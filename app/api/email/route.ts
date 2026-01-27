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
            return NextResponse.json({ error: 'Fotka nenalezena' }, { status: 404 });
        }

        // 2. Nastavení SMTP (Pošťák)
        let transportConfig = null;
        let fromEmail = 'fotobuddy@example.com';

        // POKUS 1: Config z DB (Priorita)
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
        // POKUS 2: Config od klienta (Fallback, kdyby někdo používal starý frontend)
        else if (clientConfig && clientConfig.host) {
            transportConfig = {
                host: clientConfig.host,
                port: Number(clientConfig.port) || 587,
                secure: false,
                auth: { user: clientConfig.user, pass: clientConfig.pass },
            };
            fromEmail = clientConfig.user;
        }
        // POKUS 3: ENV variables
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
            subject: 'Tvoje fotka z FotoBuddy! 🥳',
            html: `
                <div style="font-family: sans-serif; text-align: center; padding: 20px;">
                    <h1>📸 Tady je tvůj úlovek!</h1>
                    <p>Díky, že ses stavil(a) ve fotokoutku.</p>
                </div>
            `,
            attachments: [{ filename: filename || 'foto.jpg', content: media.data }],
        });

        return NextResponse.json({ success: true });

    } catch (e: any) {
        console.error('Email error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
