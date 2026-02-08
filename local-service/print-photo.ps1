param(
    [string]$ImagePath,
    [string]$PrinterName
)

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Drawing.Printing

$pd = New-Object System.Drawing.Printing.PrintDocument

if (-not [string]::IsNullOrEmpty($PrinterName)) {
    $pd.PrinterSettings.PrinterName = $PrinterName
    # Check if validity is essentially checking if it exists/is installed
    if (-not $pd.PrinterSettings.IsValid) {
        Write-Host "VAROVANI: Tiskarna '$PrinterName' nenalezena nebo neplatna. Pouzivam vychozi." -ForegroundColor Yellow
    }
    else {
        Write-Host "Cilova tiskarna: $PrinterName"
    }
}
# Canon Selphy usually needs Landscape for 148x100mm
$pd.DefaultPageSettings.Landscape = $true

# Ignore logical margins to access full page size
$pd.OriginAtMargins = $false 
$pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0) 

$pd.add_PrintPage({
        param($sender, $e)
    
        $img = [System.Drawing.Image]::FromFile($ImagePath)
        $g = $e.Graphics

        # Get Physical Page Dimensions (in 1/100 inch)
        $pageW = $e.PageBounds.Width
        $pageH = $e.PageBounds.Height

        # --- SETTINGS ---
        # Bleed Factor: 0.03 (3%) expansion to ensure borderless
        # This pushes the image slightly past the paper edges to eliminate white gaps.
        $bleedFactor = 0.03 
    
        # 1. DEFINE TARGET AREA (Page + Bleed)
        $targetW = $pageW * (1 + $bleedFactor * 2)
        $targetH = $pageH * (1 + $bleedFactor * 2)
    
        # Center the target area relative to the page (Negative coords move it up/left)
        $targetX = - ($pageW * $bleedFactor)
        $targetY = - ($pageH * $bleedFactor)

        # 2. ASPECT FILL CALCULATION
        # We must fill the $target area completely with $img, preserving $img aspect ratio.
        # We will crop the dimension that overflows.
    
        $imgRatio = $img.Width / $img.Height
        $targetRatio = $targetW / $targetH
    
        $drawW = $targetW
        $drawH = $targetH
        $drawX = $targetX
        $drawY = $targetY
    
        if ($imgRatio > $targetRatio) {
            # Image is WIDER than target -> Match Height, Crop Width (Sides)
            $drawH = $targetH
            $drawW = $drawH * $imgRatio
        
            # Center horizontally: Subtract the overflow/2 from the starting X
            $drawX = $targetX - ($drawW - $targetW) / 2
        }
        else {
            # Image is TALLER (or narrower) than target -> Match Width, Crop Height (Top/Bottom)
            $drawW = $targetW
            $drawH = $drawW / $imgRatio
        
            # Center vertically
            $drawY = $targetY - ($drawH - $targetH) / 2
        }
    
        # Debug info (visible in PowerShell console if run manually)
        Write-Host "Page: $pageW x $pageH"
        Write-Host "Target: $targetW x $targetH"
        Write-Host "Draw: $drawW x $drawH at ($drawX, $drawY)"
    
        # 3. DRAW
        $rect = New-Object System.Drawing.RectangleF($drawX, $drawY, $drawW, $drawH)
    
        # Enable High Quality Scaling
        $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

        $g.DrawImage($img, $rect)
    
        $img.Dispose()
    })

try {
    $pd.Print()
    Write-Host "Printed successfully"
}
catch {
    Write-Error $_.Exception.Message
}
