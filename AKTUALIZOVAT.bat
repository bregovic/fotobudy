@echo off
chcp 65001 >nul
color 0B
cls

echo.
echo ==============================================
echo      A K T U A L I Z A C E   K I O S K U
echo ==============================================
echo.

cd /d "%~dp0"

echo 1. Stahuji novinky z internetu (GitHub)...
if exist settings.json (
    echo [INFO] Prejmenovavam settings.json na settings.local.json pro zachovani nastaveni...
    ren settings.json settings.local.json
)
git pull origin main

if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo.
    echo [CHYBA] Nepodarilo se stahnout aktualizace.
    echo Zkontrolujte pripojeni k internetu.
    echo.
    pause
    exit
)

echo.
echo 2. Pripravuji databazi...
call npx prisma generate
call npx prisma db push --skip-generate

echo.
echo 3. Restartuji aplikaci...
taskkill /f /im node.exe 2>nul
taskkill /f /im CameraControl.exe 2>nul
timeout /t 2 >nul

start Blick_Cvak.bat
exit
