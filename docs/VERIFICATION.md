# Weryfikacja
## Etap 1 — potwierdzony Windows
GitHub Actions run 45355291216, commit 774df6039b5b44d8ab7ac3bbf308bd208f92a6d4, conclusion success. Instalacja zależności, typecheck, test, build, smoke Electron (IPC i SQLite), NSIS oraz upload artefaktu zakończone pomyślnie.
https://github.com/viriacci/PanSzczesniak-Stream-Alerts/actions/runs/45355291216
Instalator niepodpisany; nie jest publicznym wydaniem. Test instalacji u użytkownika pozostaje do wykonania.
## Etap 2 — oczekuje na CI
Dodano trzy testy jednostkowe walidacji layoutu, trwałości ustawień i przywracania okna. Smoke rozszerzony o rzeczywisty zapis layoutu przez IPC. CI ma uruchomić wszystkie testy, kompilację, smoke i NSIS. Nie oznaczać ich jako zaliczonych bez wyniku. Test ręczny: szerokość menu/inspektora, restart, monitor odłączony, focus i klawiatura, okno 700px, dialog resetu, wygląd na Windows.

## Etap 2 — potwierdzony Windows
Run 45356052125: success. https://github.com/viriacci/PanSzczesniak-Stream-Alerts/actions/runs/45356052125
## Etap 3 — oczekuje na CI
Dodano 4 testy jednostkowe/integracyjne normalizacji zdarzeń, walidacji reguł, zapisu i importu; rozszerzono smoke. Rzeczywisty Twitch/OBS, OAuth callback i render multimediów wymagają testów ręcznych; bez ich wykonania nie uznawać ich za zaliczone.

Dodano test HTTP/SSE lokalnej nakładki: dostęp z kluczem, odmowa bez klucza i niedozwolonej nazwy pliku, dostarczenie zdarzenia. Wynik wymaga CI.
