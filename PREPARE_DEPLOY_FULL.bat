@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
color 0b
cls

REM ====================================================
REM   P R I P R A V A   K   P R E N A S E N I  (FULL v2)
REM ====================================================
echo.
echo    Tento skript pripravi KOMPLETNI balicek vcitane knihoven (node_modules).
echo.

set "DEPLOY_DIR=Deployment_Full"
set "SOURCE_DIR=%~dp0"

echo [INFO] Zdroj: %SOURCE_DIR%
echo [INFO] Cil: %SOURCE_DIR%%DEPLOY_DIR%

REM Reset
if exist "%DEPLOY_DIR%" (
    echo [INFO] Mazani stareho Deploymentu...
    rd /s /q "%DEPLOY_DIR%"
)
mkdir "%DEPLOY_DIR%"

echo [INFO] Kopiruji aplikaci...

REM - Use robocopy for better performance if available
robocopy . "%DEPLOY_DIR%" /MIR /XD node_modules .next .git Deployment Deployment_Full /XF *.lnk >nul

echo [INFO] Kopiruji node_modules (prosim cekejte)...
robocopy node_modules "%DEPLOY_DIR%\node_modules" /E /NFL /NDL /NJH /NJS >nul

REM Settings example override
copy /Y "settings.json" "%DEPLOY_DIR%\settings.example.json" >nul 2>&1

REM Add safe install scripts
copy /Y "INSTALL_MANUAL.bat" "%DEPLOY_DIR%\INSTALL.bat" >nul 2>&1
copy /Y "OPRAVA_SETTINGS.bat" "%DEPLOY_DIR%\" >nul 2>&1

echo.
echo ====================================================
echo   H O T O V O !
echo ====================================================
echo.
echo Deployment slozka pripravena v:
echo %SOURCE_DIR%%DEPLOY_DIR%
echo.
pause
