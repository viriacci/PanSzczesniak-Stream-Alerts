"""
Nagrody Shiroe - GUI (PySide6 + QFluentWidgets)

Okno w stylu Windows 11 Fluent. Główny kolor: #5c4f47, Akcent: #d4b499.
"""
import asyncio
import shutil
import socket
import sys
import threading
from pathlib import Path

import aiohttp
from PySide6.QtCore import Qt, QObject, Signal, QTimer
from PySide6.QtGui import QIcon, QColor
from PySide6.QtWidgets import (
    QApplication, QWidget, QVBoxLayout, QHBoxLayout, QFormLayout,
    QFileDialog, QMessageBox, QLineEdit, QSizePolicy, QLabel, QListWidgetItem,
)
from qfluentwidgets import (
    FluentWindow, FluentIcon, NavigationItemPosition,
    setTheme, Theme, setThemeColor,
    LineEdit, PrimaryPushButton, PushButton, CheckBox,
    ListWidget, TextEdit, BodyLabel, CaptionLabel, SubtitleLabel,
    CardWidget, InfoBar, InfoBarPosition,
    TeachingTip, TeachingTipTailPosition
)

import config as cfgmod
import twitch_client as tc
from overlay_server import OverlayServer
from instruction_interface import InstructionInterface

# Główna paleta barw Shiroe
ACCENT = "#d4b499"


def get_lan_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


class AsyncLoopThread:
    def __init__(self):
        self.loop = asyncio.new_event_loop()
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def _run(self):
        asyncio.set_event_loop(self.loop)
        self.loop.run_forever()

    def run(self, coro):
        return asyncio.run_coroutine_threadsafe(coro, self.loop)


class Bridge(QObject):
    log = Signal(str)
    auth_status = Signal(str, bool)
    rewards_fetched = Signal(list)
    engine_status = Signal(bool, str)
    error = Signal(str, str)


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
        
        self.client_id_edit = LineEdit()
        self.client_id_edit.setText(cfg.get("client_id", ""))
        form.addRow(BodyLabel("Client ID:"), self.client_id_edit)

        self.client_secret_edit = LineEdit()
        self.client_secret_edit.setText(cfg.get("client_secret", ""))
        self.client_secret_edit.setEchoMode(QLineEdit.Password)
        form.addRow(BodyLabel("Client Secret:"), self.client_secret_edit)

        self.redirect_url_edit = LineEdit()
        self.redirect_url_edit.setText(cfg.get("redirect_uri", "http://localhost:3000"))
        form.addRow(BodyLabel("Redirect URL:"), self.redirect_url_edit)
        layout.addWidget(card)

        self.authorize_button = PrimaryPushButton(FluentIcon.LINK, "Zapisz i autoryzuj")
        self.authorize_button.clicked.connect(self.on_authorize)
        layout.addWidget(self.authorize_button)

        self.status_label = BodyLabel("Status: nie zalogowano")
        layout.addWidget(self.status_label)
        layout.addStretch(1)

    def on_authorize(self):
        self.app.cfg["client_id"] = self.client_id_edit.text()
        self.app.cfg["client_secret"] = self.client_secret_edit.text()
        self.app.cfg["redirect_uri"] = self.redirect_url_edit.text()
        cfgmod.save_config(self.app.cfg)
        threading.Thread(target=self.app.authorize_flow, args=(self.client_id_edit.text(), self.client_secret_edit.text(), self.redirect_url_edit.text()), daemon=True).start()


class RewardsInterface(QWidget):
    def __init__(self, app: "MainWindow"):
        super().__init__()
        self.setObjectName("RewardsInterface")
        self.app = app
        layout = QVBoxLayout(self)
        self.rewards_list = ListWidget()
        layout.addWidget(self.rewards_list)
        self.refresh_button = PushButton("Odśwież nagrody")
        self.refresh_button.clicked.connect(self.app.bridge.rewards_fetched.emit) # Przykład
        layout.addWidget(self.refresh_button)


class ControlInterface(QWidget):
    def __init__(self, app: "MainWindow"):
        super().__init__()
        self.setObjectName("ControlInterface")
        self.app = app
        layout = QVBoxLayout(self)
        self.start_button = PrimaryPushButton("Uruchom")
        layout.addWidget(self.start_button)


class MainWindow(FluentWindow):
    def __init__(self):
        super().__init__()
        self.cfg = cfgmod.load_config()
        self.async_loop = AsyncLoopThread()
        self.bridge = Bridge()
        self.engine_running = False

        self.setWindowTitle("Nagrody Shiroe")
        self.resize(880, 640)

        self.setup_interface = SetupInterface(self)
        self.rewards_interface = RewardsInterface(self)
        self.control_interface = ControlInterface(self)
        self.instruction_interface = InstructionInterface(self)

        self.addSubInterface(self.setup_interface, FluentIcon.CERTIFICATE, "Autoryzacja")
        self.addSubInterface(self.rewards_interface, FluentIcon.GAME, "Nagrody")
        self.addSubInterface(self.control_interface, FluentIcon.PLAY, "Uruchomienie", NavigationItemPosition.BOTTOM)
        self.addSubInterface(self.instruction_interface, FluentIcon.QUESTION, "Instrukcja (?)", NavigationItemPosition.BOTTOM)

        QTimer.singleShot(1000, self.show_instruction_tip)

    def show_instruction_tip(self):
        if not self.cfg.get("instructions_completed", False):
            target = self.navigationInterface.widget("InstructionInterface")
            if target:
                TeachingTip.create(
                    target=target,
                    title="Wskazówka",
                    content="Przeczytaj instrukcję!",
                    duration=-1,
                    tailPosition=TeachingTipTailPosition.LEFT,
                    parent=self
                )

    def authorize_flow(self, client_id, client_secret, redirect_uri):
        self.bridge.auth_status.emit("Autoryzuję...", True)

def main():
    app = QApplication(sys.argv)
    setTheme(Theme.DARK)
    setThemeColor("#5c4f47") # Baza
    setThemeColor(ACCENT)    # Akcent
    window = MainWindow()
    window.show()
    sys.exit(app.exec())

if __name__ == "__main__":
    main()