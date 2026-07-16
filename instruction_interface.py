"""
Zakladka "Instrukcja": lista krokow z checkboxami (stan zapamietywany w
config.json), klikalne linki oraz przycisk "Gotowe" pokazujacy grafike po
ukonczeniu checklisty.

Tresc wczytywana jest z pliku instrukcja.txt (lub instructions.txt).
Obsluguje tagi:
  - {checkbox} tresc {/checkbox} -> karta z checkboxem (moze byc wielolinijkowa)
  - <flat text> tresc </flat text> -> czysty tekst bez zadnej ramki i tla
  - <align=center> tresc </align> -> wysrodkowanie zawartego tekstu
  - <H1> / # tresc -> glowny naglowek
  - <H2> / ## tresc -> podnaglowek
  - [button...] -> miejsce wstawienia przycisku GOTOWE / obrazka owo.png
"""
import html
import re
from pathlib import Path

from PySide6.QtCore import Qt, QUrl
from PySide6.QtGui import QDesktopServices, QPixmap
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QSizePolicy,
)
from qfluentwidgets import (
    CheckBox, PrimaryPushButton, SubtitleLabel, CaptionLabel, CardWidget,
    SingleDirectionScrollArea,
)

import config as cfgmod

# Rozpoznaje pelne adresy (http(s)://...) oraz "gole" domeny typu dev.twitch.tv
_URL_RE = re.compile(
    r'(https?://[^\s<>"\']+'
    r'|(?:[a-zA-Z0-9-]+\.)+(?:com|net|org|tv|io|pl|dev|co|app|me|gg)(?:/[^\s<>"\']*)?)'
)
_BOLD_RE = re.compile(r'\*\*(.+?)\*\*')
_CODE_RE = re.compile(r'`([^`]+)`')
_ITALIC_RE = re.compile(r'\*(.+?)\*')


def _resolve_data_file(name: str) -> Path:
    user_path = cfgmod.base_dir() / name
    if user_path.exists():
        return user_path
    return cfgmod.resource_path(name)


def _linkify(escaped: str) -> str:
    # Podmiana specyficznego opisu Creator Dashboard na link (kolor zmieniony na beżowy akcent Shiroe: #d4b499)
    escaped = escaped.replace(
        "Creator Dashboard&lt;na słowach Creator Dashboard, klikalny odnośnik do https://dashboard.twitch.tv&gt;",
        '<a href="https://dashboard.twitch.tv" style="color:#d4b499; text-decoration: none;">Creator Dashboard</a>'
    )
    # Podmiana opisu klikalnego linku dla Twitch dev
    escaped = escaped.replace(
        "https://dev.twitch.tv/console/apps &lt;w tym miejscu klikalny link&gt;",
        '<a href="https://dev.twitch.tv/console/apps" style="color:#d4b499; text-decoration: none;">https://dev.twitch.tv/console/apps</a>'
    )

    def repl(match: "re.Match") -> str:
        url = match.group(0)
        # Jezeli ten adres zostal juz obsluzony wyzej jako czesc tagu HTML <a>, to go pomijamy
        if f'href="{url}"' in escaped or f'href="https://{url}"' in escaped:
            return url
        href = url if url.startswith("http") else f"https://{url}"
        return f'<a href="{href}" style="color:#d4b499; text-decoration: none;">{url}</a>'

    return _URL_RE.sub(repl, escaped)


def _format_line(raw_line: str) -> str:
    cleaned_line = (raw_line
                    .replace("{checkbox}", "")
                    .replace("{/checkbox}", "")
                    .replace("/{checkbox}", "")
                    .replace("<flat text>", "")
                    .replace("</flat text>", "")
                    .replace("<align=center>", "")
                    .replace("</align>", "")
                    .replace("<H1>", "")
                    .replace("</H1>", "")
                    .replace("<H2>", "")
                    .replace("</H2>", "")
                    .replace("<h1>", "")
                    .replace("</h1>", "")
                    .replace("<h2>", "")
                    .replace("</h2>", "")
                    .strip())
    escaped = html.escape(cleaned_line)
    escaped = _BOLD_RE.sub(r"<b>\1</b>", escaped)
    # Kolor kodu w tle dostosowany do #d4b499
    escaped = _CODE_RE.sub(
        r'<code style="background:rgba(255,255,255,0.10); padding:2px 5px; border-radius:4px; color:#d4b499;">\1</code>',
        escaped,
    )
    escaped = _ITALIC_RE.sub(r"<i>\1</i>", escaped)
    return _linkify(escaped)


class InstructionInterface(QWidget):
    def __init__(self, app: "MainWindow"):
        super().__init__()
        self.setObjectName("InstructionInterface")
        self.app = app
        self.checkboxes = []  # Tu zbieramy checkboxy do zapisywania stanu

        self.setStyleSheet("background: transparent;")

        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)

        title = SubtitleLabel("Instrukcja")
        title.setStyleSheet("color: #f2f2f2; font-weight: bold;")
        layout.addWidget(title)

        # Glowny scroll area o przezroczystym tle
        scroll = SingleDirectionScrollArea(orient=Qt.Vertical)
        scroll.setWidgetResizable(True)
        scroll.setStyleSheet("QScrollArea { background: transparent; border: none; }")
        scroll.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        steps_container = QWidget()
        steps_container.setStyleSheet("background: transparent;")
        self.steps_layout = QVBoxLayout(steps_container)
        self.steps_layout.setContentsMargins(0, 0, 12, 4)
        self.steps_layout.setSpacing(12)

        items = self._load_items()
        completed = set(app.cfg.get("completed_steps", []))

        if items:
            step_idx = 0
            for kind, text, centered in items:
                if kind == "h1":
                    self._add_h1_row(text, centered)
                elif kind == "h2":
                    self._add_h2_row(text, centered)
                elif kind == "flat_text":
                    self._add_flat_text_row(text, centered)
                elif kind == "checkbox":
                    self._add_checkbox_card(step_idx, text, step_idx in completed)
                    step_idx += 1
                elif kind == "button":
                    self._add_action_button_row(centered)
        else:
            info = CaptionLabel(
                "Brak pliku instrukcja.txt. Umiesc go w folderze projektu."
            )
            info.setStyleSheet("color: #f2f2f2;")
            self.steps_layout.addWidget(info)

        self.steps_layout.addStretch(1)
        scroll.setWidget(steps_container)
        layout.addWidget(scroll, 1)

    # ------------------------------------------------------------ parser pliku

    def _load_items(self) -> list:
        path = _resolve_data_file("instrukcja.txt")
        if not path.exists():
            path = _resolve_data_file("instructions.txt")
        if not path.exists():
            return []

        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            return []

        text = text.replace("/{checkbox}", "{/checkbox}")

        lines = text.splitlines()
        items = []
        
        current_mode = "normal"
        current_block = []
        is_centered = False

        def flush_block(mode, block, centered):
            block_content = "\n".join(block).strip()
            if block_content:
                items.append((mode, block_content, centered))

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            if "<align=center>" in stripped:
                is_centered = True
            
            # Wykrywanie przycisku
            if "[" in stripped and "button" in stripped and "]" in stripped:
                if current_block:
                    flush_block(current_mode, current_block, is_centered)
                    current_block = []
                    current_mode = "normal"
                items.append(("button", "", is_centered))
                if "</align>" in stripped:
                    is_centered = False
                continue

            has_cb_start = "{checkbox}" in stripped
            has_cb_end = "{/checkbox}" in stripped
            has_flat_start = "<flat text>" in stripped
            has_flat_end = "</flat text>" in stripped
            
            # Obsluga naglowkow H1 i H2 (zarowno tagi html jak i markdownowe # oraz ##)
            has_h1 = "<H1>" in stripped or "</H1>" in stripped or "<h1>" in stripped or "</h1>" in stripped or (stripped.startswith("#") and not stripped.startswith("##"))
            has_h2 = "<H2>" in stripped or "</H2>" in stripped or "<h2>" in stripped or "</h2>" in stripped or stripped.startswith("##")

            cleaned = (stripped
                       .replace("{checkbox}", "")
                       .replace("{/checkbox}", "")
                       .replace("<flat text>", "")
                       .replace("</flat text>", "")
                       .replace("<align=center>", "")
                       .replace("</align>", "")
                       .replace("<H1>", "")
                       .replace("</H1>", "")
                       .replace("<H2>", "")
                       .replace("</H2>", "")
                       .replace("<h1>", "")
                       .replace("</h1>", "")
                       .replace("<h2>", "")
                       .replace("</h2>", "")
                       .strip())

            if cleaned.startswith("#") and not cleaned.startswith("##"):
                cleaned = cleaned.lstrip("#").strip()
            elif cleaned.startswith("##"):
                cleaned = cleaned.lstrip("#").strip()

            if has_h1 and current_mode == "normal":
                if current_block:
                    flush_block(current_mode, current_block, is_centered)
                    current_block = []
                items.append(("h1", cleaned, is_centered))
                if "</align>" in stripped:
                    is_centered = False
                continue

            if has_h2 and current_mode == "normal":
                if current_block:
                    flush_block(current_mode, current_block, is_centered)
                    current_block = []
                items.append(("h2", cleaned, is_centered))
                if "</align>" in stripped:
                    is_centered = False
                continue

            # Obsluga blokow jedno-linijkowych
            if has_cb_start and has_cb_end:
                if current_block:
                    flush_block(current_mode, current_block, is_centered)
                    current_block = []
                items.append(("checkbox", cleaned, is_centered))
                if "</align>" in stripped:
                    is_centered = False
                continue
            elif has_flat_start and has_flat_end:
                if current_block:
                    flush_block(current_mode, current_block, is_centered)
                    current_block = []
                items.append(("flat_text", cleaned, is_centered))
                if "</align>" in stripped:
                    is_centered = False
                continue

            # Rozpoczecie bloku wielolinijkowego
            if has_cb_start:
                if current_block:
                    flush_block(current_mode, current_block, is_centered)
                current_block = [cleaned]
                current_mode = "checkbox"
                continue
            elif has_flat_start:
                if current_block:
                    flush_block(current_mode, current_block, is_centered)
                current_block = [cleaned]
                current_mode = "flat_text"
                continue

            # Zakonczenie bloku wielolinijkowego
            if has_cb_end and current_mode == "checkbox":
                current_block.append(cleaned)
                flush_block("checkbox", current_block, is_centered)
                current_block = []
                current_mode = "normal"
                if "</align>" in stripped:
                    is_centered = False
                continue
            elif has_flat_end and current_mode == "flat_text":
                current_block.append(cleaned)
                flush_block("flat_text", current_block, is_centered)
                current_block = []
                current_mode = "normal"
                if "</align>" in stripped:
                    is_centered = False
                continue

            # Zbieranie zawartosci do bloku lub traktowanie jako zwykly tekst plaski
            if current_mode != "normal":
                current_block.append(line)
            else:
                items.append(("flat_text", stripped, is_centered))

            if "</align>" in stripped:
                is_centered = False

        if current_block:
            flush_block(current_mode, current_block, is_centered)

        return items

    def _load_done_pixmap(self):
        path = _resolve_data_file("owo.png")
        if not path.exists():
            return None
        pixmap = QPixmap(str(path))
        if pixmap.isNull():
            return None
        return pixmap.scaled(188, 128, Qt.KeepAspectRatio, Qt.SmoothTransformation)

    # ------------------------------------------------------------- Budowa UI

    def _make_rich_label(self) -> QLabel:
        label = QLabel()
        label.setTextFormat(Qt.RichText)
        label.setWordWrap(True)
        label.setTextInteractionFlags(Qt.TextBrowserInteraction)
        label.setOpenExternalLinks(False)
        label.linkActivated.connect(self._open_link)
        label.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Preferred)
        label.setStyleSheet("background: transparent; border: none; padding: 0px;")
        return label

    def _add_h1_row(self, text: str, centered: bool) -> None:
        """Naglowek glowny (H1)."""
        label = self._make_rich_label()
        content_html = _format_line(text)
        align_style = "text-align: center;" if centered else "text-align: left;"
        if centered:
            label.setAlignment(Qt.AlignCenter)
        
        label.setText(
            f'<div style="{align_style}"><span style="font-size:18px; font-weight:700; color:#f2f2f2;">{content_html}</span></div>'
        )
        label.setContentsMargins(2, 14, 2, 4)
        self.steps_layout.addWidget(label)

    def _add_h2_row(self, text: str, centered: bool) -> None:
        """Podnaglowek (H2). Kolor dostosowany do #d4b499."""
        label = self._make_rich_label()
        content_html = _format_line(text)
        align_style = "text-align: center;" if centered else "text-align: left;"
        if centered:
            label.setAlignment(Qt.AlignCenter)

        label.setText(
            f'<div style="{align_style}"><span style="font-size:15px; font-weight:600; color:#d4b499;">{content_html}</span></div>'
        )
        label.setContentsMargins(2, 14, 2, 4)
        self.steps_layout.addWidget(label)

    def _add_flat_text_row(self, text: str, centered: bool) -> None:
        """Zwykły płaski tekst bez ramek kart."""
        label = self._make_rich_label()
        align_style = "text-align: center;" if centered else "text-align: left;"
        if centered:
            label.setAlignment(Qt.AlignCenter)

        formatted_paragraphs = []
        for line in text.splitlines():
            if line.strip():
                formatted_paragraphs.append(f'<div style="{align_style}">{_format_line(line)}</div>')
        
        content_html = "".join(formatted_paragraphs)
        label.setText(
            f'<span style="font-size:13px; color:#f2f2f2; line-height: 1.4;">{content_html}</span>'
        )
        label.setContentsMargins(4, 6, 4, 6)
        self.steps_layout.addWidget(label)

    def _add_checkbox_card(self, idx: int, text: str, done: bool) -> None:
        """Karta z dokładnie jednym checkboxem (CardWidget)."""
        row_card = CardWidget()
        row_card.setStyleSheet(
            "CardWidget { "
            "  background-color: rgba(255, 255, 255, 0.04); "
            "  border: 1px solid rgba(255, 255, 255, 0.08); "
            "  border-radius: 6px; "
            "}"
        )
        row_layout = QHBoxLayout(row_card)
        row_layout.setContentsMargins(14, 10, 14, 10)
        row_layout.setSpacing(12)

        checkbox = CheckBox()
        checkbox.setChecked(done)

        label = self._make_rich_label()
        
        formatted_lines = []
        for line in text.splitlines():
            formatted_lines.append(_format_line(line))
        content_html = "<br>".join(formatted_lines)
        
        label.setText(self._styled_html(content_html, done))

        checkbox.toggled.connect(
            lambda checked, i=idx, c=content_html, l=label: self._on_step_toggled(i, checked, c, l)
        )

        row_layout.addWidget(checkbox, alignment=Qt.AlignTop)
        row_layout.addWidget(label, 1)

        self.checkboxes.append((idx, checkbox, content_html, label))
        self.steps_layout.addWidget(row_card)

    def _add_action_button_row(self, centered: bool) -> None:
        """Ustawia przycisk GOTOWE oraz owo.png bezpośrednio w linii przewijania tekstu."""
        container = QWidget()
        container.setStyleSheet("background: transparent;")
        btn_layout = QHBoxLayout(container)
        btn_layout.setContentsMargins(4, 12, 4, 12)
        btn_layout.setSpacing(16)

        self.done_button = PrimaryPushButton("GOTOWE")
        self.done_button.setFixedWidth(120)
        self.done_button.clicked.connect(self.on_done_clicked)
        # Przycisk jest od razu aktywny i dostepny dla uzytkownika!
        self.done_button.setEnabled(True)

        self.done_image = QLabel()
        self.done_image.setFixedSize(188, 128)
        pixmap = self._load_done_pixmap()
        if pixmap is not None:
            self.done_image.setPixmap(pixmap)
        else:
            self.done_image.setText("(brak owo.png)")
            self.done_image.setStyleSheet("color: #f2f2f2;")
            self.done_image.setAlignment(Qt.AlignCenter)

        alignment = Qt.AlignCenter if centered else Qt.AlignLeft

        if centered:
            btn_layout.addStretch(1)
        btn_layout.addWidget(self.done_button, alignment=alignment)
        btn_layout.addWidget(self.done_image, alignment=alignment)
        btn_layout.addStretch(1)
        
        self.steps_layout.addWidget(container)

        # Na starcie, jesli konfiguracja wskazuje na ukonczenie checklisty:
        if self.app.cfg.get("instructions_completed"):
            self.done_button.hide()
            self.done_image.show()
        else:
            self.done_button.show()
            self.done_image.hide()

    @staticmethod
    def _styled_html(content_html: str, done: bool) -> str:
        if done:
            return (
                '<span style="color:rgba(230,230,230,110); '
                f'text-decoration:line-through;">{content_html}</span>'
            )
        return f'<span style="color:#f2f2f2;">{content_html}</span>'

    # -------------------------------------------------------------- Akcje

    def _open_link(self, url: str) -> None:
        QDesktopServices.openUrl(QUrl(url))

    def _on_step_toggled(self, idx: int, checked: bool, content_html: str, label: QLabel) -> None:
        label.setText(self._styled_html(content_html, checked))

        completed = set(self.app.cfg.get("completed_steps", []))
        if checked:
            completed.add(idx)
        else:
            completed.discard(idx)
        self.app.cfg["completed_steps"] = sorted(completed)
        cfgmod.save_config(self.app.cfg)

    def on_done_clicked(self) -> None:
        self.app.cfg["instructions_completed"] = True
        cfgmod.save_config(self.app.cfg)
        self.done_button.hide()
        self.done_image.show()