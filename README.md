# Twitch Reward Alerts

Program pokazuje GIF i odtwarza dzwiek w OBS, kiedy widz odbierze konkretna
nagrode za punkty kanalu na Twitchu. Dziala przez oficjalne EventSub (WebSocket) -
zero reverse-engineeringu, zero botow.

## 1. Rejestracja aplikacji na Twitchu (jednorazowo, kilka minut, bez oczekiwania)

1. Wejdz na https://dev.twitch.tv/console/apps i zaloguj sie swoim kontem Twitcha.
2. Jesli konto nie ma jeszcze wlaczonego 2FA - Twitch cie o to poprosi (Security and Privacy -> 2FA).
3. Kliknij **Register Your Application**.
4. Wypelnij:
   - **Name**: dowolna unikalna nazwa, np. `MojeAlertyPanSzczesniak`
   - **OAuth Redirect URLs**: `http://localhost:3000` (musi byc identyczne jak w programie)
   - **Category**: `Application Integration`
5. Zaznacz captche, kliknij **Create**.
6. Wejdz w **Manage** przy nowo utworzonej apce - zobaczysz **Client ID**.
7. Kliknij **New Secret**, zeby wygenerowac **Client Secret** (pokazuje sie tylko raz - zapisz go).

Zadnej akceptacji/review nie ma - Client ID i Secret dostajesz od razu.

## 2. Instalacja (development / uruchomienie z Pythona)

Wymaga Pythona 3.10+. Interfejs jest zbudowany na PySide6 + PySide6-Fluent-Widgets
(styl Windows 11 Fluent, boczna nawigacja, efekt Mica na Windows 11 - na starszych
systemach program dziala identycznie, tylko bez przezroczystego tla okna).

```
pip install -r requirements.txt
python main.py
```

## Ikona programu i nazwa .exe

Program buduje się teraz jako **`Nagrody Vivi.exe`**, z Twoja wlasna ikona. Zeby to zadzialalo:

1. Skopiuj swoj plik obrazka (np. `47.png`) do folderu z projektem (tam gdzie jest `main.py`).
2. Zmien mu nazwe na dokladnie **`icon.png`**.
3. Uruchom `build_exe.bat` jak zwykle.

Skrypt sam zamieni `icon.png` na `icon.ico` (Windows wymaga formatu .ico dla ikon .exe,
PNG nie zadziala bezposrednio) i zbuduje z nia `Nagrody Vivi.exe`. Jesli zapomnisz
wrzucic `icon.png`, skrypt zatrzyma sie z jasnym komunikatem zamiast budowac cos
bez ikony.

## 3. Budowanie .exe (do zrobienia NA WINDOWSIE - PyInstaller nie kompiluje krzyzowo z Linuksa/Maca)

```
build_exe.bat
```

Po zbudowaniu w folderze `dist\` znajdziesz `TwitchRewardAlerts.exe` oraz skopiowany
`overlay.html`. Uruchamiaj program z tego folderu - obok stworzy sobie `config.json`
oraz folder `media\` na twoje GIF-y i dzwieki.

## 4. Pierwsze uruchomienie programu

1. Zakladka **1. Autoryzacja**: wklej Client ID i Client Secret z kroku 1, zostaw
   Redirect URI jako `http://localhost:3000`, kliknij **Zapisz i autoryzuj w przegladarce**.
2. Otworzy sie przegladarka z logowaniem Twitcha - zaloguj sie i zatwierdz dostep.
   Wrocisz do programu z komunikatem "zalogowano jako [twoj login]".
3. Zakladka **2. Nagrody**: kliknij **Odswiez liste nagrod z Twitcha** - zobaczysz
   swoje aktywne nagrody za punkty kanalu (musisz miec je juz utworzone w Creator Dashboard).
4. Zaznacz nagrode na liscie, wybierz plik GIF i plik dzwiekowy, ustaw czas wyswietlania
   (w sekundach), kliknij **Zapisz przypisanie**. Powtorz dla kazdej nagrody, ktora ma miec alert.
5. Zakladka **3. Uruchomienie**:
   - jesli OBS jest na TYM SAMYM komputerze co program - zostaw checkbox LAN odznaczony
   - jesli OBS jest na INNYM komputerze w tej samej sieci (twoj przypadek: laptop + PC) -
     zaznacz **"Zezwol na dostep z sieci LAN"**
   - kliknij **Uruchom**
6. Program pokaze adres w stylu `http://192.168.x.x:8766/overlay.html` - to jest adres
   do wklejenia w OBS.

## 5. Konfiguracja OBS (raz)

1. Dodaj zrodlo **Browser Source** (Zrodlo przegladarki).
2. W polu **URL** wklej adres pokazany w programie.
3. Ustaw rozdzielczosc np. 1920x1080 (albo taka jak twoj canvas).
4. Zaznacz **"Shutdown source when not visible"** = odznaczone (zeby dzwiek/GIF dzialal
   nawet gdy scena akurat nie jest aktywna, w zaleznosci od potrzeb).
5. Upewnij sie, ze zrodlo NIE jest wyciszone (Twitch Studio/OBS domyslnie przechwytuje
   dzwiek z Browser Source do miksera audio).

Od tej pory: odpalasz program, klikasz Uruchom, wlaczasz OBS - i dziala. Program
pamieta autoryzacje i przypisania miedzy uruchomieniami (plik `config.json`), wiec
kroki 1-4 robisz tylko raz.

## Uruchamianie na laptopie, gdy streamujesz na PC (LAN)

Patrz punkt 5 powyzej - zaznacz checkbox LAN. Upewnij sie dodatkowo, ze:
- Zapora systemowa (Windows Firewall) na laptopie pozwala na polaczenia przychodzace
  na porty 8765 i 8766 (przy pierwszym uruchomieniu Windows zwykle sam o to zapyta -
  zaznacz "Sieci prywatne").
- Router nie ma wlaczonej izolacji klientow (AP/Client Isolation) - w domowych
  routerach to rzadkosc, ale warto wiedziec, gdyby polaczenie nie chcialo dzialac.

## Pliki w projekcie

- `main.py` - GUI (Tkinter), spina wszystko w calosc
- `twitch_client.py` - logowanie OAuth + polaczenie EventSub (WebSocket)
- `overlay_server.py` - lokalny serwer HTTP + WebSocket dla nakladki
- `overlay.html` - strona wyswietlana w OBS jako Browser Source
- `config.py` / `config.json` - zapis ustawien, tokenow i przypisan nagrod
- `media/` - tu program kopiuje wgrane przez ciebie GIF-y/dzwieki
- `build_exe.bat` - budowanie samodzielnego .exe (odpalac na Windowsie)

## Typowe problemy

- **"Nie otrzymano kodu autoryzacji"** - zbyt dlugo czekales (limit 3 min) albo
  Redirect URI w programie nie zgadza sie z tym w ustawieniach apki na Twitchu.
- **Pusta lista nagrod** - upewnij sie, ze masz aktywne (wlaczone) nagrody za punkty
  kanalu w Creator Dashboard -> Viewer Rewards, i ze Channel Points sa wlaczone dla kanalu.
- **GIF/dzwiek sie nie pokazuje w OBS** - sprawdz w logu programu, czy pisze
  "Nakladka podlaczona do WebSocketu" - jesli nie, adres URL w Browser Source
  jest zly albo firewall blokuje polaczenie.
