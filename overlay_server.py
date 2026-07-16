"""
Lokalny serwer dla nakladki (overlay) w OBS:
- HTTP: serwuje overlay.html i pliki z folderu media/ (zeby OBS Browser Source mogl je wczytac)
- WebSocket: broadcastuje info "pokaz GIF X + zagraj dzwiek Y" do wszystkich podlaczonych nakladek
"""
import asyncio
import json
import mimetypes
from pathlib import Path

import websockets
from aiohttp import web


class OverlayServer:
    def __init__(self, base_dir: Path, ws_port: int, http_port: int, bind_lan: bool, log=print):
        self.base_dir = base_dir
        self.ws_port = ws_port
        self.http_port = http_port
        self.bind_host = "0.0.0.0" if bind_lan else "127.0.0.1"
        self.log = log
        self._clients = set()
        self._ws_server = None
        self._http_runner = None

    async def start(self):
        # --- WebSocket ---
        async def handler(ws):
            self._clients.add(ws)
            self.log("Nakladka podlaczona do WebSocketu.")
            try:
                async for _ in ws:
                    pass  # nakladka nic do nas nie wysyla, tylko odbiera
            finally:
                self._clients.discard(ws)

        self._ws_server = await websockets.serve(handler, self.bind_host, self.ws_port)

        # --- HTTP (statyczne pliki: overlay.html, media/) ---
        app = web.Application()
        app.router.add_get("/overlay.html", self._serve_overlay_html)
        app.router.add_get("/media/{filename}", self._serve_media)
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, self.bind_host, self.http_port)
        await site.start()
        self._http_runner = runner

        self.log(f"Serwer nakladki dziala: http://{self.bind_host}:{self.http_port}/overlay.html")

    async def stop(self):
        if self._ws_server:
            self._ws_server.close()
            await self._ws_server.wait_closed()
        if self._http_runner:
            await self._http_runner.cleanup()

    async def _serve_overlay_html(self, request):
        path = self.base_dir / "overlay.html"
        return web.FileResponse(path)

    async def _serve_media(self, request):
        filename = request.match_info["filename"]
        path = self.base_dir / "media" / filename
        if not path.exists():
            return web.Response(status=404, text="not found")
        content_type, _ = mimetypes.guess_type(str(path))
        return web.FileResponse(path, headers={"Content-Type": content_type or "application/octet-stream"})

    async def broadcast_redemption(self, gif_url: str, sound_url: str, duration: float, title: str, user_name: str = ""):
        if not self._clients:
            self.log("Uwaga: nikt nie jest podlaczony do nakladki (dodaj Browser Source w OBS).")
            return
        message = json.dumps({
            "type": "redeem",
            "gif": gif_url,
            "sound": sound_url,
            "duration": duration,
            "title": title,
            "user": user_name,
        })
        stale = set()
        for ws in self._clients:
            try:
                await ws.send(message)
            except Exception:
                stale.add(ws)
        self._clients -= stale
