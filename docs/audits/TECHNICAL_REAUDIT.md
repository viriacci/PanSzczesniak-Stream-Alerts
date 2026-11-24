# Niezależny przegląd techniczny — beta.3
Data: 2026-11-24. Baza f19ab6417ca0fe17edde0ab02bb88dd1e6f5a9fe.
## Dowody bazowe
Windows run 45375146660: 73/73 testów Node, npm audit 0, typecheck, build, Chromium overlay smoke, NSIS, packaged smoke, clean install, upgrade i zachowanie markera danych po uninstall PASS. Enqueue 1000 alertów 229.2521 ms, drain 1812.2407 ms (test syntetyczny, nie stream).
437 wpisów lockfile, wszystkie z integrity, źródła npm registry. Produkcyjne npm: React 19.2.0, React DOM 19.2.0, Scheduler 0.27.0. Electron 45.4.1 to osobny runtime, oficjalne wydanie 18.11.2026 https://releases.electronjs.org/release/v45.4.1. Pięć wpisów z install scripts: @parcel/watcher, electron-winstaller, esbuild (dwie wersje), fsevents. Brak nowych pakietów.
## Zakres
Przegląd przypiętego commita: main/lifecycle, Agent, IPC, Twitch Auth/EventSub, OBS, kolejka i reguły, live i SQL, media/legacy import, overlay/renderer scen, profile, backup/restore, budowanie i frontend polling. Automatyczny inwentarz każdego śledzonego pliku (SHA256, liczba linii) i każdego wpisu lockfile (wersja, źródło, integrity, licencja, installScript), CycloneDX SBOM i npm audit. Inwentarz nie jest dowodem ręcznego przeglądu każdej linii wszystkich plików i bibliotek. Nie wykonano pełnego niezależnego pentestu ani ręcznej analizy kodu Chromium/Node i wszystkich zewnętrznych pakietów. Pozostałe pliki UI, testy i dokumenty wymagają osobnej listy kontrolnej przed stable.
## Poprawki
| ID | Ustalenie i zmiana |
|---|---|
| T01 | Pusta kolejka z aktywną nakładką pytała SQLite co 250 ms; hint hasPending pomija SQL. |
| T02 | Odczyt kolejki każdorazowo pobierał historię i reguły; cache snapshotu z invalidacją po mutacji/online. |
| T03 | Powtarzane walidacje całych scen; cache reguł po treści DB, test rollback. |
| T04 | Pełny snapshot IPC bez zmian; revision poll zwraca null. |
| T05 | Powtarzane agregacje live i pobranie pełnego stanu do wariantu; dirty flag i getter kategorii. |
| T06 | Agent pełny Electron bez okna; Node entry przez ELECTRON_RUN_AS_NODE, wrapper autostartu, smoke dev/packaged. |
| T07 | Heartbeat i status dwa żądania co 2 s; piggyback, fallback starszego Agenta, backoff offline 15 s, cache autostartu. |
| T08 | tasklist.exe co 2 s przy autoLaunch; maks. co 15 s. |
| T09 | Statyczna scena renderowana co klatkę; harmonogram granic czasowych, rAF przy animacji, particles 30 Hz, pomijanie niezmienionych stylów i ukrytych zasobów. |
| T10 | Prywatny cache treści adresowanych SHA256 do 24 h; limit 50 MB. |
| T11 | Timer kopiujący OBS state co sekundę; callback świeżej telemetrii i disconnect. |
| T12 | Import legacy mógł zapisać dane w innym profilu; sprawdzenie profilu po import dialogu. |
| T13 | Fallback preferencji Background, odziedziczone klucze template, duplikaty ID szablonu, część martwych importów. |
| T14 | Akcje CI przypięte do SHA zweryfikowanych wersji zamiast ruchomych tagów. |
Weryfikacja nowego CI oczekuje. Brak nowych funkcji użytkowych, brak zmiany schematu bazy.
## Pomiar
scripts/performance.mjs: 14400 ticków pustej kolejki, 1000 niezmienionych snapshotów z 200 wpisami historii, 500 odczytów 64 reguł z 16 warstwami. Porównanie beta.2/beta.3 na tym samym runnerze, wall/CPU ms, SQL prepares. Test idle wymaga 0 prepare po rozgrzaniu. Bez OBS, GPU i gry. Nie ekstrapolować na FPS/RAM.
scripts/profile-stream.ps1: rzeczywisty Windows PSSA+OBS+opcjonalny proces gry; tryby off/Studio/Streaming/Background, identyczna scena i gra, 120 s domyślnie. CPU procent maszyny, suma working set/private bytes, procesy. GPU i frametime osobno OBS Stats i narzędzie gry. Nie wykonano pomiarów na PC użytkownika.
## Dalsze bramki
Potwierdzić CI, Node Agent, revision IPC, benchmark i SBOM. Kontynuować ręczny audyt pozostałych plików, licencji i pakietów. Zbadać indeksy historii/kolejki/czatu, agregację dużych baz, wzrost DB i retencję bez usuwania danych bez decyzji użytkownika. Ewentualne batchowanie zapisów wymaga oceny trwałości. Background nadal wyładowuje dokument, nie gwarantuje zamknięcia procesu Chromium/GPU. Rozważyć destroy/recreate BrowserWindow po pomiarach. Backup i analityka pozostają synchroniczne: ocenić worker/snapshot WAL. Realne OBS/Twitch, Windows autostart/tray, wydajność GPU i długi stream pozostają otwarte. Brak podpisu instalatora, automatyczna instalacja unsigned zablokowana. Nie publikować stable/main.


## Wyniki beta.3 (run 45377162735)
Pełny pipeline Windows zakończony sukcesem: audit, inventory, SBOM, benchmark, typecheck, test, build, smoke (w tym Agent Node), packaged smoke, NSIS, clean install, upgrade i marker danych po uninstall.
Benchmark syntetyczny na tym samym runnerze, beta.2 → beta.3:
- 14 400 idle ticks: 305.08 → 1.66 ms, SQL 14 400 → 0.
- 1000 snapshots: 767.67 → 0.34 ms, SQL 3000 → 0.
- 500 reads of 64 rules: 1234.24 → 113.87 ms, SQL 500 → 500.
Nie są to wyniki obciążenia całej aplikacji, GPU ani FPS.

## Beta.4 — kolejna seria
- T15: ciężkie odczyty raportów, eksportów i katalogu w krótkotrwałym workerze Node z read-only SQLite, spójnym snapshotem, limitem pamięci, timeoutem 60 s, anulowaniem przy shutdown i pojedynczym aktywnym zadaniem. Brak stale uruchomionego workera.
- T16: import historii blokowany podczas transmisji/aktywnej kolejki; stan sprawdzany ponownie po wyborze i odczycie pliku, również OBS.
- T17: memoizacja stron, brak dekodowania miniatur w Streaming, zachowanie nowszego szkicu edytora przy równoległym zapisie.
- Test read tasks i rozszerzenie smoke IPC na katalog. CI beta.4 wymaga potwierdzenia; brak zmiany schematu lub zależności.
- Dalsze bramki: rzeczywisty OBS/Twitch, pomiary trybów na komputerze, soak test 6–8h, profilowanie pamięci/GPU i dalszy przegląd zewnętrznych źródeł pakietów. Nie publikować stable przed akceptacją.

## Domknięcie RC.1
Beta.4 run 45378166188 — 78/78, audit 0, full Windows CI PASS. RC T18–T23: kolejka budzona przez zdarzenia/ACK/zmianę transportu i pojedynczy deadline, schema 5 (indeksy historii i zdarzeń), odczyt backupów v4 i v5, zachowanie starego EventSub podczas awarii zastępczego socketu, Background destroy/recreate BrowserWindow i rebinding IPC, limit importu po odczycie, 8h wirtualnego soak. Weryfikacja RC oczekuje. Brak pomiaru rzeczywistego GPU, RAM i frametimes; nie zastępować go testem syntetycznym. Pełny upstream source audit i fizyczne stanowisko nadal poza dowodem CI.
