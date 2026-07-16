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
    --add-data "overlay.html;." ^
    --add-data "icon.png;." ^
    --collect-all qfluentwidgets ^
    --collect-all qframelesswindow ^
    --exclude-module PySide6.QtWebEngineCore ^
    --exclude-module PySide6.QtWebEngineWidgets ^
    --exclude-module PySide6.QtWebEngineQuick ^
    --exclude-module PySide6.QtQml ^
    --exclude-module PySide6.QtQuick ^
    --exclude-module PySide6.QtQuick3D ^
    --exclude-module PySide6.QtQuickWidgets ^
    --exclude-module PySide6.QtMultimedia ^
    --exclude-module PySide6.QtMultimediaWidgets ^
    --exclude-module PySide6.QtBluetooth ^
    --exclude-module PySide6.QtSerialPort ^
    --exclude-module PySide6.QtSql ^
    --exclude-module PySide6.QtTest ^
    --exclude-module PySide6.QtDesigner ^
    --exclude-module PySide6.QtHelp ^
    --exclude-module PySide6.QtPdf ^
    --exclude-module PySide6.QtPdfWidgets ^
    --exclude-module PySide6.QtCharts ^
    --exclude-module PySide6.QtDataVisualization ^
    --exclude-module PySide6.QtRemoteObjects ^
    --exclude-module PySide6.QtSensors ^
    --exclude-module PySide6.QtPositioning ^
    --exclude-module PySide6.QtNfc ^
    --exclude-module PySide6.QtWebSockets ^
    --exclude-module PySide6.QtWebChannel ^
    --exclude-module PySide6.QtSpeech ^
    --exclude-module PySide6.QtScxml ^
    --exclude-module PySide6.Qt3DCore ^
    --exclude-module PySide6.Qt3DRender ^
    --exclude-module PySide6.Qt3DInput ^
    --exclude-module PySide6.Qt3DLogic ^
    --exclude-module PySide6.Qt3DAnimation ^
    --exclude-module PySide6.Qt3DExtras ^
    main.py

echo.
echo Gotowe. W folderze dist\ masz TYLKO jeden plik:
echo   - Nagrody Vivi.exe
echo To jest jedyny plik ktory musisz wyslac / przeniesc na inny komputer.
echo Program przy pierwszym uruchomieniu sam utworzy folder
echo Dokumenty\Nagrody Vivi (config.json, media\, overlay.html) - nic
echo nie trzeba dokladac recznie.
echo.
echo Uwaga: exe budowany trybem --onefile ZAWSZE przy kazdym starcie rozpakowuje
echo sie do folderu tymczasowego, wiec pierwsze 1-3 sekundy startu to normalne.
echo Ten build jest jednak znaczaco mniejszy/szybszy niz poprzedni, bo nie dokleja
echo juz nieuzywanych modulow Qt (WebEngine, Qml, Multimedia itp.).
pause
