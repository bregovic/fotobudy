import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');

function getSettings() {
    if (!fs.existsSync(SETTINGS_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    } catch {
        return {};
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, photoUrls, isTest } = body;

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // Loading Settings
        const settings = getSettings();
        const smtp = settings.smtp_config;
        const template = settings.email_template || {};

        if (!smtp || !smtp.host || !smtp.user || !smtp.pass) {
            return NextResponse.json({ error: 'SMTP Settings missing in settings.json' }, { status: 500 });
        }

        // Normalizace na pole
        const urls = Array.isArray(photoUrls) ? photoUrls : (body.photoUrl ? [body.photoUrl] : []);

        if (!isTest && urls.length === 0) {
            return NextResponse.json({ error: 'No photos provided' }, { status: 400 });
        }

        console.log(`[EMAIL] Odesílám ${isTest ? 'TEST' : urls.length + ' fotek'} na ${email}`);

        // Konfigurace SMTP (z nastavení)
        const transporter = nodemailer.createTransport({
            host: smtp.host,
            port: parseInt(smtp.port || '587'),
            secure: parseInt(smtp.port || '587') === 465, // True pro 465, jinak false (STARTTLS)
            auth: {
                user: smtp.user,
                pass: smtp.pass
            }
        });

        // Příprava příloh
        const attachments = await Promise.all(urls.map(async (url: string, index: number) => {
            // URL je lokální cesta k API "/api/view/..."
            // Musíme ji fetchonout a udělat z ní buffer
            // Pokud je to plna URL (http...), pouzijeme ji, jinak localhost

            // Check if we are running on custom port (e.g. 3000)
            // In local/kiosk mode usually localhost:3000
            const baseUrl = 'http://localhost:3000';
            const fetchUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

            try {
                const res = await fetch(fetchUrl);
                if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
                const buffer = await res.arrayBuffer();

                // OPTIMALIZACE: Zmenšit pro email (aby nepadalo na limitu přílohy)
                const resizedBuffer = await sharp(Buffer.from(buffer))
                    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
                    .jpeg({ quality: 80 })
                    .toBuffer();

                return {
                    filename: `foto_${index + 1}.jpg`,
                    content: resizedBuffer
                };
            } catch (e) {
                console.error(`Failed to fetch attachment ${url}:`, e);
                return null;
            }
        }));

        const validAttachments = attachments.filter(a => a !== null) as any[];

        const subject = isTest ? 'Test Email - Blick & Cvak' : (template.subject || 'Vaše fotky z Blick & Cvak! ✨');
        const textBody = isTest ? 'Toto je testovací email.' : (template.body || 'Ahoj! V příloze posíláme Vaše úlovky z dnešní akce.');

        await transporter.sendMail({
            from: `"Blick & Cvak 📸" <${smtp.user}>`,
            to: email,
            subject: subject,
            text: textBody,
            attachments: validAttachments
        });

        return NextResponse.json({ success: true, messageId: 'sent' });

    } catch (error: any) {
        console.error('Email error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
