"""
Samodzielne okno "Edytor wygladu alertow": pozwala ustawic pozycje, rozmiar
i obrys obrazka/GIF-a oraz "tabelki" (tekstu), kolory i font tabelki, tresc
alertu (szablon tekstu z tokenami typu {user}) oraz animacje wejscia/wyjscia
- osobno dla kazdego typu alertu (Nagrody/Raid/Follow/Sub/Prime Sub).

Zwykly QWidget (NIE FramelessWindow) - probowalismy FramelessWindow dla
spojnego paska tytulu, ale jego wlasna obsluga przeciagania okna gryzla sie
z przeciaganiem ramek na kanwie (okno "skakalo" i potrafilo wyleciec poza
ekran). Stabilnosc jest wazniejsza niz spojny pasek tytulu, wiec zostajemy
przy prostym, przewidywalnym QWidget z domyslnym paskiem Windows.

WAZNE OGRANICZENIE: program celowo NIE dolacza QtWebEngine (zeby .exe bylo
lekkie), wiec to okno NIE potrafi wyrenderowac prawdziwego overlay.html z
animacjami na zywo. Kanwa pokazuje wylacznie STATYCZNY podglad pozycji i
rozmiaru (przeciagalne ramki). Zeby zobaczyc naprawde jak to wyglada (wraz
z animacja), sluzy przycisk "Testowy alert" w prawym gornym rogu glownego
okna - nie trzeba wchodzic do edytora.
"""
from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor, QIcon
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QFormLayout, QColorDialog, QFontComboBox,
    QScrollArea,
)
from qfluentwidgets import (
    ComboBox, SpinBox, LineEdit, PrimaryPushButton, PushButton, BodyLabel,
    CaptionLabel, SubtitleLabel, CardWidget, InfoBar, InfoBarPosition,
)

import config as cfgmod
from qframelesswindow import FramelessWindow, StandardTitleBar

# Ten sam zaokraglony/przezroczysty pasek przewijania co w Alertach/Instrukcji
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

CANVAS_WIDTH = 640
CANVAS_HEIGHT = 360

# Kolory uzyte TAKZE do ramek na kanwie i kropek w panelu - dzieki temu
# widac na pierwszy rzut oka, ktora kontrolka odpowiada za ktory element.
IMAGE_COLOR = "#E3C048"
CAPTION_COLOR = "#43fbff"

ANIM_OPTIONS = [
    ("fade", "Fade (przenikanie)"),
    ("slide_left", "Wjazd z lewej"),
    ("slide_right", "Wjazd z prawej"),
    ("slide_top", "Wjazd z gory"),
    ("slide_bottom", "Wjazd z dolu"),
    ("zoom", "Zoom"),
    ("bounce", "Odbicie (bounce)"),
    ("none", "Brak animacji"),
]

BORDER_STYLE_OPTIONS = [
    ("solid", "Ciagla"),
    ("dashed", "Kreskowana"),
    ("dotted", "Kropkowana"),
    ("none", "Brak"),
]

ALERT_TYPE_OPTIONS = [
    ("redemption", "Nagrody (wspolny wyglad)"),
    ("raid", "Raid"),
    ("follow", "Nowy follow"),
    ("sub", "Nowa subskrypcja"),
    ("prime_sub", "Subskrypcja Prime"),
    ("bits", "Bity (Cheer)"),
]

# Dostepne tokeny tresci alertu - rozne dla kazdego typu, bo Twitch daje inne
# dane (raid ma liczbe widzow, sub ma tier/miesiace, follow tylko nick).
ALERT_VARIABLES = {
    "redemption": [("user", "Nick"), ("reward", "Nagroda")],
    "raid": [("user", "Nick"), ("viewers", "Widzowie")],
    "follow": [("user", "Nick")],
    "sub": [("user", "Nick"), ("months", "Miesiace"), ("tier", "Tier")],
    "prime_sub": [("user", "Nick"), ("months", "Miesiace")],
    "bits": [("user", "Nick"), ("bits", "Bity"), ("message", "Wiadomosc")],
}

_DEFAULT_IMAGE = {"x": 50, "y": 38, "width": 30, "height": 40,
                   "border_width": 0, "border_color": "#000000", "border_style": "none"}
_DEFAULT_CAPTION = {"x": 50, "y": 68, "width": 40, "height": 10,
                     "font_size": 32, "font_family": "Amatic SC", "font_color": "#ffffff",
                     "bg_color": "#843935", "bg_opacity": 90,
                     "border_width": 3, "border_color": "#000000", "border_style": "solid"}
_DEFAULT_TEMPLATE = "{user}"


def _hex_to_rgb(hex_color: str):
    hex_color = (hex_color or "#000000").lstrip("#")
    return tuple(int(hex_color[i:i + 2], 16) for i in (0, 2, 4))


def _swatch_label() -> BodyLabel:
    """Maly kolorowy kwadracik - podglad aktualnie wybranego koloru."""
    swatch = BodyLabel("")
    swatch.setFixedSize(22, 22)
    swatch.setStyleSheet("border-radius: 4px; border: 1px solid rgba(255,255,255,0.3);")
    return swatch


def _set_swatch_color(swatch: BodyLabel, color_hex: str) -> None:
    swatch.setStyleSheet(
        f"background-color: {color_hex}; border-radius: 4px; border: 1px solid rgba(255,255,255,0.3);"
    )


def _section_title(text: str, dot_color: str = None) -> QWidget:
    """Naglowek sekcji w panelu - opcjonalnie z kolorowa kropka, ktora
    odpowiada kolorowi odpowiedniej ramki na kanwie."""
    row = QWidget()
    layout = QHBoxLayout(row)
    layout.setContentsMargins(0, 0, 0, 0)
    layout.setSpacing(8)
    if dot_color:
        dot = BodyLabel("")
        dot.setFixedSize(12, 12)
        dot.setStyleSheet(f"background-color: {dot_color}; border-radius: 6px;")
        layout.addWidget(dot)
    label = BodyLabel(text)
    label.setStyleSheet("font-weight: 600;")
    layout.addWidget(label)
    layout.addStretch(1)
    return row


def _style_font_combo(combo: QFontComboBox) -> None:
    """QFontComboBox to zwykly, niemotywowany widget Qt (qfluentwidgets nie
    ma wlasnego odpowiednika) - bez tego bylby czarny tekst na czarnym tle,
    tak jak wczesniej przy SpinBoxach."""
    combo.setStyleSheet("""
        QFontComboBox {
            background-color: rgba(255, 255, 255, 0.08);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.25);
            border-radius: 5px;
            padding: 4px 8px;
        }
        QFontComboBox QAbstractItemView {
            background-color: #1a1a1a;
            color: white;
            selection-background-color: #E3C048;
            selection-color: black;
        }
    """)


class _DraggableBox(QWidget):
    """Ramka reprezentujaca obraz albo tabelke na kanwie edytora - mozna ja
    przeciagac mysza, zeby zmienic pozycje X/Y. Rozmiar zmienia sie przez
    pola liczbowe w panelu obok (bez uchwytow do resize - prosciej i
    pewniej niz rysowanie wlasnych uchwytow w rogach)."""

    def __init__(self, label: str, color_hex: str, parent=None):
        super().__init__(parent)
        self._dragging = False
        self._drag_offset = None
        self.on_moved = None  # callback(x_procent, y_procent) po puszczeniu myszy

        # WAZNE: goly QWidget domyslnie IGNORUJE background-color/border ze
        # stylesheet, dopoki nie ustawi sie ten atrybut - bez niego ramka
        # jest niewidoczna (tylko tekst na niej).
        self.setAttribute(Qt.WA_StyledBackground, True)

        r, g, b = _hex_to_rgb(color_hex)
        self.setStyleSheet(
            f"background-color: rgba({r}, {g}, {b}, 60); "
            f"border: 3px solid {color_hex}; border-radius: 6px;"
        )
        self.setCursor(Qt.SizeAllCursor)
        self._label = BodyLabel(label, self)
        self._label.setStyleSheet(
            "color: white; background: transparent; border: none; "
            "font-size: 11px; font-weight: 600;"
        )
        self._label.setAlignment(Qt.AlignCenter)

    def resizeEvent(self, event):
        super().resizeEvent(event)
        self._label.setGeometry(0, 0, self.width(), self.height())

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self._dragging = True
            self._drag_offset = event.pos()
            event.accept()

    def mouseMoveEvent(self, event):
        if not self._dragging:
            return
        delta = event.pos() - self._drag_offset
        new_pos = self.pos() + delta
        parent_rect = self.parentWidget().rect()
        new_x = max(0, min(new_pos.x(), parent_rect.width() - self.width()))
        new_y = max(0, min(new_pos.y(), parent_rect.height() - self.height()))
        self.move(new_x, new_y)
        event.accept()

    def mouseReleaseEvent(self, event):
        if self._dragging:
            self._dragging = False
            if self.on_moved:
                canvas = self.parentWidget()
                cx = (self.x() + self.width() / 2) / canvas.width() * 100
                cy = (self.y() + self.height() / 2) / canvas.height() * 100
                self.on_moved(round(cx, 1), round(cy, 1))
            event.accept()


class LayoutEditorWindow(FramelessWindow):
    def __init__(self, app: "MainWindow"):
        super().__init__()
        self.app = app
        self.current_key = "redemption"
        self._loading = False  # blokada przed zapisem podczas wczytywania wartosci do pol
        self._font_color = "#ffffff"
        self._bg_color = "#843935"
        self._image_border_color = "#000000"
        self._caption_border_color = "#000000"

        self.setTitleBar(StandardTitleBar(self))
        self.setWindowTitle("Edytor wygladu alertow - PanSzczesniak Stream Alerts")
        self.resize(1080, 760)
        self.setMinimumSize(880, 620)
        self.setStyleSheet("""
            LayoutEditorWindow { background-color: #000000; }

            /* Strzalki gora/dol w polach liczbowych (SpinBox) - domyslnie
            to natywne, czarne ikonki Qt, niewidoczne na ciemnym tle. */
            QAbstractSpinBox::up-button, QAbstractSpinBox::down-button {
                background-color: rgba(255, 255, 255, 0.08);
                border: none;
                width: 18px;
            }
            QAbstractSpinBox::up-button:hover, QAbstractSpinBox::down-button:hover {
                background-color: rgba(227, 192, 72, 0.35);
            }
            QAbstractSpinBox::up-arrow {
                image: none;
                border-left: 4px solid transparent;
                border-right: 4px solid transparent;
                border-bottom: 5px solid #f2f2f2;
                width: 0px; height: 0px;
            }
            QAbstractSpinBox::down-arrow {
                image: none;
                border-left: 4px solid transparent;
                border-right: 4px solid transparent;
                border-top: 5px solid #f2f2f2;
                width: 0px; height: 0px;
            }

            /* Lista rozwijana ComboBox (Alert/Styl/Wejscie/Wyjscie) - jej
            popup potrafi uzyc domyslnej (jasnej) palety systemowej zamiast
            ciemnego motywu, co daje czarny tekst na bialym tle. */
            QComboBox QAbstractItemView {
                background-color: #1a1a1a;
                color: #f2f2f2;
                border: 1px solid rgba(255, 255, 255, 0.2);
                selection-background-color: #E3C048;
                selection-color: black;
                outline: none;
            }
        """)

        icon_path = cfgmod.base_dir() / "icon.png"
        if icon_path.exists():
            self.setWindowIcon(QIcon(str(icon_path)))

        title_bar_h = self.titleBar.height() or 32
        outer = QVBoxLayout(self)
        outer.setContentsMargins(24, title_bar_h + 20, 24, 24)
        outer.setSpacing(16)

        top_row = QHBoxLayout()
        top_row.addWidget(SubtitleLabel("Edytor wygladu alertow"))
        top_row.addStretch(1)
        top_row.addWidget(BodyLabel("Alert:"))
        self.type_combo = ComboBox()
        for key, label in ALERT_TYPE_OPTIONS:
            self.type_combo.addItem(label, userData=key)
        self.type_combo.currentIndexChanged.connect(self.on_type_changed)
        top_row.addWidget(self.type_combo)
        outer.addLayout(top_row)

        body_row = QHBoxLayout()
        body_row.setSpacing(20)

        # --- Kanwa (statyczny podglad pozycji/rozmiaru) ---
        canvas_card = CardWidget()
        canvas_layout = QVBoxLayout(canvas_card)
        canvas_layout.setContentsMargins(16, 16, 16, 16)
        canvas_layout.setSpacing(10)
        info = CaptionLabel(
            "Przeciagnij ramke mysza, zeby ustawic pozycje. Rozmiar, obrys i "
            "kolory - w panelu obok. To podglad statyczny (bez animacji) - "
            "uzyj 'Wyslij testowy alert', zeby zobaczyc prawdziwy wyglad w OBS."
        )
        info.setWordWrap(True)
        canvas_layout.addWidget(info)

        self.canvas = QWidget()
        self.canvas.setFixedSize(CANVAS_WIDTH, CANVAS_HEIGHT)
        self.canvas.setAttribute(Qt.WA_StyledBackground, True)
        self.canvas.setStyleSheet(
            "background-color: #1a1a1a; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px;"
        )
        self.image_box = _DraggableBox("OBRAZ / GIF", IMAGE_COLOR, self.canvas)
        self.caption_box = _DraggableBox("TABELKA (TEKST)", CAPTION_COLOR, self.canvas)
        self.image_box.on_moved = lambda x, y: self._on_box_moved("image", x, y)
        self.caption_box.on_moved = lambda x, y: self._on_box_moved("caption", x, y)
        canvas_layout.addWidget(self.canvas, alignment=Qt.AlignCenter)
        canvas_layout.addStretch(1)
        body_row.addWidget(canvas_card, 2)

        # --- Panel ustawien (kazda sekcja we wlasnej karcie) ---
        panel_col = QVBoxLayout()
        panel_col.setSpacing(14)

        # Tresc alertu (szablon tekstu z tokenami)
        text_card = CardWidget()
        text_card_layout = QVBoxLayout(text_card)
        text_card_layout.setContentsMargins(16, 14, 16, 14)
        text_card_layout.setSpacing(8)
        text_card_layout.addWidget(_section_title("Tresc alertu"))
        self.template_edit = LineEdit()
        self.template_edit.setPlaceholderText("np. {user} odbiera {reward}")
        self.template_edit.textChanged.connect(self._on_fields_changed)
        text_card_layout.addWidget(self.template_edit)
        self.token_hint = CaptionLabel("Kliknij, zeby wstawic znacznik w miejscu kursora:")
        text_card_layout.addWidget(self.token_hint)
        self.token_row = QHBoxLayout()
        self.token_row.setSpacing(6)
        text_card_layout.addLayout(self.token_row)
        panel_col.addWidget(text_card)

        # Obraz / GIF
        image_card = CardWidget()
        image_card_layout = QVBoxLayout(image_card)
        image_card_layout.setContentsMargins(16, 14, 16, 14)
        image_card_layout.setSpacing(10)
        image_card_layout.addWidget(_section_title("Obraz / GIF", IMAGE_COLOR))
        img_form = QFormLayout()
        img_form.setFieldGrowthPolicy(QFormLayout.AllNonFixedFieldsGrow)
        self.image_width_spin = SpinBox()
        self.image_width_spin.setRange(5, 100)
        self.image_width_spin.setSuffix("%")
        self.image_height_spin = SpinBox()
        self.image_height_spin.setRange(5, 100)
        self.image_height_spin.setSuffix("%")
        self.image_width_spin.valueChanged.connect(self._on_fields_changed)
        self.image_height_spin.valueChanged.connect(self._on_fields_changed)
        img_form.addRow(BodyLabel("Szerokosc:"), self.image_width_spin)
        img_form.addRow(BodyLabel("Wysokosc:"), self.image_height_spin)
        image_card_layout.addLayout(img_form)
        image_card_layout.addWidget(_section_title("Obrys ramki"))
        (image_border_widget, self.image_border_swatch,
         self.image_border_width_spin, self.image_border_style_combo) = self._build_border_controls(
            on_pick_color=self.on_pick_image_border_color
        )
        image_card_layout.addWidget(image_border_widget)
        panel_col.addWidget(image_card)

        # Tabelka (tekst)
        caption_card = CardWidget()
        caption_card_layout = QVBoxLayout(caption_card)
        caption_card_layout.setContentsMargins(16, 14, 16, 14)
        caption_card_layout.setSpacing(10)
        caption_card_layout.addWidget(_section_title("Tabelka (tekst)", CAPTION_COLOR))
        cap_form = QFormLayout()
        cap_form.setFieldGrowthPolicy(QFormLayout.AllNonFixedFieldsGrow)
        self.caption_width_spin = SpinBox()
        self.caption_width_spin.setRange(5, 100)
        self.caption_width_spin.setSuffix("%")
        self.caption_height_spin = SpinBox()
        self.caption_height_spin.setRange(3, 100)
        self.caption_height_spin.setSuffix("%")
        self.font_size_spin = SpinBox()
        self.font_size_spin.setRange(10, 96)
        self.font_size_spin.setSuffix(" px")
        self.bg_opacity_spin = SpinBox()
        self.bg_opacity_spin.setRange(0, 100)
        self.bg_opacity_spin.setSuffix("%")
        for w in (self.caption_width_spin, self.caption_height_spin, self.font_size_spin, self.bg_opacity_spin):
            w.valueChanged.connect(self._on_fields_changed)
        cap_form.addRow(BodyLabel("Szerokosc:"), self.caption_width_spin)
        cap_form.addRow(BodyLabel("Wysokosc:"), self.caption_height_spin)
        cap_form.addRow(BodyLabel("Rozmiar czcionki:"), self.font_size_spin)
        cap_form.addRow(BodyLabel("Przezroczystosc tla:"), self.bg_opacity_spin)
        caption_card_layout.addLayout(cap_form)

        font_row = QHBoxLayout()
        font_row.setSpacing(8)
        font_row.addWidget(BodyLabel("Czcionka:"))
        self.font_combo = QFontComboBox()
        _style_font_combo(self.font_combo)
        self.font_combo.currentFontChanged.connect(self._on_fields_changed)
        font_row.addWidget(self.font_combo, 1)
        caption_card_layout.addLayout(font_row)

        color_row = QHBoxLayout()
        color_row.setSpacing(8)
        self.font_color_swatch = _swatch_label()
        self.font_color_btn = PushButton("Kolor tekstu...")
        self.font_color_btn.clicked.connect(self.on_pick_font_color)
        self.bg_color_swatch = _swatch_label()
        self.bg_color_btn = PushButton("Kolor tla...")
        self.bg_color_btn.clicked.connect(self.on_pick_bg_color)
        color_row.addWidget(self.font_color_swatch)
        color_row.addWidget(self.font_color_btn)
        color_row.addSpacing(8)
        color_row.addWidget(self.bg_color_swatch)
        color_row.addWidget(self.bg_color_btn)
        color_row.addStretch(1)
        caption_card_layout.addLayout(color_row)

        caption_card_layout.addWidget(_section_title("Obrys ramki"))
        (caption_border_widget, self.caption_border_swatch,
         self.caption_border_width_spin, self.caption_border_style_combo) = self._build_border_controls(
            on_pick_color=self.on_pick_caption_border_color
        )
        caption_card_layout.addWidget(caption_border_widget)
        panel_col.addWidget(caption_card)

        # Animacja
        anim_card = CardWidget()
        anim_card_layout = QVBoxLayout(anim_card)
        anim_card_layout.setContentsMargins(16, 14, 16, 14)
        anim_card_layout.setSpacing(10)
        anim_card_layout.addWidget(_section_title("Animacja"))
        anim_form = QFormLayout()
        anim_form.setFieldGrowthPolicy(QFormLayout.AllNonFixedFieldsGrow)
        self.anim_in_combo = ComboBox()
        self.anim_out_combo = ComboBox()
        for key, label in ANIM_OPTIONS:
            self.anim_in_combo.addItem(label, userData=key)
            self.anim_out_combo.addItem(label, userData=key)
        self.anim_in_combo.currentIndexChanged.connect(self._on_fields_changed)
        self.anim_out_combo.currentIndexChanged.connect(self._on_fields_changed)
        self.anim_duration_spin = SpinBox()
        self.anim_duration_spin.setRange(100, 3000)
        self.anim_duration_spin.setSingleStep(50)
        self.anim_duration_spin.setSuffix(" ms")
        self.anim_duration_spin.valueChanged.connect(self._on_fields_changed)
        anim_form.addRow(BodyLabel("Wejscie:"), self.anim_in_combo)
        anim_form.addRow(BodyLabel("Wyjscie:"), self.anim_out_combo)
        anim_form.addRow(BodyLabel("Czas animacji:"), self.anim_duration_spin)
        anim_card_layout.addLayout(anim_form)
        panel_col.addWidget(anim_card)

        panel_col.addStretch(1)

        button_row = QHBoxLayout()
        self.save_button = PrimaryPushButton("Zapisz wyglad")
        self.save_button.clicked.connect(self.on_save)
        self.test_button = PushButton("Wyslij testowy alert")
        self.test_button.clicked.connect(self.on_send_test)
        button_row.addWidget(self.save_button)
        button_row.addWidget(self.test_button)
        panel_col.addLayout(button_row)

        panel_wrap = QWidget()
        panel_wrap.setStyleSheet("background: transparent;")
        panel_wrap.setLayout(panel_col)

        panel_scroll = QScrollArea()
        panel_scroll.setWidgetResizable(True)
        panel_scroll.setFrameShape(QScrollArea.NoFrame)
        panel_scroll.setStyleSheet(SCROLLBAR_QSS)
        panel_scroll.setWidget(panel_wrap)

        body_row.addWidget(panel_scroll, 1)
        outer.addLayout(body_row, 1)

        self.titleBar.raise_()
        self._load_layout_into_fields(self.current_key)

    # ------------------------------------------------------- male fabryki UI

    def _build_border_controls(self, on_pick_color):
        """Zwraca JEDEN gotowy QWidget (kolor + grubosc + styl obrysu) do
        dodania przez addWidget() - uzywane identycznie dla obrazu i dla
        tabelki, zeby nie duplikowac kodu. Zwraca tez referencje do
        poszczegolnych kontrolek (swatch/spinbox/combo), zeby moc je
        pozniej odczytywac i ustawiac.

        WAZNE: kazdy QLayout tworzony tu nalezy WYLACZNIE do "container" -
        nigdy nie jest dolaczany do dwoch widgetow/layoutow na raz (to byl
        blad w poprzedniej wersji, ktory powodowal cichy crash calego okna)."""
        container = QWidget()
        outer = QVBoxLayout(container)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(8)

        color_row = QHBoxLayout()
        color_row.setSpacing(8)
        swatch = _swatch_label()
        color_btn = PushButton("Kolor obrysu...")
        color_btn.clicked.connect(on_pick_color)
        color_row.addWidget(swatch)
        color_row.addWidget(color_btn)
        color_row.addStretch(1)
        outer.addLayout(color_row)

        form = QFormLayout()
        form.setFieldGrowthPolicy(QFormLayout.AllNonFixedFieldsGrow)
        width_spin = SpinBox()
        width_spin.setRange(0, 20)
        width_spin.setSuffix(" px")
        width_spin.valueChanged.connect(self._on_fields_changed)
        style_combo = ComboBox()
        for key, label in BORDER_STYLE_OPTIONS:
            style_combo.addItem(label, userData=key)
        style_combo.currentIndexChanged.connect(self._on_fields_changed)
        form.addRow(BodyLabel("Grubosc:"), width_spin)
        form.addRow(BodyLabel("Styl:"), style_combo)
        outer.addLayout(form)

        return container, swatch, width_spin, style_combo

    def _rebuild_token_buttons(self, alert_key: str):
        while self.token_row.count():
            item = self.token_row.takeAt(0)
            if item.widget():
                item.widget().deleteLater()
        for token, label in ALERT_VARIABLES.get(alert_key, [("user", "Nick")]):
            btn = PushButton(label)
            btn.clicked.connect(lambda _checked=False, t=token: self._insert_token(t))
            self.token_row.addWidget(btn)
        self.token_row.addStretch(1)

    def _insert_token(self, token: str):
        self.template_edit.insert("{" + token + "}")

    # ---------------------------------------------------------------- dane

    def _current_layout_dict(self) -> dict:
        return self.app.cfg.setdefault("layouts", {}).setdefault(self.current_key, {})

    def on_type_changed(self, index: int):
        key = self.type_combo.itemData(index)
        if key:
            self.current_key = key
            self._rebuild_token_buttons(key)
            self._load_layout_into_fields(key)

    def _load_layout_into_fields(self, key: str):
        self._loading = True
        layout = self._current_layout_dict()
        img = {**_DEFAULT_IMAGE, **layout.get("image", {})}
        cap = {**_DEFAULT_CAPTION, **layout.get("caption", {})}

        self.template_edit.setText(layout.get("text_template", _DEFAULT_TEMPLATE))
        if self.token_row.count() == 0:
            self._rebuild_token_buttons(key)

        self.image_width_spin.setValue(int(img.get("width", 30)))
        self.image_height_spin.setValue(int(img.get("height", 40)))
        self._image_border_color = img.get("border_color", "#000000")
        _set_swatch_color(self.image_border_swatch, self._image_border_color)
        self.image_border_width_spin.setValue(int(img.get("border_width", 0)))
        self._set_combo_value(self.image_border_style_combo, img.get("border_style", "none"))

        self.caption_width_spin.setValue(int(cap.get("width", 40)))
        self.caption_height_spin.setValue(int(cap.get("height", 10)))
        self.font_size_spin.setValue(int(cap.get("font_size", 32)))
        self.bg_opacity_spin.setValue(int(cap.get("bg_opacity", 90)))
        self.font_combo.setCurrentFont(self.font_combo.currentFont().__class__(cap.get("font_family", "Amatic SC")))
        self._font_color = cap.get("font_color", "#ffffff")
        self._bg_color = cap.get("bg_color", "#843935")
        _set_swatch_color(self.font_color_swatch, self._font_color)
        _set_swatch_color(self.bg_color_swatch, self._bg_color)
        self._caption_border_color = cap.get("border_color", "#000000")
        _set_swatch_color(self.caption_border_swatch, self._caption_border_color)
        self.caption_border_width_spin.setValue(int(cap.get("border_width", 3)))
        self._set_combo_value(self.caption_border_style_combo, cap.get("border_style", "solid"))

        self._set_combo_value(self.anim_in_combo, layout.get("anim_in", "fade"))
        self._set_combo_value(self.anim_out_combo, layout.get("anim_out", "fade"))
        self.anim_duration_spin.setValue(int(layout.get("anim_duration_ms", 600)))

        self._position_box(self.image_box, img["x"], img["y"], img["width"], img["height"])
        self._position_box(self.caption_box, cap["x"], cap["y"], cap["width"], cap["height"])

        self._loading = False

    @staticmethod
    def _set_combo_value(combo, value):
        idx = combo.findData(value)
        if idx >= 0:
            combo.setCurrentIndex(idx)

    @staticmethod
    def _position_box(box: _DraggableBox, x_pct, y_pct, w_pct, h_pct):
        w = max(int(CANVAS_WIDTH * w_pct / 100), 24)
        h = max(int(CANVAS_HEIGHT * h_pct / 100), 20)
        cx = int(CANVAS_WIDTH * x_pct / 100)
        cy = int(CANVAS_HEIGHT * y_pct / 100)
        box.setGeometry(cx - w // 2, cy - h // 2, w, h)

    def _on_box_moved(self, which: str, x_pct: float, y_pct: float):
        if self._loading:
            return
        layout = self._current_layout_dict()
        elem = layout.setdefault(which, dict(_DEFAULT_IMAGE if which == "image" else _DEFAULT_CAPTION))
        elem["x"] = x_pct
        elem["y"] = y_pct

    def _on_fields_changed(self, *_args):
        if self._loading:
            return
        layout = self._current_layout_dict()

        layout["text_template"] = self.template_edit.text() or _DEFAULT_TEMPLATE

        img = layout.setdefault("image", dict(_DEFAULT_IMAGE))
        img["width"] = self.image_width_spin.value()
        img["height"] = self.image_height_spin.value()
        img["border_width"] = self.image_border_width_spin.value()
        img["border_style"] = self.image_border_style_combo.currentData()
        img["border_color"] = self._image_border_color

        cap = layout.setdefault("caption", dict(_DEFAULT_CAPTION))
        cap["width"] = self.caption_width_spin.value()
        cap["height"] = self.caption_height_spin.value()
        cap["font_size"] = self.font_size_spin.value()
        cap["font_family"] = self.font_combo.currentFont().family()
        cap["bg_opacity"] = self.bg_opacity_spin.value()
        cap["font_color"] = self._font_color
        cap["bg_color"] = self._bg_color
        cap["border_width"] = self.caption_border_width_spin.value()
        cap["border_style"] = self.caption_border_style_combo.currentData()
        cap["border_color"] = self._caption_border_color

        layout["anim_in"] = self.anim_in_combo.currentData()
        layout["anim_out"] = self.anim_out_combo.currentData()
        layout["anim_duration_ms"] = self.anim_duration_spin.value()

        # Rozmiar ramki na kanwie trzeba odswiezyc (pozycja zostaje ta sama,
        # zmienia sie tylko rozmiar wokol tego samego srodka)
        self._position_box(self.image_box, img.get("x", 50), img.get("y", 38), img["width"], img["height"])
        self._position_box(self.caption_box, cap.get("x", 50), cap.get("y", 68), cap["width"], cap["height"])

    def on_pick_font_color(self):
        color = QColorDialog.getColor(QColor(self._font_color), self, "Kolor tekstu")
        if color.isValid():
            self._font_color = color.name()
            _set_swatch_color(self.font_color_swatch, self._font_color)
            self._on_fields_changed()

    def on_pick_bg_color(self):
        color = QColorDialog.getColor(QColor(self._bg_color), self, "Kolor tla")
        if color.isValid():
            self._bg_color = color.name()
            _set_swatch_color(self.bg_color_swatch, self._bg_color)
            self._on_fields_changed()

    def on_pick_image_border_color(self):
        color = QColorDialog.getColor(QColor(self._image_border_color), self, "Kolor obrysu obrazu")
        if color.isValid():
            self._image_border_color = color.name()
            _set_swatch_color(self.image_border_swatch, self._image_border_color)
            self._on_fields_changed()

    def on_pick_caption_border_color(self):
        color = QColorDialog.getColor(QColor(self._caption_border_color), self, "Kolor obrysu tabelki")
        if color.isValid():
            self._caption_border_color = color.name()
            _set_swatch_color(self.caption_border_swatch, self._caption_border_color)
            self._on_fields_changed()

    # -------------------------------------------------------------- akcje

    def on_save(self):
        cfgmod.save_config(self.app.cfg)
        InfoBar.success(
            "Zapisano", "Wyglad alertu zapisany.",
            parent=self, position=InfoBarPosition.TOP, duration=2000,
        )

    def on_send_test(self):
        ok = self.app.send_test_alert(self.current_key)
        if ok:
            InfoBar.info(
                "Wyslano", "Testowy alert wyslany do nakladki - sprawdz OBS/przegladarke.",
                parent=self, position=InfoBarPosition.TOP, duration=2500,
            )
        else:
            InfoBar.warning(
                "Silnik nie dziala",
                "Uruchom silnik w zakladce Uruchomienie, zeby wyslac testowy alert.",
                parent=self, position=InfoBarPosition.TOP, duration=3500,
            )
