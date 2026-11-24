# PanSzczesniak Stream Alerts 2.0

Lokalna aplikacja Windows dla Twitcha i OBS. Etap 2: interfejs i fundamenty, nie gotowy następca PSSA 1.x.

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
- Lockfile: do wygenerowania i zatwierdzenia po pierwszej udanej instalacji zależności; do tego czasu build nie jest w pełni powtarzalny.
- Etap 2 nie łączy się z Twitchem ani OBS, nie importuje danych starego programu.

Zobacz [architekturę](docs/ARCHITECTURE.md), [handoff](docs/HANDOFF.md), [roadmapę](ROADMAP.md) i [przewodnik do nauki](docs/LEARNING_GUIDE.md).
