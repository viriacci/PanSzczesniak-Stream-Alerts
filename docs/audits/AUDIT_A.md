# Audyt A — etapy 1–4
Data: 2026-11-24. Baza: 64c43c91a58b40d1f6e3f3b3d761c2f1d84fb3cf.
## Status
Przegląd statyczny i poprawki wykonane. Weryfikacja nowego CI i triage raportu npm audit pozostają obowiązkowe. Nie jest to potwierdzenie gotowości do publicznego wydania. Nie przechodzić do etapu 5 przy czerwonym CI lub niezamkniętych P0/P1. Weryfikacja manualna prawdziwego Twitch/OBS nie została wykonana.
## Wynik bazowy
Windows Actions run 45360806153: 20/20 testów, typecheck, build, smoke, NSIS: success.
https://github.com/viriacci/PanSzczesniak-Stream-Alerts/actions/runs/45360806153
## Zakres
Przejrzano main/preload/IPC, kontrakty, bazę i migracje, logger, layout, OAuth, EventSub, store/import/media, kolejkę, serwer i kod odtwarzania, UI sterowania, pakowanie i CI. Zagrożenia: asynchroniczne operacje po zmianie sesji, błędy mediów, przerwany zapis, niepełne zdarzenia, obsługa zamknięcia, nieaktualny stan UI, kontrola dostępu i zależności. Nie przeprowadzono zewnętrznego pentestu.
## Znaleziska
| ID | Priorytet | Problem | Naprawa / status |
|---|---|---|---|
| A01 | P1 | Spóźnione 401/refresh mogły użyć nowej sesji lub nadpisać stan po logout | Generacja sesji w każdym kroku i testy mock; kod poprawiony |
| A02 | P1 | Równoległe 401 po odświeżeniu mogły ponownie odświeżyć token | Porównanie access tokena i współdzielony refresh; kod poprawiony |
| A03 | P1 | Nieudane media raportowane jako done | ACK rozróżnia media-error; kod poprawiony |
| A04 | P1 | Zapis media bez atomowej publikacji, uszkodzony plik o tym samym hashu nie był naprawiany | Temp + rename, kontrola hash, test; kod poprawiony |
| A05 | P1 | Spóźniona walidacja godzinowa mogła zatrzymać nową sesję | Kontrola generacji serwisu; kod poprawiony |
| A06 | P2 | Stara sesja mogła powrócić po nieudanej zmianie konta, callback bez guardu Host i jednokrotności | Jawne usunięcie poprzednich danych przed nowym flow, host, state, single accept |
| A07 | P2 | Migracja EventSub gubiła informację o częściowo odrzuconych subskrypcjach; zbyt duży/nieprawidłowy JSON | Zachowanie detail i walidacja |
| A08 | P2 | Shared chat i nieobsłużone płatne upgrade; nieskonfigurowane reward znikały z historii | Filtrowanie obcych kanałów, mapowanie upgrade, suppressed dla nieprzypisanych nagród |
| A09 | P2 | Wyjątek transportu mógł zakleszczyć kolejkę, shutdown mógł ominąć zamknięcie pozostałych zasobów | Obsługa wyjątku, kolejność aktualizacji, finally, niezależny cleanup |
| A10 | P2 | Niezgodny typ audio/grafiki; brak limitu liczby importowanych nagród | Walidacja i limit |
| A11 | P2 | Polling ukrywał błąd i pokazywał stare dane | Czyści snapshot po błędzie |
| A12 | P2 | Po utrwaleniu lockfile CI nadal zawierał niepotrzebną ścieżkę write | npm ci i read-only workflow; dodano raport npm audit |
| A13 | P3 | Rotacja logów i zamknięcie aktywnych połączeń HTTP | Usunięcie poprzedniego logu, closeAllConnections |
## Testy dodane
3 mocki Auth (late 401 po zmianie konta, single refresh, logout w trakcie refresh); mock EventSub (handover i dedup, zły URL); 2 testy alertów (shared chat, typy pliku); test naprawy media; 2 testy kolejki (media-error, pełne odtworzenie 1000 zdarzeń); rozszerzenie testu HTTP ACK. Oczekuje CI.
## Otwarte i ograniczenia
- P0/P1: poprawki kodu oczekują na regresję CI; ewentualne nowe błędy i advisories należy rozstrzygnąć przed etapem 5.
- P1 weryfikacja manualna: własne konto Twitch, callback localhost, utrata internetu, realny OBS Browser Source, obraz/audio, test długotrwały, CPU/RAM podczas gry. Brak danych do potwierdzenia; wymaga środowiska użytkownika. Można rozwijać dopiero po zielonym CI i triage, ale gotowość produkcyjna pozostaje niepotwierdzona.
- P2: historia bez retencji, brak paginacji powyżej 100 pozycji, obciążenie SQLite w procesie main do pomiarów; brak kopii bazy/odtworzenia do etapu 10. Wspólne lokalne reguły i kolejka przy zmianie konta, nie są izolowane według kont; nie używać równolegle do różnych kanałów bez sprawdzenia kolejki.
- P2: overlay potwierdza zakończenie logiki renderera, nie gwarantuje słyszalności czy widoczności w wybranej scenie. Jedno źródło aktywne, inne standby; docelowa kontrola scen w etapie 5.
- P3: fonty nie dołączone, ręczne testy UX, spójność legacy animacji do etapu 7.
## Źródła
Twitch: https://dev.twitch.tv/docs/authentication/validate-tokens/ ; https://dev.twitch.tv/docs/authentication/refresh-tokens/ ; https://dev.twitch.tv/docs/eventsub/reference/chat ; https://dev.twitch.tv/docs/eventsub/handling-websocket-events/

## Aktualizacja weryfikacji
Run 45363061536: 29/29 testów PASS, typecheck, build, smoke i NSIS PASS. Raport npm audit wykazał 15 wpisów wyłącznie w zależnościach dev (8 high / 7 moderate); triage i plan naprawy w [DEPENDENCIES_A.md](DEPENDENCIES_A.md). Bramkę zależności zamknąć dopiero po zweryfikowanej aktualizacji.
