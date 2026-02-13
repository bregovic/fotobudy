@echo off
chcp 65001 >nul
color 0b
cls

echo ====================================================
echo      S P U S T E N I   K I O S K U   (CORRECT)
echo ====================================================
echo.
echo Tento skript zajisti, ze bezite na LOKALNI adrese.
echo (Cloudova verze na Railway se s kamerou nespoji).
echo.

cd /d "%~dp0"

REM 1. Zkontrolujeme, zda bezi server (port 3000) - robustni kontrola (CZ/EN)
netstat -an | find ":3000 " | find /i "LISTENING" >nul
if %errorlevel% neq 0 (
    netstat -an | find ":3000 " | find /i "NASLOUCH" >nul
)

if %errorlevel% neq 0 (
    echo [INFO] Lokalni server nebezi (port 3000 volny). Startuji Blick_Cvak.bat...
    start "" "Blick_Cvak.bat"
    
    echo Cekam 15 sekund na start serveru...
    timeout /t 15 >nul
) else (
    echo [OK] Server jiz bezi (port 3000 obsazen).
    echo [INFO] Nespoustim novou instanci, pouze oteviram okno.
)

REM 2. Otevreme Chrome na LOCALHOST
echo [INFO] Oteviram Kiosk na http://localhost:3000/kiosk ...

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000/kiosk --start-maximized
) else (
    start http://localhost:3000/kiosk
)

echo.
echo Hotovo. Pokud vidite obrazovku, je to SPRAVNE.
echo Pokud vidite chybu, zkontrolujte cerne okno Blick_Cvak.
echo.
pause
