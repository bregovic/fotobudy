import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
    try {
        const { email, photoUrl } = await req.json();

        if (!email || !photoUrl) {
            return NextResponse.json({ error: 'Chybí email nebo fotka' }, { status: 400 });
        }

        // 1. Získání fotky z DB (podle názvu souboru)
        const filename = photoUrl.split('/').pop();
        const media = (await prisma.media.findFirst({
            where: { url: { endsWith: filename } }
        })) as any;

        if (!media || !media.data) {
            return NextResponse.json({ error: 'Fotka nenalezena' }, { status: 404 });
        }

        // 2. Nastavení SMTP (Pošťák)
        // Pokud nejsou nastavené proměnné prostředí, vrátíme chybu (nebo logujeme)
        if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.log('[EMAIL] Simulace odeslání na:', email);
            return NextResponse.json({ success: true, simulated: true });
        }

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: false, // true pro 465, false pro ostatní
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        // 3. Odeslání
        await transporter.sendMail({
            from: `"FotoBuddy 📸" <${process.env.SMTP_USER}>`,
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
                    content: media.data, // Posíláme přímo binární data z DB
                },
            ],
        });

        return NextResponse.json({ success: true });

    } catch (e: any) {
        console.error('Email error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
