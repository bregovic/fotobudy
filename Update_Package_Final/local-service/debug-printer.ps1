
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Drawing.Printing

$pd = New-Object System.Drawing.Printing.PrintDocument
# Optional: Specify printer name if not default, but let's assume default is the Selphy or the user's active printer
# $pd.PrinterSettings.PrinterName = "Canon SELPHY CP1500" 

Write-Host "Printer: $($pd.PrinterSettings.PrinterName)"
Write-Host "--- Paper Sizes ---"
foreach ($size in $pd.PrinterSettings.PaperSizes) {
    Write-Host "$($size.PaperName) - Width: $($size.Width), Height: $($size.Height) (RawKind: $($size.RawKind))"
}
