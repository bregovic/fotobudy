# 📸 Blick & Cvak - Architectural Context
*Updated: 2026-02-08*

## 1. O projektu
**Blick & Cvak** je moderní webová aplikace (Next.js) běžící v kioskovém režimu na Windows. Slouží jako samoobslužná fotobudka, která ovládá připojenou zrcadlovku přes **DigicamControl**, umožňuje živý náhled, focení, editaci, klíčování (zelené plátno), tisk a odesílání fotek e-mailem.

## 2. Technologický Stack
- **Framework:** Next.js 16 (App Router)
- **Jazyk:** TypeScript
- **Styling:** TailwindCSS + Lucide React (ikony)
- **Databáze:** PostgreSQL (přes Prisma ORM) – pouze v Cloud režimu. V Local režimu se používá **File System**.
- **Hardware Integrace:** DigicamControl (HTTP API)
- **Image Processing:** Sharp (server-side), PowerShell (local resize)

## 3. Režimy Provozu

### 🏠 Lokální Režim (LOCAL_ONLY) - Výchozí pro Kiosk
- **Spouštění:** `SPUSTIT_KIOSK_SPRAVNE.bat` (nebo `Blick_Cvak.bat`) -> `localhost:3000`
- **Fotky:** Ukládají se do `public/photos/[Event]/` (filesystem).
- **Databáze:** Nepoužívá se pro ukládání fotek. API `/api/poll` a `/api/media/list` prohledávají disk rekurzivně.
- **Galerie:** Zobrazuje fotky z disku. Skrývá originály, pokud existuje `edited_` verze ("Smart Gallery").
- **Kamera:** Spojení přímo na `localhost` (DigiCamControl).

### ☁️ Cloud Režim (Railway)
- **Detekce:** `process.env.RAILWAY_ENVIRONMENT_NAME`
- **Fotky:** Ukládají se do **PostgreSQL** jako BLOB (`Media.data`).
- **Servírování:** Přes `/api/media/image/[id]`.

## 4. Architektura a Deployment

### 4.1. Deployment na Kiosk (Offline)
Kvůli problémům s instalací (node_modules, databáze) používáme strategii **Patch Updates**:
1. **Zdrojový PC:** Spustí `PREPARE_PATCH.bat` -> vytvoří složku `Patch_Update` (kód, skripty, config).
2. **Cílový PC (Kiosk):**
   - Přepsat soubory ve složce aplikace.
   - Spustit `INSTALL_FAST.bat` (restart serveru, vyčištění procesů).
   - Spustit `OPRAVA_EMAIL_NODE.bat` (oprava `settings.json` přes Node.js).
   - Spustit `SPUSTIT_KIOSK_SPRAVNE.bat` (otevře `localhost:3000`).

### 4.2. Klíčové Soubory pro Deployment
- **`PREPARE_PATCH.bat`**: Generuje update balíček.
- **`INSTALL_FAST.bat`**: Rychlý restart a příprava prostředí na Kiosku.
- **`OPRAVA_EMAIL_NODE.bat`** + **`scripts/fix_settings.js`**: Robustní oprava nastavení emailu (Node.js).
- **`SPUSTIT_KIOSK_SPRAVNE.bat`**: Launcher, který kontroluje server a otevírá Chrome na správné adrese.
- **`DEBUG_GALLERY.html`**: Diagnostický nástroj pro API galerie.

### 4.3. API Změny pro Lokální Režim
Aby aplikace nepadala na chybějící databázi (Prisma) v offline režimu:
- **`api/poll/route.ts`**: Kompletně přepsáno na **FS-only** (rekurzivní skenování disku). Žádná Prisma.
- **`api/media/list/route.ts`**: Kompletně přepsáno na **FS-only** + logika pro **skrývání originálů** (pokud existuje editovaná verze).

## 5. Nastavení (settings.json)
- **SMTP:** Gmail (port 465, SSL).
- **Template:** Předmět "Fotka je tu! 🥳".
- **App Password:** Nutné vygenerovat v Google Account Security (16 znaků).

## 6. Známé Problémy a Řešení
- **"Connection Refused" v Kiosku:** Kiosk běžel na cloudové adrese (`railway.app`). -> **Fix:** Musí běžet na `localhost:3000`.
- **"Failed to Fetch" v Galerii:** API padalo na chybějící DB. -> **Fix:** Přepsáno na FS-only.
- **"Invalid Login" u Emailu:** Špatné heslo nebo email. -> **Fix:** Použít App Password a `OPRAVA_EMAIL_NODE.bat`.
- **Fotky v rootu vs podsložce:** DigiCamControl ukládal do rootu, Kiosk hledal v podsložce. -> **Fix:** API nyní prohledává rekurzivně vše.

---
*Aktualizováno po úspěšném vyřešení deploymentu a emailu.*
