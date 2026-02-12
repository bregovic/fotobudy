
@echo off
chcp 65001 >nul
color 0c
cls

echo ====================================================
echo      F O R C E   R E S T A R T   (Kiosk)
echo ====================================================
echo.
echo Tento skript:
echo 1. Nasilne ukonci vsechny procesy Kiosku (Node, Chrome, cmd)
echo 2. Vymaze docasne soubory (cache) - vynuti nacteni zmen
echo 3. Spusti Kiosk nacisto
echo.
echo [!] Ujistete se, ze mate ulozenou praci jinde.
echo.
pause

echo.
echo [1/3] Ukoncuji procesy...
taskkill /F /IM node.exe /T 2>nul
taskkill /F /IM chrome.exe /T 2>nul
taskkill /F /IM "CameraControl.exe" /T 2>nul
taskkill /F /FI "WINDOWTITLE eq Blick_Cvak.bat" /T 2>nul

echo.
echo [2/3] Mazu Next.js cache...
if exist ".next" (
    echo       Mazani .next slozky...
    rd /s /q ".next"
)

echo.
echo [3/3] Spoustim Kiosk...
start "" "SPUSTIT_KIOSK_SPRAVNE.bat"

echo.
echo HOTOVO. Muzete zavrit toto okno.
timeout /t 10
