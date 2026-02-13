@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
color 0e
cls

echo ==============================================
echo   O P R A V A   E M A I L U  (NODE)
echo ==============================================
echo.
echo    Tento soubor zajisti, ze settings.json ma platny JSON format
echo    a obsahuje spravne udaje pro Gmail.
echo    Pouzivejte, pokud predchozi OPRAVA_SETTINGS.bat nepomohl.
echo.

node scripts/fix_settings.js

if %errorlevel% neq 0 (
    color 0c
    echo [CHYBA] Selhala oprava settings.json.
    echo Zkontrolujte konzoli.
) else (
    color 0a
    echo [OK] settings.json aktualizovan.
    echo.
    echo Nyni zkuste odeslat email v aplikaci.
)

pause
