# Odbiór wydania

## CI

Każdy kandydat do dystrybucji musi przejść pełny workflow Windows dla dokładnego commita: npm audit, inwentaryzacja źródeł, SBOM, benchmark, typecheck, testy Node, kompilacja, Electron smoke, build wtyczki OBS, uruchomienie spakowanej aplikacji, test restartu, instalacja, aktualizacja i dezinstalacja z zachowaniem danych. Artefakty i SHA-256 muszą pochodzić z tej samej kompilacji.

## Testy na stanowisku Windows

- Instalacja, aktualizacja z poprzedniej wersji, skróty, zachowanie danych i ponowne uruchomienie.
- Twitch: logowanie, odświeżenie tokenu, reconnect, rzeczywiste zdarzenia i nagrody.
- OBS: źródło przeglądarkowe, dźwięk, zmiana scen, dock, start/stop/restart, Agent.
- Alerty: grafika/GIF/wideo/audio, pauza, skip, replay, brak pliku, profile i szablony.
- Kopia zapasowa i przywrócenie na osobnym zestawie danych, import/eksport statystyk.
- Wszystkie tryby pracy, zmiana układu, samouczki oraz skórki.
- Wielogodzinna sesja z grą i OBS; syntetyczny soak nie zastępuje rzeczywistej transmisji.

Przed testem aktualizacji wykonać kopię poza katalogiem danych. Nie publikować tokenów, adresów nakładek ani prywatnych raportów.

## Wydajność

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\profile-stream.ps1 -Seconds 120 -Label Background -Game RDR2 -Output background.csv
```

Porównać Off, Studio, Streaming i Background w tej samej grze i scenie OBS. Kontrolować CPU/RAM, FPS, frametime oraz rendering/encoding lag w OBS. Cele: CPU idle poniżej 0,5%, bez alertów poniżej 1%, Agent poniżej 50 MB, spadek FPS poniżej 1%; nie są to gwarancje.

## Status 2.0.0

Opublikowane RC.22 ma zakończony Windows CI. Zmiany optymalizacyjne po RC.22 są weryfikowane oddzielnie. Pełny ręczny audyt kodu oraz testy rzeczywistego stanowiska pozostają otwarte zgodnie z [raportem](AUDIT_RC22.md). Stabilny instalator wymaga ustalenia podpisu i ścieżki aktualizacji z niepodpisanych RC. Nie nadpisywać istniejących wydań.
