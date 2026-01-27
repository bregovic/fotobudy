import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
    try {
        const { email, photoUrl, smtpConfig: clientConfig } = await req.json();

        if (!email || !photoUrl) {
            return NextResponse.json({ error: 'Chybí email nebo fotka' }, { status: 400 });
        }

        // 1. Získání fotky z DB
        const filename = photoUrl.split('/').pop();
        const media = (await prisma.media.findFirst({
            where: { url: { endsWith: filename } }
        })) as any;

        if (!media || !media.data) {
            console.error('Fotka nenalezena v DB, nelze odeslat prílohu.');
            return NextResponse.json({ error: 'Fotka nenalezena' }, { status: 404 });
        }

        // 2a. Načtení nastavení emailu (Subject/Body)
        const templateSetting = await prisma.setting.findUnique({ where: { key: 'email_template' } });
        let subject = 'Tvoje fotka z FotoBuddy! 🥳';
        let body = 'Ahoj! Tady je tvoje fotka z akce. Užij si ji!';

        if (templateSetting) {
            try {
                const tpl = JSON.parse(templateSetting.value);
                if (tpl.subject) subject = tpl.subject;
                if (tpl.body) body = tpl.body;
            } catch { }
        }

        // 2b. Nastavení SMTP (Pošťák)
        // Priorita: 1. DB, 2. Klient (Legacy), 3. ENV
        let transportConfig = null;
        let fromEmail = 'fotobuddy@example.com';

        const dbSetting = await prisma.setting.findUnique({ where: { key: 'smtp_config' } });
        let dbSmtp = null;
        if (dbSetting) {
            try { dbSmtp = JSON.parse(dbSetting.value); } catch { }
        }

        if (dbSmtp && dbSmtp.host && dbSmtp.user) {
            transportConfig = {
                host: dbSmtp.host,
                port: Number(dbSmtp.port) || 587,
                secure: false,
                auth: { user: dbSmtp.user, pass: dbSmtp.pass },
            };
            fromEmail = dbSmtp.user;
        }
        else if (clientConfig && clientConfig.host) {
            transportConfig = {
                host: clientConfig.host,
                port: Number(clientConfig.port) || 587,
                secure: false,
                auth: { user: clientConfig.user, pass: clientConfig.pass },
            };
            fromEmail = clientConfig.user;
        }
        else if (process.env.SMTP_HOST) {
            transportConfig = {
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT) || 587,
                secure: false,
                auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
            };
            fromEmail = process.env.SMTP_USER || 'fotobuddy@example.com';
        }

        if (!transportConfig) {
            console.log('[EMAIL] Simulace (chybí SMTP config) na:', email);
            return NextResponse.json({ success: true, simulated: true });
        }

        const transporter = nodemailer.createTransport(transportConfig);

        // 3. Odeslání
        await transporter.sendMail({
            from: `"FotoBuddy 📸" <${fromEmail}>`,
            to: email,
            subject: subject,
            text: body, // Plain text verze
            html: `
                <div style="font-family: sans-serif; text-align: center; padding: 20px; background-color: #f8fafc; border-radius: 10px;">
                    <h1 style="color: #333;">📸 ${subject}</h1>
                    <p style="font-size: 16px; color: #555;">${body.replace(/\n/g, '<br>')}</p>
                    <div style="margin-top: 20px;">
                    </div>
                     <p style="font-size: 12px; color: #888; margin-top: 30px;">Odesláno z FotoBuddy</p>
                </div>
            `,
            attachments: [{
                filename: filename || 'foto.jpg',
                content: media.data,
                // cid: 'photo' // Zrušil jsem CID, protože některým klientům to dělá problémy. Lepší poslat jako klasickou přílohu.
            }],
        });

        return NextResponse.json({ success: true });

    } catch (e: any) {
        console.error('Email error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
