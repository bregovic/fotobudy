
Add-Type -AssemblyName System.Drawing

$sourcePath = "c:\Users\Wendulka\Documents\Webhry\FotoBuddy\public\logo.png"
$destPath = "c:\Users\Wendulka\Documents\Webhry\FotoBuddy\public\app.ico"

if (-not (Test-Path $sourcePath)) {
    Write-Host "Error: Logo not found at $sourcePath"
    exit 1
}

try {
    # 1. Load Image
    $img = [System.Drawing.Image]::FromFile($sourcePath)
    
    # 2. Prevent locking original file? No need if we just read.

    # 3. Create a square bitmap (Crop to center if needed, or Resize)
    # Ideally icons are 256x256
    $size = 256
    $bmp = new-object System.Drawing.Bitmap $size, $size
    $graph = [System.Drawing.Graphics]::FromImage($bmp)
    
    $graph.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

    # Calculate aspect ratio to center/crop or fit
    # We will FIT (contain) to keep the whole logo visible, transparent background
    
    $ratio = $img.Width / $img.Height
    $newW = $size
    $newH = $size
    
    if ($img.Width -gt $img.Height) {
        $newH = $size / $ratio
    }
    else {
        $newW = $size * $ratio
    }
    
    $posX = ($size - $newW) / 2
    $posY = ($size - $newH) / 2

    $graph.DrawImage($img, [int]$posX, [int]$posY, [int]$newW, [int]$newH)

    # 4. Save as ICO
    # .NET System.Drawing can save as Icon format, but sometimes it is tricky.
    # A simple way that works for Windows 10/11 is valid PNG stream with ICO header, 
    # OR using the Icon class.
    
    # Simple method: Create an Icon object from the handle (Low quality usually)
    # Better method: Just save as PNG but name it .ico? No, that's a hack.
    # Proper method: Use Icon.FromHandle (quality might suffer but it's valid ICO).
    
    $icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
    
    $fs = new-object System.IO.FileStream $destPath, "Create"
    $icon.Save($fs)
    $fs.Close()
    
    $img.Dispose()
    $bmp.Dispose()
    $graph.Dispose()
    $icon.Dispose() # DestroyIcon
    
    Write-Host "Success: Icon created at $destPath"

    # --- 5. Create Desktop Shortcut ---
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $shortcutPath = Join-Path $desktopPath "Blick & Cvak.lnk"
    $targetPath = "c:\Users\Wendulka\Documents\Webhry\FotoBuddy\Blick_Cvak.bat"
    $workingDir = "c:\Users\Wendulka\Documents\Webhry\FotoBuddy"

    $wshShell = New-Object -ComObject WScript.Shell
    $shortcut = $wshShell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $targetPath
    $shortcut.WorkingDirectory = $workingDir
    $shortcut.IconLocation = $destPath
    $shortcut.WindowStyle = 1 # 1 = Normal (Visible), 7 = Minimized
    $shortcut.Save()

    Write-Host "Shortcut created on Desktop: $shortcutPath"

}
catch {
    Write-Host "Error converting icon: $_"
    exit 1
}
