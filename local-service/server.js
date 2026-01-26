const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5555;

app.use(cors());
app.use(express.json());

// --- KONFIGURACE ---
// Zde nastavte cestu k příkazovému řádku DigiCamControl nebo gphoto2
// Příklad: "C:\\Program Files (x86)\\digiCamControl\\CameraControlCmd.exe"
const CAMERA_CMD_TEMPLATE = 'echo "Simulating Capture: %filename%"';
const SAVE_DIR = path.join(process.cwd(), 'public', 'photos');

// Vytvoření složky pro fotky
if (!fs.existsSync(SAVE_DIR)) {
    fs.mkdirSync(SAVE_DIR, { recursive: true });
}

// Servírování vyfocených fotek (aby je Kiosk mohl zobrazit hned z disku)
app.use('/photos', express.static(SAVE_DIR));

app.get('/status', (req, res) => {
    res.json({
        status: 'ready',
        camera: 'Canon 5D Mark II (Bridge)',
        serviceVersion: '1.0.0'
    });
});

app.post('/shoot', (req, res) => {
    const timestamp = Date.now();
    const filename = `foto_${timestamp}.jpg`;
    const fullPath = path.join(SAVE_DIR, filename);

    // Nahrazení %filename% v příkazu
    const cmd = CAMERA_CMD_TEMPLATE.replace('%filename%', fullPath);

    console.log(`[BRIDGE] Spouštím příkaz: ${cmd}`);

    // Simulating camera delay
    setTimeout(() => {
        console.log(`[BRIDGE] Fotka vyfocena: ${filename}`);

        // Vytvoříme dummy soubor pro testování, pokud neexistuje (v simulaci)
        if (!fs.existsSync(fullPath)) {
            // Create a simple colored SVG or copy a placeholder
            // For now, let's write a text file or try to copy from public/globe.svg if available?
            // Or better, just write a minimal valid SVG as JPG (browsers might complain) or just a textual placeholder.
            // Actually, let's create a red placeholder square.
            // But Kiosk expects image.
            // Let's copy 'public/globe.svg' to it (Next.js default asset).
            const globePath = path.join(process.cwd(), 'public', 'globe.svg');
            if (fs.existsSync(globePath)) {
                fs.copyFileSync(globePath, fullPath);
            } else {
                fs.writeFileSync(fullPath, 'Mock Image Data');
            }
        }

        res.json({
            success: true,
            filename: filename,
            url: `/photos/${filename}` // Cesta HTTP na Bridge serveru
        });
    }, 1500);
});

app.post('/print', (req, res) => {
    const { filename } = req.body;
    console.log(`[BRIDGE] Odesílám na tiskárnu: ${filename}`);
    // exec(`mspaint /p "${path.join(SAVE_DIR, filename)}"`);
    res.json({ success: true, message: 'Odesláno na tisk (Simulace)' });
});

app.listen(PORT, () => {
    console.log(`\n📷 FotoBuddy Local Bridge běží na http://localhost:${PORT}`);
    console.log(`   - Server naslouchá příkazům z Kiosku`);
    console.log(`   - Servíruje fotky z: ${SAVE_DIR}`);
    console.log(`   - Ukládání fotek do: ${SAVE_DIR}\n`);
});
