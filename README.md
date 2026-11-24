# Pan Szczesniak Stream Alerts 2.0

Lokalna aplikacja Windows dla Twitcha i OBS. Etap 6: Live Center, Twitch, silnik alertów i OBS, nie gotowy następca PSSA 1.x.

## Uruchomienie

Node.js 24 LTS, npm, Windows 10/11 x64.
```powershell
npm install
npm run dev
```
```powershell
npm run typecheck
npm test
npm run build
npm run smoke
npm run dist:win
```
Instalator developerski (niepodpisany) ma trafić do `dist/`. Windows CI etapu 1 wygenerowało artefakt EXE; brak publicznego release. Instalator nie publikuje wydania automatycznie.

- `main` i `legacy/python`: zachowana wersja Pythonowa.
- `develop/v2`: nowa aplikacja.
- Dane v2: `%APPDATA%/PSSA 2 Dev` (osobna baza i log).
- Lockfile jest przechowywany w repozytorium; użyj npm ci.
- Etap 3: Twitch i nakładka OBS, import konfiguracji. Kolejka, OBS i Live Center działają lokalnie; statystyki historyczne w etapie 9. Zobacz docs/TWITCH.md i docs/OBS.md.

Zobacz [architekturę](docs/ARCHITECTURE.md), [handoff](docs/HANDOFF.md), [roadmapę](ROADMAP.md) i [przewodnik do nauki](docs/LEARNING_GUIDE.md).
