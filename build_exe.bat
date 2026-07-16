@echo off
REM Buduje "Nagrody Vivi.exe" z wlasna ikona. Uruchamiaj TEN plik NA WINDOWSIE,
REM w tym samym folderze co main.py, PO wrzuceniu pliku icon.png do tego folderu
REM (patrz README - sekcja "Ikona programu").

pip install -r requirements.txt

if not exist icon.png (
    echo BLAD: brak pliku icon.png w tym folderze.
    echo Skopiuj swoj obrazek tutaj i zmien mu nazwe na icon.png, potem uruchom ten plik ponownie.
    pause
    exit /b 1
)

REM Konwersja PNG na ICO - PyInstaller na Windowsie wymaga formatu .ico, nie .png
python -c "from PIL import Image; img = Image.open('icon.png').convert('RGBA'); img.save('icon.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])"

python -m PyInstaller --onefile --noconsole --name "Nagrody Vivi" --icon "icon.ico" ^
    --collect-all PySide6 ^
    --collect-all qfluentwidgets ^
    --collect-all qframelesswindow ^
    main.py

copy overlay.html "dist\overlay.html"
copy icon.png "dist\icon.png"

echo.
echo Gotowe. W folderze dist\ masz teraz:
echo   - Nagrody Vivi.exe  (z Twoja ikona)
echo   - overlay.html
echo Uruchamiaj program z tego folderu - sam utworzy tam config.json i folder media\.
pause
