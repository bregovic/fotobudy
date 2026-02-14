$target = "Update_Package_Final"
Write-Host "1/3 Mazání starých souborů..."
if (Test-Path $target) { Remove-Item $target -Recurse -Force }
New-Item -ItemType Directory -Path $target | Out-Null

Write-Host "2/3 Kopírování souborů projektu..."
# Folders
foreach ($folder in @("app", "scripts", "local-service", "public", "prisma", "lib")) {
    if (Test-Path $folder) {
        Copy-Item $folder -Destination $target -Recurse
    }
}

# Root Files
foreach ($file in @("package.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs", "tailwind.config.ts", ".env")) {
    if (Test-Path $file) {
        Copy-Item $file -Destination $target
    }
}

# Settings example
if (Test-Path "settings.json") {
    Copy-Item "settings.json" -Destination "$target\settings.example.json"
}

# Scripts
$batFiles = Get-ChildItem -Filter "*.bat"
foreach ($bat in $batFiles) {
    Copy-Item $bat.FullName -Destination $target
}

# Clean photos (don't include active photos)
if (Test-Path "$target\public\photos") { Remove-Item "$target\public\photos" -Recurse -Force }
New-Item -ItemType Directory -Path "$target\public\photos" | Out-Null

# Create Readme
"1. Rozbalte ZIP na cílovém PC.`r`n2. Spusťte INSTALL_FAST.bat`r`n3. Spusťte SPUSTIT_KIOSK.bat" | Set-Content "$target\PRECTI_ME.txt"

Write-Host "3/3 Komprese do ZIP..."
$zipName = "FotoBuddy_Deploy.zip"
if (Test-Path $zipName) { Remove-Item $zipName }
Compress-Archive -Path "$target\*" -DestinationPath $zipName -Force

Write-Host "✅ HOTOVO! Vytvořen soubor: $zipName"
Invoke-Item "."
