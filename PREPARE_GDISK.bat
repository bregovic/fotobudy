@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
color 0b
cls

REM ====================================================
REM      F O T O B U D D Y   -   G-DISK S Y N C
REM ====================================================

REM Cesta, kterou si uzivatel vyzadoval
set "TARGET_DIR=DeployGDisk"
set "SOURCE_DIR=%~dp0"

echo [INFO] Zdroj: %SOURCE_DIR%
echo [INFO] Cil: %SOURCE_DIR%%TARGET_DIR%

REM 1. Reset (vycistit cilovou slozku)
if exist "%TARGET_DIR%" rd /s /q "%TARGET_DIR%"
mkdir "%TARGET_DIR%"

echo [INFO] Kopiruji zmenene soubory...

REM 2. Kod aplikace a Skripty (Patch)
xcopy /E /I /Q /Y "app" "%TARGET_DIR%\app"
xcopy /E /I /Q /Y "scripts" "%TARGET_DIR%\scripts"
xcopy /E /I /Q /Y "local-service" "%TARGET_DIR%\local-service"
xcopy /E /I /Q /Y "public" "%TARGET_DIR%\public" /EXCLUDE:exclude_photos.txt
REM Kopirujeme Prisma pro novou databazi
xcopy /E /I /Q /Y "prisma" "%TARGET_DIR%\prisma"

REM 3. Config
copy /Y "package.json" "%TARGET_DIR%\" >nul
copy /Y "next.config.mjs" "%TARGET_DIR%\" >nul
copy /Y "tsconfig.json" "%TARGET_DIR%\" >nul
copy /Y "postcss.config.mjs" "%TARGET_DIR%\" >nul
copy /Y "tailwind.config.ts" "%TARGET_DIR%\" >nul
copy /Y ".env" "%TARGET_DIR%\" >nul
copy /Y "settings.json" "%TARGET_DIR%\settings.example.json" >nul

REM 4. Deployment Tools
copy /Y "INSTALL_FAST.bat" "%TARGET_DIR%\" >nul
copy /Y "OPRAVA_EMAIL_NODE.bat" "%TARGET_DIR%\" >nul
copy /Y "SPUSTIT_KIOSK_SPRAVNE.bat" "%TARGET_DIR%\" >nul
copy /Y "PREPARE_DEPLOY_FULL.bat" "%TARGET_DIR%\" >nul

REM 5. Dokumentace
(
echo ====================================================
echo      F O T O B U D D Y   -   G-DISK E X P O R T
echo ====================================================
echo.
echo Tento balicek je pripraveny pro Google Drive.
echo Obsahuje kompletni kod aplikace (bez zbytecnych cache).
echo.
echo ====================================================
echo      N A V O D   P R O   I N S T A L A C I
echo ====================================================
echo.
echo 1. Stahnete obsah teto slozky na cilovy pocitac do:
echo    C:\Apps\FotoBuddy (nebo kamkoliv jinam).
echo.
echo 2. Spustte INSTALL_FAST.bat.
echo    -> Automaticky nainstaluje node_modules (pokud chybi).
echo    -> Spustit jako prvni krok.
echo.
echo 3. Spustte OPRAVA_EMAIL_NODE.bat.
echo    -> Pro nastaveni emailu.
echo.
echo 4. Spustte SPUSTIT_KIOSK_SPRAVNE.bat
echo    -> Spusti aplikaci.
echo.
) > "%TARGET_DIR%\PRECTI_ME.txt"

echo.
echo ====================================================
echo   H O T O V O !
echo ====================================================
echo.
echo Obsah je ve slozce: %TARGET_DIR%
echo Muzete to pretahnout na Google Disk.
echo.
pause
