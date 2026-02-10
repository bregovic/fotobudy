@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
color 0e
cls

echo ==============================================
echo   O P R A V A   S E T T I N G S  (SMART)
echo ==============================================
echo.
echo Tento skript pouze OPRAVI emailove nastaveni.
echo Vsechno ostatni (cesty k fotkam, API klice) necha tak, jak jsou.
echo.

if not exist "settings.json" (
    echo [INFO] settings.json neexistuje, vytvarim novy...
    (
        echo {
        echo   "use_cloud_stream": true
        echo }
    ) > settings.json
)

echo [INFO] Aktualizuji pouze SMTP cast...

powershell -Command "$s = Get-Content settings.json | ConvertFrom-Json; if (-not $s.smtp_config) { $s | Add-Member -MemberType NoteProperty -Name 'smtp_config' -Value @{ host=''; port=''; user=''; pass='' } }; $s.smtp_config.host = 'smtp.gmail.com'; $s.smtp_config.port = '465'; $s.smtp_config.user = 'blickacvak@gmail.com'; $s.smtp_config.pass = 'wpnf vhsn fyjw c'; $s | ConvertTo-Json -Depth 10 | Set-Content settings.json"

if %errorlevel% neq 0 (
    color 0c
    echo [CHYBA] Selhala uprava JSONu.
    pause
    exit /b
)

echo.
echo [OK] Email nastaven. Ostatni hodnoty zachovany.
echo.
echo Zkontrolujte vysledek:
type settings.json
echo.
pause
