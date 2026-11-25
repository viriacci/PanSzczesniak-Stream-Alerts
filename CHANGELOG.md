# Changelog
## 2.0.0-rc.6
- Osobny custom installer WPF, wbudowany silnik NSIS, animowane złote iskry wokół okna, aktualizacja i dezinstalacja.

## 2.0.0-rc.5
- Stylizowany instalator PSSA, ikona, wybór skrótów i opcja dezinstalacji istniejącej instalacji.

## 2.0.0-rc.4
- ViviOnyx: paleta #141414 / #843935 / #ae9278, kontrast tekstu, dopasowanie biblioteki i edytora oraz wykresów do motywu.

## 2.0.0-rc.3
- Trzy skórki lokalnego interfejsu; koncepcje ViviOnyx i Shiroe.
- Opcjonalna sesja pomiarowa CPU/RAM, GPU, OBS, Agenta i kolejki, historia, porównanie, CSV/JSON.
- Lokalne crash logi i native dumps bez uploadu, eksport diagnostyczny.

## 2.0.0-rc.2
- Wymuszenie indeksu historii i test rzeczywistego planu zapytań bez tymczasowego sortowania.

## 2.0.0-rc.1
- Kolejka zdarzeniowa, bez aktywnego timera w idle.
- Schemat 5: indeksy historii/czatu, obsługa archiwów v4.
- Background zwalnia okno renderera; bezpieczny powrót z tray.
- Odporność migracji EventSub i regresje, 8h syntetyczny soak.
- Instrukcja odbioru, SHA256 instalatora, test aktualizacji z beta.4.

## 2.0.0-beta.3
- Reaudyt techniczny, cache reguł/kolejki, revision IPC, Node Agent, oszczędny harmonogram renderowania, callback telemetrii OBS.
- Inwentarz źródeł i pakietów, SBOM, pinning CI i benchmark Windows.

## 2.0.0-beta.2
- Audyt C: bezpieczne eksporty i kopie, izolacja profili, wspólny guard dialogów, reconnect, limity aktualizacji i fallback Background.
- Branding Pan Szczesniak Stream Alerts.
- Regresje oraz rozszerzenie CI o upgrade i uninstall.

## 2.0.0-beta.1
- Tryby wydajności, tray i wyładowanie UI, onboarding oraz diagnostyka.
- Kopia zapasowa historii, ustawień i mediów bez tokenów; staging restore i kopia bezpieczeństwa.
- Sprawdzanie wydań stable/beta, NSIS clean-install smoke; bez automatycznej instalacji niepodpisanego EXE.
- Etap 9 potwierdzony w CI.

## 2.0.0-dev.9
- Analityka historyczna, zakresy i porównania, trend, heatmapa, kategorie, ranking sesji.
- Import/eksport PSSA CSV/JSON, oznaczenie źródeł, deduplikacja i brak sztucznych próbek. Schema 4.
- Etap 8 potwierdzony w CI.

## 2.0.0-dev.8
- Biblioteka mediów: deduplikacja, tagi, foldery, filtry, wykrywanie braków, podgląd.
- Profile alertów i szablony scen, warianty ważone oraz warunki liczby/miesięcy/kategorii.
- Audyt B: 52/52 PASS, clean npm audit, packaged smoke.

## 2.0.0-dev.7-audit.1
- Audyt B: potwierdzenia Agenta, izolacja sesji OBS, readiness scen, poprawki Live Center i bezpieczny zapis scen.
- HTTP Range, lekkie snapshoty kolejki, optymalizacja geometrii, szkice w pamięci, walidacja i regresje.

## 2.0.0-dev.7
- Visual Studio: warstwy, pozycje, skalowanie, prowadnice, snap, właściwości, undo/redo, timeline, animacje.
- Wspólny renderer sceny dla preview i overlay, wideo MP4/WebM, kształty i proste cząsteczki.
- Konwersja starego layoutu, zapis sceny w regule, testy modelu i smoke Chromium overlay.
- Poprawka TypeScript w auth.ts wykryta przez CI etapu 6.

## 2.0.0-dev.6
- Live Center: odczyty widzów, średnia i szczyt z próbek, sesje, kategorie, wykres, aktywność i statystyki czatu.
- SQLite schema 3, telemetria OBS i wyliczany bitrate; rozłączenia pozostawiają luki.
- Wyszukiwanie kategorii, edycja tytułu i kategorii, markery Twitch przy dodatkowym scope.
- Testy sesji, dedup, prywatności, bitrate i uprawnień.

## 2.0.0-dev.5
- OBS WebSocket 5, szyfrowane hasło, sceny, stan transmisji/nagrania, telemetria i odświeżanie źródeł PSSA.
- PSSA Agent i dock, start/stop/restart/refresh, opcjonalny autostart Windows i start z OBS, ograniczony watchdog.
- Audyt A: 0 npm advisories, 29/29 testów, packaged smoke. CI read-only z bramką audytu.

## 2.0.0-dev.4-audit.1
- Audyt A: poprawki wyścigów sesji OAuth, odświeżania tokenów, reconnect, ACK błędów mediów, zapisu plików, shutdown i walidacji.
- Testy mock Auth/EventSub, pełny test 1000 alertów, regresje media i ACK.
- CI read-only, npm ci i raport advisory.

## 2.0.0-dev.4
- Trwała kolejka i historia, migracja SQLite 2, priorytety, ręczne przesuwanie, pauza, skip, replay.
- Cooldown, minimalna liczba, głośność globalna/indywidualna, mute, przerwy.
- Nakładka z ACK i ponowieniem po rozłączeniu, limit prób, watchdog.
- Testy kolejki i poprawka testu overlay Node strip-only.

## 2.0.0-dev.3
- OAuth Twitch, szyfrowane poświadczenia, EventSub i reconnect.
- Alerty follow/raid/bits/sub/Prime/resub/gift/mass gift oraz nagrody kanału.
- Reguły alertów, grafiki i audio, lokalny overlay SSE, offline test.
- Import ustawień i mediów z Python bez tokenów.
- UI integracji, alertów i nagród, dokumentacja i testy.

## 2.0.0-dev.2
- Czarno-złoty shell, 13 zakładek, wyszukiwanie, komponenty React i ikony SVG.
- Regulowane panele, tryb kompaktowy, skróty, zapamiętanie układu i pozycji okna.
- Pasek tytułu, powiadomienia, dialog resetu, dashboard bez sztucznych danych.
- Testy layoutu, rozszerzenie smoke i dokumentacja frontendu.
- Potwierdzono Windows CI etapu 1; etap 2 oczekuje na weryfikację.

## 2.0.0-dev.1
- Nowy szkielet Electron, React, TypeScript, SCSS.
- SQLite z migracją transakcyjną, ustawieniami i tabelami pod analitykę.
- Izolowany preload i walidowane IPC, blokada nawigacji i uprawnień.
- Ekran diagnostyczny z rzeczywistym zapisem ustawień.
- Logi zdarzeń, konfiguracja NSIS, testy bazy i polityki IPC.
- Weryfikacja pełnej kompilacji i instalatora pozostaje wymagana.
