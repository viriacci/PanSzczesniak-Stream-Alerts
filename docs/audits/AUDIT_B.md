# Audyt B — etapy 1–7
Data 2026-11-24. Baza d1fb25346ff418f9179bbf89f7b21695cbb5bd71.
## Bazowa weryfikacja
Run 45370241006: 45/45 PASS, clean npm audit, typecheck, build, Chromium overlay render/ACK smoke, NSIS i packaged smoke PASS. Etap 6 wcześniej zatrzymał się na TS2532; poprawka została potwierdzona w tym runie. https://github.com/viriacci/PanSzczesniak-Stream-Alerts/actions/runs/45370241006
## Zakres i ustalenia
Przegląd kodu: Agent server/bridge, OBS WebSocket, lifecycle/IPC, Twitch Auth/EventSub, Live Center store/service, media/import, kolejka i model, renderer scen, UI studio i snapshot. Ponownie sprawdzono bazowy CI, zabezpieczenia lokalnego transportu oraz zależności. Nie jest to niezależny pentest ani certyfikacja bezpieczeństwa.
| ID | Priorytet | Przyczyna | Poprawka |
|---|---|---|---|
| B01 | P1 | Agent usuwał komendę przed jej odebraniem | ID polecenia, ponawianie do ACK refresh lub closing, bridge dedup |
| B02 | P1 | Spóźniony heartbeat/closing mógł zaburzyć restart i stan nowej instancji | Izolacja instancji, idempotentne closing, 3 s bufor |
| B03 | P1 | Refresh źródeł OBS mógł kontynuować się po zmianie sesji WebSocket | Kontrola tego samego socketu przed każdym requestem |
| B04 | P1 | Czas alertu startował przed gotowością obrazu/audio/wideo | Wspólna readiness, limit 7 s, media-error zamiast pozornego done |
| B05 | P1 | Zapis z Visual Studio mógł nadpisać ustawienia reguły z innego widoku | Dedykowane IPC saveScene, merge w main |
| B06 | P1 | Niepoprawna odpowiedź streams [null] interpretowana jako offline | Walidacja, unknown, bez zamykania sesji |
| B07 | P2 | Ręczne odświeżenia mogły zawyżać wagę próbek | Minimum 25 s między zapisywanymi próbkami, metadata aktualizowana nadal |
| B08 | P2 | EventSub online/offline w trakcie pollingu mógł zostać pominięty | Koalescencja dodatkowego odczytu |
| B09 | P2 | Brak HTTP Range dla seek video/audio | Single range 206/416, test HTTP |
| B10 | P2 | Drag powodował tworzenie od nowa wszystkich elementów DOM i mediów | Oddzielne updateGeometry przy zmianach geometrii |
| B11 | P2 | Nawigacja powodowała utratę szkicu | Do 50 szkiców w pamięci renderera, jawne odrzucenie, brak autosave dyskowego |
| B12 | P2 | Polling kolejki przesyłał pełne snapshoty scen 200 elementów | Lekki QueueSummary, pełne reguły tylko w backendzie |
| B13 | P2 | Równoległe okna wyboru pliku/import mogły się nakładać | Guard dialogBusy |
| B14 | P2 | Zbyt słaba walidacja czasu i odpowiedzi OBS/EventSub | Kontrola rpcVersion, migration session ID, timestamp i stare obserwacje |
| B15 | P2 | Dock mógł nakładać zapytania i długo czekać na API | Timeout, single poll i porównanie klucza na bajtach |
| B16 | P2 | SSE bez sprawdzenia obcego Origin i nadmiarowy payload playback | Odrzucenie obcego Origin, tylko scena i dane konieczne do renderowania |
Wszystkie wymienione pozycje mają poprawki w kodzie, ale status weryfikacji = oczekuje CI. Nie przechodzić do etapu 8 przed zielonym pipeline i zamknięciem nowych P0/P1.
## Pozostałe ograniczenia / testy manualne
- Realny Twitch, OBS/CEF, autostart Windows, rozłączenie sieci, kodeki, alpha WebM i różnice fontów niezweryfikowane. Smoke Chromium nie zastępuje OBS.
- Agent jest procesem Electron bez okna, nie minimalnym niezależnym Node binary. Watchdog wyłącznie dla własnego child process, brak kill zawieszonego procesu; brak gwarancji restartu po hard crash procesu uruchomionego ręcznie.
- ACK nie gwarantuje, że alert był widoczny na aktywnej scenie OBS lub słyszalny. Jedno aktywne źródło SSE. Brak dokładnie-jednorazowego odtwarzania przy awarii. Bufor gotowości ograniczony.
- Statystyki zdarzeń mają braki przy nieaktywnych subskrypcjach i rozłączeniu; nieprzypisane zdarzenia po ostatnim potwierdzeniu pozostają w bazie. Średnia z próbek, nie oficjalne Twitch Analytics; bitrate dotyczy OBS, nie potwierdza transmisji do konkretnego kanału. Czas końca dolne oszacowanie.
- Szkice nie przeżywają restartu renderera/programu. Limit 50, najstarszy wypada. Pełna ochrona niezapisanych zmian, trwałe drafty, edycja keyframes i timeline drag do późniejszego UX. Brak SVG.
- Nadal do wykonania: retencja, backup/restore, instalacja/upgrade na Windows, profilowanie CPU/RAM/GPU przy OBS+gra, długotrwały test i testy prawdziwych formatów wideo/audio. Nie raportować pomiarów, których nie wykonano.

## Dodatkowe testy po przeglądzie
Dodano regresję wymiany socketu OBS w trakcie refreshu oraz rozszerzony smoke rzeczywistego Chromium: poprawna wielowarstwowa scena z deterministycznym PNG, potwierdzenie renderowania i ACK, brakujący PNG musi zakończyć się failed/media-error. Preview oczekuje na ten sam readiness i ogranicza odświeżanie zegara React do ~15 Hz, pozostawiając renderowanie animacji w requestAnimationFrame. Wynik wymaga CI.

## Zamknięcie bramki automatycznej
Run 45371861162: 52/52 PASS, npm audit 0, typecheck, build, smoke Chromium (warstwy PNG oraz brakujący zasób), NSIS i packaged smoke PASS. Regresje B01–B16 potwierdzone w zakresie automatycznych testów; manualne ograniczenia pozostają otwarte. Etap 8 odblokowany.
