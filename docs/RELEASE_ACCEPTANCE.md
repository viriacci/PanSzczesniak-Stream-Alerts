# PSSA 2.0 — odbiór wydania RC
## Warunki automatyczne
Wynik CI dla dokładnego commita: npm audit 0; inventory/SBOM; typecheck; testy Node; build; Electron/Chromium smoke (ACK, PNG, brak zasobu, Agent Node, worker, zwolnienie i odtworzenie okna); NSIS; smoke EXE; czysta instalacja; aktualizacja beta.4 → RC; zachowanie markera danych; SHA256 instalatora.
## Instalacja na stanowisku
1. Zakończ PSSA. Jeśli Agent jest aktywny, wyłącz jego autostart, zakończ jego proces przed aktualizacją (w Menedżerze zadań sprawdź wiersz polecenia: agent.js / --pssa-agent). Nie kończ OBS ani innych procesów na podstawie samego podobieństwa nazwy.
2. Utwórz kopię PSSA poza katalogiem danych. Zainstaluj wyłącznie artefakt z zielonego CI, porównaj SHA256. AppId i katalog danych pozostają takie same. RC migruje bazę v4→v5 (tylko indeksy); nie wracaj do starszego programu na bazie v5 bez wcześniejszej kopii.
3. Po uruchomieniu sprawdź dane, układ i konfigurację. Połącz Twitch z własną aplikacją Developer Console (redirect http://localhost:3000), OBS WebSocket v5 z hasłem. Nie publikuj tokenów ani adresów z kluczem.
4. Dodaj overlay jako Browser Source w OBS i opcjonalnie panel Agenta. Sprawdź start/stop/restart/refresh i ponowne uruchomienie Windows, jeżeli włączasz autostart.
## Testy akceptacyjne (nieprzeprowadzone w rzeczywistym środowisku)
- OAuth, odświeżenie tokenu, utrata sieci i ponowne połączenie; follow/sub/gift/raid/bits/nagrody; rozróżnienie zdarzeń testowych i rzeczywistych.
- Sceny: tekst/PNG/GIF/wideo/audio, wyciszenie, zmiana sceny OBS, brak pliku, reload, pauza/skip/replay, zamknięcie/przywrócenie interfejsu.
- Kopia/restore na osobnych danych, eksport i import, analityka 180 dni, przełączenie profilu.
- Tryby Studio/Streaming/Background, realny tray i start Windows. Kontynuacja alertów i statystyk bez okna. Sprawdź, że po zamknięciu całego silnika Agent nadal uruchamia aplikację.
- 8h rzeczywistego streamu lub kontrolowanego nagrania z grą i OBS; test syntetyczny 8h w przyspieszonym zegarze nie zastępuje realnego soak.
## Pomiar wydajności
Uruchom PowerShell w repo. Skrypt zapisuje CPU jako procent całej maszyny, working set, private bytes oraz liczbę procesów. Wykonaj serię przy identycznej grze i scenie OBS, bez alertów, następnie z tym samym alertem. Najpierw stan bez PSSA, następnie każdy tryb:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\profile-stream.ps1 -Seconds 120 -Label Background -Game RDR2 -Output background.csv
```
Powtórz dla Off, Studio, Streaming i Background. Sprawdź OBS Stats (rendering/encoding lag), FPS i frametimes gry osobno. Cele, nie gwarancje: CPU idle <0,5%, bez alertów <1%, Agent <50 MB, spadek FPS <1%. Wartości zależą od mediów, obciążenia i sterowników. Nie wyłączaj automatycznie akceleracji.
## Decyzja
Development zakończony w zakresie roadmapy po zielonym CI RC i zamknięciu wykrytych usterek. Publiczny stable/main dopiero po akceptacji użytkownika i rzeczywistych testach. Bez podpisu kodu nie włączamy automatycznego instalowania aktualizacji. Pełny ręczny audyt wszystkich linii kodu upstream Chromium/Node i 437 pakietów nie został wykonany; lockfile, SBOM, audit i kontrola źródeł nie zastępują takiego audytu. 
## Następny osobny projekt
Tryb testowy i skórki: docs/POST_ROADMAP.md. Nie wdrażać w RC.
