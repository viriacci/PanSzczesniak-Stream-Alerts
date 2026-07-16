"""
Nagrody Vivi - GUI (PySide6 + QFluentWidgets)

Okno w stylu Windows 11 Fluent (boczna nawigacja, Mica, zaokraglone karty).
Logika Twitcha (OAuth/EventSub) i lokalnego serwera nakladki jest w osobnych
plikach (twitch_client.py, overlay_server.py) i nie zostala tu ruszona -
ten plik odpowiada wylacznie za interfejs.
"""
import asyncio
import shutil
import socket
import sys
import threading
from pathlib import Path

import aiohttp
from PySide6.QtCore import Qt, QObject, Signal, QSize
from PySide6.QtGui import QIcon, QColor
from PySide6.QtWidgets import (
    QApplication, QWidget, QVBoxLayout, QHBoxLayout, QFormLayout,
    QFileDialog, QMessageBox, QLineEdit, QSizePolicy, QLabel,
)
from qfluentwidgets import (
    FluentWindow, FluentIcon, NavigationItemPosition,
    setTheme, Theme, setThemeColor,
    LineEdit, PrimaryPushButton, PushButton, CheckBox,
    ListWidget, TextEdit, BodyLabel, CaptionLabel, SubtitleLabel,
    CardWidget, InfoBar, InfoBarPosition,
)

import config as cfgmod
import twitch_client as tc
from overlay_server import OverlayServer

ACCENT = "#843935"


def get_lan_ip() -> str:
    """Best-effort proba znalezienia adresu IP w sieci lokalnej (bez laczenia sie donikad)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


class AsyncLoopThread:
    """Trzyma jedna petle asyncio dzialajaca w tle przez caly czas zycia programu."""

    def __init__(self):
        self.loop = asyncio.new_event_loop()
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def _run(self):
        asyncio.set_event_loop(self.loop)
        self.loop.run_forever()

    def run(self, coro):
        """Odpal coroutine z watku GUI na petli w tle. Zwraca concurrent.futures.Future."""
        return asyncio.run_coroutine_threadsafe(coro, self.loop)


class Bridge(QObject):
    """
    Sygnaly Qt sa bezpieczne miedzy watkami (auto-queued), wiec caly kod
    dzialajacy w tle (autoryzacja, EventSub, serwer nakladki) komunikuje
    sie z GUI wylacznie przez ten obiekt - bez recznego marshalowania.
    """
    log = Signal(str)
    auth_status = Signal(str, bool)          # tekst, czy zalogowano (kolor)
    rewards_fetched = Signal(list)           # lista dict-ow z Twitch API
    engine_status = Signal(bool, str)        # czy dziala, adres nakladki
    error = Signal(str, str)                 # tytul, tresc


class SetupInterface(QWidget):
    def __init__(self, app: "MainWindow"):
        super().__init__()
        self.setObjectName("SetupInterface")
        self.app = app
        cfg = app.cfg

        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)

        layout.addWidget(SubtitleLabel("Autoryzacja"))

        card = CardWidget()
        form = QFormLayout(card)
        form.setContentsMargins(20, 20, 20, 20)
        form.setSpacing(12)
        form.setFieldGrowthPolicy(QFormLayout.AllNonFixedFieldsGrow)

        self.client_id_edit = LineEdit()
        self.client_id_edit.setText(cfg.get("client_id", ""))
        self.client_id_edit.setPlaceholderText("Client ID z dev.twitch.tv/console")
        form.addRow("Client ID:", self.client_id_edit)

        self.client_secret_edit = LineEdit()
        self.client_secret_edit.setText(cfg.get("client_secret", ""))
        self.client_secret_edit.setEchoMode(QLineEdit.Password)
        self.client_secret_edit.setPlaceholderText("Client Secret")
        form.addRow("Client Secret:", self.client_secret_edit)

        self.redirect_uri_edit = LineEdit()
        self.redirect_uri_edit.setText(cfg.get("redirect_uri", "http://localhost:3000"))
        form.addRow("Redirect URI:", self.redirect_uri_edit)

        layout.addWidget(card)

        info = CaptionLabel(
            "Redirect URI musi byc dokladnie taki sam jak w ustawieniach aplikacji "
            "na dev.twitch.tv/console (np. http://localhost:3000)."
        )
        info.setWordWrap(True)
        layout.addWidget(info)

        self.authorize_button = PrimaryPushButton(FluentIcon.LINK, "Zapisz i autoryzuj w przegladarce")
        self.authorize_button.clicked.connect(self.on_authorize)
        layout.addWidget(self.authorize_button, alignment=Qt.AlignLeft)

        self.status_label = BodyLabel("Status: nie zalogowano")
        self.status_label.setWordWrap(True)
        layout.addWidget(self.status_label)
        if cfg.get("access_token"):
            self.status_label.setText(f"Status: zalogowano jako {cfg.get('broadcaster_login', '?')}")

        layout.addStretch(1)

        app.bridge.auth_status.connect(self.on_auth_status)

    def on_auth_status(self, text: str, _ok: bool):
        self.status_label.setText(text)

    def on_authorize(self):
        client_id = self.client_id_edit.text().strip()
        client_secret = self.client_secret_edit.text().strip()
        redirect_uri = self.redirect_uri_edit.text().strip()
        if not client_id or not client_secret:
            QMessageBox.critical(self, "Brak danych", "Podaj Client ID i Client Secret.")
            return

        self.app.cfg["client_id"] = client_id
        self.app.cfg["client_secret"] = client_secret
        self.app.cfg["redirect_uri"] = redirect_uri
        cfgmod.save_config(self.app.cfg)

        threading.Thread(
            target=self.app.authorize_flow, args=(client_id, client_secret, redirect_uri), daemon=True
        ).start()


class RewardsInterface(QWidget):
    def __init__(self, app: "MainWindow"):
        super().__init__()
        self.setObjectName("RewardsInterface")
        self.app = app
        self.rewards_cache = {}
        self.selected_reward_id = None
        self.selected_gif_path = ""
        self.selected_sound_path = ""

        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)

        top_row = QHBoxLayout()
        top_row.addWidget(SubtitleLabel("Nagrody"))
        top_row.addStretch(1)
        self.refresh_button = PushButton(FluentIcon.SYNC, "Odswiez liste nagrod")
        self.refresh_button.clicked.connect(self.on_fetch_rewards)
        top_row.addWidget(self.refresh_button)
        layout.addLayout(top_row)

        self.rewards_list = ListWidget()
        self.rewards_list.setMinimumHeight(160)
        self.rewards_list.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        self.rewards_list.currentRowChanged.connect(self.on_select_reward)
        layout.addWidget(self.rewards_list)

        card = CardWidget()
        form = QFormLayout(card)
        form.setContentsMargins(20, 20, 20, 20)
        form.setSpacing(12)
        form.setFieldGrowthPolicy(QFormLayout.AllNonFixedFieldsGrow)

        gif_row = QHBoxLayout()
        self.gif_label = CaptionLabel("(nie wybrano)")
        self.gif_label.setWordWrap(True)
        gif_btn = PushButton(FluentIcon.PHOTO, "Wybierz GIF...")
        gif_btn.clicked.connect(self.on_pick_gif)
        gif_row.addWidget(self.gif_label, 1)
        gif_row.addWidget(gif_btn)
        form.addRow("GIF:", gif_row)

        sound_row = QHBoxLayout()
        self.sound_label = CaptionLabel("(nie wybrano)")
        self.sound_label.setWordWrap(True)
        sound_btn = PushButton(FluentIcon.VOLUME, "Wybierz dzwiek...")
        sound_btn.clicked.connect(self.on_pick_sound)
        sound_row.addWidget(self.sound_label, 1)
        sound_row.addWidget(sound_btn)
        form.addRow("Dzwiek:", sound_row)

        self.duration_edit = LineEdit()
        self.duration_edit.setText(str(app.cfg.get("default_duration_seconds", 5)))
        self.duration_edit.setFixedWidth(80)
        form.addRow("Czas wyswietlania (s):", self.duration_edit)

        layout.addWidget(card)

        self.save_button = PrimaryPushButton(FluentIcon.SAVE, "Zapisz przypisanie dla wybranej nagrody")
        self.save_button.clicked.connect(self.on_save_mapping)
        layout.addWidget(self.save_button, alignment=Qt.AlignLeft)

        app.bridge.rewards_fetched.connect(self.on_rewards_fetched)

    def on_fetch_rewards(self):
        cfg = self.app.cfg
        if not cfg.get("access_token") or not cfg.get("broadcaster_id"):
            QMessageBox.critical(self, "Brak autoryzacji", "Najpierw autoryzuj sie w zakladce Autoryzacja.")
            return
        threading.Thread(target=self._fetch_rewards_thread, daemon=True).start()

    def _fetch_rewards_thread(self):
        try:
            async def do_fetch():
                token = await self.app.get_valid_access_token()
                async with aiohttp.ClientSession() as session:
                    return await tc.get_custom_rewards(
                        session, self.app.cfg["client_id"], token, self.app.cfg["broadcaster_id"]
                    )

            rewards = self.app.async_loop.run(do_fetch()).result(timeout=30)
            self.app.bridge.rewards_fetched.emit(rewards)
        except Exception as e:
            self.app.bridge.log.emit(f"Blad pobierania nagrod: {e}")
            self.app.bridge.error.emit("Blad pobierania nagrod", str(e))

    def on_rewards_fetched(self, rewards: list):
        self.rewards_list.clear()
        self.rewards_cache = {}
        for r in rewards:
            self.rewards_cache[r["id"]] = r
            self.rewards_list.addItem(f"{r['title']}  ({r['cost']} pkt)")
        self.app.bridge.log.emit(f"Pobrano {len(rewards)} nagrod.")

    def on_select_reward(self, row: int):
        if row < 0 or row >= len(self.rewards_cache):
            return
        reward_id = list(self.rewards_cache.keys())[row]
        self.selected_reward_id = reward_id
        mapping = self.app.cfg["rewards"].get(reward_id, {})
        self.selected_gif_path = mapping.get("gif_source", "")
        self.selected_sound_path = mapping.get("sound_source", "")
        self.gif_label.setText(Path(self.selected_gif_path).name if self.selected_gif_path else "(nie wybrano)")
        self.sound_label.setText(Path(self.selected_sound_path).name if self.selected_sound_path else "(nie wybrano)")
        self.duration_edit.setText(str(mapping.get("duration", self.app.cfg.get("default_duration_seconds", 5))))

    def on_pick_gif(self):
        path, _ = QFileDialog.getOpenFileName(self, "Wybierz GIF", "", "Obrazy (*.gif *.png *.webp);;Wszystkie pliki (*.*)")
        if path:
            self.selected_gif_path = path
            self.gif_label.setText(Path(path).name)

    def on_pick_sound(self):
        path, _ = QFileDialog.getOpenFileName(self, "Wybierz dzwiek", "", "Dzwiek (*.mp3 *.wav *.ogg);;Wszystkie pliki (*.*)")
        if path:
            self.selected_sound_path = path
            self.sound_label.setText(Path(path).name)

    def on_save_mapping(self):
        if not self.selected_reward_id:
            QMessageBox.critical(self, "Brak wyboru", "Zaznacz nagrode z listy.")
            return
        try:
            duration = float(self.duration_edit.text())
        except ValueError:
            duration = self.app.cfg.get("default_duration_seconds", 5)

        reward_id = self.selected_reward_id
        media = cfgmod.media_dir()
        gif_url = ""
        sound_url = ""
        if self.selected_gif_path:
            dest = media / f"{reward_id}_gif{Path(self.selected_gif_path).suffix}"
            shutil.copyfile(self.selected_gif_path, dest)
            gif_url = f"media/{dest.name}"
        if self.selected_sound_path:
            dest = media / f"{reward_id}_sound{Path(self.selected_sound_path).suffix}"
            shutil.copyfile(self.selected_sound_path, dest)
            sound_url = f"media/{dest.name}"

        title = self.rewards_cache.get(reward_id, {}).get("title", reward_id)
        self.app.cfg["rewards"][reward_id] = {
            "title": title,
            "gif_source": self.selected_gif_path,
            "sound_source": self.selected_sound_path,
            "gif_url": gif_url,
            "sound_url": sound_url,
            "duration": duration,
        }
        cfgmod.save_config(self.app.cfg)
        self.app.bridge.log.emit(f"Zapisano przypisanie dla nagrody: {title}")
        InfoBar.success("Zapisano", f"Przypisano GIF/dzwiek do: {title}", parent=self, position=InfoBarPosition.TOP, duration=2500)


class ControlInterface(QWidget):
    def __init__(self, app: "MainWindow"):
        super().__init__()
        self.setObjectName("ControlInterface")
        self.app = app

        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)

        layout.addWidget(SubtitleLabel("Uruchomienie"))

        self.lan_checkbox = CheckBox("Zezwol na dostep z sieci LAN (gdy OBS jest na innym komputerze)")
        self.lan_checkbox.setChecked(app.cfg.get("lan_access", False))
        layout.addWidget(self.lan_checkbox)

        url_card = CardWidget()
        url_layout = QVBoxLayout(url_card)
        url_layout.setContentsMargins(20, 16, 20, 16)
        url_layout.setSpacing(8)
        url_layout.addWidget(CaptionLabel("Adres nakladki dla OBS (Browser Source -> URL):"))

        url_row = QHBoxLayout()
        self.url_edit = LineEdit()
        self.url_edit.setText("uruchom program, zeby zobaczyc")
        self.url_edit.setReadOnly(True)
        self.url_edit.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)
        copy_btn = PushButton(FluentIcon.COPY, "Kopiuj")
        copy_btn.clicked.connect(self.on_copy_url)
        url_row.addWidget(self.url_edit, 1)
        url_row.addWidget(copy_btn)
        url_layout.addLayout(url_row)
        layout.addWidget(url_card)

        button_row = QHBoxLayout()
        self.start_button = PrimaryPushButton(FluentIcon.PLAY, "Uruchom")
        self.start_button.clicked.connect(self.on_start)
        self.stop_button = PushButton(FluentIcon.PAUSE, "Zatrzymaj")
        self.stop_button.setEnabled(False)
        self.stop_button.clicked.connect(self.on_stop)
        button_row.addWidget(self.start_button)
        button_row.addWidget(self.stop_button)
        button_row.addStretch(1)
        layout.addLayout(button_row)

        self.status_label = BodyLabel("Status silnika: zatrzymany")
        layout.addWidget(self.status_label)

        layout.addWidget(SubtitleLabel("Log"))
        self.log_text = TextEdit()
        self.log_text.setReadOnly(True)
        self.log_text.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        layout.addWidget(self.log_text, 1)

        app.bridge.log.connect(self.on_log)
        app.bridge.engine_status.connect(self.on_engine_status)

    def on_copy_url(self):
        QApplication.clipboard().setText(self.url_edit.text())
        self.app.bridge.log.emit("Skopiowano adres nakladki do schowka.")

    def on_log(self, msg: str):
        self.log_text.append(msg)

    def on_start(self):
        app = self.app
        cfg = app.cfg
        if app.engine_running:
            return
        if not cfg.get("access_token") or not cfg.get("broadcaster_id"):
            QMessageBox.critical(self, "Brak autoryzacji", "Najpierw autoryzuj sie w zakladce Autoryzacja.")
            return
        if not cfg["rewards"]:
            reply = QMessageBox.question(
                self, "Brak przypisan",
                "Nie przypisales GIF/dzwiekow do zadnej nagrody. Uruchomic mimo to?",
            )
            if reply != QMessageBox.Yes:
                return

        cfg["lan_access"] = self.lan_checkbox.isChecked()
        cfgmod.save_config(cfg)

        app.async_loop.run(app.start_engine_async())
        app.engine_running = True
        self.start_button.setEnabled(False)
        self.stop_button.setEnabled(True)

        host_for_obs = get_lan_ip() if self.lan_checkbox.isChecked() else "127.0.0.1"
        url = f"http://{host_for_obs}:{cfg['overlay_http_port']}/overlay.html"
        self.url_edit.setText(url)
        self.status_label.setText("Status silnika: dziala")

    def on_stop(self):
        app = self.app
        if not app.engine_running:
            return
        if app.eventsub_client:
            app.eventsub_client.stop()
        if app.overlay_server:
            app.async_loop.run(app.overlay_server.stop())
        app.engine_running = False
        self.start_button.setEnabled(True)
        self.stop_button.setEnabled(False)
        self.status_label.setText("Status silnika: zatrzymany")
        self.app.bridge.log.emit("Zatrzymano silnik.")

    def on_engine_status(self, running: bool, _url: str):
        pass


class MainWindow(FluentWindow):
    WATERMARK_TEXT = "PanSzczesniak Development"

    def __init__(self):
        super().__init__()
        self.cfg = cfgmod.load_config()
        self.async_loop = AsyncLoopThread()
        self.bridge = Bridge()

        self.overlay_server: OverlayServer | None = None
        self.eventsub_client: tc.EventSubClient | None = None
        self.engine_running = False

        self.setWindowTitle("Nagrody Vivi")
        self.resize(880, 640)
        self.setMinimumSize(560, 420)

        icon_path = cfgmod.base_dir() / "icon.png"
        if icon_path.exists():
            self.setWindowIcon(QIcon(str(icon_path)))

        try:
            self.setMicaEffectEnabled(True)
        except Exception:
            pass  # dziala tylko na Win11 - na innych systemach po prostu zostaje plaskie tlo

        self.setup_interface = SetupInterface(self)
        self.rewards_interface = RewardsInterface(self)
        self.control_interface = ControlInterface(self)

        self.addSubInterface(self.setup_interface, FluentIcon.CERTIFICATE, "Autoryzacja")
        self.addSubInterface(self.rewards_interface, FluentIcon.GAME, "Nagrody")
        self.addSubInterface(self.control_interface, FluentIcon.PLAY, "Uruchomienie", NavigationItemPosition.BOTTOM)

        self.watermark = QLabel(self.WATERMARK_TEXT, self)
        self.watermark.setStyleSheet("color: rgba(128, 128, 128, 140); font-size: 11px; background: transparent;")
        self.watermark.adjustSize()
        self.watermark.raise_()

        self.bridge.log.connect(self._log_stdout)
        self.bridge.error.connect(lambda title, msg: QMessageBox.critical(self, title, msg))

        self._log(f"Config: {cfgmod.config_path()}")
        if self.cfg.get("access_token") and self.cfg.get("broadcaster_id"):
            self._log("Znaleziono zapisana autoryzacje - mozesz od razu odswiezyc liste nagrod i uruchomic.")

    def resizeEvent(self, event):
        super().resizeEvent(event)
        margin = 10
        self.watermark.move(self.width() - self.watermark.width() - margin,
                             self.height() - self.watermark.height() - margin)
        self.watermark.raise_()

    def _log(self, msg: str):
        self.bridge.log.emit(msg)

    def _log_stdout(self, msg: str):
        pass  # log.emit trafia tez do ControlInterface.on_log, ktory dopisuje do widgetu

    # ------------------------------------------------------- autoryzacja

    def authorize_flow(self, client_id, client_secret, redirect_uri):
        try:
            self._log("Czekam na autoryzacje w przegladarce (masz 3 minuty)...")
            code = tc.run_oauth_flow(client_id, redirect_uri, log=self._log)

            async def do_exchange():
                async with aiohttp.ClientSession() as session:
                    token_payload = await tc.exchange_code_for_token(session, client_id, client_secret, code, redirect_uri)
                    user = await tc.get_user_info(session, client_id, token_payload["access_token"])
                    return token_payload, user

            token_payload, user = self.async_loop.run(do_exchange()).result(timeout=30)

            self.cfg["access_token"] = token_payload["access_token"]
            self.cfg["refresh_token"] = token_payload["refresh_token"]
            self.cfg["broadcaster_id"] = user["id"]
            self.cfg["broadcaster_login"] = user["login"]
            cfgmod.save_config(self.cfg)

            self._log(f"Zalogowano jako {user['login']}.")
            self.bridge.auth_status.emit(f"Status: zalogowano jako {user['login']}", True)
        except Exception as e:
            self._log(f"Blad autoryzacji: {e}")
            self.bridge.error.emit("Blad autoryzacji", str(e))

    async def get_valid_access_token(self):
        """Zwraca dzialajacy access_token, odswiezajac go jesli wygasl."""
        async with aiohttp.ClientSession() as session:
            ok = await tc.validate_token(session, self.cfg["access_token"])
            if ok:
                return self.cfg["access_token"]
            self._log("Token wygasl, odswiezam...")
            payload = await tc.refresh_access_token(
                session, self.cfg["client_id"], self.cfg["client_secret"], self.cfg["refresh_token"]
            )
            self.cfg["access_token"] = payload["access_token"]
            self.cfg["refresh_token"] = payload.get("refresh_token", self.cfg["refresh_token"])
            cfgmod.save_config(self.cfg)
            return self.cfg["access_token"]

    # -------------------------------------------------------------- silnik

    async def start_engine_async(self):
        base_dir = cfgmod.base_dir()
        self.overlay_server = OverlayServer(
            base_dir=base_dir,
            ws_port=self.cfg["overlay_ws_port"],
            http_port=self.cfg["overlay_http_port"],
            bind_lan=self.control_interface.lan_checkbox.isChecked(),
            log=self._log,
        )
        await self.overlay_server.start()

        def handle_redemption(reward_id, reward_title, user_name):
            self._log(f"Odebrano nagrode: {reward_title} (od {user_name})")
            mapping = self.cfg["rewards"].get(reward_id)
            if not mapping:
                self._log(f"(brak przypisanego GIF/dzwieku dla '{reward_title}' - pomijam)")
                return
            asyncio.run_coroutine_threadsafe(
                self.overlay_server.broadcast_redemption(
                    gif_url=mapping.get("gif_url", ""),
                    sound_url=mapping.get("sound_url", ""),
                    duration=mapping.get("duration", 5),
                    title=reward_title,
                    user_name=user_name,
                ),
                self.async_loop.loop,
            )

        self.eventsub_client = tc.EventSubClient(
            client_id=self.cfg["client_id"],
            get_access_token=self.get_valid_access_token,
            broadcaster_id=self.cfg["broadcaster_id"],
            on_redemption=handle_redemption,
            on_status=lambda s: self._log(f"[Twitch] {s}"),
            log=self._log,
        )
        asyncio.ensure_future(self.eventsub_client.run_forever(), loop=self.async_loop.loop)


def main():
    QApplication.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )
    app = QApplication(sys.argv)
    setTheme(Theme.AUTO)
    setThemeColor(ACCENT)

    window = MainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
