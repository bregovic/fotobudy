# 📸 Blick & Cvak - Architectural Context

## 1. O projektu
Blick & Cvak je moderní webová aplikace (Next.js) běžící v kioskovém režimu na operačním systému Windows. Slouží jako samoobslužná fotobudka, která ovládá připojenou zrcadlovku přes **DigicamControl**, umožňuje živý náhled, focení, klíčování (zelené plátno), tisk a odesílání fotek e-mailem.

## 2. Technologický Stack
- **Framework:** Next.js 16 (App Router)
- **Jazyk:** TypeScript
- **Styling:** TailwindCSS + Lucide React (ikony)
- **Databáze:** PostgreSQL (přes Prisma ORM) – pouze v Cloud režimu
- **Hardware Integrace:** DigicamControl (HTTP API běžící na localhost)

## 3. Režimy Provozu

### 🏠 Lokální Režim (LOCAL_ONLY)
- Detekce: `!process.env.RAILWAY_ENVIRONMENT_NAME`
- Fotky se ukládají pouze do `public/photos` (filesystem)
- Žádné volání databáze
- Ideální pro offline akce

### ☁️ Cloud Režim (Railway)
- Detekce: `process.env.RAILWAY_ENVIRONMENT_NAME`
- Fotky se ukládají do PostgreSQL (BLOB v tabulce `Media`)
- Servírování přes `/api/media/image/[id]`
- Bridge na lokálním PC streamuje náhled na cloud

## 4. Architektura Aplikace

### 4.1. Frontend (`/app/kiosk/page.tsx`)
Hlavní rozhraní je jednostránková aplikace (SPA), která obsluhuje kompletní uživatelský tok (User Flow).
- **Stavy:** `idle` (klid) -> `countdown` (odpočet) -> `processing` (zpracování) -> `review` (náhled/tisk).
- **LiveView:** Komponenta, která zobrazuje MJPEG stream z DigicamControl.
- **Gallery:** Modální okno pro hromadnou správu fotek.

### 4.2. Backend (`/app/api/...`)
API routes slouží jako prostředník mezi frontendem, databází a souborovým systémem.
- **/api/media/upload**: Přijímá vyfocenou/upravenou fotku a ukládá ji (FS nebo DB podle režimu).
- **/api/media/list**: Vrací seznam fotek (z FS nebo DB).
- **/api/media/image/[id]**: Servíruje obrázek z DB (Cloud režim).
- **/api/print**: Posílá příkaz k tisku.
- **/api/email**: Odesílá fotky e-mailem (SMTP z settings.json).

### 4.3. DigicamControl Integrace
Komunikace probíhá přes lokální HTTP server, který DigicamControl vystavuje.
- **Port 5513 (Default) / 5520 / 5555**: Ovládací příkazy (`/?cmd=Capture`).
- **Port 5514 / 5521**: Live stream (MJPEG).
- *Poznámka: Aplikace obsahuje autodetekci portů.*

## 5. Důležité Soubory & Skripty
- **`app/kiosk/page.tsx`**: Hlavní logika klienta.
- **`Blick_Cvak.bat`**: Spouštěcí skript pro lokální režim.
- **`local-service/server.js`**: Bridge server pro kameru.
- **`prisma/schema.prisma`**: Definice datového modelu.
- **`settings.json`**: Lokální konfigurace (SMTP, cesty).

## 6. Pravidla pro vývoj
- **Estetika**: Design musí být "WOW" – animace, skleněné efekty, velké ovládací prvky.
- **Robustnost**: Aplikace musí přežít výpadek kamery (auto-reconnect).
- **Lokální cesty**: Vždy používat absolutní cesty ve Windows formátu (`C:\...`) pro systémové volání.
- **Dual Mode**: Každá API route musí respektovat `IS_CLOUD` přepínač.

---
*Tento soubor slouží jako kontext pro AI asistenta. Při každé relaci si jej přečti pro pochopení architektury.*
