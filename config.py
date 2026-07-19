"""
Ladowanie i zapisywanie konfiguracji programu.
Config (config.json, media/, overlay.html, instrukcja.txt, owo.png) trzyma
sie w folderze Dokumenty/PanSzczesniak Stream Alerts uzytkownika -
niezaleznie od tego, gdzie polozony jest sam plik .exe.
"""
import json
import sys
import shutil
from pathlib import Path

DEFAULT_CONFIG = {
    "client_id": "",
    "client_secret": "",
    "redirect_uri": "http://localhost:3000",
    "access_token": "",
    "refresh_token": "",
    "broadcaster_id": "",
    "broadcaster_login": "",
    "overlay_ws_port": 8765,
    "overlay_http_port": 8766,
    "lan_access": False,
    "default_duration_seconds": 5,
    "rewards": {},
    "instructions_completed": False,
    "completed_steps": [],
    # alerty inne niz nagrody za punkty kanalu - kazdy typ ma jedno, stale
    # przypisanie (nie liste do wyboru jak rewards), bo Twitch nie daje
    # listy "dostepnych raidow/followow" do pobrania z API
    "alerts": {
        "raid": {"enabled": False, "gif_source": "", "sound_source": "", "gif_url": "", "sound_url": "", "duration": 5},
        "follow": {"enabled": False, "gif_source": "", "sound_source": "", "gif_url": "", "sound_url": "", "duration": 5},
        "sub": {"enabled": False, "gif_source": "", "sound_source": "", "gif_url": "", "sound_url": "", "duration": 5},
        "prime_sub": {"enabled": False, "gif_source": "", "sound_source": "", "gif_url": "", "sound_url": "", "duration": 5},
        "bits": {"enabled": False, "gif_source": "", "sound_source": "", "gif_url": "", "sound_url": "", "duration": 5},
    },
    # layouty (wyglad) dla edytora wizualnego - kazdy typ alertu ma wlasny,
    # niezalezny wyglad. Pozycje/rozmiary w procentach kanwy nakladki (0-100),
    # x/y to SRODEK elementu (latwiejsze do przeciagania niz rog).
    # text_template: wzor tresci "tabelki" - dostepne tokeny zaleza od typu
    # alertu, patrz ALERT_VARIABLES w layout_editor.py (np. {user}, {reward}).
    "layouts": {
        "redemption": {
            "image": {"x": 50, "y": 38, "width": 30, "height": 40,
                      "border_width": 0, "border_color": "#000000", "border_style": "none"},
            "caption": {"x": 50, "y": 68, "width": 40, "height": 10,
                        "font_size": 32, "font_family": "Amatic SC", "font_color": "#ffffff",
                        "bg_color": "#843935", "bg_opacity": 90,
                        "border_width": 3, "border_color": "#000000", "border_style": "solid"},
            "text_template": "{user} odbiera {reward}",
            "anim_in": "fade", "anim_out": "fade", "anim_duration_ms": 600,
        },
        "raid": {
            "image": {"x": 50, "y": 38, "width": 30, "height": 40,
                      "border_width": 0, "border_color": "#000000", "border_style": "none"},
            "caption": {"x": 50, "y": 68, "width": 40, "height": 10,
                        "font_size": 32, "font_family": "Amatic SC", "font_color": "#ffffff",
                        "bg_color": "#843935", "bg_opacity": 90,
                        "border_width": 3, "border_color": "#000000", "border_style": "solid"},
            "text_template": "{user} najechal z {viewers} widzami!",
            "anim_in": "fade", "anim_out": "fade", "anim_duration_ms": 600,
        },
        "follow": {
            "image": {"x": 50, "y": 38, "width": 30, "height": 40,
                      "border_width": 0, "border_color": "#000000", "border_style": "none"},
            "caption": {"x": 50, "y": 68, "width": 40, "height": 10,
                        "font_size": 32, "font_family": "Amatic SC", "font_color": "#ffffff",
                        "bg_color": "#843935", "bg_opacity": 90,
                        "border_width": 3, "border_color": "#000000", "border_style": "solid"},
            "text_template": "{user} zaczyna Cie sledzic!",
            "anim_in": "fade", "anim_out": "fade", "anim_duration_ms": 600,
        },
        "sub": {
            "image": {"x": 50, "y": 38, "width": 30, "height": 40,
                      "border_width": 0, "border_color": "#000000", "border_style": "none"},
            "caption": {"x": 50, "y": 68, "width": 40, "height": 10,
                        "font_size": 32, "font_family": "Amatic SC", "font_color": "#ffffff",
                        "bg_color": "#843935", "bg_opacity": 90,
                        "border_width": 3, "border_color": "#000000", "border_style": "solid"},
            "text_template": "{user} zasubskrybowal!",
            "anim_in": "fade", "anim_out": "fade", "anim_duration_ms": 600,
        },
        "prime_sub": {
            "image": {"x": 50, "y": 38, "width": 30, "height": 40,
                      "border_width": 0, "border_color": "#000000", "border_style": "none"},
            "caption": {"x": 50, "y": 68, "width": 40, "height": 10,
                        "font_size": 32, "font_family": "Amatic SC", "font_color": "#ffffff",
                        "bg_color": "#843935", "bg_opacity": 90,
                        "border_width": 3, "border_color": "#000000", "border_style": "solid"},
            "text_template": "{user} zasubskrybowal z Prime!",
            "anim_in": "fade", "anim_out": "fade", "anim_duration_ms": 600,
        },
        "bits": {
            "image": {"x": 50, "y": 38, "width": 30, "height": 40,
                      "border_width": 0, "border_color": "#000000", "border_style": "none"},
            "caption": {"x": 50, "y": 68, "width": 40, "height": 10,
                        "font_size": 32, "font_family": "Amatic SC", "font_color": "#ffffff",
                        "bg_color": "#843935", "bg_opacity": 90,
                        "border_width": 3, "border_color": "#000000", "border_style": "solid"},
            "text_template": "{user} rzucil {bits} bitsow!",
            "anim_in": "fade", "anim_out": "fade", "anim_duration_ms": 600,
        },
    },
}

# Nazwy folderow danych uzywane przez wczesniejsze wersje/rebrandy programu
# (Nagrody Vivi -> PanSzczesniak Twitch Alerts -> Shiroe Twitch Alerts).
# Trzymane tu wylacznie do jednorazowej migracji danych - patrz
# _migrate_legacy_data() nizej.
_LEGACY_FOLDER_NAMES = (
    "Shiroe Twitch Alerts",
    "Nagrody Vivi",
    "PanSzczesniak Twitch Alerts",
)

def _documents_dir() -> Path:
    """Zwraca prawdziwy folder Dokumenty uzytkownika (dziala tez gdy jest
    przekierowany np. przez OneDrive Backup - bardzo czeste na Windows)."""
    if sys.platform == "win32":
        try:
            import ctypes
            from ctypes import wintypes
            CSIDL_PERSONAL = 5  # Dokumenty / My Documents
            SHGFP_TYPE_CURRENT = 0
            buf = ctypes.create_unicode_buffer(wintypes.MAX_PATH)
            ctypes.windll.shell32.SHGetFolderPathW(None, CSIDL_PERSONAL, None, SHGFP_TYPE_CURRENT, buf)
            if buf.value:
                return Path(buf.value)
        except Exception:
            pass
    return Path.home() / "Documents"

def _migrate_legacy_data(target_dir: Path) -> None:
    """Jednorazowa migracja danych ze starszych nazw folderu programu (z
    czasow zanim nazywal sie "PanSzczesniak Stream Alerts"). Dzieki temu
    ktokolwiek juz z niego korzystal (config.json, media/, autoryzacja
    Twitcha, przypisania nagrod) nie musi ustawiac wszystkiego od nowa po
    aktualizacji do nowej wersji/nazwy. Bezpieczne: nic nie robi, jesli w
    nowym folderze juz jest config.json (np. druga migracja albo zwykle
    kolejne uruchomienie)."""
    if (target_dir / "config.json").exists():
        return

    docs_dir = _documents_dir()
    candidates = [
        docs_dir / name for name in _LEGACY_FOLDER_NAMES
        if (docs_dir / name / "config.json").exists()
    ]
    if not candidates:
        return

    # Jesli istnieje kilka starych folderow (kolejne rebrandy), bierzemy
    # ten z najnowiej zmienianym config.json - najprawdopodobniej ten,
    # z ktorego uzytkownik faktycznie korzystal ostatnio.
    source = max(candidates, key=lambda p: (p / "config.json").stat().st_mtime)

    try:
        for item in source.iterdir():
            dest = target_dir / item.name
            if item.is_dir():
                shutil.copytree(item, dest, dirs_exist_ok=True)
            else:
                shutil.copyfile(item, dest)
    except OSError:
        pass  # migracja to "best effort" - w najgorszym razie uzytkownik configuruje od nowa

def base_dir() -> Path:
    """Folder, w ktorym trzymamy dane (config.json, media/ itd.)."""
    d = _documents_dir() / "PanSzczesniak Stream Alerts"
    d.mkdir(parents=True, exist_ok=True)
    _migrate_legacy_data(d)
    return d

def resource_path(name: str) -> Path:
    """
    Pobiera ścieżkę do zasobów:
    1. W trybie spakowanym (PyInstaller) szuka wewnątrz folderu tymczasowego.
    2. W trybie developerskim szuka w katalogu ze skryptem.
    """
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS) / name
    return Path(__file__).parent / name

def ensure_bundled_files() -> None:
    """
    Przy pierwszym uruchomieniu .exe kopiuje pliki zaszyte w exe
    (overlay.html, icon.png, instrukcja.txt, instructions.txt, owo.png)
    obok siebie w Dokumentach. Zapisuje tez startup_log.txt z informacja co
    sie udalo/nie udalo skopiowac - przydatne do diagnozowania problemow na
    komputerach, do ktorych nie mamy bezposredniego dostepu (np. zniknal
    checkbox w zakladce Instrukcja - ten log pokaze, czy to dlatego, ze
    instrukcja.txt w ogole nie byla w paczce programu).
    """
    if not getattr(sys, "frozen", False):
        return

    target_dir = base_dir()
    # Lista wszystkich plików, które muszą zostać wypakowane do Dokumentów.
    # UWAGA: "instrukcja.txt" to aktualny format tresci zakladki Instrukcja
    # (z tagami {checkbox}/<H1>/<H2>); "instructions.txt" zostaje jako
    # zapasowy fallback dla starszego, prostszego formatu.
    files_to_copy = ("overlay.html", "icon.png", "instrukcja.txt", "instructions.txt", "owo.png")
    log_lines = [f"ensure_bundled_files() - {target_dir}"]

    for name in files_to_copy:
        target = target_dir / name
        if target.exists():
            log_lines.append(f"  {name}: juz jest w folderze danych - pomijam")
            continue

        src = resource_path(name)
        if not src.exists():
            log_lines.append(f"  {name}: BRAK w paczce programu ({src}) - NIE skopiowano")
            continue

        try:
            shutil.copyfile(src, target)
            log_lines.append(f"  {name}: skopiowano z paczki programu")
        except OSError as e:
            log_lines.append(f"  {name}: BLAD kopiowania - {e}")

    try:
        with open(target_dir / "startup_log.txt", "w", encoding="utf-8") as f:
            f.write("\n".join(log_lines))
    except OSError:
        pass

def config_path() -> Path:
    return base_dir() / "config.json"

def media_dir() -> Path:
    d = base_dir() / "media"
    d.mkdir(exist_ok=True)
    return d

def load_config() -> dict:
    path = config_path()
    if not path.exists():
        save_config(DEFAULT_CONFIG)
        return dict(DEFAULT_CONFIG)
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        data = {}

    # Dopełnienie brakujących kluczy domyślnymi wartościami (np. po aktualizacji programu)
    updated = False
    for k, v in DEFAULT_CONFIG.items():
        if k not in data:
            data[k] = v
            updated = True
    if updated:
        save_config(data)
    return data

def save_config(config_dict: dict) -> None:
    with open(config_path(), "w", encoding="utf-8") as f:
        json.dump(config_dict, f, indent=4, ensure_ascii=False)
