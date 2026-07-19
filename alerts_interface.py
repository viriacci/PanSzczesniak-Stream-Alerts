"""
Zakladka "Alerty": wlaczanie/wylaczanie i przypisywanie obrazu/GIF-a oraz
dzwieku dla alertow innych niz nagrody za punkty kanalu (raid, follow,
sub, sub Prime).

W przeciwienstwie do zakladki Nagrody nie ma tu listy do pobrania z Twitcha -
Twitch nie udostepnia listy "dostepnych raidow/followow/subow" przez API,
wiec kazdy z tych czterech typow ma po prostu jedno, stale przypisanie
(gif/dzwiek/czas), wlaczane osobnym checkboxem.
"""
import shutil
from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QFormLayout, QFileDialog,
    QSizePolicy, QScrollArea,
)
from qfluentwidgets import (
    CheckBox, LineEdit, PrimaryPushButton, PushButton, BodyLabel,
    CaptionLabel, SubtitleLabel, CardWidget, InfoBar, InfoBarPosition,
)

import config as cfgmod

# Wspolny wyglad paska przewijania (zaokraglony, przezroczysty, w kolorach
# marki) - taki sam jak w zakladce Instrukcja, dla spojnosci.
SCROLLBAR_QSS = """
    QScrollArea { background: transparent; border: none; }
    QScrollBar:vertical {
        background: transparent;
        width: 10px;
        margin: 2px 0px 2px 0px;
    }
    QScrollBar::handle:vertical {
        background: rgba(227, 192, 72, 120);
        border-radius: 5px;
        min-height: 24px;
    }
    QScrollBar::handle:vertical:hover {
        background: rgba(67, 251, 255, 160);
    }
    QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
        height: 0px;
        background: transparent;
    }
    QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {
        background: transparent;
    }
"""

# (klucz w config["alerts"], etykieta widoczna w programie)
ALERT_TYPES = [
    ("raid", "Raid"),
    ("follow", "Nowy follow"),
    ("sub", "Nowa subskrypcja"),
    ("prime_sub", "Subskrypcja Prime"),
    ("bits", "Bity (Cheer)"),
]


class _AlertCard(CardWidget):
    """Jedna karta = jeden typ alertu (np. Raid): checkbox wlacz/wylacz,
    wybor obrazu/GIF-a i dzwieku, czas wyswietlania, zapis."""

    def __init__(self, app: "MainWindow", alert_key: str, title: str):
        super().__init__()
        self.app = app
        self.alert_key = alert_key

        mapping = app.cfg.setdefault("alerts", {}).get(alert_key, {})
        self.selected_gif_path = mapping.get("gif_source", "")
        self.selected_sound_path = mapping.get("sound_source", "")

        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 16, 20, 16)
        layout.setSpacing(10)

        top_row = QHBoxLayout()
        top_row.addWidget(SubtitleLabel(title))
        top_row.addStretch(1)
        self.enabled_checkbox = CheckBox("Wlaczony")
        self.enabled_checkbox.setChecked(mapping.get("enabled", False))
        top_row.addWidget(self.enabled_checkbox)
        layout.addLayout(top_row)

        form = QFormLayout()
        form.setSpacing(10)
        form.setFieldGrowthPolicy(QFormLayout.AllNonFixedFieldsGrow)

        gif_row = QHBoxLayout()
        self.gif_label = CaptionLabel(
            Path(self.selected_gif_path).name if self.selected_gif_path else "(nie wybrano)"
        )
        self.gif_label.setWordWrap(True)
        gif_btn = PushButton("Wybierz obraz/GIF...")
        gif_btn.clicked.connect(self.on_pick_gif)
        gif_row.addWidget(self.gif_label, 1)
        gif_row.addWidget(gif_btn)
        form.addRow(BodyLabel("Obraz/GIF:"), gif_row)

        sound_row = QHBoxLayout()
        self.sound_label = CaptionLabel(
            Path(self.selected_sound_path).name if self.selected_sound_path else "(nie wybrano)"
        )
        self.sound_label.setWordWrap(True)
        sound_btn = PushButton("Wybierz dzwiek...")
        sound_btn.clicked.connect(self.on_pick_sound)
        sound_row.addWidget(self.sound_label, 1)
        sound_row.addWidget(sound_btn)
        form.addRow(BodyLabel("Dzwiek:"), sound_row)

        self.duration_edit = LineEdit()
        self.duration_edit.setText(str(mapping.get("duration", app.cfg.get("default_duration_seconds", 5))))
        self.duration_edit.setFixedWidth(80)
        form.addRow(BodyLabel("Czas wyswietlania (s):"), self.duration_edit)

        layout.addLayout(form)

        self.save_button = PrimaryPushButton("Zapisz")
        self.save_button.clicked.connect(self.on_save)
        layout.addWidget(self.save_button, alignment=Qt.AlignLeft)

    def on_pick_gif(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "Wybierz obraz lub GIF", "",
            "Obrazy (*.gif *.png *.jpg *.jpeg *.webp);;Wszystkie pliki (*.*)"
        )
        if path:
            self.selected_gif_path = path
            self.gif_label.setText(Path(path).name)

    def on_pick_sound(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "Wybierz dzwiek", "", "Dzwiek (*.mp3 *.wav *.ogg);;Wszystkie pliki (*.*)"
        )
        if path:
            self.selected_sound_path = path
            self.sound_label.setText(Path(path).name)

    def on_save(self):
        try:
            duration = float(self.duration_edit.text())
        except ValueError:
            duration = self.app.cfg.get("default_duration_seconds", 5)

        media = cfgmod.media_dir()
        existing = self.app.cfg["alerts"].get(self.alert_key, {})
        gif_url = existing.get("gif_url", "")
        sound_url = existing.get("sound_url", "")

        # Kopiujemy plik do media/ tylko jesli user faktycznie wybral nowy -
        # jesli sciezka sie nie zmienila, zostawiamy juz zapisany gif_url/sound_url.
        if self.selected_gif_path and self.selected_gif_path != existing.get("gif_source", ""):
            dest = media / f"alert_{self.alert_key}_gif{Path(self.selected_gif_path).suffix}"
            shutil.copyfile(self.selected_gif_path, dest)
            gif_url = f"media/{dest.name}"
        if self.selected_sound_path and self.selected_sound_path != existing.get("sound_source", ""):
            dest = media / f"alert_{self.alert_key}_sound{Path(self.selected_sound_path).suffix}"
            shutil.copyfile(self.selected_sound_path, dest)
            sound_url = f"media/{dest.name}"

        self.app.cfg["alerts"][self.alert_key] = {
            "enabled": self.enabled_checkbox.isChecked(),
            "gif_source": self.selected_gif_path,
            "sound_source": self.selected_sound_path,
            "gif_url": gif_url,
            "sound_url": sound_url,
            "duration": duration,
        }
        cfgmod.save_config(self.app.cfg)
        InfoBar.success(
            "Zapisano", "Ustawienia alertu zapisane.",
            parent=self, position=InfoBarPosition.TOP, duration=2000,
        )


class AlertsInterface(QWidget):
    def __init__(self, app: "MainWindow"):
        super().__init__()
        self.setObjectName("AlertsInterface")
        self.app = app
        self.setStyleSheet("background: transparent;")

        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)

        layout.addWidget(SubtitleLabel("Alerty"))

        info = CaptionLabel(
            "Raid, follow i sub dzialaja niezaleznie od nagrod za punkty kanalu - "
            "wlacz te, ktore Cie interesuja, i przypisz obraz/GIF oraz dzwiek."
        )
        info.setWordWrap(True)
        layout.addWidget(info)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QScrollArea.NoFrame)
        scroll.setStyleSheet("QScrollArea { background: transparent; border: none; }")
        scroll.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        container = QWidget()
        container.setStyleSheet("background: transparent;")
        cards_layout = QVBoxLayout(container)
        cards_layout.setContentsMargins(0, 0, 0, 4)
        cards_layout.setSpacing(12)

        for key, title in ALERT_TYPES:
            cards_layout.addWidget(_AlertCard(app, key, title))

        cards_layout.addStretch(1)
        scroll.setWidget(container)
        layout.addWidget(scroll, 1)
