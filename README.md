# Pan Szczesniak Stream Alerts 2.0
Lokalna aplikacja Windows x64 dla Twitcha i OBS. Wersja 2.0.0-rc.1 to kandydat do odbioru, nie publiczny stable. Wszystkie zaplanowane moduły zaimplementowane; test rzeczywistego stanowiska nadal wymagany.
## Instalacja
Użyj artefaktu instalatora z zielonego Windows CI dla danego commita. Zweryfikuj SHA256 z SHA256SUMS.txt. Instalator nie jest podpisany cyfrowo, więc nie ma niezależnej gwarancji tożsamości wydawcy. Nie uruchamiaj nieznanych kopii. Zakończ PSSA i niezależny Agent przed aktualizacją. Dane: %APPDATA%/PSSA 2 Dev. Przed aktualizacją wykonaj kopię poza katalogiem danych. Nie zmieniaj AppId ani nazwy EXE; zachowana zgodność aktualizacji. Wersja 1.x zachowana w main/legacy/python.
## Rozwój
Node.js 24, npm, Windows 10/11 x64.
```powershell
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm run smoke
npm run dist:win
```
## Tryby
Studio: pełny interfejs. Streaming: wolniejsze odświeżanie UI, bez miniatur biblioteki. Background: zwolnienie okna i renderera, silnik pozostaje aktywny, powrót przez zasobnik. Agent Node jest opcjonalny. Analizy i katalog są obliczane w krótkotrwałym workerze.
## Dokumentacja
[Odbiór i instalacja](docs/RELEASE_ACCEPTANCE.md) · [Architektura](docs/ARCHITECTURE.md) · [Twitch](docs/TWITCH.md) · [OBS](docs/OBS.md) · [Audyt](docs/audits/TECHNICAL_REAUDIT.md) · [Handoff](docs/HANDOFF.md) · [Nauka](docs/LEARNING_GUIDE.md).
