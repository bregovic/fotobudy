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

REM Kill any running node processes that might lock the files
echo [INFO] Ukoncuji bezici procesy...
taskkill /F /IM node.exe >nul 2>&1

echo.
echo 1. Check Node.js
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
REM Try to delete the problematic file if exists
if exist "node_modules\.prisma\client\query_engine-windows.dll.node" (
    del /F /Q "node_modules\.prisma\client\query_engine-windows.dll.node" >nul 2>&1
)

call node_modules\.bin\prisma generate
if %errorlevel% neq 0 (
    color 0c
    echo [CHYBA] Selhala aktualizace databaze.
    echo         Zkuste restartovat pocitac a spustit znovu.
    echo         Chyba: EPERM (soubor je pouzivan).
    pause
    exit /b
)

call node_modules\.bin\prisma db push --accept-data-loss
if %errorlevel% neq 0 (
    color 0c
    echo [CHYBA] Selhala synchronizace schematu databaze.
    pause
    exit /b
)

echo.
echo 3. Tvorba Zastupce...
if exist "scripts\create_shortcut_dynamic.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/create_shortcut_dynamic.ps1"
)

echo.
echo 4. Nastaveni Emailu...
if not exist "settings.json" (
    echo [INFO] Vytvarim settings.json...
    copy settings.example.json settings.json
)

echo.
echo ====================================================
echo   H O T O V O !
echo ====================================================
echo.
echo Aplikaci muzete spustit ikonou na plose "Blick & Cvak".
echo.
pause
