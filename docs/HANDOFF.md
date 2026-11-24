# Handoff — 2.0-dev.4-audit.1
Pracować tylko na develop/v2 od aktualnego HEAD. main/legacy bez zmian.
Etap 4 potwierdzony: run 45360806153, 20/20 PASS, Windows build/smoke/NSIS.
Audyt A: poprawki auth, EventSub, overlay, media, kolejka, shutdown, UI, read-only CI, nowe testy. Raport docs/audits/AUDIT_A.md. Przed etapem 5 sprawdzić najnowszy pipeline i artefakt pssa-npm-audit; ocenić i naprawić rzeczywiste P0/P1, zapisać wyniki w raporcie. Realne testy Twitch i OBS nadal niewykonane, nie oznaczać jako PASS. Brak gwarancji gotowości do wydania.
Następny etap po bramce CI i triage: OBS WebSocket, niezależny Agent, dock start/stop/restart/refresh, watchdog. Audyty B po 7 i C po 10. Nie publikować main.

Aktualizacja: audyt A CI 45363061536 zakończył się success (29/29). Triage npm audit: 15 wpisów dev-only; jednorazowy workflow Audit A dependency remediation aktualizuje Vite i electron-builder, testuje i przypina manifesty dopiero przy 0 podatności. Sprawdzić aktualny HEAD i wynik workflow przed etapem 5. Po zakończeniu usunąć jednorazowy workflow z uprawnieniem contents:write i zapisać wynik w DEPENDENCIES_A.md. Nie oznaczać testów rzeczywistego Twitch/OBS jako wykonanych.

Run 45363844728: kandydat Vite/electron-builder usunął wszystkie high, pozostało 6 moderate jednego GHSA minimatch; production audit 0. Manifestów nie zapisano. Druga iteracja dodaje zakresowy override minimatch 11.0.9 i smoke spakowanego exe. Sprawdź nowy run Audit A dependency remediation; jeśli success, potwierdź commit bota i aktualne manifesty, usuń jednorazowy workflow, wpisz wyniki. Jeśli failure, przeanalizuj logi i raporty, bez force downgrade i bez przechodzenia do etapu 5.
