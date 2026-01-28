import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, photoUrls } = body;
        // photoUrls může být string (jedna fotka) nebo pole stringů (více fotek)

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // Normalizace na pole
        const urls = Array.isArray(photoUrls) ? photoUrls : (body.photoUrl ? [body.photoUrl] : []);

        if (urls.length === 0) {
            return NextResponse.json({ error: 'No photos provided' }, { status: 400 });
        }

        console.log(`[EMAIL] Odesílám ${urls.length} fotek na ${email}`);

        // Konfigurace SMTP (Seznam)
        const transporter = nodemailer.createTransport({
            host: "smtp.seznam.cz",
            port: 465,
            secure: true,
            auth: {
                user: "fotobudka-kiosk@seznam.cz", // Změnit na vaše
                pass: "Heslo123" // Změnit na vaše
            }
        });

        // Příprava příloh
        const attachments = await Promise.all(urls.map(async (url, index) => {
            // URL je lokální cesta k API "/api/view/..."
            // Musíme ji fetchonout a udělat z ní buffer
            const fetchUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
            const res = await fetch(fetchUrl);
            const buffer = await res.arrayBuffer();

            return {
                filename: `foto_${index + 1}.jpg`,
                content: Buffer.from(buffer)
            };
        }));

        await transporter.sendMail({
            from: '"FotoBudka 📸" <fotobudka-kiosk@seznam.cz>', // Změnit na vaše
            to: email,
            subject: 'Vaše fotky z FotoBudky! ✨',
            text: 'Ahoj! V příloze posíláme Vaše úlovky z dnešní akce. Užijte si je!',
            html: `
                <div style="font-family: sans-serif; text-align: center; color: #333;">
                    <h1>Díky za návštěvu! 📸</h1>
                    <p>V příloze najdete vaše fotky.</p>
                    <p>Mějte se krásně!</p>
                </div>
            `,
            attachments: attachments
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Email error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
