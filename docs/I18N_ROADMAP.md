# PSSA 2.1.0 – International Update

Stable 2.0.3 pozostaje produkcją. Gałąź develop/i18n jest robocza; artefakty dev nie są publikowane jako Stable.

## Etap 1–2 (dev.1)
- Jeden plik źródłowy JSON dla każdego języka w locales/. Instalator osadza wszystkie trzy zasoby, a aplikacja instaluje je jako resources/locales/*.json poza app.asar.
- Wspólne ustawienie %APPDATA%/PSSA 2 Dev/language.json; plik per użytkownik, atomowy zapis, migracja istniejących instalacji na polski. Pierwsza instalacja wybiera język domyślny, aktualizacja i dezinstalacja pomijają wybór. Ustawienia zmieniają język bez restartu.
- Zlokalizowane własne ekrany WPF, nawigacja, onboarding i selektor języka. Systemowe dialogi mogą używać języka Windows. Niezlokalizowane moduły pozostają po polsku w tym etapie.
- Walidacja słowników i testy preferencji; wymagane testy instalatora i wizualny odbiór wszystkich języków.

## Następne etapy
3. Cały interfejs, powiadomienia, błędy i ustawienia. 4. Alerty, kolejka, biblioteka, profile i nagrody. 5. Kreator. 6. Analityka i niezależny format regionalny. 7. Audyt UI, pseudolokalizacja, liczby mnogie, wydajność. 8. Agent i OBS Dock, niezależny język alertów oraz docka. 9. Pomoc, dokumentacja, WWW, changelog, menedżer języków, bezpieczny import społecznościowych pakietów w AppData, eksport szablonu i wskaźniki kompletności. 10. Pełne testy i wydanie.

Własne alerty, nazwy i dane nie są tłumaczone ani nadpisywane. Pakiety oficjalne aktualizowane przez instalator, społecznościowe poza katalogiem programu. Nie obsługujemy wykonywalnego kodu w tłumaczeniach. Wszystkie klucze i zmienne muszą być identyczne w trzech oficjalnych słownikach.

## dev.2
Dodano lokalizację kolejki (statusy, przyczyny, sterowanie, daty), ustawień wyglądu i wydajności, nawigacji konfigurowalnej, głównego okna, dokumentacji w aplikacji oraz diagnostyki podstawowej. Test UI przełącza PL → EN → DE → PL i sprawdza zapis preferencji oraz niemiecką kolejkę. Pozostałe moduły, dialogi backendu, aktualizator, statystyki, dock, Agent oraz pakiety społecznościowe nadal wymagają osobnych etapów. Format regionalny kolejki na razie wynika z języka interfejsu, przed niezależnym ustawieniem regionu.

## dev.3
Lokalizacja ekranów alertów, nagród Twitch, edytora reguł i wskazówek zmiennych, logowania i migracji, biblioteki mediów, profili, szablonów i wariantów. Zapisane treści i nazwy użytkownika pozostają bez zmian. Poprawiono test nawigacji (9 sekcji ustawień zamiast 8) oraz test sprzątania aktualizacji (nazwa RC zgodna z produkcyjną polityką). Nadal do wykonania: komunikaty backendu, domyślne alerty według osobnego języka, kreator, dashboard transmisji, analityka, aktualizator, dock i pomoc. Nie publikować jako Stable przed pełnym CI.

## dev.4
Lokalizacja Kreatora Alertów: toolbar, warstwy, właściwości, animacje, geometria, timeline, keyframe’y, biblioteka fontów, edytor zmiennych i komunikaty. Wartości enum, klucze zmiennych, zapisane nazwy i geometria scen pozostają bez zmian; nowe nazwy warstw i kopii są lokalizowane. Rozszerzono test Electron o zmianę języka i zachowanie szkicu oraz keyframe’ów. Nie zmieniano silnika scen, renderera nakładki, IPC zapisu scen ani schematu bazy. Pełny CI wymagany przed dalszą dystrybucją.
