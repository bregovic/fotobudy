$ErrorActionPreference = "Stop"

# Ziskame cestu k tomuto skriptu (scripts/) a rodicovskou slozku (koren aplikace)
$scriptPath = $PSScriptRoot
$appRoot = Split-Path $scriptPath -Parent

Write-Host "Koren aplikace: $appRoot"

# Cesta na plochu
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutName = "Blick & Cvak.lnk"
$shortcutPath = Join-Path $desktopPath $shortcutName

# Cil: Blick_Cvak.bat v koreni aplikace
$targetPath = Join-Path $appRoot "Blick_Cvak.bat"

# Ikona: public/app.ico
$iconPath = Join-Path $appRoot "public\app.ico"

# Vytvoreni zastupce
$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)

$shortcut.TargetPath = $targetPath
$shortcut.WorkingDirectory = $appRoot

if (Test-Path $iconPath) {
    $shortcut.IconLocation = $iconPath
}
else {
    Write-Warning "Ikona nenalezena: $iconPath"
}

# Run minimized? (7 = Minimized, 1 = Normal)
# Chceme videt konzoli pro debug, takze Normal (1) nebo Minimized (7). Dame 1 at vidi co se deje.
$shortcut.WindowStyle = 1 

$shortcut.Save()

Write-Host "Zastupce vytvoren: $shortcutPath"
Write-Host "Cil: $targetPath"
