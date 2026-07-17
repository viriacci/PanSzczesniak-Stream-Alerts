"""
Ladowanie i zapisywanie konfiguracji programu.
Config (config.json, media/, overlay.html, instrukcja.txt, owo.png) trzyma
sie w folderze Dokumenty/Shiroe Twitch Alerts uzytkownika - niezaleznie
od tego, gdzie polozony jest sam plik .exe.
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
}

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

def base_dir() -> Path:
    """Folder, w ktorym trzymamy dane (config.json, media/ itd.)."""
    d = _documents_dir() / "Shiroe Twitch Alerts"
    d.mkdir(parents=True, exist_ok=True)
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
    obok siebie w Dokumentach.
    """
    if not getattr(sys, "frozen", False):
        return

    target_dir = base_dir()
    # Lista wszystkich plików, które muszą zostać wypakowane do Dokumentów.
    # UWAGA: "instrukcja.txt" to aktualny format tresci zakladki Instrukcja
    # (z tagami {checkbox}/<H1>/<H2>); "instructions.txt" zostaje jako
    # zapasowy fallback dla starszego, prostszego formatu.
    files_to_copy = ("overlay.html", "icon.png", "instrukcja.txt", "instructions.txt", "owo.png")

    for name in files_to_copy:
        target = target_dir / name
        # Jeśli plik już istnieje, nie nadpisujemy go, żeby nie zepsuć ustawień użytkownika
        if target.exists():
            continue

        src = resource_path(name)
        if src.exists():
            try:
                shutil.copyfile(src, target)
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
