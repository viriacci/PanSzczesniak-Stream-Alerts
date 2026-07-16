@echo off
REM Buduje program "Nagrody Shiroe" w trybie --onedir (folder, nie pojedynczy plik)
REM Uruchamiaj ten plik w tym samym folderze co main.py, po upewnieniu się, 
REM że posiadasz wszystkie wymagane pliki zasobów.

pip install -r requirements.txt

if not exist icon.png (
    echo BLAD: brak pliku icon.png w tym folderze.
    echo Skopiuj swoj obrazek tutaj i zmien mu nazwe na icon.png, potem uruchom ten plik ponownie.
    pause
    exit /b 1
)

REM Konwersja PNG na ICO - PyInstaller na Windowsie wymaga formatu .ico
python -c "from PIL import Image; img = Image.open('icon.png').convert('RGBA'); img.save('icon.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])"

REM Komenda budujaca z uwzglednieniem wszystkich zasobow
python -m PyInstaller --onedir --noconsole --name "Nagrody Shiroe" --icon "icon.ico" ^
    --add-data "overlay.html;." ^
    --add-data "icon.png;." ^
    --add-data "instructions.txt;." ^
    --add-data "owo.png;." ^
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
echo Gotowe. W folderze dist\Nagrody Shiroe\ znajduje sie caly program.
echo Pamietaj, aby dystrybuowac caly folder, a nie tylko plik .exe.
echo.
pause