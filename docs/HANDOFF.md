# Handoff — 2.0.0-beta.4
Gałąź develop/v2, main/legacy bez zmian. Beta.3 run 45377162735 zakończony sukcesem (audit, inventory, SBOM, benchmark, build/test/smoke Agent Node, NSIS, instalacja, upgrade, uninstall marker).
Reaudyt T01–T14: cache, idle SQL, revision IPC, Agent Node, scheduler scen, media cache, OBS callback, piny CI. Benchmark w docs/audits/TECHNICAL_REAUDIT.md.
Beta.4 T15–T17: read-only worker analityki/eksportu/katalogu, blokada importu podczas streama i ponowna kontrola po dialogu, memoizacja stron, brak miniatur w Streaming, ochrona nowszych szkiców. Test read tasks, smoke katalogu. CI oczekuje — sprawdzić przed dalszymi zmianami.
Pełny inwentarz nie jest ręcznym audytem kodu wszystkich pakietów upstream. Dalsze bramki w raporcie. scripts/profile-stream.ps1: pomiar off/studio/streaming/background, rzeczywisty OBS i gra; soak 6–8h. Bez deklaracji FPS/RAM przed pomiarem.
Tryb testowy i skórki odłożone; nie publikować stable/main bez akceptacji.
