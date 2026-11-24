# Changelog
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
