@echo off
title FotoBuddy - Obnova Galerie
echo ==========================================
echo      FotoBuddy - RESYNC GALERIE
echo ==========================================
echo.
echo Tento skript znovu nahraje vsechny fotky z disku na Cloud.
echo Pouzijte, pokud se v galerii zobrazuji prazdne ramecky.
echo.
node local-service/resync.js
pause
