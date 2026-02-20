const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

function resizeImagePowershell(inputPath, outputPath, maxWidth, overlayConfig = null) {
    return new Promise((resolve, reject) => {
        let overlayLogic = '';
        if (overlayConfig && overlayConfig.path) {
            const absOvPath = path.resolve(process.cwd(), overlayConfig.path);
            if (fs.existsSync(absOvPath)) {
                overlayLogic = `
                $ovPath = '${absOvPath.replace(/\\/g, '\\\\')}';
                if (Test-Path $ovPath) {
                    Write-Host "Overlay found and loaded!"
                } else {
                    Write-Host "Overlay Test-Path Failed!"
                }
                `;
            } else {
                console.warn(`[BG] Sticker path not found: ${absOvPath}`);
            }
        }

        const psScript = `
$inputPathEsc = '${inputPath.replace(/\\/g, '\\\\')}'
Write-Host "Input: $inputPathEsc"
${overlayLogic}
$outEsc = '${outputPath.replace(/\\/g, '\\\\')}'
Write-Host "Output: $outEsc"
`;
        const command = `powershell -Command "${psScript.replace(/\r?\n/g, ' ')}"`;
        exec(command, (error, stdout, stderr) => {
            console.log("Error:", error);
            console.log("Stdout:", stdout);
            console.log("Stderr:", stderr);
            resolve();
        });
    });
}

resizeImagePowershell('C:\\Temp\\in.jpg', 'C:\\Temp\\out.jpg', 1200, {
    path: 'public/assets/stickers/sticker_1771538640556_balkan.png'
});
