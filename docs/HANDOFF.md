# Handoff — 2.0.0-rc.2
Gałąź develop/v2. Main i legacy/python pozostają bez zmian.
Beta.4 run 45378166188 success, 78/78, audit 0, build, Agent Node, worker, NSIS, install/upgrade/uninstall marker PASS.
RC: event-driven kolejka bez stałego tick, indeksy schematu 5 (wczytywanie backupu v4 zachowane), oddzielna agregacja czatu, EventSub zachowuje stary socket przy nieudanej migracji, Background niszczy i odtwarza BrowserWindow z ponownym IPC, test 8h wirtualny, checksum instalatora, aktualizacja z beta.4. RC.1: 82/83 PASS, plan historii wymagał wymuszenia indeksu; RC.2 poprawia rzeczywiste zapytanie i test. Nowy CI oczekuje; przed zamknięciem sprawdzić i naprawić regresje.
Raport docs/audits/TECHNICAL_REAUDIT.md; instrukcja i bramki docs/RELEASE_ACCEPTANCE.md. Brak rzeczywistych pomiarów PC i OBS/Twitch live. Stable/main nie publikować przed odbiorem.
Po zakończeniu przypomnieć użytkownikowi: tryb testowy i skórki, docs/POST_ROADMAP.md.
