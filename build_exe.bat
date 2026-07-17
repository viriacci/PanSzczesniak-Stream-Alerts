@echo off
REM Buduje program "PanSzczesniak Stream Alerts" na podstawie pliku
REM "PanSzczesniak Stream Alerts.spec" (tryb --onedir - folder, nie
REM pojedynczy plik, startuje od razu bez rozpakowywania sie do folderu
REM tymczasowego). Uruchamiaj TEN plik NA WINDOWSIE, w tym samym folderze
REM co main.py / plik .spec, PO wrzuceniu pliku icon.png do tego folderu.

pip install -r requirements.txt

if not exist icon.png (
    echo BLAD: brak pliku icon.png w tym folderze.
    echo Skopiuj swoj obrazek tutaj i zmien mu nazwe na icon.png, potem uruchom ten plik ponownie.
    pause
    exit /b 1
)

if not exist "PanSzczesniak Stream Alerts.spec" (
    echo BLAD: brak pliku "PanSzczesniak Stream Alerts.spec" w tym folderze.
    pause
    exit /b 1
)

REM Konwersja PNG na ICO - PyInstaller na Windowsie wymaga formatu .ico, nie .png
python -c "from PIL import Image; img = Image.open('icon.png').convert('RGBA'); img.save('icon.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])"

REM Budujemy na podstawie .spec, zeby konfiguracja (wykluczone moduly Qt,
REM dolaczone pliki danych: overlay.html, instrukcja.txt, owo.png itd.)
REM byla trzymana w JEDNYM miejscu i nie rozjezdzala sie z tym skryptem.
python -m PyInstaller --noconfirm "PanSzczesniak Stream Alerts.spec"

echo.
echo Gotowe. W folderze dist\PanSzczesniak Stream Alerts\ masz caly program:
echo   - PanSzczesniak Stream Alerts.exe   ^<- TEN plik uruchamiasz
echo   - folder _internal\                 (biblioteki, Qt itp. - MUSI zostac obok exe)
echo.
echo WAZNE: to NIE jest pojedynczy plik do wyslania. Do spakowania w
echo instalator (Inno Setup) uzyj CALEGO folderu "dist\PanSzczesniak Stream Alerts".
pause
