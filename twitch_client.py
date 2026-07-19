"""
Obsluga Twitcha:
1) TwitchAuth  - jednorazowa autoryzacja w przegladarce (Authorization Code Flow),
   odswiezanie tokena, pobranie danych o kanale i nagrodach.
2) EventSubClient - podlaczenie do EventSub przez WebSocket i nasluchiwanie
   na alerty: nagrody za punkty kanalu, raidy, followy, suby (w tym Prime).

Wymagane scope'y:
  - channel:read:redemptions  - nagrody za punkty kanalu (podstawa programu)
  - moderator:read:followers  - alert "nowy follow"
  - user:read:chat            - alert "sub"/"sub Prime" (przez channel.chat.notification,
                                 ktore ma bezposrednie pole is_prime - jedyny pewny sposob
                                 odroznienia Prime od zwyklego platnego Tier 1)
  channel.raid nie wymaga zadnego dodatkowego scope'a.
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

SCOPES = [
    "channel:read:redemptions",
    "moderator:read:followers",
    "user:read:chat",
    "bits:read",
]
SCOPE = " ".join(SCOPES)


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
    Laczy sie do Twitch EventSub przez WebSocket, subskrybuje kilka typow
    alertow i dla kazdego woła on_alert(alert_type, user_name, extra) z
    ujednoliconymi danymi:

      alert_type="redemption"  extra={"reward_id": ..., "reward_title": ...}
      alert_type="raid"        extra={"viewers": <int>}
      alert_type="follow"      extra={}
      alert_type="sub"         extra={"tier": "1000"/"2000"/"3000", "months": <int>}
      alert_type="prime_sub"   extra={"tier": "1000", "months": <int>}
      alert_type="bits"        extra={"bits": <int>, "message": <str>}
    """

    def __init__(self, client_id, get_access_token, broadcaster_id, on_alert, on_status, log=print):
        self.client_id = client_id
        self.get_access_token = get_access_token  # callable -> zwraca aktualny access_token (moze go odswiezyc)
        self.broadcaster_id = broadcaster_id
        self.on_alert = on_alert
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
                            sub_type = msg["metadata"].get(
                                "subscription_type",
                                msg["payload"].get("subscription", {}).get("type", ""),
                            )
                            self._dispatch_notification(sub_type, event)

                        elif msg_type == "revocation":
                            self.on_status("subskrypcja cofnieta przez Twitch")
                            self.log(f"Subskrypcja cofnieta: {msg['payload']}")

            except Exception as e:
                self.on_status(f"rozlaczono ({e}), ponawiam za 5s")
                self.log(f"Blad polaczenia EventSub: {e}")
                ws_url = EVENTSUB_WS_URL
                await asyncio.sleep(5)

    def _dispatch_notification(self, sub_type: str, event: dict) -> None:
        """Zamienia surowy payload EventSub na ujednolicone wywolanie on_alert."""
        try:
            if sub_type == "channel.channel_points_custom_reward_redemption.add":
                self.on_alert("redemption", event.get("user_name", "?"), {
                    "reward_id": event["reward"]["id"],
                    "reward_title": event["reward"]["title"],
                })

            elif sub_type == "channel.raid":
                self.on_alert("raid", event.get("from_broadcaster_user_name", "?"), {
                    "viewers": event.get("viewers", 0),
                })

            elif sub_type == "channel.follow":
                self.on_alert("follow", event.get("user_name", "?"), {})

            elif sub_type == "channel.cheer":
                # Cheer moze byc anonimowy - wtedy Twitch nie podaje user_name.
                anon = event.get("is_anonymous", False)
                user_name = "Anonim" if anon else event.get("user_name", "?")
                self.on_alert("bits", user_name, {
                    "bits": event.get("bits", 0),
                    "message": event.get("message", ""),
                })

            elif sub_type == "channel.chat.notification":
                notice_type = event.get("notice_type", "")
                chatter = event.get("chatter_user_name") or event.get("chatter_user_login", "?")

                if notice_type == "sub":
                    info = event.get("sub") or {}
                    alert_type = "prime_sub" if info.get("is_prime") else "sub"
                    self.on_alert(alert_type, chatter, {
                        "tier": info.get("sub_tier", "1000"),
                        "months": 1,
                    })
                elif notice_type == "resub":
                    info = event.get("resub") or {}
                    alert_type = "prime_sub" if info.get("is_prime") else "sub"
                    self.on_alert(alert_type, chatter, {
                        "tier": info.get("sub_tier", "1000"),
                        "months": info.get("cumulative_months", 1),
                    })
                # inne notice_type (sub_gift, community_sub_gift, announcement,
                # itp.) na razie celowo ignorujemy - poza zakresem Fazy 1.

        except Exception as e:
            self.log(f"Blad przetwarzania zdarzenia '{sub_type}': {e}")

    async def _subscribe(self, session_id):
        access_token = await self.get_access_token()
        headers = {
            "Client-Id": self.client_id,
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        async with aiohttp.ClientSession() as session:
            # Nagrody za punkty kanalu - to byla pierwsza i podstawowa funkcja
            # programu, wiec jej brak od razu przerywa polaczenie (jak dawniej).
            await self._create_subscription(
                session, headers, session_id,
                "channel.channel_points_custom_reward_redemption.add", "1",
                {"broadcaster_user_id": self.broadcaster_id},
                critical=True,
            )
            # Nowsze typy alertow wymagaja scope'ow, ktorych starsze
            # autoryzacje moga nie miec - brak ktoregos z nich NIE przerywa
            # polaczenia (patrz critical=False w _create_subscription):
            # po prostu ten jeden typ alertu nie zadziala, dopoki uzytkownik
            # nie zaloguje sie ponownie (nowy token = nowe scope'y).
            await self._create_subscription(
                session, headers, session_id, "channel.raid", "1",
                {"to_broadcaster_user_id": self.broadcaster_id},
                critical=False,
            )
            await self._create_subscription(
                session, headers, session_id, "channel.follow", "2",
                {"broadcaster_user_id": self.broadcaster_id, "moderator_user_id": self.broadcaster_id},
                critical=False,
            )
            await self._create_subscription(
                session, headers, session_id, "channel.cheer", "1",
                {"broadcaster_user_id": self.broadcaster_id},
                critical=False,
            )
            await self._create_subscription(
                session, headers, session_id, "channel.chat.notification", "1",
                {"broadcaster_user_id": self.broadcaster_id, "user_id": self.broadcaster_id},
                critical=False,
            )

    async def _create_subscription(self, session, headers, session_id, sub_type, version, condition, critical):
        body = {
            "type": sub_type,
            "version": version,
            "condition": condition,
            "transport": {"method": "websocket", "session_id": session_id},
        }
        async with session.post(
            f"{TWITCH_API_BASE}/eventsub/subscriptions", headers=headers, json=body
        ) as resp:
            payload = await resp.json()
            if resp.status not in (200, 202):
                if critical:
                    raise AuthError(f"Blad subskrypcji EventSub ({sub_type}): {payload}")
                # Cicha degradacja: logujemy tylko do logu programu (nie do
                # okienka bledu), reszta alertow dziala normalnie.
                self.log(f"Alert '{sub_type}' niedostepny w tym tokenie - pomijam.")
                return
            self.log(f"Subskrypcja aktywna: {sub_type}")
