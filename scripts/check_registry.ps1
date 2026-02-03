
$paths = @("HKCU:\Software\DigiCamControl", "HKCU:\Software\Duka Istvan")

foreach ($path in $paths) {
    if (Test-Path $path) {
        Write-Host "Found Registry Key: $path"
        Get-ItemProperty -Path $path | Select-Object *
        
        # Check subkeys
        Get-ChildItem -Path $path -Recurse | ForEach-Object {
            Write-Host "  Subkey: $($_.Name)"
            Get-ItemProperty -Path $_.PSPath | Select-Object *
        }
    }
    else {
        Write-Host "Not found: $path"
    }
}
