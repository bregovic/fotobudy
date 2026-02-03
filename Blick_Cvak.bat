@echo off
chcp 65001 >nul
title Blick & Cvak LOCAL APP 📸🏠
color 0E
cls

echo.
echo  =============================================================
echo     B L I C K   ^&   C V A K   -   L O K A L N I   A P L I K A C E
echo  =============================================================
echo.
echo   Startuji lokalni server (rychlejsi) + DigicamControl...
echo   (Prvni start muze trvat cca 20s, prosim cekejte)
echo.

:: Přejít do složky
cd /d "%~dp0"

:: Kontrola
if not exist "scripts\start_app.js" (
    color 0C
    echo [CHYBA] Nenalezen script/start_app.js!
    pause
    exit
)

:: Spuštění Launcheru
node scripts\start_app.js

echo.
echo  =============================================================
echo   POZOR: Aplikace ukoncena.
echo  =============================================================
pause
