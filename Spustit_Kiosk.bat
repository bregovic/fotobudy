@echo off
set "CHROME_PATH_1=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "CHROME_PATH_2=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
set "KIOSK_URL=http://localhost:3000/kiosk"

if exist "%CHROME_PATH_1%" (
    set "CHROME=%CHROME_PATH_1%"
) else (
    set "CHROME=%CHROME_PATH_2%"
)

if not exist "%CHROME%" (
    echo Chrome nenalezen!
    pause
    exit
)

start "" "%CHROME%" --app=%KIOSK_URL% --start-maximized --kiosk --autoplay-policy=no-user-gesture-required --disable-infobars --user-data-dir=C:\Temp\BlickCvakKiosk
