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
// Používáme DigiCamControl (CameraControlCmd.exe)
// Ověřte prosím, že máte nainstalováno ve výchozí cestě:
const CAMERA_CMD_TEMPLATE = '"C:\\Program Files (x86)\\digiCamControl\\CameraControlCmd.exe" /capture /filename "%filename%"';
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
        camera: 'Canon 5D Mark II (DigiCamControl)',
        serviceVersion: '1.0.0'
    });
});

app.post('/shoot', (req, res) => {
    const timestamp = Date.now();
    const filename = `foto_${timestamp}.jpg`;
    const fullPath = path.join(SAVE_DIR, filename);

    // Nahrazení %filename% v příkazu
    const cmd = CAMERA_CMD_TEMPLATE.replace('%filename%', fullPath);

    console.log(`[BRIDGE] Spouštím fotoaparát: ${cmd}`);

    // Spuštění externího programu (DigiCamControl)
    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`[CHYBA] Nepodařilo se vyfotit: ${error.message}`);
            // Fallback pro testování bez kamery (odkomentovat pro simulaci)
            // console.log("Simuluji fotku jako fallback...");
            // createMockImage(fullPath);
            // return res.json({ success: true, filename, url: `/photos/${filename}` });

            return res.status(500).json({ success: false, error: 'Chyba fotoaparátu' });
        }

        console.log(`[BRIDGE] Fotka uložena: ${filename}`);
        res.json({
            success: true,
            filename: filename,
            url: `/photos/${filename}`
        });
    });
});

function createMockImage(fullPath) {
    const globePath = path.join(process.cwd(), 'public', 'globe.svg');
    if (fs.existsSync(globePath)) {
        fs.copyFileSync(globePath, fullPath);
    } else {
        fs.writeFileSync(fullPath, 'Mock Image Data');
    }
}

app.post('/print', (req, res) => {
    const { filename } = req.body;
    console.log(`[BRIDGE] Odesílám na tiskárnu: ${filename}`);
    // Příklad tisku přes mspaint nebo jiný nástroj
    const printCmd = `mspaint /p "${path.join(SAVE_DIR, filename)}"`;

    exec(printCmd, (error) => {
        if (error) {
            console.error('Chyba tisku:', error);
            return res.status(500).json({ success: false });
        }
        res.json({ success: true, message: 'Odesláno na tisk' });
    });
});

app.listen(PORT, () => {
    console.log(`\n📷 FotoBuddy Bridge (Canon 5D) běží na http://localhost:${PORT}`);
    console.log(`   - Ujistěte se, že běží DigiCamControl nebo je kamera připojena`);
    console.log(`   - Ukládání fotek do: ${SAVE_DIR}\n`);
});
