@echo off
chcp 65001 >nul
title Blick & Cvak - RESYNC TO CLOUD
color 0B
cls

echo.
echo  =============================================================
echo     B L I C K   ^&   C V A K   -   S Y N C   T O   C L O U D
echo  =============================================================
echo.
echo   Tento skript synchronizuje lokální fotky do Railway databáze.
echo   Fotky budou optimalizovány na cca 0.5 MB.
echo.
echo   Mapování se ukládá do: sync_map.json
echo.

cd /d "%~dp0"

if not exist "local-service\resync.js" (
    color 0C
    echo [CHYBA] Nenalezen resync.js!
    pause
    exit
)

node local-service\resync.js

echo.
echo  =============================================================
echo   Hotovo!
echo  =============================================================
echo.
pause
