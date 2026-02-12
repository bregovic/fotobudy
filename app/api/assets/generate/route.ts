
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// Helper: Read Settings
function getLocalSettings() {
    let settings: any = {};
    if (fs.existsSync(path.join(process.cwd(), 'settings.json'))) {
        try { settings = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'settings.json'), 'utf-8')); } catch { }
    }
    return settings;
}

export async function POST(req: NextRequest) {
    try {
        const { prompt, isSticker } = await req.json();
        const settings = getLocalSettings();

        if (!settings.openai_api_key) return NextResponse.json({ success: false, error: 'No OpenAI API Key' }, { status: 400 });

        const openai = new OpenAI({ apiKey: settings.openai_api_key });

        const model = "dall-e-3";
        const size = "1024x1024";
        const quality = "standard";

        // Enhance prompt for stickers (remove bg later via external API or robust prompt)
        const finalPrompt = isSticker
            ? `A sticker design of ${prompt} on a plain white background, isolated, vector style suitable for cutout`
            : `A high quality photo background of ${prompt}, professional lighting, scenic`;

        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: finalPrompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
            response_format: "b64_json"
        });

        const image = response.data[0].b64_json;
        if (!image) throw new Error("No image generated");

        // Save
        const buffer = Buffer.from(image, 'base64');
        const type = isSticker ? 'sticker' : 'background';
        const subDir = type + 's'; // backgrounds or stickers
        const fileName = `${type}_AI_${Date.now()}.png`; // DALL-E 3 returns PNG (or WEBP) usually

        const dir = path.join(process.cwd(), 'public', 'assets', subDir);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const filePath = path.join(dir, fileName);
        fs.writeFileSync(filePath, buffer);

        return NextResponse.json({ success: true, url: `/assets/${subDir}/${fileName}` });

    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
