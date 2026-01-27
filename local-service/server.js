const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5555;

app.use(cors());
app.use(express.json());

// --- KONFIGURACE PRO CANON 5D MARK II ---
const CAMERA_CMD_TEMPLATE = '"C:\\Program Files (x86)\\digiCamControl\\CameraControlCmd.exe" /capture /noautofocus /filename "%filename%"';
const SAVE_DIR = path.join(process.cwd(), 'public', 'photos');

// Zámek proti vícenásobnému spuštění
let isCapturing = false;

// Vytvoření složky pro fotky
if (!fs.existsSync(SAVE_DIR)) {
    fs.mkdirSync(SAVE_DIR, { recursive: true });
}

app.use('/photos', express.static(SAVE_DIR));

app.get('/status', (req, res) => {
    res.json({
        status: 'ready',
        camera: 'Canon 5D Mark II (DigiCamControl)',
        busy: isCapturing
    });
});

app.post('/shoot', (req, res) => {
    // Pokud už běží focení, odmítneme další pokus
    if (isCapturing) {
        console.warn('[BRIDGE] Ignoruji požadavek: Fotoaparát je zaneprázdněn.');
        return res.status(429).json({ success: false, error: 'Camera busy', busy: true });
    }

    const timestamp = Date.now();
    const filename = `foto_${timestamp}.jpg`;
    const fullPath = path.join(SAVE_DIR, filename);

    // Nahrazení %filename% v příkazu
    const cmd = CAMERA_CMD_TEMPLATE.replace('%filename%', fullPath);

    console.log(`[BRIDGE] Spouštím fotoaparát: ${cmd}`);
    isCapturing = true;

    // Timeout pojistka
    const timeout = setTimeout(() => {
        if (isCapturing) {
            console.error('[BRIDGE] Timeout: Kamera neodpověděla včas. Zabíjím proces...');
            exec('taskkill /F /IM CameraControlCmd.exe', () => { }); // Násilné ukončení
            isCapturing = false;
        }
    }, 15000); // Prodlouženo na 15s

    // PREVENTIVNÍ ÚKLID: Zkusíme zabít staré visící procesy (kromě hlavního DCC, ten se jmenuje jinak)
    // CameraControlCmd.exe je ten řádkový nástroj co se seká
    exec('taskkill /F /IM CameraControlCmd.exe', (err) => {
        // Ignorujeme chybu (pokud nic neběželo, vrátí to chybu, to je ok)

        // Teď teprve fotíme
        exec(cmd, (error, stdout, stderr) => {
            clearTimeout(timeout);
            isCapturing = false;

            if (error) {
                // Pokud to spadlo, asi se to nepotkalo s kamerou
                console.error(`[CHYBA] Exec error: ${error.message}`);
                return res.status(500).json({
                    success: false,
                    error: 'Chyba příkazu (Kamera busy nebo odpojena)',
                    details: stderr
                });
            }

            console.log(`[BRIDGE] DigiCamOutput: ${stdout}`);

            if (fs.existsSync(fullPath)) {
                console.log(`[BRIDGE] Fotka úspěšně uložena: ${filename}`);
                res.json({ success: true, filename: filename, url: `/photos/${filename}` });
            } else {
                console.error(`[CHYBA] Soubor nevznikl: ${fullPath}`);
                res.status(500).json({ success: false, error: 'Soubor nevznikl' });
            }
        });
    });
});

app.post('/print', (req, res) => {
    const { filename } = req.body;
    console.log(`[BRIDGE] Odesílám na tiskárnu: ${filename}`);
    const printCmd = `mspaint /p "${path.join(SAVE_DIR, filename)}"`;
    exec(printCmd, (error) => { });
    res.json({ success: true, message: 'Odesláno na tisk' });
});

app.listen(PORT, () => {
    console.log(`\n📷 FotoBuddy Bridge (Locking Enabled) běží na http://localhost:${PORT}`);
});
