const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Přesměrujeme require, aby hledal v node_modules projektu
// Pokud jsme ve složce scripts a voláme node scripts/test_email.js, node_modules jsou o uroveň výše
if (!fs.existsSync('node_modules')) {
    console.log('[INFO] node_modules nenalezeny v aktuální složce, zkouším o úroveň výš...');
    module.paths.push(path.resolve(__dirname, '..', 'node_modules'));
}

console.log('[TEST] Starting Email Test...');

try {
    const settingsPath = path.resolve(__dirname, '..', 'settings.json');
    if (!fs.existsSync(settingsPath)) {
        console.error('[ERROR] settings.json nenalezen!');
        process.exit(1);
    }

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const smtp = settings.smtp_config;

    console.log('[TEST] Loaded Config:');
    console.log('       Host:', smtp.host);
    console.log('       Port:', smtp.port);
    console.log('       User:', smtp.user);
    console.log('       Pass:', smtp.pass ? '******' : '(missing)');

    if (!smtp.host || !smtp.port || !smtp.user || !smtp.pass) {
        console.error('[ERROR] Missing SMTP configuration!');
        process.exit(1);
    }

    const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: parseInt(smtp.port),
        secure: parseInt(smtp.port) === 465, // true for 465, false for 587
        auth: {
            user: smtp.user,
            pass: smtp.pass
        }
    });

    console.log('[TEST] Attempting to send email to:', smtp.user);

    transporter.sendMail({
        from: `"Test Bot 🤖" <${smtp.user}>`,
        to: smtp.user, // Send to self
        subject: "Test Email from FotoBuddy Patch",
        text: "If you see this, email sending is working correctly! 🎉"
    }).then(info => {
        console.log('[SUCCESS] ✅ Email sent successfully!');
        console.log('          Message ID:', info.messageId);
    }).catch(err => {
        console.error('[ERROR] ❌ Failed to send email:');
        console.error(err);
    });

} catch (e) {
    console.error('[CRITICAL ERROR]', e);
}
