@echo off
setlocal
chcp 65001 >nul
cls

echo [INFO] Zacatek...

if exist "Update_Package_Final" rd /s /q "Update_Package_Final"
mkdir "Update_Package_Final"

echo [INFO] Kopiruji slozky...
xcopy /E /I /Q /Y "app" "Update_Package_Final\app"
xcopy /E /I /Q /Y "scripts" "Update_Package_Final\scripts"
xcopy /E /I /Q /Y "local-service" "Update_Package_Final\local-service"
xcopy /E /I /Q /Y "public" "Update_Package_Final\public"
xcopy /E /I /Q /Y "prisma" "Update_Package_Final\prisma"
xcopy /E /I /Q /Y "lib" "Update_Package_Final\lib"

echo [INFO] Mazani fotek...
if exist "Update_Package_Final\public\photos" rd /s /q "Update_Package_Final\public\photos"
mkdir "Update_Package_Final\public\photos"

echo [INFO] Kopiruji soubory...
copy /Y "package.json" "Update_Package_Final"
copy /Y "next.config.ts" "Update_Package_Final"
copy /Y "tsconfig.json" "Update_Package_Final"
copy /Y "postcss.config.mjs" "Update_Package_Final"
copy /Y "tailwind.config.ts" "Update_Package_Final"
copy /Y ".env" "Update_Package_Final"
copy /Y "settings.json" "Update_Package_Final\settings.example.json"

echo [INFO] Kopiruji skripty...
copy /Y "INSTALL_FAST.bat" "Update_Package_Final"
copy /Y "OPRAVA_EMAIL_NODE.bat" "Update_Package_Final"
copy /Y "SPUSTIT_KIOSK_SPRAVNE.bat" "Update_Package_Final"
copy /Y "PREPARE_PATCH.bat" "Update_Package_Final"
copy /Y "public\DEBUG_GALLERY.html" "Update_Package_Final"

copy /Y "FORCE_RESTART.bat" "Update_Package_Final"

echo [INFO] Vytvarim Assets adresare...
mkdir "Update_Package_Final\public\assets\backgrounds" 2>nul
mkdir "Update_Package_Final\public\assets\stickers" 2>nul

(
echo Navod k instalaci:
echo 0. POKUD MATE PROBLEMY, spustte FORCE_RESTART.bat
echo 1. Smazte settings.local.json na Kiosku.
echo 2. Spustte INSTALL_FAST.bat
echo 3. Spustte SPUSTIT_KIOSK_SPRAVNE.bat
) > "Update_Package_Final\PRECTI_ME.txt"

echo [INFO] HOTOVO!
pause
