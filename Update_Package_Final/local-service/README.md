# FotoBuddy Local Bridge

Tato služba běží na notebooku (Kiosku) a zprostředkovává komunikaci mezi webovou aplikací a hardwarem (Canon DSLR, Tiskárna).

## Jak to funguje

1. **Webová aplikace (Next.js)** běží v prohlížeči.
2. Když kliknete na "Vyfotit", aplikace pošle požadavek na `localhost:5555/shoot`.
3. **Bridge (tento skript)** přijme požadavek a spustí příkaz pro kameru (přes USB).
4. Kamera vyfotí snímek a uloží ho do složky.

## Instalace a Spuštění

1. V hlavním adresáři projektu spusťte instalaci balíčků (pokud jste ještě neudělali):
   ```bash
   npm install
   ```

2. Spusťte Bridge Server:
   ```bash
   node local-service/server.js
   ```

3. V jiném okně spusťte Next.js aplikaci:
   ```bash
   npm run dev
   ```

## Integrace s Realnou Kamerou (Windows)

Pro ovládání **Canon 5D Mark II** doporučujeme program **DigiCamControl** (zdarma).

1. Nainstalujte [DigiCamControl](http://digicamcontrol.com/).
2. Připojte kameru přes USB.
3. Upravte soubor `local-service/server.js`:
   
   Změňte `CAMERA_CMD_TEMPLATE` na cestu k `CameraControlCmd.exe`.
   
   Příklad:
   ```javascript
   const CAMERA_CMD_TEMPLATE = '"C:\\Program Files (x86)\\digiCamControl\\CameraControlCmd.exe" /capture /filename %filename%';
   ```

Tím je zajištěno, že se po zavolání endpointu `/shoot` skutečně spustí spoušť fotoaparátu.
