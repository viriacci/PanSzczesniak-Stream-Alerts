# Handoff — 2.0-dev.1
Baza migracji: c0458a1412cc6c5a753bf84779e3d33753553d3a (Python). Zachowana na main i legacy/python. Pracować tylko na develop/v2, od jego najnowszego HEAD.
Zaimplementowano fundamenty, nie pełny produkt: React shell, main/preload, kontrakty, SQLite, logi, testy, konfiguracja NSIS. Etap 2 ma zastąpić diagnostyczny ekran właściwym design systemem.
Bramka etapu 1: npm install i commit lockfile, typecheck, test, build, smoke Electron i dist:win na Windows. Środowisko autora zmian nie posiada dostępu do npm; pełny build i EXE nie są potwierdzone. Nie udawać zielonych testów.
Smoke uruchamia aplikację z odrębną tymczasową bazą i sprawdza prawdziwy IPC; nie dotyka produkcyjnych danych. Przed etapem 2 potwierdzić wyniki i naprawić wszelkie błędy.
Ryzyka: zgodność narzędzi i node:sqlite w Electron, brak lockfile, brak podpisu instalatora. Brak Twitch/OBS na tym etapie. Audyty po 4, 7, 10 obowiązkowe. SullyGnome tylko autoryzowany import.
