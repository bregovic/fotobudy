@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
color 0b
cls

REM ====================================================
REM      F O T O B U D D Y   -   P A T C H   V13
REM ====================================================

set "DEPLOY_DIR=Patch_Update"
set "SOURCE_DIR=%~dp0"

echo [INFO] Zdroj: %SOURCE_DIR%
echo [INFO] Cil: %SOURCE_DIR%%DEPLOY_DIR%

REM Reset
if exist "%DEPLOY_DIR%" rd /s /q "%DEPLOY_DIR%"
mkdir "%DEPLOY_DIR%"

echo [INFO] Kopiruji zmenene soubory...

REM 1. Kod aplikace (vcetne Smart Gallery List API a noveho nastaveni emailu)
xcopy /E /I /Q /Y "app" "%DEPLOY_DIR%\app"
xcopy /E /I /Q /Y "scripts" "%DEPLOY_DIR%\scripts"
xcopy /E /I /Q /Y "local-service" "%DEPLOY_DIR%\local-service"

REM 2. KONFIGURACE
copy /Y ".env" "%DEPLOY_DIR%\.env" >nul
copy /Y "settings.json" "%DEPLOY_DIR%\settings.example.json" >nul

REM 3. Pomocne skripty (vsechny dulezite)
copy /Y "INSTALL_FAST.bat" "%DEPLOY_DIR%\" >nul
copy /Y "OPRAVA_SETTINGS.bat" "%DEPLOY_DIR%\" >nul
copy /Y "OPRAVA_EMAIL_NODE.bat" "%DEPLOY_DIR%\" >nul
copy /Y "SPUSTIT_KIOSK_SPRAVNE.bat" "%DEPLOY_DIR%\" >nul
copy /Y "public\DEBUG_GALLERY.html" "%DEPLOY_DIR%\public\DEBUG_GALLERY.html" >nul

REM 4. Dokumentace
(
echo ====================================================
echo      F O T O B U D D Y   -   P A T C H   V13
echo ====================================================
echo.
echo 1. Zkopirujte obsah Patch_Update.
echo.
echo 2. Spustte INSTALL_FAST.bat (restartuje server).
echo    - Nyni galerie skryva originaly, pokud existuje upravena verze.
echo.
echo 3. Spustte OPRAVA_EMAIL_NODE.bat
echo    - Nastavi predmet emailu na "Fotka je tu! 🥳".
echo.
echo 4. Spustte aplikaci (SPUSTIT_KIOSK_SPRAVNE.bat).
echo.
) > "%DEPLOY_DIR%\PRECTI_ME.txt"

echo.
echo ====================================================
echo   H O T O V O !
echo ====================================================
echo.
echo Rychly update pripraven (Patch V13).
echo.
pause
