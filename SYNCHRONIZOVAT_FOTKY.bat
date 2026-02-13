
@echo off
chcp 65001 >nul
cls

echo ====================================================
echo      FOTBUDDY - RUCNI SYNCHRONIZACE CLOUDU
echo ====================================================
echo.
echo Tento skript nacte vsechny fotky z DISKU C: (lokalni)
echo a nahraje je do RAILWAY DATABAZE (pokud tam nejsou).
echo.
echo [!] Ujistete se, ze mate internet.
echo [!] Musi existovat soubor .env s pripojenim k DB.
echo.
pause

echo.
echo [INFO] Hledam fotky...
node scripts/manual_sync.js

echo.
echo HOTOVO.
pause
