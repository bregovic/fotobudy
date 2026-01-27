@echo off
cd /d "%~dp0"
echo ===================================================
echo   FOTOBUDDY BRIDGE - SPUSTENO JAKO SPRAVCE
echo ===================================================
echo.
echo Probiha start serveru...
echo.

node local-service/server.js

echo.
echo Server se ukoncil.
pause
