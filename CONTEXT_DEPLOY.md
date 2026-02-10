# FotoBuddy Deployment Guide

## Architecture Overview
The application is a Next.js (React) web application running locally on a kiosk PC. It communicates with backend services (Node.js Bridge, DigiCamControl, File Watcher) to handle camera capture, photo processing, and printing.

### Key Components
1.  **Frontend (Next.js)**: Runs on port 3000. Handles UI, photo gallery, editing, email sending.
2.  **Backend (Bridge Server)**: Runs on port 5555 (`local-service/server.js`). Handles live view stream, camera commands via HTTP to DigiCamControl.
3.  **File Watcher**: `scripts/watch_folder.js`. Monitors specific folder for new photos from DigiCamControl.
4.  **DigiCamControl**: External application controlling the DSLR camera.
5.  **Database (SQLite)**: Managed by Prisma (schema in `prisma/schema.prisma`). Stores settings, logs, and photo metadata.

## Deployment Process

### 1. Preparation (Source PC)
1.  Make sure your code is up to date and working.
2.  Run `PREPARE_DEPLOY.bat` in the project root.
3.  This creates a `Deployment` folder containing a clean copy of the application (without `node_modules` or `.next` artifacts, to save space and ensure compatibility).

### 2. Transfer (Thumb Drive / Network)
1.  Copy the entire `Deployment` folder to the Target PC (e.g., to `C:\Users\User\Documents\FotoBuddy`).

### 3. Installation (Target PC)
1.  **Install Node.js**: Download and install Node.js (LTS version) from [nodejs.org](https://nodejs.org/) if not already installed. Open a command prompt (`cmd`) and type `node -v` to verify.
2.  **Run `INSTALL.bat`**: Wait for dependencies to install (`npm install`). This may take a few minutes.
3.  **Check Configuration**:
    - Open `settings.json` (created from `settings.example.json` if missing).
    - Set `smtp_config` (Host: `smtp.gmail.com`, Port: `465`, User: `...`, Pass: `...`).
    - Set `photo_path` to the folder where DigiCamControl saves photos (e.g., `C:\Fotky`).
4.  **Check DigiCamControl**:
    - Ensure DigiCamControl is installed and configured to save photos to the same `photo_path`.
    - Session settings: File Name `[Counter 4 digit]`, Folder `C:\Fotky`.

### 4. Running the App
1.  Use the desktop shortcut **"Blick & Cvak"** created by the installer.
2.  Or run `Start_App.bat` (renamed from `Blick_Cvak.bat`) directly.
3.  The application will open in a dedicated Chrome window (Kiosk mode).

## Troubleshooting
- **Email not sending**: Check `settings.json`. Ensure "App Password" is used for Gmail. Run `scripts/test_email.js` manually with `node scripts/test_email.js` to debug.
- **Photos not appearing**: Run `scripts/watch_folder.js` manually to see if it detects files. Check if `photo_path` in `settings.json` matches DigiCamControl.
- **Shortcut icon missing**: The installer uses `public/app.ico`. Ensure this file exists.

## Updates
To update the Target PC:
1.  Run `PREPARE_DEPLOY.bat` on Source.
2.  Copy new contents to Target folder (overwrite all).
3.  Run `INSTALL.bat` again (safe to re-run).
4.  Restart the application.

---
*Created by Antigravity Assitant*
