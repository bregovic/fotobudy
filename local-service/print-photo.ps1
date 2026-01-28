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
    
    $rect = $e.PageBounds
    
    # Draw Image Stretched to Fill Page
    # Since we pre-cropped in App, stretching ensures it fits exactly.
    $g.DrawImage($img, $rect)
    
    $img.Dispose()
})

try {
    $pd.Print()
    Write-Host "Printed successfully"
} catch {
    Write-Error $_.Exception.Message
}
