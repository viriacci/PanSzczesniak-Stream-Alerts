# Audyt zależności — A
Data 2026-11-24. Źródło: pełny npm audit w run 45363061536, artefakt 14906085378, commit b98a2fb366b14ef52f2bf2f569ef30e4b42fb9bf. 
https://github.com/viriacci/PanSzczesniak-Stream-Alerts/actions/runs/45363061536
## Triage
15 raportowanych pakietów: 8 high, 7 moderate, 0 critical. To nie jest 15 niezależnych CVE; raport propaguje podatności przez drzewo zależności. Wszystkie wskazane w raporcie węzły są oznaczone dev: true w package-lock. Produkcyjne pakiety npm w lockfile: react 19.2.0, react-dom 19.2.0, scheduler 0.27.0; żaden nie występuje w tym raporcie. Nie oznacza to audytu binariów Electron/Chromium ani gwarancji bezpieczeństwa runtime.
| Grupa | High | Moderate | Ryzyko |
|---|---:|---:|---|
| Vite 7.2.2 | 1 | 0 | Dev server: odczyt plików, obejścia restrykcji, launch-editor i problemy Windows; nie uruchamiany przez instalator |
| electron-builder 26.12.1 i zależności | 7 | 7 | Budowanie/pakowanie, redirect credential leak, Linux AppImage, glob/minimatch i node-gyp |
PSSA pakuje Windows NSIS, nie Linux AppImage. Nie używa jeszcze electron-updater. Vite pozostaje zagrożeniem developerskim nawet gdy nie jest dystrybuowany. Aktualizacja potrzebna, nie ignorować.
## Pakiety z raportu
High: app-builder-lib, builder-util, builder-util-runtime, dmg-builder, electron-builder, electron-builder-squirrel-windows, electron-publish, vite.
Moderate: @electron/rebuild, @electron/universal, cacache, glob, make-fetch-happen, minimatch, node-gyp.
Przykładowe źródłowe advisories:
- https://github.com/advisories/GHSA-p2f4-r6v6-j797 (credential leak w builder-util-runtime)
- https://github.com/advisories/GHSA-7g7r-gx96-252g (AppImage)
- https://github.com/advisories/GHSA-g3hv-75wg-m249 (minimatch)
- https://github.com/advisories/GHSA-3g3m-2fjr-6pw4 (glob)
- https://github.com/advisories/GHSA-p9ff-h696-f583 (Vite WebSocket file read)
- https://github.com/advisories/GHSA-587h-7wmj-h5pm (launch-editor Windows)
## Działania
Raport npm rekomenduje aktualizacje bez zmiany major: vite 7.3.8 i electron-builder 26.18.0. electron-vite 5.0.0 deklaruje kompatybilność z Vite 7. Ustawiono jawny host 127.0.0.1 dla dev servera. Nie używać npm audit fix --force.
Środowisko lokalne nie ma dostępu do registry.npmjs.org. Jednorazowy workflow audit-a-dependencies.yml rozwiązuje lockfile, wykonuje pełny i produkcyjny audit, wymaga 0 raportowanych podatności, przeprowadza typecheck, wszystkie testy, build, smoke, NSIS. Dopiero po sukcesie osobny job przypina dwa zweryfikowane manifesty do develop/v2 bez force push, po sprawdzeniu HEAD. Do tego czasu dotychczasowe zależności pozostają w repo. Workflow push wywołany GITHUB_TOKEN nie musi uruchomić zwykłego CI, jednak identyczny manifest jest testowany przed publikacją.
Status: triage wykonany, aktualizacja i regresja oczekują na wynik workflow. Jeżeli audyt wykryje kolejne advisories, nie zamykać bramki i nie publikować manifestów. Testy realnego Twitch i OBS nadal wymagane.

## Druga iteracja — 2026-11-24
Run 45363844728, artefakt 14906545210: aktualizacja Vite 7.3.8 i electron-builder 26.18.0 poprawiła wynik z 15 do 6 (0 high, 0 critical, 6 moderate); osobny audit-production.json: 0. Bramkę zatrzymano prawidłowo przed testami i zapisem manifestów. Stary lockfile pozostał bez zmian.
Sześć pozostałych wpisów jest propagacją jednego GHSA-g3hv-75wg-m249 / CVE-2026-118764 (minimatch): @electron/universal, app-builder-lib, dmg-builder, electron-builder, electron-builder-squirrel-windows, minimatch. Podatne kopie: node_modules/minimatch oraz node_modules/@electron/universal/node_modules/minimatch. Raport proponuje downgrade buildera do 25.1.0, co odrzucamy.
Kolejny kandydat: zachować Vite 7.3.8 i electron-builder 26.18.0, dodać ograniczony override "minimatch@>=7.0.0 <11.0.1": "11.0.9". Nie wymuszać nowej wersji dla starszych, niewskazanych przez advisory gałęzi minimatch 3/5/6. Wersja 11 zmienia API i zachowanie dopasowania, dlatego poza testami i NSIS wymagamy uruchomienia faktycznie spakowanego exe. Wybrano 11.0.9 zamiast minimalnego 11.0.1 także ze względu na późniejsze GHSA-hqmv-qgp3-jx75. Override jest tymczasowy; usunąć, gdy upstream przejdzie na bezpieczną wersję, po ponownych testach.
Źródła: https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249 ; https://github.com/isaacs/minimatch/security/advisories/GHSA-hqmv-qgp3-jx75 ; https://www.npmjs.com/package/minimatch ; https://github.com/isaacs/minimatch/blob/main/changelog.md .
Status: drugi kandydat oczekuje CI; nie przechodzić do etapu 5 przed zieloną bramką i sprawdzeniem zapisanych manifestów.

## Wynik końcowy
Run 45364375474: full npm audit 0, production 0, 29/29 testów, typecheck, build, smoke, NSIS i uruchomienie spakowanego EXE PASS; job publish success. Manifesty zapisane w abbd15e5bbf2269307b29c21f3f3f11624ba455d. Jednorazowy workflow z uprawnieniami zapisu usunięty w etapie 5. Zwykłe CI wymaga czystego audit i smoke spakowanego EXE. Bramka automatyczna A zamknięta. Testy realnego Twitch i OBS otwarte.
