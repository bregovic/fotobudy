# FotoBuddy 📸

Chytrá webová fotobudka postavená na **Next.js** s propojením na DSLR (Canon) a tiskárnu.

## 🚀 Jak to funguje

Tento systém se skládá ze dvou částí:

1.  **Webová Aplikace (Cloud)**
    *   Běží na Railway (nebo Vercel/VPS).
    *   Poskytuje rozhraní pro Kiosk (display na akci) a Remote (ovládání mobilem).
    *   Ukládá fotky a relace do databáze.

2.  **Lokální Bridge (Notebook u foťáku)**
    *   Skript ve složce `local-service/`.
    *   Běží na notebooku připojeném k fotoaparátu.
    *   Přijímá příkazy z webu a ovládá hardware (vyfocení, tisk).

## 🛠️ Instalace a Spuštění

### 1. Webová Aplikace
```bash
npm install
npm run dev
# Web běží na http://localhost:3000
```

### 2. Hardware Bridge
Více informací viz [local-service/README.md](local-service/README.md).

## 🌍 Nasazení (Railway)

1. Propojte tento repozitář s Railway.
2. Přidejte PostgreSQL databázi.
3. Nastavte proměnné prostředí (ENV):
   *   `DATABASE_URL`: Automaticky nastaveno Railway.

## 📱 Použití

1. Otevřete `/kiosk` na notebooku/tabletu u fotostěny.
2. Hosté naskenují QR kód.
3. Na mobilu se jim otevře `/remote` ovladač.
4. Kliknou na "VYFOTIT" -> Kamera cvakne -> Fotka se ukáže na kiosku.

Vyvinuto s ❤️ pro zábavnější akce.
