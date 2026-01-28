# 📸 FotoBuddy - Architectual Context

## 1. O projektu
FotoBuddy je moderní webová aplikace (Next.js) běžící v kioskovém režimu na operačním systému Windows. Slouží jako samoobslužná fotobudka, která ovládá připojenou zrcadlovku přes **DigicamControl**, umožňuje živý náhled, focení, klíčování (zelené plátno), tisk a odesílání fotek e-mailem.

## 2. Technologický Stack
- **Framework:** Next.js 16 (App Router)
- **Jazyk:** TypeScript
- **Styling:** TailwindCSS + Lucide React (ikony)
- **Databáze:** PostgreSQL (přes Prisma ORM)
- **Hardware Integrace:** DigicamControl (HTTP API bežící na localhost)

## 3. Architektura Aplikace

### 3.1. Frontend (`/app/kiosk/page.tsx`)
Hlavní rozhraní je jednostránková aplikace (SPA), která obsluhuje kompletní uživatelský tok (User Flow).
- **Stavy:** `idle` (klid) -> `countdown` (odpočet) -> `processing` (zpracování) -> `review` (náhled/tisk).
- **LiveView:** Komponenta, která zobrazuje MJPEG stream z DigicamControl.
- **Gallery:** Modální okno pro hromadnou správu fotek.

### 3.2. Backend (`/app/api/...`)
API routes slouží jako prostředník mezi frontendem, databází a souborovým systémem.
- **/api/media/upload**: Přijímá vyfocenou/upravenou fotku a ukládá ji na disk + záznam do DB.
- **/api/print**: Posílá příkaz k tisku (často volá externí skript nebo systémový příkaz).
- **/api/email**: Odesílá fotky e-mailem (SMTP/Resend).

### 3.3. DigicamControl Integrace
Komunikace probíhá přes lokální HTTP server, který DigicamControl vystavuje.
- **Port 5513 (Default) / 5520 / 5555**: Ovládací příkazy (`/?cmd=Capture`).
- **Port 5514 / 5521**: Live stream (MJPEG).
- *Poznámka: Aplikace obsahuje autodetekci portů.*

## 4. Workflows

### 📸 Focení
1. Uživatel stiskne tlačítko.
2. Spustí se odpočet (3s).
3. Frontend pošle `GET` na DigicamControl `/?cmd=Capture`.
4. DigicamControl vyfotí, uloží fotku do složky (např. `C:\Fotky`).
5. Aplikace (pollingem nebo webhookem) zjistí nový soubor.
6. Aplikace načte fotku, aplikuje efekty (Chroma key, Overlay) v Canvasu.
7. Výsledek se nahraje zpět na `/api/media/upload`.

### 🖨️ Tisk
1. Uživatel vybere fotku.
2. API zavolá systémový příkaz pro tisk (např. `rundll32 printui.dll...` nebo přes dedikovaný `print.exe` wrapper).

## 5. Důležité Soubory & Skripty
- **`app/kiosk/page.tsx`**: Hlavní logika klienta.
- **`SPUSTIT_FOTOBUDDY.bat`**: Spouštěcí skript, který nahodí Next.js, DigicamControl a další služby.
- **`prisma/schema.prisma`**: Definice datového modelu (Session, Media, Settings).

## 6. Pravidla pro vývoj
- **Estetika**: Design musí být "WOW" – animace, skleněné efekty, velké ovládací prvky. Žádné nudné HTML.
- **Robustnost**: Aplikace musí přežít výpadek kamery (auto-reconnect).
- **Lokální cesty**: Vždy používat absolutní cesty ve Windows formátu (`C:\...`) pro systémové volání.

---
*Tento soubor slouží jako kontext pro AI asistenta. Při každé relaci si jej přečti pro pochopení architektury.*
