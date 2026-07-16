"""
Obsluga Twitcha:
1) TwitchAuth  - jednorazowa autoryzacja w przegladarce (Authorization Code Flow),
   odswiezanie tokena, pobranie danych o kanale i nagrodach.
2) EventSubClient - podlaczenie do EventSub przez WebSocket i nasluchiwanie
   na odebranie nagrody za punkty kanalu.

Wymagany scope: channel:read:redemptions
"""
import asyncio
import json
import secrets
import threading
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer

import aiohttp
import websockets

TWITCH_AUTH_URL = "https://id.twitch.tv/oauth2/authorize"
TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
TWITCH_API_BASE = "https://api.twitch.tv/helix"
EVENTSUB_WS_URL = "wss://eventsub.wss.twitch.tv/ws"
SCOPE = "channel:read:redemptions"


class AuthError(Exception):
    pass


def _parse_redirect_uri(redirect_uri: str):
    parsed = urllib.parse.urlparse(redirect_uri)
    host = parsed.hostname or "localhost"
    port = parsed.port or 3000
    return host, port


def run_oauth_flow(client_id: str, redirect_uri: str, log=print) -> str:
    """
    Otwiera przegladarke do logowania na Twitchu, odbiera 'code' na lokalnym
    serwerze HTTP i zwraca go. Blokujace (wywolywac w watku pobocznym).
    """
    state = secrets.token_urlsafe(16)
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": SCOPE,
        "state": state,
    }
    auth_url = f"{TWITCH_AUTH_URL}?{urllib.parse.urlencode(params)}"

    result = {"code": None, "error": None}
    done = threading.Event()

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            qs = urllib.parse.urlparse(self.path).query
            parsed_qs = urllib.parse.parse_qs(qs)
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            if "code" in parsed_qs and parsed_qs.get("state", [""])[0] == state:
                result["code"] = parsed_qs["code"][0]
                self.wfile.write(
                    "<html><body><h2>Autoryzacja OK! Mozesz zamknac te karte.</h2></body></html>".encode("utf-8")
                )
            else:
                result["error"] = parsed_qs.get("error_description", ["Nieznany blad"])[0]
                self.wfile.write(
                    f"<html><body><h2>Blad autoryzacji: {result['error']}</h2></body></html>".encode("utf-8")
                )
            done.set()

        def log_message(self, fmt, *args):
            pass  # wycisz domyslne logi http.server

    host, port = _parse_redirect_uri(redirect_uri)
    server = HTTPServer((host, port), Handler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    log(f"Otwieram przegladarke do logowania na Twitchu...")
    webbrowser.open(auth_url)

    done.wait(timeout=180)
    server.shutdown()

    if result["error"]:
        raise AuthError(result["error"])
    if not result["code"]:
        raise AuthError("Nie otrzymano kodu autoryzacji (timeout albo zamknieto okno).")
    return result["code"]


async def exchange_code_for_token(session: aiohttp.ClientSession, client_id, client_secret, code, redirect_uri):
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
    }
    async with session.post(TWITCH_TOKEN_URL, data=data) as resp:
        payload = await resp.json()
        if resp.status != 200:
            raise AuthError(f"Blad wymiany kodu na token: {payload}")
        return payload  # zawiera access_token, refresh_token, expires_in


async def refresh_access_token(session: aiohttp.ClientSession, client_id, client_secret, refresh_token):
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }
    async with session.post(TWITCH_TOKEN_URL, data=data) as resp:
        payload = await resp.json()
        if resp.status != 200:
            raise AuthError(f"Blad odswiezania tokena: {payload}")
        return payload


async def get_user_info(session: aiohttp.ClientSession, client_id, access_token):
    headers = {"Client-Id": client_id, "Authorization": f"Bearer {access_token}"}
    async with session.get(f"{TWITCH_API_BASE}/users", headers=headers) as resp:
        payload = await resp.json()
        if resp.status != 200:
            raise AuthError(f"Blad pobierania danych uzytkownika: {payload}")
        return payload["data"][0]


async def get_custom_rewards(session: aiohttp.ClientSession, client_id, access_token, broadcaster_id):
    headers = {"Client-Id": client_id, "Authorization": f"Bearer {access_token}"}
    params = {"broadcaster_id": broadcaster_id}
    async with session.get(f"{TWITCH_API_BASE}/channel_points/custom_rewards", headers=headers, params=params) as resp:
        payload = await resp.json()
        if resp.status != 200:
            raise AuthError(f"Blad pobierania nagrod (sprawdz czy masz wlaczone Channel Points): {payload}")
        return payload["data"]


async def validate_token(session: aiohttp.ClientSession, access_token: str) -> bool:
    headers = {"Authorization": f"Bearer {access_token}"}
    async with session.get("https://id.twitch.tv/oauth2/validate", headers=headers) as resp:
        return resp.status == 200


class EventSubClient:
    """
    Laczy sie do Twitch EventSub przez WebSocket, subskrybuje odbiory nagrod
    za punkty kanalu i wola on_redemption(reward_id, reward_title, user_name) dla kazdego eventu.
    """

    def __init__(self, client_id, get_access_token, broadcaster_id, on_redemption, on_status, log=print):
        self.client_id = client_id
        self.get_access_token = get_access_token  # callable -> zwraca aktualny access_token (moze go odswiezyc)
        self.broadcaster_id = broadcaster_id
        self.on_redemption = on_redemption
        self.on_status = on_status
        self.log = log
        self._stop = False

    def stop(self):
        self._stop = True

    async def run_forever(self):
        """Petla z automatycznym reconnectem, konczy sie dopiero po wywolaniu stop()."""
        ws_url = EVENTSUB_WS_URL
        while not self._stop:
            try:
                self.on_status("laczenie...")
                async with websockets.connect(ws_url, ping_interval=None) as ws:
                    async for raw in ws:
                        if self._stop:
                            break
                        msg = json.loads(raw)
                        msg_type = msg["metadata"]["message_type"]

                        if msg_type == "session_welcome":
                            session_id = msg["payload"]["session"]["id"]
                            await self._subscribe(session_id)
                            self.on_status("polaczono, czekam na eventy")

                        elif msg_type == "session_keepalive":
                            pass

                        elif msg_type == "session_reconnect":
                            ws_url = msg["payload"]["session"]["reconnect_url"]
                            self.log("Twitch prosi o reconnect na nowy adres...")
                            break  # wyjdz z petli async for, polacz sie ponownie na nowy url

                        elif msg_type == "notification":
                            event = msg["payload"]["event"]
                            self.on_redemption(
                                reward_id=event["reward"]["id"],
                                reward_title=event["reward"]["title"],
                                user_name=event.get("user_name", "?"),
                            )

                        elif msg_type == "revocation":
                            self.on_status("subskrypcja cofnieta przez Twitch")
                            self.log(f"Subskrypcja cofnieta: {msg['payload']}")

            except Exception as e:
                self.on_status(f"rozlaczono ({e}), ponawiam za 5s")
                self.log(f"Blad polaczenia EventSub: {e}")
                ws_url = EVENTSUB_WS_URL
                await asyncio.sleep(5)

    async def _subscribe(self, session_id):
        access_token = await self.get_access_token()
        headers = {
            "Client-Id": self.client_id,
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        body = {
            "type": "channel.channel_points_custom_reward_redemption.add",
            "version": "1",
            "condition": {"broadcaster_user_id": self.broadcaster_id},
            "transport": {"method": "websocket", "session_id": session_id},
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{TWITCH_API_BASE}/eventsub/subscriptions", headers=headers, json=body
            ) as resp:
                payload = await resp.json()
                if resp.status not in (200, 202):
                    raise AuthError(f"Blad subskrypcji EventSub: {payload}")
                self.log("Subskrypcja na odbior nagrod aktywna.")
