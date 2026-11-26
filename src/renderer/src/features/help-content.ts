import type {PageId} from '../../../shared/layout'
export type TourPage='alerts'|'analytics'|'dashboard'|'studio'|'queue'|'rewards'
export type Topic={title:string;body:string}
export type TourStep=Topic&{target:string;fallback?:string}
export const tours:Record<TourPage,TourStep[]>={
 alerts:[
  {target:'alerts-list',title:'Typy alertów',body:'Każdy kafelek odpowiada innemu zdarzeniu Twitcha. Wybierz kafelek, aby skonfigurować regułę.'},
  {target:'alerts-tile',fallback:'alerts-list',title:'Włączenie i edycja',body:'Kafelek pokazuje stan reguły. W edytorze możesz włączyć alert, ustawić tekst, priorytet, cooldown, głośność i minimalną liczbę.'},
  {target:'alerts-tile',fallback:'alerts-list',title:'Zapis i test',body:'W oknie edycji wybierz Zapisz lub Zapisz i testuj. Test trafia do kolejki. Animacje i warstwy edytujesz osobno w Kreatorze Alertów.'}],
 rewards:[
  {target:'rewards-sync',title:'Synchronizacja',body:'Po połączeniu Twitcha pobierz nagrody kanału. Dostęp wymaga odpowiednich uprawnień i dostępnych punktów kanału.'},
  {target:'rewards-tile',fallback:'rewards-list',title:'Kafelki nagród',body:'Kafelki zawierają nazwę, ikonę, koszt w punktach i stan przypisania. Jeśli lista jest pusta, najpierw zsynchronizuj nagrody.'},
  {target:'rewards-list',title:'Konfiguracja i zapis',body:'Otwórz nagrodę, włącz powiązany alert i ustaw jego parametry. Zapisz regułę; wygląd sceny zmienisz w Kreatorze Alertów.'}],
 dashboard:[
  {target:'dashboard-status',title:'Stan transmisji',body:'Sprawdź, czy Twitch jest połączony i czy trwa transmisja. Konfiguracja otwiera ustawienia połączeń.'},
  {target:'dashboard-metrics',title:'Dane na żywo',body:'Kafelki przedstawiają aktualnie dostępne odczyty. Brak wartości nie oznacza zera.'},
  {target:'dashboard-title',fallback:'dashboard-edit',title:'Tytuł transmisji',body:'Wpisz tytuł. Edycja wymaga ponownego logowania z uprawnieniem channel:manage:broadcast.'},
  {target:'dashboard-category',fallback:'dashboard-edit',title:'Kategoria',body:'Wyszukaj kategorię i wybierz wynik z miniaturą.'},
  {target:'dashboard-tags',fallback:'dashboard-edit',title:'Tagi i zapis',body:'Dodaj maksymalnie 10 tagów, każdy do 25 znaków. Zapisz informacje o transmisji, aby wysłać zmiany do Twitcha.'}],
 studio:[
  {target:'studio-project',title:'Projekt',body:'Wybierz alert albo nagrodę do edycji.'},
  {target:'studio-layers',title:'Warstwy',body:'Dodaj tekst, obraz, dźwięk, wideo lub cząsteczki. Zmieniaj kolejność przez przeciąganie; Delete usuwa odblokowaną warstwę, Ctrl+Z cofa zmianę.'},
  {target:'studio-canvas',fallback:'studio-preview',title:'Podgląd i geometria',body:'Przeciągaj obiekt, aby go przesunąć. Narożniki skalują, Ctrl skaluje od środka, Shift zachowuje proporcje, Alt przycina. Tło podglądu nie jest wysyłane do OBS.'},
  {target:'studio-properties',title:'Właściwości',body:'Zaznacz warstwę, aby edytować Styl, Geometrię i Czas. Zmienne tekstowe wstawiaj z menu + Zmienna.'},
  {target:'studio-timeline',title:'Oś czasu i keyframe',body:'Przesuwaj klipy, krawędzie i keyframe’y; Alt wyłącza przyciąganie na osi czasu. Ustawiaj początek mediów, dodawaj klatki kluczowe i wybieraj interpolację animacji.'},
  {target:'studio-save',title:'Szablony, zapis i test',body:'Szablon można zapisać z bieżącego szkicu. Zapisz scenę, aby zmienić alert, a Test OBS zapisuje ją i dodaje test do kolejki.'}],
 queue:[
  {target:'queue-layout',title:'Układ kolejki',body:'Wybierz układ pionowy lub kolumnowy. W kolumnach przeciągaj separatory, aby zmienić szerokość.'},
  {target:'queue-current',title:'Aktualny alert',body:'Tutaj widać bieżący alert. Dodaj testowy alert pozwala sprawdzić nakładkę i dźwięk, gdy OBS jest połączony.'},
  {target:'queue-pending',title:'Oczekujące',body:'Wyższy priorytet jest odtwarzany pierwszy. Strzałki zmieniają kolejność w obrębie priorytetu.'},
  {target:'queue-history',title:'Historia',body:'Ostatnie 100 zakończonych lub odfiltrowanych zdarzeń. Ukrycie pozycji z historii nie usuwa bazowego zdarzenia ani statystyk.'},
  {target:'queue-playback',fallback:'queue-engine',title:'Działanie alertów',body:'W górnej części kolejki wstrzymaj odtwarzanie po bieżącym alercie, wznów je lub wycisz natychmiast. Stan nakładki informuje o połączeniu z OBS.'},
  {target:'queue-volume',fallback:'queue-engine',title:'Głośność i odstęp',body:'Ustaw globalną głośność oraz przerwę między alertami. Testowy alert ma dźwięk.'}],
 analytics:[
  {target:'analytics-filter',title:'Zakres dat',body:'Wybierz 7, 14, 30 lub 180 dni albo własny zakres. Daty są liczone w UTC, data końcowa jest włączona. Poprzedni okres ma taką samą długość.'},
  {target:'analytics-inputs',title:'Kanał i filtry',body:'Wybierz kanał Twitch, źródło danych i kategorię. Bez kanału połącz Twitch w Konfiguracji.'},
  {target:'analytics-report',title:'Raport i eksport',body:'Oblicz raport, aby zobaczyć metryki i porównanie z poprzednim okresem. Gotowy raport można wyeksportować do CSV lub JSON.'},
  {target:'analytics-results',fallback:'analytics-report',title:'Interpretacja metryk',body:'Średnia i szczyt bazują na lokalnych próbkach. Dane importowane mają osobne podsumowania. Luki nie oznaczają zerowej oglądalności.'},
  {target:'analytics-history',fallback:'analytics-report',title:'Historia transmisji',body:'Po obliczeniu raportu historia pokazuje daty, tytuły, kategorie, czas i źródło. Importowane sesje nie uzupełniają brakujących lokalnych próbek.'}]
}
export function isTourPage(page:PageId):page is TourPage{return Object.prototype.hasOwnProperty.call(tours,page)}
export const settingsTopics:Topic[]=[
 {title:'Ukryj zakładki',body:'Zaznacz niepotrzebne moduły, aby ukryć je w menu. Nie usuwa to danych ani nie wyłącza funkcji. Przywrócisz je w tej samej sekcji; ustawienia są zawsze dostępne z ikony koła zębatego.'},
 {title:'Kategorie i podkategorie',body:'Twórz grupy i podgrupy oraz przeciągaj moduły i kategorie w menu. Środek nagłówka przenosi do kategorii, krawędzie zmieniają kolejność. Najpierw wyczyść wyszukiwanie. Zwijaj grupy, aby oszczędzić miejsce.'},
 {title:'Wygląd i układ',body:'Włącz tryb kompaktowy lub inspektor. Przeciągaj separatory paneli, używaj Ctrl+B i Ctrl+I. Przywróć układ resetuje nawigację i rozmiary, nie alerty.'},
 {title:'Tryb wydajności',body:'Wybierz tryb odpowiedni do transmisji lub pracy w tle. Przed przejściem w tło zapisz szkice; interfejs może zostać zamknięty.'},
 {title:'Kopia zapasowa i przywracanie',body:'Eksportuj bazę z multimediami do archiwum do 1 GB, bez tokenów i haseł. Wybierz plik poza katalogiem danych PSSA; kopie zawierają prywatną historię i treści alertów, nie publikuj ich. Przywracanie poza transmisją zastępuje dane po restarcie; zachowana jest kopia sprzed operacji.'},
 {title:'Aktualizacje',body:'Wybierz Stable albo Beta (wydania RC), automatyczne sprawdzanie lub sprawdź ręcznie. Instaluj poza transmisją i nagrywaniem, po zakończeniu kolejki i zamknięciu OBS. Instalator jest weryfikowany przez SHA256 i podpis; oficjalny niepodpisany instalator Beta wymaga odrębnej zgody. Niepodpisane wydania Stable można zapisać z aktualizatora do folderu Pobrane po weryfikacji SHA256 i uruchomić ręcznie.'},
 {title:'Skórki aplikacji',body:'Wybierz PSSA, ViviOnyx albo Shiroe. Skórka zmienia wygląd interfejsu, nie sceny alertów.'},
 {title:'Logowanie zaawansowane',body:'Opcjonalnie użyj własnej aplikacji Twitch Developer Console. Wpisz Client ID, Client Secret i skonfiguruj adres przekierowania http://localhost:3000. Tokeny i sekret są szyfrowane lokalnie; nie udostępniaj sekretu.'},
 {title:'Wtyczka OBS',body:'Przycisk w nagłówku Ustawień instaluje lub aktualizuje dock OBS. Zamknij OBS i potwierdź uprawnienia Windows. Po ponownym uruchomieniu OBS otwórz dock PSSA.'}
]
export const topics:Partial<Record<PageId,Topic[]>>={
 alerts:tours.alerts,rewards:tours.rewards,queue:tours.queue,dashboard:tours.dashboard,analytics:tours.analytics,studio:tours.studio,
 profiles:[{title:'Profile alertów',body:'Utwórz profil i przełączaj zestawy reguł oraz scen. Alerty już w kolejce zachowują wcześniejszą konfigurację.'},{title:'Szablony i warianty',body:'Wybierz alert docelowy, załaduj szablon lub zdefiniuj warianty z warunkami i wagami. Jeśli żaden wariant nie pasuje, odtwarzana jest scena bazowa.'}],
 library:[{title:'Multimedia',body:'Zarządzaj obrazami, wideo i dźwiękami. Wybierz zasób, aby zobaczyć właściwości, podgląd i informację o brakującym pliku. Organizuj pliki w folderach i przy pomocy tagów. Jeden zasób może być używany przez wiele scen i profili; foldery i tagi nie zmieniają fizycznej ścieżki pliku.'}],
 integrations:[{title:'Połączenie z Twitch',body:'Zaloguj się przez Twitch, zatwierdź uprawnienia, a w razie problemów połącz ponownie. Własna aplikacja OAuth znajduje się w Ustawieniach.'},{title:'Nakładka i OBS',body:'Skopiuj lokalny adres nakładki do źródła przeglądarkowego OBS (1920 × 1080). Skonfiguruj połączenie OBS w tym module; dock instalujesz w Ustawieniach.'},{title:'Migracja PSSA 1.x',body:'Import starszej konfiguracji zastępuje przypisania o tych samych kluczach, ale nie przenosi tokenów.'}],
 diagnostics:[{title:'Stan aplikacji',body:'Odśwież dane o wersji, bazie, procesach i pamięci. Pomiary CPU/RAM dotyczą rzeczywistego działania PSSA, nie całego komputera ani niezależnego Agenta. Eksport diagnostyki nie zawiera tokenów, adresów nakładek, ścieżek, nazw kanałów ani treści czatu.'},{title:'Awarie i błędy',body:'Historia obejmuje główny proces, renderer, Agenta i procesy potomne. Raport tekstowy nie zawiera treści wyjątków, tokenów, pełnych ścieżek ani surowych zrzutów pamięci. Lokalne zrzuty native w crash-dumps/ mogą zawierać prywatne dane; nie publikuj ich bez sprawdzenia.'}],
 documentation:[{title:'Skróty i dokumentacja',body:'Ctrl+B zwija menu, Ctrl+I przełącza inspektor, Ctrl+, otwiera ustawienia. Strzałki, Home i End regulują aktywny separator. Esc zamyka dialog. Dokumentacja techniczna jest w repozytorium.'}],
 settings:settingsTopics
}
