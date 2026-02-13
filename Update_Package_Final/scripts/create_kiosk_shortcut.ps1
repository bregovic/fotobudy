
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "Blick - Obrazovka.lnk"
$targetPath = "c:\Users\Wendulka\Documents\Webhry\FotoBuddy\Spustit_Kiosk.bat"
$workingDir = "c:\Users\Wendulka\Documents\Webhry\FotoBuddy"
$iconPath = "c:\Users\Wendulka\Documents\Webhry\FotoBuddy\public\app.ico"

$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetPath
$shortcut.WorkingDirectory = $workingDir
if (Test-Path $iconPath) {
    $shortcut.IconLocation = $iconPath
}
$shortcut.WindowStyle = 7 # Minimized (run bat quietly)
$shortcut.Save()

Write-Host "Shortcut created: $shortcutPath"
