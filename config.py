"""
Ladowanie i zapisywanie konfiguracji programu.
Config trzyma sie w pliku config.json obok programu (albo obok .exe po zbudowaniu).
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


def base_dir() -> Path:
    """Folder obok .exe (po spakowaniu PyInstallerem) albo obok skryptu (w trakcie developmentu)."""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent
    return Path(__file__).parent


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
