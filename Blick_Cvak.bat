@echo off
chcp 65001 >nul
title FotoBuddy LOCAL APP 📸🏠
color 0E
cls

echo.
echo  =============================================================
echo     F O T O B U D D Y   -   L O K A L N I   A P L I K A C E
echo  =============================================================
echo.
echo   Startuji lokalni server (rychlejsi) + DigicamControl...
echo   (Prvni start muze trvat cca 20s, prosim cekejte)
echo.

:: Přejít do složky
cd /d "%~dp0"

:: Kontrola
if not exist "scripts\start_fotobuddy.js" (
    color 0C
    echo [CHYBA] Nenalezen script/start_fotobuddy.js!
    pause
    exit
)

:: Spuštění Launcheru
node scripts\start_fotobuddy.js

echo.
echo  =============================================================
echo   POZOR: Aplikace ukoncena.
echo  =============================================================
pause
