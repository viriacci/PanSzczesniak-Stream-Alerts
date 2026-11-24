# Handoff — 2.0-dev.4-audit.1
Pracować tylko na develop/v2 od aktualnego HEAD. main/legacy bez zmian.
Etap 4 potwierdzony: run 45360806153, 20/20 PASS, Windows build/smoke/NSIS.
Audyt A: poprawki auth, EventSub, overlay, media, kolejka, shutdown, UI, read-only CI, nowe testy. Raport docs/audits/AUDIT_A.md. Przed etapem 5 sprawdzić najnowszy pipeline i artefakt pssa-npm-audit; ocenić i naprawić rzeczywiste P0/P1, zapisać wyniki w raporcie. Realne testy Twitch i OBS nadal niewykonane, nie oznaczać jako PASS. Brak gwarancji gotowości do wydania.
Następny etap po bramce CI i triage: OBS WebSocket, niezależny Agent, dock start/stop/restart/refresh, watchdog. Audyty B po 7 i C po 10. Nie publikować main.
