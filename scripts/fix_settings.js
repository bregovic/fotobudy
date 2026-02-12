const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, '..', 'settings.json');

console.log('--- FIXING SETTINGS.JSON ---');

let settings = {};

// 1. Load existing or create new
if (fs.existsSync(SETTINGS_PATH)) {
    try {
        const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
        settings = JSON.parse(raw);
        console.log('✅ Loaded existing settings.json');
    } catch (e) {
        console.error('⚠️ Error reading settings.json, creating new one.', e.message);
    }
} else {
    console.log('ℹ️ settings.json not found, creating new.');
}

// 2. Ensure structure
if (!settings.smtp_config) settings.smtp_config = {};
if (!settings.email_template) settings.email_template = {};

// 3. Apply Gmail Settings
settings.smtp_config.host = 'smtp.gmail.com';
settings.smtp_config.port = '465';
settings.smtp_config.user = 'blickacvak@gmail.com';
settings.smtp_config.pass = 'YOUR_APP_PASSWORD';

// 4. Ensure Template
if (!settings.email_template.subject) settings.email_template.subject = 'Fotka je tu! 🥳';
if (!settings.email_template.body) settings.email_template.body = 'Ahoj! Tady je tvoje fotka z akce. Užij si ji!';

// 5. Ensure critical flags
if (settings.use_cloud_stream === undefined) settings.use_cloud_stream = true;

// 6. Save
try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
    console.log('✅ Settings saved successfully!');
    console.log('   Host:', settings.smtp_config.host);
    console.log('   User:', settings.smtp_config.user);
} catch (e) {
    console.error('❌ Failed to save settings.json:', e.message);
}
