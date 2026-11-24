# Audyt C — końcowy przegląd beta.2
## Baseline
Beta.1 (22b792b), run 45374474420 success: 68/68 testów Node, npm audit 0, typecheck, build, Chromium overlay smoke, NSIS, packaged smoke i clean install. Nie jest to potwierdzenie braku wszystkich podatności ani test na fizycznym komputerze streamera.
## Przegląd i poprawki
| ID | Priorytet | Ustalenie i poprawka |
|---|---|---|
| C01 | P1 | Eksport analityki mógł nadpisać dowolny plik wybrany w dialogu, również bazę. Wspólny guard katalogu danych, wyjście atomowe bez nadpisania przez hard link. |
| C02 | P1 | Stary edytor po zmianie profilu mógł zapisać scenę/regułę do nowego profilu. Wymagany identyfikator aktywnego profilu w IPC. |
| C03 | P1 | Import backupu akceptował obce obiekty SQL i tworzył pełną kopię tabel w RAM. Porównanie znanego schematu przed quick_check, odrzucenie sidecarów, walidacja kopii w tymczasowej bazie dyskowej. |
| C04 | P2 | Niedokończony zapis eksportu/backup/mediów mógł zostawić plik finalny. Publikacja kompletnego pliku bez zastępowania istniejącego. |
| C05 | P2 | Oddzielne blokady dialogów dopuszczały równoległe operacje runtime i alertów. Jeden guard w IPC. |
| C06 | P2 | Backup podczas aktywnego lub oczekującego alertu blokował silnik. Dodano kontrolę kolejki. |
| C07 | P2 | Błąd utworzenia WebSocket kończył reconnect EventSub. Ponawianie z backoff, nieudana migracja nie zamyka poprzedniego socketu. |
| C08 | P2 | Brak zasobnika pozostawiał preferencję Background mimo aktywnego UI. Fallback do Streaming. |
| C09 | P2 | Odpowiedź GitHub Releases bez limitu wielkości. Limit 2 MiB. |
| C10 | P3 | Ujednolicony branding: Pan Szczesniak Stream Alerts; nazwisko po polsku Szcześniak. Zachowano istniejące AppId, nazwę pliku exe, katalog danych i repozytorium. |
Poprawki w kodzie, regresje w 5 dodatkowych testach Node, wynik CI oczekuje. 
## Pozostałe bramki
- Test aktualizacji instalacji z beta.1 do beta.2 oraz zachowania markeru danych przy uninstall w CI dodany; nie jest testem pełnej migracji realnej bazy użytkownika.
- Złożone sceny, faktyczny OBS/CEF, Twitch OAuth i eventy live, urządzenia audio, WebM alpha, autostart Agenta, przejścia tray/background na realnym Windows oraz test wielogodzinny w połączeniu z OBS i grą pozostają niezweryfikowane.
- Backup/restore synchronizowany w main; walidacja na dysku ogranicza RAM, ale nie eliminuje blokowania procesu. Backup tylko poza wykrytą transmisją i przy pustej kolejce. Limit 1 GB. Publikacja wymaga systemu plików obsługującego hard linki (np. NTFS); nośniki FAT/exFAT mogą zostać odrzucone bez nadpisywania pliku. Przywracanie nie kasuje dodatkowych mediów. 
- Nie ma automatycznej instalacji aktualizacji, podpisu kodu, ani autoryzowanego API SullyGnome. Zachowana preferencja manualnego release. 
- Przejrzano istotne ścieżki IPC, backupu, eksportu, EventSub, statystyk, profili, kolejki, Agenta, overlay i lifecycle. Nie jest to pełny niezależny pentest. Wydajność długich sesji, dużych bibliotek i raportów pozostaje do pomiaru. 
- P0/P1 potwierdzić po CI. Nie publikować stable/main bez akceptacji oraz testów akceptacyjnych. 
## Po roadmapie
Przypomnieć o trybie testowym i skórkach (docs/POST_ROADMAP.md). Nie implementować w ramach audytu.
