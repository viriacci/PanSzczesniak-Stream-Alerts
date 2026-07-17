# PanSzczesniak Stream Alerts

Program pokazuje GIF/obraz i odtwarza dzwiek w OBS, kiedy widz odbierze
konkretna nagrode za punkty kanalu na Twitchu. Dziala przez oficjalne
EventSub (WebSocket) - zero reverse-engineeringu, zero botow.

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
Te kroki (z klikalnymi linkami i checkboxami) sa tez dostepne bezposrednio
w programie, w zakladce **Instrukcja**.

## 2. Instalacja (development / uruchomienie z Pythona)

Wymaga Pythona 3.10+. Interfejs jest zbudowany na PySide6 + PySide6-Fluent-Widgets
(styl Windows 11 Fluent, boczna nawigacja, ciemny motyw, akcent `#E3C048`).

```
pip install -r requirements.txt
python main.py
```

## Ikona programu

Program buduje sie jako **`PanSzczesniak Stream Alerts.exe`**, z Twoja wlasna
ikona. Zeby to zadzialalo:

1. Skopiuj swoj plik obrazka do folderu z projektem (tam gdzie jest `main.py`).
2. Zmien mu nazwe na dokladnie **`icon.png`**.
3. Uruchom `build_exe.bat` jak zwykle.

Skrypt sam zamieni `icon.png` na `icon.ico` (Windows wymaga formatu .ico dla
ikon .exe, PNG nie zadziala bezposrednio). Jesli zapomnisz wrzucic `icon.png`,
skrypt zatrzyma sie z jasnym komunikatem zamiast budowac cos bez ikony.

## 3. Budowanie programu (do zrobienia NA WINDOWSIE - PyInstaller nie kompiluje krzyzowo z Linuksa/Maca)

```
build_exe.bat
```

Skrypt buduje program na podstawie pliku **`PanSzczesniak Stream Alerts.spec`**
(tryb `--onedir` - folder, nie pojedynczy plik, wiec program startuje od razu
bez kilkusekundowego rozpakowywania sie przy kazdym uruchomieniu). Cala
konfiguracja PyInstallera (wykluczone moduly Qt, dolaczane pliki danych:
`overlay.html`, `icon.png`, `instrukcja.txt`, `owo.png`) trzymana jest w tym
jednym pliku `.spec`, zeby nie rozjezdzala sie z tym skryptem.

Po zbudowaniu w folderze `dist\PanSzczesniak Stream Alerts\` znajdziesz caly
program:
- **`PanSzczesniak Stream Alerts.exe`** - ten plik uruchamiasz
- folder **`_internal\`** - biblioteki (Qt, Python itp.), musi zostac obok .exe

## 4. Budowanie instalatora (Inno Setup) - zalecany sposob wysylania programu dalej

Zamiast recznie pakowac i wysylac caly folder `dist\...`, uzyj gotowego
skryptu **`installer.iss`**:

1. Zainstaluj darmowy [Inno Setup Compiler](https://jrsoftware.org/isinfo.php).
2. Upewnij sie, ze `dist\PanSzczesniak Stream Alerts\` istnieje (patrz punkt 3)
   oraz ze `icon.ico` jest w folderze projektu (powstaje automatycznie
   w `build_exe.bat`).
3. Otworz `installer.iss` w Inno Setup Compiler, kliknij **Build -> Compile**
   (albo `Ctrl+F9`).
4. Gotowy instalator znajdziesz w `installer_output\PanSzczesniak-Stream-Alerts-Instalator.exe`.

Instalator:
- **nie wymaga uprawnien administratora** (instaluje sie per-uzytkownik do
  `%LocalAppData%\Programs\PanSzczesniak Stream Alerts`, bez okienka UAC),
- sam tworzy skrot na Pulpicie i w Menu Start,
- przy odinstalowaniu **nie kasuje** danych uzytkownika (autoryzacji Twitcha,
  przypisanych GIF-ow/dzwiekow) - te siedza osobno, w Dokumentach.

Wysylasz dalej **TYLKO** plik `PanSzczesniak-Stream-Alerts-Instalator.exe` -
reszta (folder `_internal`, skroty) tworzy sie sama podczas instalacji.

## 5. Pierwsze uruchomienie programu

1. Zakladka **1. Autoryzacja**: wklej Client ID i Client Secret z kroku 1, zostaw
   Redirect URI jako `http://localhost:3000`, kliknij **Zapisz i autoryzuj w przegladarce**.
2. Otworzy sie przegladarka z logowaniem Twitcha - zaloguj sie i zatwierdz dostep.
   Wrocisz do programu z komunikatem "zalogowano jako [twoj login]".
3. Zakladka **2. Nagrody**: kliknij **Odswiez liste nagrod z Twitcha** - zobaczysz
   swoje aktywne nagrody za punkty kanalu (musisz miec je juz utworzone w Creator Dashboard).
4. Zaznacz nagrode na liscie, wybierz plik obrazu/GIF (gif/png/jpg/jpeg/webp) i plik
   dzwiekowy, ustaw czas wyswietlania (w sekundach), kliknij **Zapisz przypisanie**.
   Powtorz dla kazdej nagrody, ktora ma miec alert.
5. Zakladka **3. Uruchomienie**:
   - jesli OBS jest na TYM SAMYM komputerze co program - zostaw checkbox LAN odznaczony
   - jesli OBS jest na INNYM komputerze w tej samej sieci - zaznacz
     **"Zezwol na dostep z sieci LAN"**
   - kliknij **Uruchom**
6. Program pokaze adres w stylu `http://192.168.x.x:8766/overlay.html` - to jest adres
   do wklejenia w OBS.

## 6. Konfiguracja OBS (raz)

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

## Uruchamianie na laptopie, gdy streamujesz na innym komputerze (LAN)

Patrz punkt 6 powyzej - zaznacz checkbox LAN. Upewnij sie dodatkowo, ze:
- Zapora systemowa (Windows Firewall) pozwala na polaczenia przychodzace
  na porty 8765 i 8766 (przy pierwszym uruchomieniu Windows zwykle sam o to zapyta -
  zaznacz "Sieci prywatne").
- Router nie ma wlaczonej izolacji klientow (AP/Client Isolation) - w domowych
  routerach to rzadkosc, ale warto wiedziec, gdyby polaczenie nie chcialo dzialac.

## Dane programu i migracja ze starszych wersji

Program trzyma swoje dane (`config.json`, autoryzacja Twitcha, folder `media\`
z Twoimi GIF-ami/dzwiekami, tresc zakladki Instrukcja) w:

```
Dokumenty\PanSzczesniak Stream Alerts\
```

niezaleznie od tego, gdzie zainstalowany jest sam program. Jesli na danym
komputerze byla juz wczesniej zainstalowana starsza wersja programu (pod
nazwa "Shiroe Twitch Alerts", "Nagrody Vivi" albo "PanSzczesniak Twitch
Alerts"), program **automatycznie skopiuje z niej dane** przy pierwszym
uruchomieniu nowej wersji - nie trzeba nic robic recznie, autoryzacja Twitcha
i przypisania nagrod przechodza same.

## Pliki w projekcie

- `main.py` - GUI (PySide6 + QFluentWidgets), spina wszystko w calosc
- `twitch_client.py` - logowanie OAuth + polaczenie EventSub (WebSocket)
- `overlay_server.py` - lokalny serwer HTTP + WebSocket dla nakladki
- `overlay.html` - strona wyswietlana w OBS jako Browser Source
- `instruction_interface.py` - logika zakladki Instrukcja (parser `instrukcja.txt`)
- `instrukcja.txt` - tresc zakladki Instrukcja (nagłowki, checkboxy, klikalne linki)
- `config.py` / `config.json` - zapis ustawien, tokenow i przypisan nagrod
- `media/` - tu program kopiuje wgrane przez ciebie obrazy/GIF-y/dzwieki
- `icon.png` / `icon.ico` - ikona programu (Ty dostarczasz `icon.png`, `.ico` powstaje automatycznie)
- `owo.png` - grafika pokazywana po ukonczeniu checklisty w zakladce Instrukcja
- `PanSzczesniak Stream Alerts.spec` - konfiguracja budowania PyInstaller (jedno zrodlo prawdy)
- `build_exe.bat` - budowanie programu z pliku `.spec` (odpalac na Windowsie)
- `installer.iss` - skrypt Inno Setup do budowania instalatora `.exe`

## Typowe problemy

- **"Nie otrzymano kodu autoryzacji"** - zbyt dlugo czekales (limit 3 min) albo
  Redirect URI w programie nie zgadza sie z tym w ustawieniach apki na Twitchu.
- **Pusta lista nagrod** - upewnij sie, ze masz aktywne (wlaczone) nagrody za punkty
  kanalu w Creator Dashboard -> Viewer Rewards, i ze Channel Points sa wlaczone dla kanalu.
- **GIF/obraz/dzwiek sie nie pokazuje w OBS** - sprawdz w logu programu, czy pisze
  "Nakladka podlaczona do WebSocketu" - jesli nie, adres URL w Browser Source
  jest zly albo firewall blokuje polaczenie.
- **Program nie startuje po przeniesieniu na inny komputer bez instalatora** -
  upewnij sie, ze przeniosles/wypakowales CALY folder `PanSzczesniak Stream
  Alerts` (z `_internal\` w srodku), a nie sam plik `.exe`. Najlatwiej tego
  unikniesz, wysylajac gotowy instalator (patrz punkt 4).
