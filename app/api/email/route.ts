import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
    try {
        const { email, photoUrl, smtpConfig } = await req.json();

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
        // Priorita: 1. Custom Config (z Profilu), 2. Environment Variables
        let transportConfig = null;
        let fromEmail = 'fotobuddy@example.com';

        if (smtpConfig && smtpConfig.host && smtpConfig.user) {
            // Použijeme nastavení z profilu
            transportConfig = {
                host: smtpConfig.host,
                port: Number(smtpConfig.port) || 587,
                secure: false,
                auth: {
                    user: smtpConfig.user,
                    pass: smtpConfig.pass,
                },
            };
            fromEmail = smtpConfig.user;
        } else if (process.env.SMTP_HOST && process.env.SMTP_USER) {
            // Fallback na ENV variables (Railway)
            transportConfig = {
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT) || 587,
                secure: false,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            };
            fromEmail = process.env.SMTP_USER;
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
            text: 'Ahoj! Tady je tvoje fotka z akce. Užij si ji!',
            html: `
                <div style="font-family: sans-serif; text-align: center; padding: 20px;">
                    <h1>📸 Tady je tvůj úlovek!</h1>
                    <p>Díky, že ses stavil(a) ve fotokoutku.</p>
                </div>
            `,
            attachments: [
                {
                    filename: filename || 'foto.jpg',
                    content: media.data,
                },
            ],
        });

        return NextResponse.json({ success: true });

    } catch (e: any) {
        console.error('Email error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
