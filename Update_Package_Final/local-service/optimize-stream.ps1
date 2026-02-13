# Stream Optimizer for FotoBuddy
# Acts as a proxy resizing MJPEG source from Port 5520 to Port 5566
# Usage: powershell -ExecutionPolicy Bypass -File optimize-stream.ps1

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Net

$sourceUrl = "http://127.0.0.1:5520/liveview.jpg"
$listenPort = 5566
$quality = 640 # Width resolution
$jpegQuality = 50 # Compression quality (0-100)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$listenPort/")
$listener.Start()

Write-Host "🌊 Stream Optimizer running on http://localhost:$listenPort/"
Write-Host "   -> Resizing $sourceUrl to width $quality px"

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $response = $context.Response

    try {
        # 1. Fetch original image
        $wc = New-Object System.Net.WebClient
        $imgData = $wc.DownloadData($sourceUrl)
        $ms = New-Object System.IO.MemoryStream(,$imgData)
        $img = [System.Drawing.Image]::FromStream($ms)

        # 2. Calculate aspect ratio resize
        $ratio = $img.Height / $img.Width
        $newWidth = $quality
        $newHeight = [int]($newWidth * $ratio)

        # 3. Resize
        $newImg = new-object System.Drawing.Bitmap $newWidth, $newHeight
        $graph = [System.Drawing.Graphics]::FromImage($newImg)
        $graph.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighSpeed
        $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::Low
        $graph.DrawImage($img, 0, 0, $newWidth, $newHeight)

        # 4. Compress to JPEG
        $msOut = New-Object System.IO.MemoryStream
        $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
        $encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
        $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, $jpegQuality)
        
        $newImg.Save($msOut, $codec, $encParams)
        $outBytes = $msOut.ToArray()

        # 5. Serve response
        $response.ContentType = "image/jpeg"
        $response.ContentLength64 = $outBytes.Length
        $response.OutputStream.Write($outBytes, 0, $outBytes.Length)
        $response.OutputStream.Close()
        
        # Cleanup
        $ms.Dispose(); $msOut.Dispose(); $img.Dispose(); $newImg.Dispose(); $graph.Dispose(); $wc.Dispose();

    } catch {
        # Return error image or 404
        $response.StatusCode = 500
        $response.Close()
    }
}
