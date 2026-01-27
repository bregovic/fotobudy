import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, photoUrl, smtpConfig: clientConfig, isTest } = body; // isTest flag

        if (!email) {
            return NextResponse.json({ error: 'Chybí email' }, { status: 400 });
        }

        // 1. Získání fotky z DB (pokud to není jen test bez fotky)
        let media = null;
        let filename = 'foto.jpg';

        if (photoUrl) {
            filename = photoUrl.split('/').pop();
            media = (await prisma.media.findFirst({
                where: { url: { endsWith: filename } }
            })) as any;

            // Pokud není v Media, zkus Asset (Backgrounds etc)
            if (!media) {
                media = await prisma.asset.findFirst({ where: { url: { endsWith: filename } } });
            }
        }

        if (!isTest && (!media || !media.data)) {
            console.error('Fotka nenalezena v DB.');
            return NextResponse.json({ error: 'Fotka nenalezena' }, { status: 404 });
        }

        // 2a. Načtení nastavení emailu (Subject/Body)
        const templateSetting = await prisma.setting.findUnique({ where: { key: 'email_template' } });
        let subject = 'Tvoje fotka z FotoBuddy! 🥳';
        let bodyText = 'Ahoj! Tady je tvoje fotka z akce. Užij si ji!';

        if (templateSetting) {
            try {
                const tpl = JSON.parse(templateSetting.value);
                if (tpl.subject) subject = tpl.subject;
                if (tpl.body) bodyText = tpl.body;
            } catch { }
        }

        if (isTest) {
            subject = "[TEST] " + subject;
            bodyText = "Toto je zkušební email z nastavení.\n\n" + bodyText;
        }

        // 2b. Nastavení SMTP (Pošťák)
        let transportConfig = null;
        let fromEmail = 'fotobuddy@example.com';

        const dbSetting = await prisma.setting.findUnique({ where: { key: 'smtp_config' } });
        let dbSmtp = null;
        if (dbSetting) {
            try { dbSmtp = JSON.parse(dbSetting.value); } catch { }
        }

        // Helper pro vytvoření transportu
        const createConfig = (conf: any) => {
            const port = Number(conf.port) || 587;
            return {
                host: conf.host,
                port: port,
                secure: port === 465, // True pro 465, false pro ostatní
                auth: { user: conf.user, pass: conf.pass },
                tls: {
                    rejectUnauthorized: false // Ignorovat chyby certifikátů (časté u hostingů)
                }
            };
        };

        if (dbSmtp && dbSmtp.host && dbSmtp.user) {
            transportConfig = createConfig(dbSmtp);
            fromEmail = dbSmtp.user;
        }
        else if (clientConfig && clientConfig.host) {
            transportConfig = createConfig(clientConfig);
            fromEmail = clientConfig.user;
        }

        if (!transportConfig) {
            console.log('[EMAIL] Simulace (chybí SMTP config) na:', email);
            return NextResponse.json({ success: true, simulated: true });
        }

        const transporter = nodemailer.createTransport(transportConfig);

        // Ověření spojení (Verify) - dobré pro debugging
        try {
            await transporter.verify();
            console.log("SMTP spojení OK");
        } catch (verifyErr) {
            console.error("SMTP Verify Chyba:", verifyErr);
            return NextResponse.json({ error: 'Chyba připojení k SMTP serveru. Zkontrolujte heslo/port.' }, { status: 500 });
        }

        // 3. Odeslání
        const mailOptions: any = {
            from: `"FotoBuddy 📸" <${fromEmail}>`,
            to: email,
            subject: subject,
            text: bodyText,
            html: `
                <div style="font-family: sans-serif; text-align: center; padding: 20px; background-color: #f8fafc; border-radius: 10px;">
                    <h1 style="color: #333;">📸 ${subject}</h1>
                    <p style="font-size: 16px; color: #555;">${bodyText.replace(/\n/g, '<br>')}</p>
                    <div style="margin-top: 20px;">
                        ${!isTest ? '<i>(Fotka je v příloze)</i>' : '<i>(Toto je test bez fotky)</i>'}
                    </div>
                     <p style="font-size: 12px; color: #888; margin-top: 30px;">Odesláno z FotoBuddy</p>
                </div>
            `
        };

        if (!isTest && media && media.data) {
            mailOptions.attachments = [{
                filename: filename || 'foto.jpg',
                content: media.data
            }];
        }

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent info:", info);

        return NextResponse.json({
            success: true,
            messageId: info.messageId,
            response: info.response
        });

    } catch (e: any) {
        console.error('Email error:', e);
        return NextResponse.json({ error: e.message || 'Neznámá chyba odesílání' }, { status: 500 });
    }
}
