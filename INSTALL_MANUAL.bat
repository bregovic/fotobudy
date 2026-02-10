@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
color 0e
cls

echo.
echo ====================================================
echo      F O T O B U D D Y   -   I N S T A L A C E
echo ====================================================
echo.

REM 1. Check Node.js
if not exist "node_modules\.bin\prisma.cmd" (
    color 0c
    echo [CHYBA] Slozka node_modules nenalezena!
    echo         Spustili jste tento script ve spatne slozce?
    echo         Nebo chybi nainstalovane zavislosti.
    pause
    exit /b
)

echo.
echo 2. Priprava databaze...
call node_modules\.bin\prisma generate
if %errorlevel% neq 0 (
    color 0c
    echo [CHYBA] Selhalo generovani Prisma klienta.
    pause
    exit /b
)

call node_modules\.bin\prisma db push --accept-data-loss
if %errorlevel% neq 0 (
    color 0c
    echo [CHYBA] Selhala aktualizace databaze.
    pause
    exit /b
)

echo.
echo 3. Tvorba Zastupce...
if exist "scripts\create_shortcut_dynamic.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/create_shortcut_dynamic.ps1"
) else (
    echo [INFO] Skript pro zastupce scripts/create_shortcut_dynamic.ps1 nenalezen, preskakuji.
)

echo.
echo 4. Nastaveni Emailu...
if not exist "settings.json" (
    echo [INFO] Vytvarim zakladni settings.json...
    (
    echo {
    echo   "email_template": {
    echo     "subject": "Tvoje fotka z FotoBuddy! 🥳",
    echo     "body": "Ahoj! Tady je tvoje fotka z akce. Užij si ji!"
    echo   },
    echo   "smtp_config": {
    echo     "host": "smtp.gmail.com",
    echo     "port": "465",
    echo     "user": "blickacvak@gmail.com",
    echo     "pass": "wpnf vhsn fyjw c"
    echo   },
    echo   "photo_path": "C:\\Fotky",
    echo   "use_cloud_stream": true
    echo }
    ) > "settings.json"
)

echo.
echo ====================================================
echo   H O T O V O !
echo ====================================================
echo.
echo Aplikaci spustite ikonou na plose "Blick & Cvak".
echo.
pause
