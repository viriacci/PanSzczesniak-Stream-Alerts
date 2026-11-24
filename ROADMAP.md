# Roadmap PSSA 2.0
Tylko Twitch i OBS. Local-first. Stabilny main pozostaje na Pythonie do akceptacji wydania.
| Krok | Zakres |
|---|---|
| 1 | Electron/React/TS/Node, SQLite, IPC, logi, testy, konfiguracja instalatora |
| 2 | Czerno-złoty design system, nawigacja, regulowane panele, ergonomia |
| 3 | OAuth, bezpieczne tokeny, EventSub/reconnect, alerty, nagrody, lokalny overlay, migracja Python, offline testy |
| 4 | Kolejka alertów, priorytety, deduplikacja, pauza/skip/replay, ACK, cooldown, historia |
| A | Audyt fundamentów, silnika, migracji i bezpieczeństwa |
| 5 | OBS WebSocket, Agent, dock, start/stop/restart/refresh, watchdog |
| 6 | Live Center: sesje, oglądalność, zdarzenia, czat, OBS, tytuł/kategoria |
| 7 | Visual Studio: warstwy, drag/resize, timeline, animacje, undo, wspólny renderer |
| B | Audyt regresji, OBS, statystyk, edytora i wydajności |
| 8 | Biblioteka mediów, profile, szablony, warianty, import/eksport |
| 9 | Analityka 7/14/30/180 dni, custom, porównania, CSV/JSON, źródła i luki; SullyGnome wyłącznie z autoryzowanym dostępem |
| 10 | Setup, backup, tryb background, optymalizacja, installer/updater, CI, dokumentacja |
| C | Audyt całego repo, bezpieczeństwa, instalacji, danych, długich streamów |
| Release | 2.0.0 dopiero po pozytywnym audycie i akceptacji |
P0/P1 blokują kolejny etap; P2/P3 naprawić albo jawnie odroczyć. Każda poprawka z testem regresji, gdy możliwe. Wyniki ręcznych testów Windows/OBS/Twitch nie mogą być oznaczone jako pozytywne bez wykonania.
