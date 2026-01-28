# 📸 Blick & Cvak - Architectural Context

## 1. O projektu
**Blick & Cvak** je moderní webová aplikace (Next.js) běžící v kioskovém režimu na Windows. Slouží jako samoobslužná fotobudka, která ovládá připojenou zrcadlovku přes **DigicamControl**, umožňuje živý náhled, focení, klíčování (zelené plátno), tisk a odesílání fotek e-mailem.

## 2. Technologický Stack
- **Framework:** Next.js 16 (App Router)
- **Jazyk:** TypeScript
- **Styling:** TailwindCSS + Lucide React (ikony)
- **Databáze:** PostgreSQL (přes Prisma ORM) – pouze v Cloud režimu
- **Hardware Integrace:** DigicamControl (HTTP API)
- **Image Processing:** Sharp (server-side), PowerShell (local resize)

## 3. Režimy Provozu

### 🏠 Lokální Režim (LOCAL_ONLY)
- **Detekce:** `!process.env.RAILWAY_ENVIRONMENT_NAME`
- Fotky se ukládají pouze do `public/photos` (filesystem)
- Žádné volání databáze
- Stream z kamery přímo do prohlížeče
- Ideální pro offline akce

### ☁️ Cloud Režim (Railway)
- **Detekce:** `process.env.RAILWAY_ENVIRONMENT_NAME`
- Fotky se ukládají do **PostgreSQL** jako BLOB (`Media.data`)
- Servírování přes `/api/media/image/[id]`
- Live stream uploadovaný lokálním Bridge serverem do `/tmp`
- Bridge na lokálním PC streamuje náhled na cloud

## 4. Architektura Aplikace

### 4.1. Frontend (`/app/kiosk/page.tsx`)
Hlavní rozhraní je jednostránková aplikace (SPA), která obsluhuje kompletní uživatelský tok.
- **Stavy:** `idle` → `countdown` → `processing` → `review`
- **LiveView:** Zobrazuje MJPEG stream z DigicamControl nebo cloud snapshot
- **Gallery:** Modální okno pro hromadnou správu fotek

### 4.2. Backend (`/app/api/...`)
API routes jako prostředník mezi frontendem, databází a souborovým systémem.

| Route | Funkce |
|-------|--------|
| `/api/media/upload` | Přijímá fotky, ukládá do FS nebo DB |
| `/api/media/list` | Seznam fotek (FS nebo DB) |
| `/api/media/image/[id]` | Servíruje obrázek z DB (cloud) |
| `/api/media/delete` | Mazání fotek |
| `/api/stream/snapshot` | POST: Bridge nahrává frame, GET: Klient stahuje |
| `/api/print` | Posílá příkaz k tisku |
| `/api/email` | Odesílá fotky e-mailem (SMTP z settings.json) |
| `/api/trigger` | Proxy pro spuštění focení (-> Bridge) |
| `/api/poll` | Polling pro nové fotky |

### 4.3. Local Bridge (`/local-service/server.js`)
Node.js server běžící na lokálním PC u kamery (port 5555).

**Funkce:**
- Proxy pro DigicamControl API (capture, liveview)
- MJPEG stream endpoint (`/stream.mjpg`)
- Tisk fotek (`/print`)
- **Cloud Sync** – automatická synchronizace fotek do Railway

**Endpointy:**
- `GET /stream.mjpg` – Live MJPEG stream
- `GET /liveview.jpg` – Single frame
- `POST /shoot` – Spustit focení
- `POST /print` – Tisk
- `GET /sync-status` – Stav cloud synchronizace
- `POST /sync-now` – Vynutit synchronizaci

### 4.4. Cloud Sync System (`/local-service/cloud-sync.js`)
Automatická synchronizace lokálních fotek do Railway databáze.

**Workflow:**
1. Sleduje `public/photos` pro nové `edited_*` nebo `web_edited_*` soubory
2. Vytváří optimalizované verze (~0.5MB) do `public/photos/cloud/`
3. Uploaduje na Railway `/api/media/upload`
4. Zaznamenává do `sync_map.json`

**`sync_map.json` struktura:**
```json
{
  "synced": {
    "cloud_web_edited_xxx.jpg": {
      "cloudId": "abc123",
      "cloudUrl": "/api/media/image/abc123",
      "syncedAt": "2026-01-29T00:00:00Z",
      "localPath": "C:/path/to/edited_xxx.jpg",
      "sizeKB": 480
    }
  },
  "lastCheck": "2026-01-29T00:00:00Z"
}
```

### 4.5. DigicamControl Integrace
Komunikace přes lokální HTTP server.
- **Port 5520 (výchozí):** Ovládání (`/?cmd=Capture`, `/?cmd=LiveView_Show`)
- **Port 5566:** Optimizovaný stream (PowerShell proxy)
- Aplikace obsahuje autodetekci portů

## 5. Důležité Soubory

| Soubor | Účel |
|--------|------|
| `Blick_Cvak.bat` | Spouštěč lokálního režimu |
| `START_BRIDGE.bat` | Spouštěč Bridge serveru (pro cloud) |
| `local-service/server.js` | Bridge server |
| `local-service/cloud-sync.js` | Modul pro cloud sync |
| `sync_map.json` | Mapování lokál ↔ cloud |
| `settings.json` | Lokální konfigurace (SMTP, cesty) |
| `prisma/schema.prisma` | Datový model |

## 6. Datový Model (Prisma)

```prisma
model Media {
  id        String   @id @default(cuid())
  url       String   // /api/media/image/[id] nebo /photos/...
  type      String   @default("PHOTO") // PHOTO, VIDEO, PRINT
  localPath String?  // Cesta na lokálním PC
  data      Bytes?   // BLOB pro cloud storage
  createdAt DateTime @default(now())
}
```

## 7. Pravidla pro vývoj

1. **Dual Mode:** Každá API route musí respektovat `IS_CLOUD` přepínač
2. **Estetika:** Design musí být "WOW" – animace, glassmorphism
3. **Robustnost:** Auto-reconnect při výpadku kamery
4. **Lokální cesty:** Absolutní cesty ve Windows formátu
5. **Optimalizace:** Fotky pro cloud max 0.5MB (1800px, JPEG 70-85%)

## 8. Spuštění

### Lokální režim (Offline)
```batch
Blick_Cvak.bat
```
Spustí: DigicamControl → Next.js dev server → Chrome kiosk

### Cloud + Local Bridge
```batch
:: Na lokálním PC:
START_BRIDGE.bat

:: Web dostupný na:
https://cvak.up.railway.app/kiosk
```

---
*Tento soubor slouží jako kontext pro AI asistenta. Aktualizován: 2026-01-29*
