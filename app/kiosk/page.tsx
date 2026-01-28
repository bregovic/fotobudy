'use client';
import { useState, useEffect, useRef, memo } from 'react';
import { Image as ImageIcon, Printer, Settings, Mail, RefreshCw, X, AlertTriangle, Send, Trash2, CameraOff, Home, Palette, Pipette, MousePointer2, Wand2, Layout, Cloud, Wifi, WifiOff, Terminal } from 'lucide-react';
import Link from 'next/link';

const SESSION_ID = 'main';
const DEFAULT_IP = '127.0.0.1';

// Porty, kde může běžet kamera
const PORTS_TO_SCAN = [5514, 5521, 5520, 5513];

// --- OPTIMIZED LIVE VIEW COMPONENT ---
const LiveView = memo(({
    streamUrl,
    isBW,
    onClick,
    className,
    error,
    isScanning,
    onStreamError
}: {
    streamUrl: string | null,
    isBW: boolean,
    onClick?: (e: React.MouseEvent<HTMLImageElement>) => void,
    className?: string,
    error?: boolean,
    isScanning?: boolean,
    onStreamError?: () => void
}) => {
    const [corsRetry, setCorsRetry] = useState(false);

    // Reset retry state when url changes
    useEffect(() => { setCorsRetry(false); }, [streamUrl]);

    if (isScanning) {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-white p-4 text-center">
                <RefreshCw className="animate-spin text-blue-500 mb-4" size={48} />
                <h3 className="text-xl font-bold mb-2">Hledám kameru...</h3>
                <p className="text-slate-400">Zkouším porty: {PORTS_TO_SCAN.join(', ')}</p>
            </div>
        );
    }

    if (error || !streamUrl) {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-white p-4 text-center">
                <AlertTriangle size={48} className="text-yellow-500 mb-4" />
                <h3 className="text-xl font-bold mb-2">Žádný signál</h3>
                <p className="max-w-md text-slate-400">
                    Kamera nalezena, ale obraz se nenačítá. <br />
                    Zkontrolujte Firewall a DigicamControl Webserver.
                </p>
            </div>
        );
    }

    return (
        <div className={`relative ${className}`}>
            <img
                key={corsRetry ? 'no-cors' : 'cors'} // Force re-render
                src={streamUrl}
                className={`w-full h-full object-contain ${isBW ? 'grayscale' : ''}`}
                crossOrigin={corsRetry ? undefined : "anonymous"}
                onClick={onClick}
                onError={(e) => {
                    console.warn("Stream load error", e);
                    if (!corsRetry) {
                        console.log("Retrying without CORS...");
                        setCorsRetry(true);
                    } else {
                        // Even without CORS it failed -> Bad port
                        if (onStreamError) onStreamError();
                    }
                }}
            />
        </div>
    );
});
LiveView.displayName = 'LiveView';

// --- MAIN PAGE ---

type SessionSettings = {
    email: string;
    isBW: boolean;
    isPrivate: boolean;
    selectedBg: string | null;
    selectedSticker: string | null;
    stickerPosition: 'br' | 'bl' | 'tr' | 'tl' | 'center' | 'cover';
    chromaKeyColor: string;
    chromaTolerance: number;
};

export default function KioskPage() {
    const [status, setStatus] = useState<'idle' | 'countdown' | 'processing' | 'review'>('idle');
    const [countdown, setCountdown] = useState(3);
    const [lastPhoto, setLastPhoto] = useState<string | null>(null);
    const processingRef = useRef(false);

    // UI States
    const [showSettings, setShowSettings] = useState(false);
    const [showGallery, setShowGallery] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailInput, setEmailInput] = useState('');
    const [galleryPhotos, setGalleryPhotos] = useState<any[]>([]);
    const [assets, setAssets] = useState<any[]>([]);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const [isPickingColor, setIsPickingColor] = useState(false);

    const [sessionSettings, setSessionSettings] = useState<SessionSettings>({
        email: '',
        isBW: false,
        isPrivate: false,
        selectedBg: null,
        selectedSticker: null,
        stickerPosition: 'br',
        chromaKeyColor: '#00FF00',
        chromaTolerance: 100
    });

    const [cameraIp, setCameraIp] = useState(DEFAULT_IP);

    // --- CONNECTIVITY & STREAMING STATES ---
    const [activePort, setActivePort] = useState<number | null>(null);
    const [isScanning, setIsScanning] = useState(true);
    const [failedPorts, setFailedPorts] = useState<number[]>([]); // BLACKLIST
    const [cloudStreamEnabled, setCloudStreamEnabled] = useState(false); // Default OFF
    const [streamLog, setStreamLog] = useState<string[]>([]);
    const [streamStatus, setStreamStatus] = useState<'offline' | 'live' | 'error'>('offline');

    // Logging helper
    const addLog = (msg: string) => {
        setStreamLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
    };

    const lastSeenTimeRef = useRef<number>(0);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const showToast = (msg: string) => {
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setToastMessage(msg);
        toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
    };

    // --- 1. ENV DETECTION & CAMERA LOGIC ---
    useEffect(() => {
        let mounted = true;

        // Detekce prostředí
        const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

        if (!isLocal) {
            // --- CLOUD REŽIM (Veřejný Web) ---
            console.log("Running in CLOUD MODE. Disabling local scan.");
            setIsScanning(false);
            setActivePort(null); // Nemáme lokální port
            setCloudStreamEnabled(false); // Na webu nevysíláme, jen přijímáme
            // Na webu VŽDY čteme ze snapshotů
            return;
        }

        // --- LOKÁLNÍ REŽIM (Kiosk App) ---
        console.log("Running in LOCAL APP MODE. Starting scanner.");

        // Reset failed ports every 30 seconds
        const resetInterval = setInterval(() => setFailedPorts([]), 30000);

        const scanPorts = async () => {
            if (!mounted) return;
            setIsScanning(true);

            const candidates = PORTS_TO_SCAN.filter(p => !failedPorts.includes(p));
            if (candidates.length === 0) {
                setFailedPorts([]); setTimeout(scanPorts, 1000); return;
            }

            for (const port of candidates) {
                if (!mounted) return;
                try {
                    const controller = new AbortController();
                    const id = setTimeout(() => controller.abort(), 1000);
                    const path = (port === 5521 || port === 5514) ? '/live' : '/liveview.jpg';
                    const url = `http://${DEFAULT_IP}:${port}${path}`;
                    await fetch(url, { method: 'GET', signal: controller.signal, mode: 'no-cors' });
                    clearTimeout(id);
                    if (mounted) {
                        console.log(`Camera found on port ${port}`);
                        setActivePort(port);
                        setIsScanning(false);
                        return;
                    }
                } catch (e) { }
            }
            if (mounted) setTimeout(scanPorts, 2000);
        };

        scanPorts();
        return () => { mounted = false; clearInterval(resetInterval); };
    }, [failedPorts]);

    // Helper to determine what to show based on ENV
    const getDisplayUrl = () => {
        const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

        // 1. Lokální Aplikace -> Přímý obraz z kamery
        if (isLocal) {
            if (!activePort) return null;
            const path = (activePort === 5521 || activePort === 5514) ? '/live' : '/liveview.jpg';
            return `http://${cameraIp}:${activePort}${path}`;
        }

        // 2. Veřejný Web -> Cloud Snapshot
        // Použijeme trik s časem pro refresh (React state 'tick' by byl lepší, ale pro jednoduchost zde):
        return `/api/stream/snapshot?t=${Date.now()}`;
    };

    // Obnovování Cloud Streamu na webu (Pseudo-stream)
    const [cloudTick, setCloudTick] = useState(0);
    useEffect(() => {
        const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        if (!isLocal) {
            const i = setInterval(() => setCloudTick(Date.now()), 200); // 5 FPS refresh na webu
            return () => clearInterval(i);
        }
    }, []);

    const finalStreamUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
        ? `/api/stream/snapshot?t=${cloudTick}`
        : getDisplayUrl();

    // --- 2. CLOUD STREAMER LOOP ---
    useEffect(() => {
        if (!cloudStreamEnabled || !activePort) {
            setStreamStatus('offline');
            return;
        }

        let mounted = true;
        setStreamStatus('live');
        addLog('Startuji Stream do Cloudu...');

        const loop = async () => {
            if (!mounted) return;
            try {
                // 1. Fetch from Local
                const path = (activePort === 5521 || activePort === 5514) ? '/live' : '/liveview.jpg';
                const localUrl = `http://${cameraIp}:${activePort}${path}`;

                const imgRes = await fetch(localUrl);
                const blob = await imgRes.blob();

                // 2. Upload to Cloud
                const cloudUrl = 'https://cvak.up.railway.app/api/stream/snapshot';
                const cloudRes = await fetch(cloudUrl, {
                    method: 'POST',
                    body: blob,
                    headers: { 'Content-Type': 'image/jpeg' }
                });

                if (!cloudRes.ok) throw new Error(cloudRes.statusText);
                // Success - wait a bit
                setTimeout(loop, 200); // ~5 FPS is enough for cloud

            } catch (e: any) {
                setStreamStatus('error');
                // addLog(`Chyba: ${e.message}`); // Too noisy
                setTimeout(loop, 1000); // Wait on error
            }
        };

        loop();
        return () => { mounted = false; addLog('Zastavuji Stream.'); };
    }, [cloudStreamEnabled, activePort, cameraIp]);


    // --- 3. FETCH DATA ---
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedIp = localStorage.getItem('camera_ip');
            if (savedIp) setCameraIp(savedIp);

            fetch('/api/assets').then(res => res.json()).then(data => {
                if (Array.isArray(data)) setAssets(data);
            });
        }

        fetch('/api/session', { method: 'POST', body: JSON.stringify({ id: SESSION_ID }) }).catch(console.error);

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/poll?sessionId=${SESSION_ID}`);
                const data = await res.json();

                if (data.pending && status === 'idle' && !processingRef.current) {
                    startCountdown();
                }

                // Check for remote commands or photo updates
                if (data.latest && data.latest.createdAt) {
                    const photoTime = new Date(data.latest.createdAt).getTime();
                    const now = Date.now();
                    if ((now - photoTime) < 30000 && photoTime > lastSeenTimeRef.current) {
                        lastSeenTimeRef.current = photoTime;
                        if (!data.latest.url.includes('edited_')) {
                            processNewPhoto(data.latest.url);
                        }
                    }
                }
            } catch (e) { }
        }, 1000);
        return () => clearInterval(interval);
    }, [status]);


    // --- CAMERA URL HELPER ---
    // This function is now replaced by getDisplayUrl and finalStreamUrl
    // const getStreamUrl = () => {
    //     if (!activePort) return null;
    //     const path = (activePort === 5521 || activePort === 5514) ? '/live' : '/liveview.jpg';
    //     return `http://${cameraIp}:${activePort}${path}`;
    // };

    // --- PROCESSING LOGIC ---
    const processNewPhoto = async (originalUrl: string) => {
        setStatus('processing');
        processingRef.current = false;
        showToast('Aplikuji efekty... ✨');
        try {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = originalUrl;
            await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });

            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('No context');
            ctx.drawImage(img, 0, 0);

            // ... (Effect Logic preserved) ...
            if (sessionSettings.selectedBg) {
                const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const l = frame.data.length / 4;
                const rKey = parseInt(sessionSettings.chromaKeyColor.slice(1, 3), 16);
                const gKey = parseInt(sessionSettings.chromaKeyColor.slice(3, 5), 16);
                const bKey = parseInt(sessionSettings.chromaKeyColor.slice(5, 7), 16);
                const tol = sessionSettings.chromaTolerance;
                for (let i = 0; i < l; i++) {
                    const r = frame.data[i * 4 + 0]; const g = frame.data[i * 4 + 1]; const b = frame.data[i * 4 + 2];
                    if (Math.abs(r - rKey) < tol && Math.abs(g - gKey) < tol && Math.abs(b - bKey) < tol) frame.data[i * 4 + 3] = 0;
                }
                ctx.putImageData(frame, 0, 0);
                const bgImg = new Image(); bgImg.crossOrigin = "Anonymous"; bgImg.src = sessionSettings.selectedBg;
                await new Promise(r => bgImg.onload = r);
                ctx.globalCompositeOperation = 'destination-over'; ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height); ctx.globalCompositeOperation = 'source-over';
            }
            if (sessionSettings.selectedSticker) {
                const stickerImg = new Image(); stickerImg.crossOrigin = "Anonymous"; stickerImg.src = sessionSettings.selectedSticker;
                await new Promise(r => stickerImg.onload = r);
                let sWidth = canvas.width * 0.3; let sHeight = (stickerImg.height / stickerImg.width) * sWidth;
                let sX = 0; let sY = 0; const margin = 50;
                switch (sessionSettings.stickerPosition) {
                    case 'br': sX = canvas.width - sWidth - margin; sY = canvas.height - sHeight - margin; break;
                    case 'bl': sX = margin; sY = canvas.height - sHeight - margin; break;
                    case 'tr': sX = canvas.width - sWidth - margin; sY = margin; break;
                    case 'tl': sX = margin; sY = margin; break;
                    case 'center': sX = (canvas.width - sWidth) / 2; sY = (canvas.height - sHeight) / 2; break;
                    case 'cover': sWidth = canvas.width; sHeight = canvas.height; sX = 0; sY = 0; break;
                }
                ctx.drawImage(stickerImg, sX, sY, sWidth, sHeight);
            }
            if (sessionSettings.isBW) {
                const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
                for (let i = 0; i < frame.data.length; i += 4) {
                    const avg = (frame.data[i] + frame.data[i + 1] + frame.data[i + 2]) / 3;
                    frame.data[i] = avg; frame.data[i + 1] = avg; frame.data[i + 2] = avg;
                }
                ctx.putImageData(frame, 0, 0);
            }

            canvas.toBlob(async (blob) => {
                if (!blob) return;
                const formData = new FormData();
                formData.append('file', blob, `edited_${Date.now()}.jpg`);
                formData.append('type', 'PHOTO');
                const uploadRes = await fetch('/api/media/upload', { method: 'POST', body: formData });
                const uploadData = await uploadRes.json();
                if (uploadData.success) {
                    setLastPhoto(uploadData.url); setStatus('review');
                    showToast('Efekty aplikovány! ✨');
                } else {
                    setLastPhoto(originalUrl); setStatus('review'); showToast('Chyba ukládání');
                }
            }, 'image/jpeg', 0.9);
        } catch (e) { console.error(e); showToast('Chyba efektů, zobrazuji originál.'); setLastPhoto(originalUrl); setStatus('review'); }
    };

    const handlePreviewClick = (e: React.MouseEvent<HTMLImageElement>) => {
        if (!isPickingColor) return;
        const img = e.currentTarget;
        const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.drawImage(img, 0, 0);
        const rect = img.getBoundingClientRect(); const x = (e.clientX - rect.left) * (img.naturalWidth / rect.width); const y = (e.clientY - rect.top) * (img.naturalHeight / rect.height);
        const p = ctx.getImageData(x, y, 1, 1).data;
        const hex = "#" + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase();
        setSessionSettings({ ...sessionSettings, chromaKeyColor: hex }); setIsPickingColor(false); showToast(`Barva vybrána: ${hex}`);
    };

    const startCountdown = () => {
        if (processingRef.current) return;
        setCountdown(3); setStatus('countdown'); processingRef.current = true;
        let count = 3;
        const timer = setInterval(() => { count--; if (count > 0) setCountdown(count); else { clearInterval(timer); takePhoto(); } }, 1000);
    };

    const takePhoto = async () => {
        setCountdown(0); setStatus('processing');
        setTimeout(() => { if (processingRef.current) { processingRef.current = false; setStatus('idle'); showToast("Timeout"); } }, 15000);
        try {
            // Local trigger only, we are the app
            await fetch(`http://${cameraIp}:5555/shoot`);
        } catch (e) { showToast('Chyba kamery - ověřte připojení!'); processingRef.current = false; setStatus('idle'); }
    };

    // Auto Email / Print etc
    const openGallery = async () => { setShowGallery(true); setConfirmDeleteId(null); try { const res = await fetch('/api/media/list'); const data = await res.json(); if (Array.isArray(data)) setGalleryPhotos(data); } catch (e) { } };
    const deletePhoto = async (id: string, url: string, e: React.MouseEvent) => { e.stopPropagation(); if (confirmDeleteId !== id) { setConfirmDeleteId(id); return; } await fetch('/api/media/delete', { method: 'POST', body: JSON.stringify({ url }) }); setGalleryPhotos(prev => prev.filter(p => p.id !== id)); setConfirmDeleteId(null); };
    const printPhoto = async () => { if (!lastPhoto) return; showToast('Tisk... 🖨️'); try { await fetch(`http://${cameraIp}:5555/print`, { method: 'POST', body: JSON.stringify({ filename: lastPhoto.split('/').pop() }) }); } catch (e) { } };
    const sendEmail = async () => { if (!emailInput.includes('@')) { showToast('Email?'); return; } showToast('Odesílám...'); try { await fetch('/api/email', { method: 'POST', body: JSON.stringify({ email: emailInput, photoUrl: lastPhoto }) }); showToast('OK ✅'); setShowEmailModal(false); } catch (e) { showToast('Chyba ❌'); } };

    return (
        <div className="relative w-full h-full bg-slate-950 overflow-hidden flex flex-col items-center justify-center select-none">

            {/* LIVE / REVIEW LAYER */}
            <div className="absolute inset-0 bg-black flex items-center justify-center">
                {status === 'processing' ? (
                    <div className="text-white flex flex-col items-center animate-pulse"><RefreshCw className="animate-spin mb-4" size={48} /><span className="text-2xl font-bold">Zpracovávám...</span></div>
                ) : status === 'review' && lastPhoto ? (
                    <img src={lastPhoto} className="w-full h-full object-contain bg-slate-900" />
                ) : (
                    <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
                        <LiveView
                            streamUrl={finalStreamUrl}
                            isBW={sessionSettings.isBW}
                            isScanning={isScanning}
                            error={!isScanning && !activePort}
                            className="w-full h-full object-contain"
                            onStreamError={() => {
                                console.log(`Port ${activePort} failed streaming. Blacklisting and restarting scan...`);
                                if (activePort) setFailedPorts(prev => [...prev, activePort]);
                                setActivePort(null);
                                setIsScanning(true);
                            }}
                        />
                    </div>
                )}
            </div>

            {/* COUNTDOWN */}
            {status === 'countdown' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-50">
                    <div className="text-[15rem] font-black text-white drop-shadow-2xl animate-bounce">{countdown}</div>
                </div>
            )}

            {/* SETTINGS MODAL */}
            {showSettings && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in zoom-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-5xl w-full shadow-2xl text-white h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6 pt-2 px-2">
                            <h2 className="text-3xl font-bold flex items-center gap-3"><Settings size={32} /> Nastavení Focení</h2>
                            <button onClick={() => { setShowSettings(false); setIsPickingColor(false); }} className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors"><X size={24} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 lg:grid-cols-2 gap-8">

                            {/* --- CLOUD STREAM CONTROL (NEW) --- */}
                            <div className="lg:col-span-2 p-6 bg-slate-800/50 border border-slate-700 rounded-2xl flex items-start gap-6">
                                <div className={`p-4 rounded-full ${cloudStreamEnabled ? 'bg-blue-600' : 'bg-slate-700'}`}>
                                    <Cloud size={32} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-xl font-bold">Vysílat na Internet (Cloud)</h3>
                                        <button
                                            onClick={() => activePort ? setCloudStreamEnabled(!cloudStreamEnabled) : showToast('Nejdříve připojte kameru!')}
                                            className={`px-6 py-2 rounded-full font-bold transition-all ${cloudStreamEnabled ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                                        >
                                            {cloudStreamEnabled ? 'VYSÍLÁNÍ ZAPNUTO' : 'VYPNUTO'}
                                        </button>
                                    </div>
                                    <p className="text-slate-400 text-sm mb-4">
                                        Pokud zapnuto, aplikace bude odesílat živý náhled na web, aby si hosté mohli načíst QR kód.
                                        Vyžaduje připojení k internetu.
                                    </p>

                                    {/* TERMINAL LOG */}
                                    <div className="bg-black rounded-xl border border-slate-800 p-4 font-mono text-xs h-32 overflow-y-auto flex flex-col-reverse">
                                        {streamLog.length === 0 && <span className="text-slate-600 italic">Zatím žádná aktivita...</span>}
                                        {streamLog.map((log, i) => (
                                            <div key={i} className="text-slate-300 border-b border-white/5 py-0.5">{log}</div>
                                        ))}
                                    </div>
                                    <div className="flex gap-4 mt-2 text-xs text-slate-500">
                                        <span className={`flex items-center gap-1 ${activePort ? 'text-green-400' : 'text-red-400'}`}>
                                            {activePort ? <Wifi size={12} /> : <WifiOff size={12} />} Kamera: {activePort ? `Online (Port ${activePort})` : 'Offline'}
                                        </span>
                                        <span className={`flex items-center gap-1 ${streamStatus === 'live' ? 'text-blue-400' : 'text-slate-500'}`}>
                                            <Cloud size={12} /> Stream: {streamStatus.toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* LEFT COL */}
                            <div className="space-y-6">
                                {/* Basic Options... */}
                                <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl">
                                    <h3 className="font-semibold mb-4">Základní</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between"><span>Auto-Email</span><input type="email" placeholder="email@..." value={sessionSettings.email} onChange={e => setSessionSettings({ ...sessionSettings, email: e.target.value })} className="bg-slate-950 p-3 rounded-lg border border-slate-600 w-48 text-sm focus:border-blue-500 outline-none" /></div>
                                        <div className="flex items-center justify-between"><span>Černobíle</span><input type="checkbox" checked={sessionSettings.isBW} onChange={e => setSessionSettings({ ...sessionSettings, isBW: e.target.checked })} className="w-6 h-6 accent-blue-500" /></div>
                                    </div>
                                </div>

                                {/* Chroma Key Settings */}
                                <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl">
                                    <h3 className="font-semibold mb-4 flex items-center gap-2 text-green-400"><Pipette size={18} /> Klíčování (Green Screen)</h3>
                                    <div className="mb-4 relative rounded-lg overflow-hidden border border-slate-600 bg-black aspect-video group">
                                        <LiveView
                                            streamUrl={finalStreamUrl}
                                            isBW={sessionSettings.isBW}
                                            onClick={handlePreviewClick}
                                            className={`w-full h-full object-cover ${isPickingColor ? 'cursor-crosshair' : ''}`}
                                        />
                                        {isPickingColor && <div className="absolute inset-0 bg-green-500/20 pointer-events-none flex items-center justify-center text-green-300 font-bold border-4 border-green-500 animate-pulse">KLIKNI KAMKOLIV</div>}
                                        <div className="absolute bottom-2 right-2">
                                            <button onClick={() => setIsPickingColor(!isPickingColor)} className={`p-2 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold transition-all ${isPickingColor ? 'bg-green-500 text-black scale-110' : 'bg-white text-black hover:bg-slate-200'}`}>
                                                <MousePointer2 size={16} /> {isPickingColor ? 'Vybírám...' : 'Kapátko'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between"><span>Barva klíče</span><div className="flex items-center gap-2"><input type="color" value={sessionSettings.chromaKeyColor} onChange={e => setSessionSettings({ ...sessionSettings, chromaKeyColor: e.target.value })} className="bg-transparent border-0 w-8 h-8 cursor-pointer" /><span className="text-xs font-mono">{sessionSettings.chromaKeyColor}</span></div></div>
                                        <div><div className="flex justify-between text-sm mb-1"><span>Tolerance</span><span>{sessionSettings.chromaTolerance}</span></div><input type="range" min="10" max="250" value={sessionSettings.chromaTolerance} onChange={e => setSessionSettings({ ...sessionSettings, chromaTolerance: Number(e.target.value) })} className="w-full accent-green-500 h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer" /></div>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT COL */}
                            <div className="space-y-6">
                                <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl">
                                    <h3 className="font-semibold mb-4 text-purple-400">🖼️ Pozadí</h3>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div onClick={() => setSessionSettings({ ...sessionSettings, selectedBg: null })} className={`aspect-video bg-slate-900 border-2 rounded-lg cursor-pointer flex items-center justify-center text-xs transition-all ${sessionSettings.selectedBg === null ? 'border-purple-500 ring-2 ring-purple-500/50' : 'border-slate-700 hover:border-slate-500'}`}>Nic</div>
                                        {assets.filter(a => a.type === 'BACKGROUND').map(a => (<img key={a.id} src={a.url} onClick={() => setSessionSettings({ ...sessionSettings, selectedBg: a.url })} className={`w-full aspect-video object-cover rounded-lg cursor-pointer border-2 transition-all ${sessionSettings.selectedBg === a.url ? 'border-purple-500 ring-2 ring-purple-500/50' : 'border-slate-700 hover:border-slate-500'}`} />))}
                                    </div>
                                </div>
                                <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl">
                                    <h3 className="font-semibold mb-4 text-pink-400 flex justify-between items-center"><span>🦄 Samolepka</span></h3>
                                    <div className="mb-4 flex gap-1 p-1 bg-slate-950 rounded-lg">
                                        {([['tl', 'TL'], ['tr', 'TR'], ['center', 'Center'], ['bl', 'BL'], ['br', 'BR'], ['cover', 'Cover']] as const).map(([pos, label]) => (
                                            <button key={pos} onClick={() => setSessionSettings(s => ({ ...s, stickerPosition: pos as any }))} className={`flex-1 py-1 text-[10px] font-bold rounded ${sessionSettings.stickerPosition === pos ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white'}`}>{label}</button>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        <div onClick={() => setSessionSettings({ ...sessionSettings, selectedSticker: null })} className={`aspect-square bg-slate-900 border-2 rounded-lg cursor-pointer flex items-center justify-center text-xs transition-all ${sessionSettings.selectedSticker === null ? 'border-pink-500 ring-2 ring-pink-500/50' : 'border-slate-700 hover:border-slate-500'}`}>Nic</div>
                                        {assets.filter(a => a.type === 'STICKER').map(a => (<img key={a.id} src={a.url} onClick={() => setSessionSettings({ ...sessionSettings, selectedSticker: a.url })} className={`w-full aspect-square object-contain bg-slate-900 rounded-lg cursor-pointer border-2 transition-all ${sessionSettings.selectedSticker === a.url ? 'border-pink-500 ring-2 ring-pink-500/50' : 'border-slate-700 hover:border-slate-500'}`} />))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DOCK */}
            <div className="absolute top-6 left-6 z-50">
                <Link href="/" className="p-4 bg-white/10 text-white rounded-full backdrop-blur-md flex items-center justify-center hover:bg-white/20 hover:scale-105 transition-all shadow-lg"><Home size={28} /></Link>
            </div>

            {status === 'review' && lastPhoto && (
                <div className="absolute top-6 right-6 z-50 animate-in fade-in slide-in-from-top-4">
                    <button onClick={() => processNewPhoto(lastPhoto)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-full font-bold shadow-2xl transition-transform active:scale-95 text-lg">
                        <Wand2 size={24} /> Upravit Fotku
                    </button>
                </div>
            )}

            <div className="absolute bottom-12 z-30 w-full flex justify-center p-4">
                <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-full p-4 flex items-center shadow-2xl scale-125 origin-bottom">
                    <div className="flex gap-6 px-4 border-r border-white/10 pr-6">
                        <button className="flex flex-col items-center gap-1 text-white opacity-80 hover:scale-110 transition-all text-[10px] uppercase font-bold tracking-widest hover:text-blue-400" onClick={() => setShowSettings(true)}><Settings size={24} /> <span>Nastavení</span></button>
                        <button className="flex flex-col items-center gap-1 text-white opacity-80 hover:scale-110 transition-all text-[10px] uppercase font-bold tracking-widest hover:text-purple-400" onClick={openGallery}><ImageIcon size={24} /> <span>Galerie</span></button>
                    </div>
                    <div className="mx-8 relative">
                        {status === 'review' ? (
                            <button className="w-24 h-24 rounded-full border-4 border-red-500 flex items-center justify-center bg-red-500/20 hover:scale-105 transition-all shadow-red-900/50 shadow-lg" onClick={() => { setStatus('idle'); setLastPhoto(null); }}><RefreshCw size={40} color="#fff" /></button>
                        ) : (
                            <button className="w-28 h-28 rounded-full border-[6px] border-white flex items-center justify-center bg-white/10 hover:bg-white/30 transition-all active:scale-95 shadow-lg shadow-white/10" onClick={startCountdown} disabled={status !== 'idle'}>
                                <div className="w-20 h-20 bg-white rounded-full shadow-inner"></div>
                            </button>
                        )}
                    </div>
                    <div className="flex gap-6 px-4 border-l border-white/10 pl-6">
                        <button className="flex flex-col items-center gap-1 text-white opacity-80 hover:scale-110 transition-all text-[10px] uppercase font-bold tracking-widest hover:text-green-400" disabled={status !== 'review'} onClick={printPhoto}><Printer size={24} /> <span>Tisk</span></button>
                        <button className="flex flex-col items-center gap-1 text-white opacity-80 hover:scale-110 transition-all text-[10px] uppercase font-bold tracking-widest hover:text-yellow-400" disabled={status !== 'review'} onClick={() => setShowEmailModal(true)}><Mail size={24} /> <span>Email</span></button>
                    </div>
                </div>
            </div>
            {toastMessage && <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[60] bg-indigo-600/90 backdrop-blur shadow-2xl text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 animate-in slide-in-from-top-4 fade-in"><div className="w-2 h-2 bg-white rounded-full animate-ping"></div> {toastMessage}</div>}

            {showGallery && (
                <div className="absolute inset-0 z-50 bg-slate-950/95 flex flex-col p-10 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-4xl font-bold text-white">Galerie</h2>
                        <button onClick={() => setShowGallery(false)} className="p-4 bg-white/10 rounded-full hover:bg-white/20 text-white"><X size={32} /></button>
                    </div>
                    <div className="grid grid-cols-4 gap-6 overflow-y-auto pb-20">
                        {galleryPhotos.map(p => (
                            <div key={p.id} className="relative group aspect-video bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 shadow-xl">
                                <img src={p.url} onClick={() => { setLastPhoto(p.url); setStatus('review'); setShowGallery(false); }} className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-500" />
                                <button onClick={(e) => deletePhoto(p.id, p.url, e)} className={`absolute top-2 right-2 p-3 rounded-full text-white bg-black/50 hover:bg-red-600 transition-colors ${confirmDeleteId === p.id ? 'bg-red-600' : ''}`}>
                                    {confirmDeleteId === p.id ? <Trash2 size={24} /> : <X size={24} />}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showEmailModal && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in">
                    <div className="bg-slate-900 p-10 rounded-3xl w-full max-w-lg space-y-6 shadow-2xl border border-slate-700">
                        <h3 className="text-2xl font-bold text-white text-center">Odeslat fotku emailem</h3>
                        <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="vas@email.cz" className="w-full p-5 rounded-xl bg-slate-950 border border-slate-600 text-white focus:border-indigo-500 outline-none text-lg text-center" autoFocus />
                        <button onClick={sendEmail} className="w-full bg-indigo-600 hover:bg-indigo-500 p-5 rounded-xl text-white font-bold text-xl transition-all shadow-lg shadow-indigo-900/50">Odeslat 🚀</button>
                        <button onClick={() => setShowEmailModal(false)} className="w-full text-slate-400 hover:text-white p-2">Zrušit</button>
                    </div>
                </div>
            )}
        </div>
    );
}
