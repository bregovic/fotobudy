# Blick & Cvak 📸

Chytrá webová fotobudka postavená na **Next.js** s propojením na DSLR (Canon/Nikon) a tiskárnu.

## 🚀 Jak to funguje

Tento systém může běžet ve dvou režimech:

### 🏠 Lokální Režim (Offline)
- Běží **přímo na notebooku** u fotoaparátu.
- **Bez databáze** – fotky se ukládají do složky `public/photos`.
- Spuštění: `Blick_Cvak.bat` → automaticky nastartuje server, DigicamControl a Chrome v kiosk módu.

### ☁️ Cloud Režim (Railway)
- Webová aplikace běží na **Railway** (nebo jiném hostingu).
- Fotky se ukládají do **PostgreSQL databáze** (jako BLOB).
- Lokální Bridge (`local-service/`) streamuje náhled a ovládá hardware.

## 🛠️ Instalace a Spuštění

### Lokální Režim
```bash
# 1. Nainstalovat závislosti
npm install

# 2. Spustit přes BAT soubor (doporučeno)
Blick_Cvak.bat

# Nebo ručně:
npm run dev
# Web běží na http://localhost:3000/kiosk
```

### Cloud Režim (Railway)
1. Propojte repozitář s Railway.
2. Přidejte PostgreSQL databázi.
3. Proměnná `DATABASE_URL` se nastaví automaticky.
4. Na lokálním PC spusťte `START_BRIDGE.bat` pro propojení s kamerou.

## 📱 Použití

1. Otevřete `/kiosk` na tabletu/notebooku u fotostěny.
2. Klikněte na obrazovku nebo použijte tlačítko "VYFOTIT".
3. Fotka se automaticky zpracuje (efekty, ořez) a zobrazí.
4. Možnost tisku nebo odeslání emailem.

## 📂 Struktura Projektu

```
/app
  /kiosk      ← Hlavní UI fotokoutku
  /gallery    ← Prohlížeč fotek
  /video      ← Video vzkazy
  /profile    ← Admin nastavení (SMTP, assets)
  /api        ← Backend API routes

/local-service  ← Bridge pro kameru a tiskárnu
/scripts        ← Pomocné skripty
/prisma         ← Schéma databáze
```

## ⚙️ Konfigurace

Nastavení se ukládá do `settings.json`:
- SMTP konfigurace pro emaily
- Šablona emailu
- Cesta k fotkám

---
Vyvinuto s ❤️ pro zábavnější akce.
