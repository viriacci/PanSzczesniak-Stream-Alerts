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

## Etap 4
Etap 3 CI run 45357845578: typecheck PASS, test overlay FAIL z powodu parameter property w trybie strip-only. Zmieniono konstruktor na jawne pola. Dodano 5 testów kolejki, w tym 1000 zdarzeń, rozszerzono test ACK i smoke; zmieniono test migracji schema 2. Wynik nowego CI oczekuje. Rzeczywisty Twitch/OBS nieprzetestowany. Audyt A jest następną obowiązkową bramką.

## Etap 4 potwierdzony
Run 45360806153: success, 20/20 testów, typecheck, build, smoke i installer. Audyt A: oczekuje na weryfikację nowego CI i analizę npm audit. Raport docs/audits/AUDIT_A.md.

Audyt A zamknięty automatycznie, run 45364375474: 29/29, full/production npm audit 0, packaged EXE smoke PASS. Etap 5: 4 nowe testy OBS i Agenta, smoke IPC OBS; CI oczekuje. Rzeczywisty OBS i proces Agenta poza aplikacją wymagają testu na Windows.

Etap 5: run 45365741505 success. Etap 6: 7 nowych testów Live Center (sesje, dedup i agregacja, luki API, bitrate, prywatność czatu, akcje i scope, spóźniona odpowiedź), regresje schema 3 i EventSub; smoke rozszerzony o liveState. CI oczekuje. Realny Twitch/OBS nieprzetestowany.

Etap 6 run 45368803283: npm audit clean, typecheck FAIL TS2532 auth.ts:29; poprawka w etapie 7. Etap 7: 5 nowych testów sceny i rozszerzony smoke nakładki Chromium z ACK. Pełny CI oczekuje; nie uznawać nieuruchomionych testów za PASS.

Etap 7: run 45370241006 success, 45/45, npm audit 0, typecheck, build, smoke render/ACK, NSIS, packaged smoke PASS. Audyt B: 6 nowych testów i rozszerzenie testu Agenta, CI oczekuje. Manualne scenariusze nieprzeprowadzone.

Dodatkowo 1 test regresji OBS i rozszerzenie smoke o poprawny PNG oraz brakujący PNG. Łącznie 52 testy Node; CI oczekuje.

Audyt B: run 45371861162 success, 52/52 PASS, clean audit, build, NSIS, Chromium media smoke i packaged smoke. Etap 8: 5 nowych testów biblioteki/profili/wariantów. CI oczekuje; manualne Twitch/OBS bez zmian.

Etap 8 run 45372844349 success (57 testów, clean audit, build/smoke/NSIS/packaged smoke). Etap 9: 6 nowych testów analityki i importu/eksportu, schema 4, rozszerzenie smoke IPC. Nowy CI oczekuje.

Etap 9 run 45373639990 success, 63/63, audit 0, build i smoke, NSIS i packaged smoke. Etap 10 beta.1: 5 testów runtime/backup, smoke IPC diagnostics, clean install smoke dodany. CI oczekuje. Realny Twitch/OBS, upgrade, autostart, wydajność pozostają otwarte.

Beta.1 run 45374474420 success: 68/68, audit 0, build, smoke, NSIS, packaged i clean install PASS. Audyt C beta.2: 5 nowych testów (73 łącznie) oraz test upgrade/uninstall, CI oczekuje. Realne środowisko streamera nadal nieprzetestowane.

Beta.2 run 45375146660: 73/73 PASS, audit clean, build/smoke, NSIS, installed, upgrade/uninstall marker. Beta.3: 4 nowe testy (77), smoke Node Agent/revision, benchmark, inventory, SBOM. CI oczekuje.

Beta.3 run 45377162735 success; Beta.4 run 45378166188 success, 78/78, npm audit 0, worker/Agent Node, build/smoke/NSIS/install/upgrade/uninstall. RC.1: 5 nowych testów (83 łącznie), w tym migracja v4→v5, restore v4, nextDelay, awaria migracji EventSub i 8h wirtualny soak. Dodatkowy smoke Background destroy/recreate. CI oczekuje. Rzeczywiste testy stanowiska: docs/RELEASE_ACCEPTANCE.md.

RC.1 run 45379912938: npm audit 0, benchmark i typecheck PASS, 82/83 testów PASS (w tym wirtualne 8h); FAIL plan historii używał alert_queue_pending i TEMP B-TREE. RC.2 jawnie wskazuje partial index w produkcyjnym SQL i testuje ten sam fragment zapytania. CI oczekuje.
