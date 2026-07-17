@echo off
REM Buduje program "Nagrody Shiroe" na podstawie pliku "Nagrody Shiroe.spec"
REM (tryb --onedir - folder, nie pojedynczy plik, startuje od razu bez
REM rozpakowywania sie do folderu tymczasowego). Uruchamiaj TEN plik NA
REM WINDOWSIE, w tym samym folderze co main.py / "Nagrody Shiroe.spec",
REM PO wrzuceniu pliku icon.png do tego folderu.

pip install -r requirements.txt

if not exist icon.png (
    echo BLAD: brak pliku icon.png w tym folderze.
    echo Skopiuj swoj obrazek tutaj i zmien mu nazwe na icon.png, potem uruchom ten plik ponownie.
    pause
    exit /b 1
)

if not exist "Nagrody Shiroe.spec" (
    echo BLAD: brak pliku "Nagrody Shiroe.spec" w tym folderze.
    pause
    exit /b 1
)

REM Konwersja PNG na ICO - PyInstaller na Windowsie wymaga formatu .ico, nie .png
python -c "from PIL import Image; img = Image.open('icon.png').convert('RGBA'); img.save('icon.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])"

REM Budujemy na podstawie .spec, zeby konfiguracja (wykluczone moduly Qt,
REM dolaczone pliki danych: overlay.html, instrukcja.txt, owo.png itd.)
REM byla trzymana w JEDNYM miejscu i nie rozjezdzala sie z tym skryptem.
python -m PyInstaller --noconfirm "Nagrody Shiroe.spec"

echo.
echo Gotowe. W folderze dist\Nagrody Shiroe\ masz caly program:
echo   - Nagrody Shiroe.exe   ^<- TEN plik uruchamiasz
echo   - folder _internal\    (biblioteki, Qt itp. - MUSI zostac obok exe)
echo.
echo WAZNE: to NIE jest pojedynczy plik do wyslania. Do spakowania w
echo instalator (Inno Setup) uzyj CALEGO folderu "dist\Nagrody Shiroe".
pause
