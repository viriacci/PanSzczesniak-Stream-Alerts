"""
Ladowanie i zapisywanie konfiguracji programu.
Config (config.json, media/, overlay.html) trzyma sie w folderze
Dokumenty/Nagrody Vivi uzytkownika - niezaleznie od tego, gdzie polozony
jest sam plik .exe.
"""
import json
import sys
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
    # rewards: { "<reward_id>": {"title": "...", "gif": "media/xxx.gif", "sound": "media/xxx.mp3", "duration": 5} }
    "rewards": {}
}


def _documents_dir() -> Path:
    """Zwraca prawdziwy folder Dokumenty uzytkownika (dziala tez z polskim
    Windowsem, gdzie widoczna nazwa to "Dokumenty" ale to samo co "Documents")."""
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
    """Folder z danymi programu: Dokumenty/Nagrody Vivi. Tworzony automatycznie,
    jesli jeszcze nie istnieje."""
    d = _documents_dir() / "Nagrody Vivi"
    d.mkdir(parents=True, exist_ok=True)
    return d


def resource_path(name: str) -> Path:
    """Sciezka do pliku zaszytego WEWNATRZ .exe (np. overlay.html, icon.png).

    Przy onefile PyInstaller w trakcie startu rozpakowuje takie pliki do
    tymczasowego folderu sys._MEIPASS. W trybie deweloperskim to po prostu
    plik obok skryptu.
    """
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS) / name
    return Path(__file__).parent / name


def ensure_bundled_files() -> None:
    """Przy pierwszym uruchomieniu .exe kopiuje overlay.html/icon.png (zaszyte
    w exe) obok niego, zeby OverlayServer i ikona okna mialy skad je wziac.
    Dzieki temu wystarczy wyslac SAM plik .exe - reszta tworzy sie sama."""
    if not getattr(sys, "frozen", False):
        return
    import shutil
    target_dir = base_dir()
    for name in ("overlay.html", "icon.png"):
        target = target_dir / name
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
    # dopelnij brakujace klucze domyslnymi wartosciami (np. po update programu)
    merged = dict(DEFAULT_CONFIG)
    merged.update(data)
    return merged


def save_config(cfg: dict) -> None:
    with open(config_path(), "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)
