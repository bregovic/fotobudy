Add-Type -AssemblyName Microsoft.VisualBasic
Add-Type -AssemblyName System.Windows.Forms

$title = "digiCamControl by Duka Istvan"

for ($i = 0; $i -lt 40; $i++) {
    # Find process by Window Title
    $proc = Get-Process | Where-Object { $_.MainWindowTitle -eq $title }
    
    if ($proc) {
        Write-Host "Splash screen found (PID: $($proc.Id)). Sending close keys..."
        try {
            [Microsoft.VisualBasic.Interaction]::AppActivate($proc.Id)
            Start-Sleep -Milliseconds 500
            
            # Send Enter, then Esc
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
            Start-Sleep -Milliseconds 200
            [System.Windows.Forms.SendKeys]::SendWait("{ESC}")
            
            Write-Host "Keys sent."
            exit
        }
        catch {
            Write-Host "Error sending keys: $_"
        }
    }
    Start-Sleep -Seconds 1
}
Write-Host "Splash screen not found or timed out."
