@echo off
setlocal enabledelayedexpansion
color 0b
cls

echo.
echo ====================================================
echo      F O T O B U D D Y   -   I N S T A L A C E
echo ====================================================
echo.

REM 1. Check Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    color 0c
    echo [CHYBA] Node.js neni nainstalovan!
    echo Prosim nainstalujte: https://nodejs.org/
    pause
    exit /b
)

REM 2. Check dependencies (Smart Install)
if exist "node_modules" (
    echo [INFO] Knihovny nalezeny (offline rezim).
    echo        Preskakuji stahovani z internetu.
) else (
    echo [INFO] Knihovny nenalezeny. Stahuji z internetu...
    call npm install
    if !errorlevel! neq 0 (
        color 0c
        echo [CHYBA] Selhala instalace (npm install).
        echo Zkontrolujte internet.
        pause
        exit /b
    )
)

REM 3. Setup Database
echo.
echo [INFO] Pripravuji databazi...
rem Try local npx first
if exist "node_modules\.bin\prisma.cmd" (
    call node_modules\.bin\prisma generate
    call node_modules\.bin\prisma db push --accept-data-loss
) else (
    call npx prisma generate
    call npx prisma db push --accept-data-loss
)

REM 4. Create Shortcut
if exist "scripts\create_shortcut_dynamic.ps1" (
    echo.
    echo [INFO] Vytvarim zastupce...
    powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/create_shortcut_dynamic.ps1"
)

REM 5. Settings Check
if not exist "settings.json" if exist "settings.example.json" (
    echo [INFO] Vytvarim settings.json...
    copy settings.example.json settings.json >nul
)

echo.
echo ====================================================
echo   H O T O V O !
echo ====================================================
echo.
echo Aplikaci spustite ikonou na plose "Blick & Cvak".
echo.
pause
