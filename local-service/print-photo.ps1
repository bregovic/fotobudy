param(
    [string]$ImagePath
)

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Drawing.Printing

$pd = New-Object System.Drawing.Printing.PrintDocument

# Use Default Printer
# $pd.PrinterSettings.PrinterName = "Canon SELPHY CP1500" # Optional: force name if needed

$pd.DefaultPageSettings.Landscape = $true
# We want to ignore margins if possible, but driver dictates printable area.
$pd.OriginAtMargins = $false 
$pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0) 

$pd.add_PrintPage({
    param($sender, $e)
    
    $img = [System.Drawing.Image]::FromFile($ImagePath)
    $g = $e.Graphics
    
    # Get printable area (which might be smaller than physical if margins exist)
    # However, if we want to force "Fill", we should use PageBounds (Physical Size) 
    # dependent on OriginAtMargins = false.
    
    # OVERSCAN / BLEED CORRECTION
    # Expand the rectangle by ~2% to ensure no white borders appear due to driver margins.
    $bleed = 0.02
    
    $w = $e.PageBounds.Width
    $h = $e.PageBounds.Height
    
    $newW = $w * (1 + $bleed * 2)
    $newH = $h * (1 + $bleed * 2)
    $x = -($w * $bleed)
    $y = -($h * $bleed)
    
    $rect = New-Object System.Drawing.RectangleF($x, $y, $newW, $newH)
    
    # Draw Image Stretched to Fill Page (with Bleed)
    $g.DrawImage($img, $rect)
    
    $img.Dispose()
})

try {
    $pd.Print()
    Write-Host "Printed successfully"
} catch {
    Write-Error $_.Exception.Message
}
