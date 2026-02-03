'use client';
import { useState, useEffect, useRef, memo } from 'react';
import { Image as ImageIcon, Printer, Settings, Mail, RefreshCw, X, AlertTriangle, Send, Trash2, CameraOff, Home, Palette, Pipette, MousePointer2, Wand2, Layout, Cloud, Wifi, WifiOff, Terminal, Video, FolderOpen, Shield, Lock, CheckCircle2, MessageSquare, ArrowLeft, ArrowRight, Calendar } from 'lucide-react';
import Link from 'next/link';

const SESSION_ID = 'main';
const DEFAULT_IP = '127.0.0.1';
const DEFAULT_CMD_PORT = 5513;
// const PORTS_TO_SCAN = [5555, 5514, 5521, 5520, 5513]; // Moved inside useEffect



const LiveView = memo(({ streamUrl, isBW, isScanning, error, className, onRestart, onStreamError, onClick, printWidth, printHeight }: any) => {
    // Calculate aspect ratio for guide
    const guideStyle: React.CSSProperties = {};
    if (printWidth && printHeight) {
        const ratio = printWidth / printHeight;
        // We want to overlay a box with this aspect ratio centered
        // Since we don't know the exact container dimensions easily without ref, 
        // we can use a trick: aspect-ratio on a centralized div if supported, or percentages.
        // But simpler: Just a border that is "contain" mode? 
        // No, we want a guide ON TOP of the image which covers the whole container.
        // Assuming the video fills the container (object-contain), the black bars are part of the container.
        // If we want to show what will be printed from the SENSOR (video), we assume the video is 3:2 (standard SLR).
        // If print is also 3:2, they match.
        // If print is different, we show crop.

        // Let's assume we want to show a guide relative to the CONTAINER, 
        // assuming the video fills the container height or width.
        // A simple approach is a centered box with aspect-ratio.
        guideStyle.aspectRatio = `${printWidth}/${printHeight}`;
        guideStyle.maxHeight = '100%';
        guideStyle.maxWidth = '100%';
        guideStyle.height = 'auto'; // will be constrained by aspect ratio
        guideStyle.width = 'auto';
    }

    return (
        <div className={`relative bg-black overflow-hidden flex items-center justify-center ${className}`} onClick={onClick}>
            {error ? (
                <div className="flex flex-col items-center justify-center text-red-500 animate-pulse">
                    <AlertTriangle size={48} className="mb-2" />
                    <p className="font-bold">Chyba kamery</p>
                    {onRestart && <button onClick={(e) => { e.stopPropagation(); onRestart(); }} className="mt-4 px-4 py-2 bg-red-900/50 rounded-full text-white text-xs hover:bg-red-800">Restart</button>}
                </div>
            ) : isScanning ? (
                <div className="flex flex-col items-center justify-center text-blue-400">
                    <RefreshCw className="animate-spin mb-2" size={48} />
                    <p className="font-bold text-xs">Hledám kameru...</p>
                </div>
            ) : (
                <>
                    <img
                        src={streamUrl}
                        className={`w-full h-full object-contain ${isBW ? 'grayscale' : ''}`}
                        onError={onStreamError}
                        alt="Live View"
                    />
                    {/* Print Guide Overlay */}
                    {/* Print Guide Removed */}
                </>
            )}
        </div>
    );
});
LiveView.displayName = 'LiveView';

const GalleryGrid = ({ photos, selectedIds, onToggle, onDelete, onPrint, onEmail, onClose }: any) => {
    const [viewPhotoIndex, setViewPhotoIndex] = useState<number | null>(null);

    // Nav Logic
    useEffect(() => {
        if (viewPhotoIndex === null) return;
        const handleK = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') next();
            if (e.key === 'ArrowLeft') prev();
            if (e.key === 'Escape') setViewPhotoIndex(null);
        };
        window.addEventListener('keydown', handleK);
        return () => window.removeEventListener('keydown', handleK);
    }, [viewPhotoIndex, photos]);

    const [ts, setTs] = useState(0);
    const [te, setTe] = useState(0);
    const handleTS = (e: React.TouchEvent) => setTs(e.targetTouches[0].clientX);
    const handleTM = (e: React.TouchEvent) => setTe(e.targetTouches[0].clientX);
    const handleTE = () => {
        if (!ts || !te) return;
        if (ts - te > 50) next();
        if (ts - te < -50) prev();
        setTs(0); setTe(0);
    };
    const next = () => { if (viewPhotoIndex !== null && viewPhotoIndex < photos.length - 1) setViewPhotoIndex(viewPhotoIndex + 1); };
    const prev = () => { if (viewPhotoIndex !== null && viewPhotoIndex > 0) setViewPhotoIndex(viewPhotoIndex - 1); };

    return (
        <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col animate-in slide-in-from-bottom-10 fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-6 bg-slate-900 border-b border-slate-800 shadow-xl z-10">
                <div className="flex items-center gap-4">
                    <h2 className="text-3xl font-bold text-white flex items-center gap-3"><ImageIcon className="text-purple-400" /> Galerie</h2>
                    <span className="bg-slate-800 text-slate-400 px-3 py-1 rounded-full text-xs font-mono">{photos.length} fotek</span>
                </div>
                <div className="flex gap-4">
                    {selectedIds.length > 0 && (
                        <>
                            <button onClick={onDelete} className="bg-red-900/50 text-red-200 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-red-900 transition-colors"><Trash2 size={20} /> Smazat ({selectedIds.length})</button>
                            <button onClick={onPrint} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20"><Printer size={20} /> Tisk ({selectedIds.length})</button>
                            <button onClick={onEmail} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/20"><Mail size={20} /> Email ({selectedIds.length})</button>
                        </>
                    )}
                    <button onClick={onClose} className="bg-slate-800 text-white p-3 rounded-full hover:bg-slate-700 transition-colors"><X size={28} /></button>
                </div>
            </div>

            {/* LIGHTBOX */}
            {viewPhotoIndex !== null && photos[viewPhotoIndex] && (
                <div
                    className="fixed inset-0 z-[60] bg-black flex items-center justify-center animate-in fade-in duration-200"
                    onTouchStart={handleTS} onTouchMove={handleTM} onTouchEnd={handleTE}
                >
                    <img src={photos[viewPhotoIndex].url} className="max-w-full max-h-full object-contain select-none" draggable={false} />

                    {/* Controls */}
                    <button onClick={() => setViewPhotoIndex(null)} className="absolute top-6 right-6 text-white/50 hover:text-white p-4 bg-black/50 rounded-full hover:bg-black/80"><X size={32} /></button>

                    {viewPhotoIndex > 0 && (
                        <button onClick={prev} className="absolute left-6 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-4 bg-black/50 rounded-full hover:bg-black/80"><ArrowLeft size={48} /></button>
                    )}
                    {viewPhotoIndex < photos.length - 1 && (
                        <button onClick={next} className="absolute right-6 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-4 bg-black/50 rounded-full hover:bg-black/80"><ArrowRight size={48} /></button>
                    )}
                </div>
            )}

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {photos.map((p: any, idx: number) => (
                    <div key={p.id} onClick={() => setViewPhotoIndex(idx)} className={`relative w-full pb-[66.66%] bg-slate-900 rounded-xl overflow-hidden group transition-all duration-200 border border-slate-800 hover:shadow-xl hover:scale-[1.02] cursor-pointer ${selectedIds.includes(p.id) ? 'ring-4 ring-indigo-500 scale-[1.02]' : ''}`}>
                        {/* Image - absolute to fill the aspect-ratio container */}
                        <img src={p.url} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />

                        {/* Top-Right Checkbox */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggle(p.id); }}
                            className={`absolute top-2 right-2 p-2 rounded-full transition-all z-20 hover:scale-110 ${selectedIds.includes(p.id) ? 'bg-indigo-600 text-white shadow-lg' : 'bg-black/30 text-white/80 hover:bg-black/60 hover:text-white'}`}
                        >
                            {selectedIds.includes(p.id) ? <CheckCircle2 size={28} /> : <div className="w-7 h-7 rounded-full border-2 border-white/90" />}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default function KioskPage() {
    const [status, setStatus] = useState<'idle' | 'countdown' | 'processing' | 'review'>('idle');
    // const [countdown, setCountdown] = useState(0); // REMOVED LEGACY LOCAL STATE
    const lastBeepRef = useRef<number | null>(null);

    const playBeep = (type: 'tick' | 'final') => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === 'final') {
                osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch (A5)
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.5);
            } else {
                osc.frequency.setValueAtTime(600, ctx.currentTime); // Mid pitch
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.1);
            }
        } catch (e) { /* Audio context blocked or error */ }
    };
    const [lastPhoto, setLastPhoto] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showGallery, setShowGallery] = useState(false);
    const [galleryPhotos, setGalleryPhotos] = useState<any[]>([]);
    const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailInput, setEmailInput] = useState('');
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Settings & Admin
    const [showSettings, setShowSettings] = useState(false);
    const [activeTab, setActiveTab] = useState('user');
    const [sessionSettings, setSessionSettings] = useState({
        localPhotoPath: 'C:\\Fotos',
        commandPort: 5513,
        selectedBg: null as string | null,
        chromaKeyColor: '#00FF00',
        chromaTolerance: 100,
        isBW: false,
        selectedSticker: null as string | null,
        email: '',
        printWidth: 148, // mm (Canon Postcard standard)
        printHeight: 100, // mm
        smtp: { host: '', port: '', user: '', pass: '' }
    });

    // ... (rest of the file until printSelected)

    const printSelected = async () => {
        // 1. Determine what to print
        let targetUrl = '';
        let targetId = '';

        if (status === 'review' && lastPhoto) {
            targetUrl = lastPhoto;
        } else if (selectedPhotoIds.length === 1) {
            targetId = selectedPhotoIds[0];
            const p = galleryPhotos.find(x => x.id === targetId);
            if (p) targetUrl = p.url;
        }

        if (!targetUrl) return;

        showToast('Příprava tisku... ✂️');

        try {
            // A) CROP IMAGE TO PRINT ASPECT RATIO
            // Load Image
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = targetUrl;
            await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });

            // Calculate Crop
            const printRatio = sessionSettings.printWidth / sessionSettings.printHeight; // e.g. 1.5
            const imgRatio = img.naturalWidth / img.naturalHeight;

            let cx = 0, cy = 0, cw = img.naturalWidth, ch = img.naturalHeight;

            // If Image is wider than Print -> Crop Sides
            if (imgRatio > printRatio) {
                cw = img.naturalHeight * printRatio;
                cx = (img.naturalWidth - cw) / 2;
            }
            // If Image is taller than Print -> Crop Top/Bottom
            else {
                ch = img.naturalWidth / printRatio;
                cy = (img.naturalHeight - ch) / 2;
            }

            // Draw to Canvas
            const canvas = document.createElement('canvas');
            canvas.width = sessionSettings.printWidth * 12; // approx 300 DPI (118 px/cm) -> 12 px/mm -> 150mm * 12 = 1800px
            canvas.height = sessionSettings.printHeight * 12; // 100mm * 12 = 1200px
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas init failed');

            // Draw Cropped
            ctx.drawImage(img, cx, cy, cw, ch, 0, 0, canvas.width, canvas.height);

            // B) UPLOAD PREPARED FILE
            canvas.toBlob(async (blob) => {
                if (!blob) throw new Error("Blob failed");
                const formData = new FormData();
                formData.append('file', blob, `print_job_${Date.now()}.jpg`);
                formData.append('type', 'PRINT');
                formData.append('isPrint', 'true'); // Tell server to keep quality

                const upRes = await fetch('/api/media/upload', { method: 'POST', body: formData });
                const upData = await upRes.json();

                if (!upData.success) throw new Error('Upload print job failed');

                // C) SEND TO PRINTER
                showToast('Tisk... 🖨️');
                const printRes = await fetch('/api/print', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: upData.filename // "print_job_..."
                    })
                });

                if (!printRes.ok) throw new Error('Print trigger failed');
                showToast('Odesláno na tiskárnu ✅');

            }, 'image/jpeg', 0.95);

        } catch (e) {
            console.error(e);
            showToast('Chyba tisku ❌');
        }
    };

    // Tech / Stream
    const [cameraIp, setCameraIp] = useState(DEFAULT_IP);
    const [activePort, setActivePort] = useState<number | null>(null);
    const [autoCmdPort, setAutoCmdPort] = useState<number | null>(null);
    const [isScanning, setIsScanning] = useState(true);
    const [failedPorts, setFailedPorts] = useState<number[]>([]);
    const [cloudStreamEnabled, setCloudStreamEnabled] = useState(true);
    const [streamStatus, setStreamStatus] = useState('offline');
    const [streamLog, setStreamLog] = useState<string[]>([]);
    const [assets, setAssets] = useState<any[]>([]);
    const [isPickingColor, setIsPickingColor] = useState(false);
    const [streamToken, setStreamToken] = useState(Date.now());

    // --- EVENT LOGIC ---
    const [events, setEvents] = useState<any[]>([]);
    const [newEventName, setNewEventName] = useState('');
    const [newEventPassword, setNewEventPassword] = useState('');

    // Tech Auth for Modal
    const [techAuth, setTechAuth] = useState(false);
    const [techPasswordInput, setTechPasswordInput] = useState('');

    const loadEvents = () => {
        fetch('/api/event')
            .then(res => res.json())
            .then(data => { if (Array.isArray(data)) setEvents(data); })
            .catch(e => console.error(e));
    };

    const activateEvent = async (id: string, name: string) => {
        try {
            await fetch('/api/event/active', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            showToast(`Aktivní: ${name} ✅`);
            loadEvents();
        } catch (e) { showToast('Chyba změny!'); }
    };

    const createEvent = async () => {
        if (!newEventName) return;
        try {
            const res = await fetch('/api/event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newEventName, password: newEventPassword, makeActive: true })
            });
            const d = await res.json();
            if (d.success) {
                showToast('Vytvořeno & Aktivní ✅');
                setNewEventName('');
                setNewEventPassword('');
                loadEvents();
            } else showToast('Chyba: ' + d.error);
        } catch (e) { showToast('Chyba vytvoření'); }
    };

    useEffect(() => {
        loadEvents();
    }, []);

    const processingRef = useRef(false);

    const showToast = (msg: string) => { setToastMessage(msg); setTimeout(() => setToastMessage(null), 3000); };
    const addLog = (msg: string) => setStreamLog(p => [msg, ...p].slice(0, 50));

    // 1. Auto-detect Command Port (API)
    useEffect(() => {
        const detectCmd = async () => {
            const candidates = [5520, 5513];
            for (const port of candidates) {
                try {
                    const controller = new AbortController();
                    setTimeout(() => controller.abort(), 500);
                    await fetch(`http://${cameraIp}:${port}/`, { mode: 'no-cors', signal: controller.signal });
                    console.log(`🔌 Nalezen Command Port: ${port}`);
                    setAutoCmdPort(port);
                    return; // Found it!
                } catch (e) { }
            }
        };
        if (typeof window !== 'undefined') detectCmd();
    }, [cameraIp]);

    useEffect(() => {
        let mounted = true;

        // Load Settings
        const savedCmdPort = localStorage.getItem('tech_cmd_port');
        const savedPath = localStorage.getItem('tech_photo_path');
        if (savedCmdPort) setSessionSettings(s => ({ ...s, commandPort: parseInt(savedCmdPort) }));
        if (savedPath) setSessionSettings(s => ({ ...s, localPhotoPath: savedPath }));

        // Load Server Settings (SMTP)
        fetch('/api/settings').then(r => r.json()).then(data => {
            if (data.smtp_config) {
                setSessionSettings(s => ({ ...s, smtp: data.smtp_config }));
            }
        }).catch(e => console.error(e));

        const resetInterval = setInterval(() => setFailedPorts([]), 30000);

        const scanPorts = async () => {
            if (!mounted) return;
            setIsScanning(true);

            // Prioritize Bridge (5555), then others
            const candidates = [5555, 5514, 5521, 5520, 5513].filter(p => !failedPorts.includes(p));

            if (candidates.length === 0 || failedPorts.length > 0) {
                try {
                    fetch(`http://${DEFAULT_IP}:5520/?cmd=LiveView_Show`, { mode: 'no-cors' }).catch(() => { });
                    fetch(`http://${DEFAULT_IP}:5513/?cmd=LiveView_Show`, { mode: 'no-cors' }).catch(() => { });
                } catch (e) { }

                setFailedPorts([]);
                setTimeout(scanPorts, 1000);
                return;
            }

            for (const port of candidates) {
                if (!mounted) return;
                try {
                    const controller = new AbortController();
                    const id = setTimeout(() => controller.abort(), 1000);

                    let path = '/liveview.jpg';
                    if (port === 5555) path = '/stream.mjpg';
                    else if (port === 5521 || port === 5514) path = '/live';

                    // For MJPEG streams (5555), fetching body can hang. 
                    // But for initial check we just need response headers or connection success.
                    const url = `http://${DEFAULT_IP}:${port}${path}`;
                    await fetch(url, { method: 'GET', signal: controller.signal, mode: 'no-cors' });

                    clearTimeout(id);
                    if (mounted) { setActivePort(port); setIsScanning(false); return; }
                } catch (e) { }
            }
            if (mounted) setTimeout(scanPorts, 2000);
        };
        scanPorts();
        return () => { mounted = false; clearInterval(resetInterval); };
    }, [failedPorts]);

    // Stream URLs
    const getDisplayUrl = () => {
        const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        if (isLocal && activePort) {
            let path = '/liveview.jpg';
            if (activePort === 5555) path = '/stream.mjpg';
            else if (activePort === 5521 || activePort === 5514) path = '/live';

            // Append token to force browser to re-connect to stream
            return `http://${cameraIp}:${activePort}${path}?t=${streamToken}`;
        }
        return `/api/stream/snapshot?t=${Date.now()}`;
    };
    const [cloudTick, setCloudTick] = useState(0);
    useEffect(() => {
        const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        if (!isLocal) { const i = setInterval(() => setCloudTick(Date.now()), 200); return () => clearInterval(i); }
    }, []);

    // Auto-restart LiveView when returning to idle
    useEffect(() => {
        if (status === 'idle') {
            const t = setTimeout(() => {
                // If stream is offline or stuck, try to kick it
                if (streamStatus !== 'live') restartLiveView();
            }, 500);
            return () => clearTimeout(t);
        }
    }, [status]);
    const finalStreamUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? `/api/stream/snapshot?t=${cloudTick}` : getDisplayUrl();

    // Stream Status (Bridge now handles cloud upload)
    useEffect(() => {
        const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

        if (isLocal && activePort) {
            setStreamStatus('live');
            addLog('Stream aktivní (Bridge uploaduje na cloud)');
        } else if (!isLocal) {
            // On cloud, we just receive - no status tracking needed
            setStreamStatus('cloud');
        } else {
            setStreamStatus('offline');
        }
    }, [activePort]);

    // Data Poll
    const lastProcessedIdRef = useRef<string | null>(null);
    const isFirstPoll = useRef(true);

    // Sync Settings to Server (Debounced)
    // Sync Photo Path (Debounced)
    useEffect(() => {
        const t = setTimeout(() => {
            if (sessionSettings.localPhotoPath) {
                fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'photo_path', value: sessionSettings.localPhotoPath })
                }).catch(e => console.error("Path sync failed", e));
            }
        }, 1000);
        return () => clearTimeout(t);
    }, [sessionSettings.localPhotoPath]);

    // Sync SMTP Config (Debounced)
    useEffect(() => {
        const t = setTimeout(() => {
            if (sessionSettings.smtp) {
                fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ smtp_config: sessionSettings.smtp })
                }).catch(e => console.error("SMTP sync failed", e));
            }
        }, 1000);
        return () => clearTimeout(t);
    }, [sessionSettings.smtp]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedIp = localStorage.getItem('camera_ip'); if (savedIp) setCameraIp(savedIp);
            fetch('/api/assets').then(res => res.json()).then(data => { if (Array.isArray(data)) setAssets(data); });
        }
        fetch('/api/session', { method: 'POST', body: JSON.stringify({ id: SESSION_ID }) }).catch(console.error);
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/poll?sessionId=${SESSION_ID}`); const data = await res.json();

                // Remote trigger
                if (data.pending && status === 'idle' && !processingRef.current) startCountdown();

                // New photo detection
                if (data.latest && data.latest.id) {

                    // FIRST RUN CHECK: Don't process what was already there on reload
                    if (isFirstPoll.current) {
                        lastProcessedIdRef.current = data.latest.id;
                        isFirstPoll.current = false;
                        console.log("ℹ️ Initial Poll: Synced ID, skipping process.");
                        return;
                    }

                    if (data.latest.id !== lastProcessedIdRef.current) {
                        // IGNORE self-generated web photos or temporary files
                        if (data.latest.url.includes('/photos/web_') || data.latest.url.includes('edited_') || data.latest.url.includes('print_')) {
                            // Mark as seen so we don't re-check constanty
                            if (lastProcessedIdRef.current !== data.latest.id) {
                                lastProcessedIdRef.current = data.latest.id;
                            }
                            return;
                        }

                        console.log("🔍 Poll detected new ID:", data.latest.id, "URL:", data.latest.url, "Status:", status);
                        lastProcessedIdRef.current = data.latest.id; // Mark as seen immediately

                        // 2. If it's a new ORIGINAL photo, process it (unless we are already reviewing one).
                        if (status === 'idle' || status === 'countdown' || status === 'processing') {
                            console.log("⚡ Auto-processing new photo...");
                            processNewPhoto(data.latest.url);
                        } else {
                            console.log("⚠️ Photo received but ignored (App is busy/reviewing).");
                        }
                    }
                }
            } catch (e) { }
        }, 1000);
        return () => clearInterval(interval);
    }, [status, sessionSettings]);

    // --- COUNTDOWN SYNC LOGIC ---
    const [countdownValue, setCountdownValue] = useState<number | null>(null);

    useEffect(() => {
        if (!activePort || status === 'review') return;

        const interval = setInterval(async () => {
            // Only poll status if we are local (connected to Bridge)
            try {
                const res = await fetch(`http://${cameraIp}:5555/status`);
                const data = await res.json();

                if (data.countdownTarget > 0) {
                    const remaining = Math.ceil((data.countdownTarget - data.now) / 1000);
                    if (remaining > 0) {
                        // Only force status if not already processing
                        if (status !== 'processing') setStatus('countdown');
                        setCountdownValue(remaining);

                        // Audio Feedback
                        if (remaining !== lastBeepRef.current) {
                            if (remaining === 3 || remaining === 2) playBeep('tick');
                            if (remaining === 1) playBeep('final');
                            lastBeepRef.current = remaining;
                        }
                    } else {
                        lastBeepRef.current = null;
                        setCountdownValue(null);
                    }
                } else {
                    setCountdownValue(null);
                    // Reset only if we were previously counting down
                    if (status === 'countdown') setStatus('idle');
                }
            } catch (e) { }
        }, 200);
        return () => clearInterval(interval);
    }, [activePort, cameraIp, status]);

    // Process Photo with Effects
    const processNewPhoto = async (originalUrl: string) => {
        // DOUBLE CHECK: Do not process already processed photos to prevent loops
        if (originalUrl.includes('/photos/web_') || originalUrl.includes('edited_') || originalUrl.includes('print_')) {
            console.log("🛑 Prevented processing of self-generated photo:", originalUrl);
            return;
        }

        // Prevent concurrent processing
        if (isUploading) return;

        // 1. Immediate Feedback
        setStatus('review');
        processingRef.current = false; // Release the capture lock immediately so timeout doesn't kill us

        console.log("🎨 Processing:", originalUrl);

        // If Green Screen is used, we might want to show "Processing" briefly instead of the raw green photo
        // But for now, let's show original to be fast, and replace it when processed.
        setLastPhoto(originalUrl);
        setIsUploading(true);

        try {
            // Load Original
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = originalUrl;
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });

            // Setup Canvas
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 2000;
            const scale = Math.min(1, MAX_WIDTH / img.naturalWidth);
            const w = Math.floor(img.naturalWidth * scale);
            const h = Math.floor(img.naturalHeight * scale);
            canvas.width = w;
            canvas.height = h;

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) throw new Error("No Canvas Context");

            // --- 1. BACKGROUND (If Chroma Key is Active) ---
            let bgImg: HTMLImageElement | null = null;
            if (sessionSettings.selectedBg) {
                try {
                    bgImg = new Image();
                    bgImg.crossOrigin = "Anonymous";
                    bgImg.src = sessionSettings.selectedBg;
                    await new Promise(r => { bgImg!.onload = r; bgImg!.onerror = () => r(null); });
                    if (bgImg) {
                        // Draw BG scaled to cover
                        const ratio = Math.max(w / bgImg.naturalWidth, h / bgImg.naturalHeight);
                        const bw = bgImg.naturalWidth * ratio;
                        const bh = bgImg.naturalHeight * ratio;
                        const bx = (w - bw) / 2;
                        const by = (h - bh) / 2;
                        ctx.drawImage(bgImg, bx, by, bw, bh);
                    }
                } catch (e) { console.warn("BG Load Failed", e); }
            }

            // --- 2. DRAW IMAGE (or apply chroma) ---
            if (sessionSettings.selectedBg && sessionSettings.chromaKeyColor) {
                // Create temp canvas for the photo to perform pixel manipulation
                const tempC = document.createElement('canvas');
                tempC.width = w; tempC.height = h;
                const tempCtx = tempC.getContext('2d', { willReadFrequently: true });
                if (tempCtx) {
                    tempCtx.drawImage(img, 0, 0, w, h);
                    const frameData = tempCtx.getImageData(0, 0, w, h);
                    const l = frameData.data.length;
                    // Parse Key Color
                    const keyColor = sessionSettings.chromaKeyColor;
                    const targetR = parseInt(keyColor.slice(1, 3), 16);
                    const targetG = parseInt(keyColor.slice(3, 5), 16);
                    const targetB = parseInt(keyColor.slice(5, 7), 16);
                    const tol = sessionSettings.chromaTolerance;

                    for (let i = 0; i < l; i += 4) {
                        const r = frameData.data[i];
                        const g = frameData.data[i + 1];
                        const b = frameData.data[i + 2];
                        // Simple Euclidean distance
                        const dist = Math.sqrt((r - targetR) ** 2 + (g - targetG) ** 2 + (b - targetB) ** 2);
                        if (dist < tol) {
                            frameData.data[i + 3] = 0; // Transparent
                        }
                    }
                    tempCtx.putImageData(frameData, 0, 0);
                    // Draw processed photo over background
                    ctx.drawImage(tempC, 0, 0);
                }
            } else {
                // No Green Screen - Just draw photo
                ctx.drawImage(img, 0, 0, w, h);
            }

            // --- 3. BW FILTER ---
            if (sessionSettings.isBW) {
                const imgData = ctx.getImageData(0, 0, w, h);
                const d = imgData.data;
                for (let i = 0; i < d.length; i += 4) {
                    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                    d[i] = gray; d[i + 1] = gray; d[i + 2] = gray;
                }
                ctx.putImageData(imgData, 0, 0);
            }

            // --- 4. STICKER ---
            if (sessionSettings.selectedSticker) {
                try {
                    const sticker = new Image();
                    sticker.crossOrigin = "Anonymous";
                    sticker.src = sessionSettings.selectedSticker;
                    await new Promise(r => { sticker.onload = r; sticker.onerror = () => r(null); });

                    // Sticker Logic (Corners or Center)
                    const sW = w * 0.3; // 30% width
                    const sH = sticker.naturalHeight * (sW / sticker.naturalWidth);
                    const pad = w * 0.05;

                    let sX = w - sW - pad; // default BR
                    let sY = h - sH - pad;

                    // Simple positioning logic based on state (can be expanded)
                    // default is BR (bottom-right)

                    ctx.drawImage(sticker, sX, sY, sW, sH);
                } catch (e) { console.warn("Sticker error", e); }
            }

            // --- EXPORT & UPLOAD ---
            canvas.toBlob(async (blob) => {
                if (!blob) throw new Error("Canvas Blob failed");
                const previewUrl = URL.createObjectURL(blob);
                setLastPhoto(previewUrl);
                setStatus('review'); // Show photo immediately

                // Upload
                const formData = new FormData();
                formData.append('file', blob, `edited_${Date.now()}.jpg`);
                formData.append('type', 'PHOTO');

                const uploadRes = await fetch('/api/media/upload', { method: 'POST', body: formData });
                const uploadData = await uploadRes.json();

                if (uploadData.success && uploadData.url) {
                    addLog('✅ Uloženo & Upraveno');
                    setLastPhoto(uploadData.url);
                } else {
                    addLog('❌ Chyba uploadu');
                }
                setIsUploading(false);

                // Auto-return to Live View after 2 seconds
                setTimeout(() => {
                    setLastPhoto(null);
                    setStatus('idle');
                }, 2000);

                // Refresh gallery data silently (no open)
                openGallery().then(() => setShowGallery(false));

            }, 'image/jpeg', 0.90);

        } catch (e) {
            console.error("Processing Error:", e);
            setIsUploading(false);
            showToast('Chyba zpracování');
        }
    };

    // Actions
    const handlePreviewClick = (e: React.MouseEvent<HTMLImageElement>) => {
        if (!isPickingColor) return;
        const img = e.currentTarget; const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight; const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.drawImage(img, 0, 0); const rect = img.getBoundingClientRect(); const x = (e.clientX - rect.left) * (img.naturalWidth / rect.width); const y = (e.clientY - rect.top) * (img.naturalHeight / rect.height); const p = ctx.getImageData(x, y, 1, 1).data;
        const hex = "#" + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase(); setSessionSettings({ ...sessionSettings, chromaKeyColor: hex }); setIsPickingColor(false); showToast(`Barva: ${hex}`);
    };
    // Unified Countdown: Trigger server with delay
    const startCountdown = () => {
        if (processingRef.current) return;
        takePhoto(3000);
    };

    const takePhoto = async (delay = 0) => {
        // We do NOT set status here. We rely on polling /status from Bridge.
        // This prevents conflicting states (local vs server).

        try {
            // Use Bridge Server (Port 5555) for synchronized shooting
            // Even if camera is on another port, Bridge handles it.
            const url = `http://${cameraIp}:5555/shoot`;

            console.log(`📸 Sending Trigger to Bridge: ${url} (Delay: ${delay}ms)`);

            // Send trigger with optional delay
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ delay })
            }).catch(e => console.error("Trigger Failed", e));

        } catch (e) {
            console.error("Camera Error:", e);
            showToast('Chyba komunikace');
        }
    };

    const restartLiveView = async () => {
        // ALWAYS send wake up command to DCC, even if we are on Bridge (5555)
        // Bridge (5555) does NOT handle ?cmd=LiveView_Show, only DCC (5513/5520) does.
        const dccPort = autoCmdPort || 5520;

        try {
            fetch(`http://${cameraIp}:${dccPort}/?cmd=LiveView_Show`, { mode: 'no-cors' }).catch(e => { });
            if (dccPort !== 5513) fetch(`http://${cameraIp}:5513/?cmd=LiveView_Show`, { mode: 'no-cors' }).catch(e => { });

            // If active port is NOT bridge, try sending there too just in case
            if (activePort && activePort !== 5555) {
                fetch(`http://${cameraIp}:${activePort}/?cmd=LiveView_Show`, { mode: 'no-cors' }).catch(e => { });
            }

            // 2. Clear failure logs
            setFailedPorts([]);

            // 3. Reset scanning logic ONLY if we don't have an active port
            if (!activePort) {
                setIsScanning(true);
            }
            setStreamStatus('live');
            setStreamToken(Date.now()); // Force reload of image tag

        } catch (e) {
            // Silent fail
        }
    };

    // --- GALLERY LOGIC START ---
    const openGallery = async () => {
        setShowGallery(true); setSelectedPhotoIds([]);
        try { const res = await fetch('/api/media/list'); const data = await res.json(); if (Array.isArray(data)) setGalleryPhotos(data); } catch (e) { }
    };
    const toggleSelection = (id: string) => {
        setSelectedPhotoIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };
    const bulkDelete = async () => {
        if (!confirm('Opravdu chcete smazat vybrané fotky?')) return;
        try {
            await fetch('/api/media/delete', { method: 'POST', body: JSON.stringify({ ids: selectedPhotoIds }) });
            setGalleryPhotos(prev => prev.filter(p => !selectedPhotoIds.includes(p.id))); setSelectedPhotoIds([]); showToast('Smazáno 🗑️');
        } catch (e) { showToast('Chyba mazání'); }
    };

    const updateSmtp = (key: string, val: string) => {
        setSessionSettings(prev => {
            const next = { ...prev, smtp: { ...prev.smtp, [key]: val } };
            return next;
        });
    };

    const bulkEmail = async () => {
        if (selectedPhotoIds.length > 3) { showToast('Max 3 fotky!'); return; }
        setShowEmailModal(true); // Open Modal with context
    };
    const sendEmail = async () => {
        if (!emailInput.includes('@')) { showToast('Email?'); return; }
        showToast('Odesílám...');
        // Find URLs for selected IDs
        let urlsToSend: string[] = [];
        // If we are reviewing a single photo (status=review), use that
        if (status === 'review' && lastPhoto) urlsToSend = [lastPhoto];
        else urlsToSend = galleryPhotos.filter(p => selectedPhotoIds.includes(p.id)).map(p => p.url);

        try { await fetch('/api/email', { method: 'POST', body: JSON.stringify({ email: emailInput, photoUrls: urlsToSend }) }); showToast('ODESLÁNO ✅'); setShowEmailModal(false); } catch (e) { showToast('Chyba odeslání ❌'); }
    };

    // --- GALLERY LOGIC END ---

    // Environment Check
    const [isLocal, setIsLocal] = useState(true);

    useEffect(() => {
        const h = window.location.hostname;
        const check = typeof window !== 'undefined' && (h === 'localhost' || h === '127.0.0.1');
        console.log(`[ENV] Hostname: ${h}, isLocal: ${check}`);
        setIsLocal(check);
        if (!check) {
            setIsScanning(false);
            setActivePort(null);
            setCloudStreamEnabled(false);
        }
    }, []);

    // ... (existing code)

    return (
        <div className="relative w-full h-full bg-slate-950 overflow-hidden flex flex-col items-center justify-center select-none">
            {/* Debug / Cloud Indicator */}
            {!isLocal && <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600/50 px-3 py-1 rounded-full text-[10px] font-bold text-white z-[60] backdrop-blur-sm pointer-events-none">☁️ CLOUD VIEW</div>}

            {/* Layers */}
            <div className="absolute inset-0 bg-black flex items-center justify-center">
                {status === 'processing' ? <div className="text-white flex flex-col items-center animate-pulse"><RefreshCw className="animate-spin mb-4" size={48} /><span className="text-2xl font-bold">Zpracovávám...</span></div>
                    : status === 'review' && lastPhoto ? <img src={lastPhoto} className="w-full h-full object-contain bg-slate-900" />
                        : <div className="w-full h-full relative flex items-center justify-center"><LiveView streamUrl={finalStreamUrl} isBW={sessionSettings.isBW} isScanning={isScanning} error={isLocal && !isScanning && !activePort} className="w-full h-full object-contain" onRestart={restartLiveView} onStreamError={() => { console.warn("Stream drop, retrying..."); setStreamToken(Date.now()); }} printWidth={sessionSettings.printWidth} printHeight={sessionSettings.printHeight} /></div>}
            </div>

            {/* Legacy Overlay Removed */}

            {/* SETTINGS MODAL */}
            {showSettings && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in zoom-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-0 max-w-6xl w-full shadow-2xl text-white h-[90vh] flex flex-col overflow-hidden">

                        {/* HEADER */}
                        <div className="flex bg-slate-950 border-b border-slate-800 p-6 justify-between items-center">
                            <h2 className="text-2xl font-bold flex items-center gap-3"><Settings size={28} /> Nastavení</h2>
                            <div className="flex bg-slate-800 rounded-full p-1 border border-slate-700">
                                <button onClick={() => setActiveTab('user')} className={`px-6 py-2 rounded-full font-bold flex gap-2 transition-all ${activeTab === 'user' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>
                                    <Calendar size={16} /> Událost
                                </button>
                                <button onClick={() => setActiveTab('admin')} className={`px-6 py-2 rounded-full font-bold flex gap-2 transition-all ${activeTab === 'admin' ? 'bg-red-900/40 text-red-300' : 'text-slate-400 hover:text-white'}`}>
                                    <Shield size={16} /> Technické
                                </button>
                            </div>
                            <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={24} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 bg-slate-900">

                            {/* === EVENT TAB (USER) === */}
                            {activeTab === 'user' && (
                                <div className="space-y-8">
                                    {/* 1. EVENT MANAGER */}
                                    <div className="p-6 bg-slate-950 border border-indigo-500/30 rounded-2xl shadow-lg">
                                        <h3 className="text-xl font-bold text-indigo-400 mb-4 flex items-center gap-2"><Calendar /> Správa Události</h3>

                                        {/* Create */}
                                        <div className="flex gap-4 mb-6">
                                            <input
                                                type="text"
                                                value={newEventName}
                                                onChange={(e) => setNewEventName(e.target.value)}
                                                placeholder="Nová akce (např. Svatba Jana)"
                                                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-4 text-lg focus:border-indigo-500 outline-none"
                                            />
                                            <button onClick={createEvent} className="bg-indigo-600 hover:bg-indigo-500 px-8 rounded-xl font-bold text-lg shadow-lg">Vytvořit</button>
                                        </div>

                                        {/* List */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-48 overflow-y-auto p-2">
                                            {events.map((ev: any) => (
                                                <div key={ev.id} className={`p-3 rounded-lg border flex justify-between items-center ${ev.isActive ? 'bg-indigo-900/40 border-indigo-500' : 'bg-slate-900 border-slate-800'}`}>
                                                    <div className="truncate pr-2">
                                                        <div className="font-bold text-sm">{ev.name}</div>
                                                        <div className="text-[10px] text-slate-500 truncate">{ev.slug}</div>
                                                    </div>
                                                    {ev.isActive ?
                                                        <span className="text-indigo-400 text-xs font-bold whitespace-nowrap">✅ Aktivní</span> :
                                                        <button onClick={() => activateEvent(ev.id, ev.name)} className="bg-slate-800 hover:bg-slate-700 text-xs px-3 py-1.5 rounded border border-slate-700">Aktivovat</button>
                                                    }
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 2. GRAPHICS (Existing Logic) */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl">
                                                <h3 className="font-semibold mb-4 text-green-400 flex items-center gap-2"><Pipette size={18} /> Green Screen</h3>
                                                <div className="mb-4 relative rounded-lg overflow-hidden border border-slate-600 bg-black aspect-video group">
                                                    <LiveView streamUrl={finalStreamUrl} isBW={sessionSettings.isBW} onClick={handlePreviewClick} className={`w-full h-full object-cover ${isPickingColor ? 'cursor-crosshair' : ''}`} printWidth={sessionSettings.printWidth} printHeight={sessionSettings.printHeight} />
                                                    {isPickingColor && <div className="absolute inset-0 bg-green-500/20 pointer-events-none flex items-center justify-center text-green-300 font-bold border-4 border-green-500 animate-pulse">KLIKNI KAMKOLIV</div>}
                                                    <div className="absolute bottom-2 right-2"><button onClick={() => setIsPickingColor(!isPickingColor)} className={`p-2 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold ${isPickingColor ? 'bg-green-500 text-black' : 'bg-white text-black'}`}><MousePointer2 size={16} /> Kapátko</button></div>
                                                </div>
                                                <div className="flex items-center justify-between"><span>Tolerance</span><input type="range" min="10" max="250" value={sessionSettings.chromaTolerance} onChange={e => setSessionSettings({ ...sessionSettings, chromaTolerance: Number(e.target.value) })} className="w-32 accent-green-500 h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer" /></div>
                                            </div>
                                            <div className="p-5 bg-slate-800 border-slate-700 border rounded-xl flex justify-between items-center"><span className="font-semibold">Černobíle</span><div onClick={() => setSessionSettings(s => ({ ...s, isBW: !s.isBW }))} className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-colors ${sessionSettings.isBW ? 'bg-indigo-600' : 'bg-slate-700'}`}><div className={`w-6 h-6 bg-white rounded-full transition-transform ${sessionSettings.isBW ? 'translate-x-6' : ''}`}></div></div></div>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl"><h3 className="font-semibold mb-4 text-purple-400">🖼️ Pozadí</h3><div className="grid grid-cols-3 gap-2"><div onClick={() => setSessionSettings({ ...sessionSettings, selectedBg: null })} className={`aspect-video bg-slate-900 border-2 rounded cursor-pointer flex items-center justify-center text-xs ${sessionSettings.selectedBg === null ? 'border-purple-500' : 'border-slate-700'}`}>Nic</div>{assets.filter(a => a.type === 'BACKGROUND').map(a => (<img key={a.id} src={a.url} onClick={() => setSessionSettings({ ...sessionSettings, selectedBg: a.url })} className={`w-full aspect-video object-cover rounded border-2 cursor-pointer ${sessionSettings.selectedBg === a.url ? 'border-purple-500' : 'border-slate-700'}`} />))}</div></div>
                                            <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl"><h3 className="font-semibold mb-4 text-pink-400">🦄 Samolepka</h3><div className="grid grid-cols-4 gap-2"><div onClick={() => setSessionSettings({ ...sessionSettings, selectedSticker: null })} className="aspect-square bg-slate-900 border-2 border-slate-700 rounded cursor-pointer flex items-center justify-center text-xs">Nic</div>{assets.filter(a => a.type === 'STICKER').map(a => (<img key={a.id} src={a.url} onClick={() => setSessionSettings({ ...sessionSettings, selectedSticker: a.url })} className={`w-full aspect-square object-contain bg-slate-900 rounded border-2 cursor-pointer ${sessionSettings.selectedSticker === a.url ? 'border-pink-500' : 'border-slate-700'}`} />))}</div></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* === TECH TAB (ADMIN) === */}
                            {activeTab === 'admin' && (
                                <>
                                    {!techAuth ? (
                                        <div className="flex flex-col items-center justify-center h-full space-y-6">
                                            <Lock size={64} className="text-red-500 mb-4" />
                                            <h3 className="text-2xl font-bold">Technická sekce</h3>
                                            <p className="text-slate-400">Zadejte heslo pro přístup k nastavení systému.</p>
                                            <div className="flex gap-4">
                                                <input
                                                    type="password"
                                                    autoFocus
                                                    value={techPasswordInput}
                                                    onChange={e => setTechPasswordInput(e.target.value)}
                                                    className="bg-slate-950 border border-slate-700 rounded-xl p-4 text-center text-xl outline-none focus:border-red-500 w-64"
                                                    placeholder="******"
                                                />
                                                <button
                                                    onClick={() => { if (techPasswordInput === 'Starter123') setTechAuth(true); else showToast('Špatné heslo!'); }}
                                                    className="bg-red-600 hover:bg-red-500 px-6 rounded-xl font-bold"
                                                >
                                                    Odemknout
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
                                            <div className="p-6 bg-slate-800 border border-slate-700 rounded-xl"><div className="flex justify-between mb-4"><h3 className="font-bold flex gap-2"><Cloud size={20} className="text-blue-400" /> Web Stream</h3><button onClick={() => activePort ? setCloudStreamEnabled(!cloudStreamEnabled) : showToast('Žádná kamera!')} className={`px-4 py-1 rounded text-xs font-bold ${cloudStreamEnabled ? 'bg-blue-600' : 'bg-slate-700'}`}>{cloudStreamEnabled ? 'ON' : 'OFF'}</button></div><div className="bg-black p-4 rounded text-xs font-mono h-32 overflow-y-auto border border-slate-700 text-slate-300">{streamLog.map((l, i) => <div key={i}>{l}</div>)}</div></div>
                                            <div className="p-6 bg-slate-800 border border-slate-700 rounded-xl space-y-4">
                                                <h3 className="font-bold flex gap-2"><Terminal size={20} className="text-yellow-400" /> Nastavení</h3>
                                                <div className="flex justify-between p-2 bg-slate-900 rounded border border-slate-700"><span className="text-sm">IP Kamery</span><input className="bg-transparent text-right outline-none text-yellow-400 w-32" value={cameraIp} onChange={e => { setCameraIp(e.target.value); localStorage.setItem('camera_ip', e.target.value); }} /></div>
                                                <div className="flex justify-between p-2 bg-slate-900 rounded border border-slate-700"><span className="text-sm">Port (Shoot)</span><input type="number" className="bg-transparent text-right outline-none text-yellow-400 w-20" value={sessionSettings.commandPort} onChange={e => { const v = Number(e.target.value); setSessionSettings(s => ({ ...s, commandPort: v })); localStorage.setItem('tech_cmd_port', String(v)); }} /></div>
                                                <div className="flex justify-between p-2 bg-slate-900 rounded border border-slate-700">
                                                    <span className="text-sm">Rozměr tisku (mm)</span>
                                                    <input
                                                        className="bg-transparent text-right outline-none text-yellow-400 w-32 font-mono"
                                                        defaultValue={`${sessionSettings.printWidth}x${sessionSettings.printHeight}`}
                                                        onBlur={e => {
                                                            const parts = e.target.value.toLowerCase().split('x');
                                                            if (parts.length === 2) {
                                                                const w = Number(parts[0].trim());
                                                                const h = Number(parts[1].trim());
                                                                if (!isNaN(w) && !isNaN(h)) {
                                                                    setSessionSettings(s => ({ ...s, printWidth: w, printHeight: h }));
                                                                    showToast(`Tisk: ${w}x${h}mm`);
                                                                }
                                                            }
                                                        }}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') e.currentTarget.blur();
                                                        }}
                                                        placeholder="150x100"
                                                    />
                                                </div>
                                                <button onClick={() => restartLiveView()} className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 rounded font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-colors"><RefreshCw size={16} /> Restart LiveView</button>
                                            </div>
                                            <div className="md:col-span-2 p-6 bg-slate-800 border border-slate-700 rounded-xl space-y-2"><h3 className="font-bold flex gap-2 text-green-400"><FolderOpen size={20} /> Cesta k fotkám</h3><input className="w-full bg-slate-900 p-3 rounded border border-slate-700 font-mono text-sm" value={sessionSettings.localPhotoPath} onChange={e => { setSessionSettings(s => ({ ...s, localPhotoPath: e.target.value })); localStorage.setItem('tech_photo_path', e.target.value); }} /><p className="text-xs text-slate-500">Nastavte stejnou cestu i v DigicamControl.</p></div>
                                            <div className="md:col-span-2 p-6 bg-slate-800 border border-slate-700 rounded-xl flex justify-between items-center"><span className="text-slate-300 font-bold flex gap-2"><Mail size={20} className="text-indigo-400" /> Admin Email</span><input className="bg-slate-900 p-2 rounded border border-slate-700 w-64 text-sm" placeholder="admin@fotobudka.cz" value={sessionSettings.email} onChange={e => setSessionSettings(s => ({ ...s, email: e.target.value }))} /></div>

                                            {/* SMTP CONFIGURATION */}
                                            <div className="md:col-span-2 p-6 bg-slate-800 border border-slate-700 rounded-xl space-y-4">
                                                <h3 className="font-bold flex gap-2 text-indigo-400"><Mail size={20} /> Nastavení Emailu (SMTP)</h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1"><label className="text-xs text-slate-500">SMTP Host</label><input className="w-full bg-slate-900 p-2 rounded border border-slate-700 text-sm" placeholder="smtp.gmail.com" value={sessionSettings.smtp?.host || ''} onChange={e => updateSmtp('host', e.target.value)} /></div>
                                                    <div className="space-y-1"><label className="text-xs text-slate-500">Port</label><input className="w-full bg-slate-900 p-2 rounded border border-slate-700 text-sm" placeholder="465" value={sessionSettings.smtp?.port || ''} onChange={e => updateSmtp('port', e.target.value)} /></div>
                                                    <div className="space-y-1"><label className="text-xs text-slate-500">Uživatel</label><input className="w-full bg-slate-900 p-2 rounded border border-slate-700 text-sm" placeholder="vas.email@gmail.com" value={sessionSettings.smtp?.user || ''} onChange={e => updateSmtp('user', e.target.value)} /></div>
                                                    <div className="space-y-1">
                                                        <label className="text-xs text-slate-500">Heslo</label>
                                                        <input type="password" className="w-full bg-slate-900 p-2 rounded border border-slate-700 text-sm" placeholder="16-místné heslo aplikace" value={sessionSettings.smtp?.pass || ''} onChange={e => updateSmtp('pass', e.target.value)} />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] text-slate-400">💡 <strong>Gmail:</strong> Musíte použít "Heslo aplikace" (ne vaše běžné heslo). <br />Jděte na: Google Účet {'>'} Zabezpečení {'>'} Dvoufázové ověření {'>'} Hesla aplikací.</p>
                                                </div>
                                                <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded">
                                                    <p className="text-xs text-slate-500">Změny se ukládají automaticky.</p>
                                                    <button onClick={async () => {
                                                        try {
                                                            const res = await fetch('/api/email', { method: 'POST', body: JSON.stringify({ email: sessionSettings.smtp?.user, isTest: true }) });
                                                            const d = await res.json();
                                                            if (d.success) showToast('Test OK ✅'); else showToast('Chyba: ' + d.error);
                                                        } catch (e) { showToast('Chyba spojení'); }
                                                    }} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-bold">Odeslat test</button>
                                                </div>
                                            </div>

                                            <div className="md:col-span-2 flex justify-end gap-4 p-6">
                                                <button onClick={() => window.close()} className="px-6 py-2 bg-red-900/50 hover:bg-red-900 text-red-200 rounded font-bold transition-colors">Zavřít Aplikaci</button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* DOCK */}
            <div className="absolute top-6 left-6 z-50"><Link href="/" className="p-4 bg-white/10 text-white rounded-full backdrop-blur-md hover:bg-white/20 hover:scale-105 transition-all shadow-lg"><Home size={28} /></Link></div>

            {/* ACTION BUTTON (Edit Last Photo) */}
            {status === 'review' && lastPhoto && (
                <div className="absolute top-6 right-6 z-50 animate-in fade-in slide-in-from-top-4">
                    <button onClick={() => processNewPhoto(lastPhoto)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-full font-bold shadow-2xl transition-transform active:scale-95 text-lg"><Wand2 size={24} /> Upravit Fotku</button>
                </div>
            )}

            {/* MAIN CONTROLS */}
            <div className="absolute bottom-12 z-30 w-full flex justify-center p-4">
                <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-full p-4 flex items-center shadow-2xl scale-125 origin-bottom">
                    <div className="flex gap-6 px-4 border-r border-white/10 pr-6">
                        <button className="flex flex-col items-center gap-1 text-white opacity-80 hover:scale-110 transition-all text-[10px] uppercase font-bold tracking-widest hover:text-blue-400" onClick={() => setShowSettings(true)}><Settings size={24} /> <span>Nastavení</span></button>
                        <button className="flex flex-col items-center gap-1 text-white opacity-80 hover:scale-110 transition-all text-[10px] uppercase font-bold tracking-widest hover:text-purple-400" onClick={openGallery}><ImageIcon size={24} /> <span>Galerie</span></button>
                    </div>
                    <div className="mx-8 relative">
                        {status === 'review' ? (
                            <button className="w-24 h-24 rounded-full border-4 border-red-500 flex items-center justify-center bg-red-500/20 hover:scale-105 transition-all shadow-red-900/50 shadow-lg" onClick={() => { setStatus('idle'); setLastPhoto(null); setTimeout(restartLiveView, 100); }}><RefreshCw size={40} color="#fff" /></button>
                        ) : (
                            <button className="w-28 h-28 rounded-full border-[6px] border-white flex items-center justify-center bg-white/10 hover:bg-white/30 transition-all active:scale-95 shadow-lg shadow-white/10" onClick={startCountdown} disabled={status !== 'idle'}><div className="w-20 h-20 bg-white rounded-full shadow-inner"></div></button>
                        )}
                    </div>
                    <div className="flex gap-6 px-4 border-l border-white/10 pl-6">
                        <button
                            className={`flex flex-col items-center gap-1 transition-all text-[10px] uppercase font-bold tracking-widest ${status === 'review' ? 'text-white opacity-80 hover:scale-110 hover:text-green-400' : 'text-slate-500 cursor-not-allowed'}`}
                            disabled={status !== 'review'}
                            onClick={printSelected}
                        >
                            {isUploading ? <RefreshCw className="animate-spin" size={24} /> : <Printer size={24} />}
                            <span>{isUploading ? 'Ukládám' : 'Tisk'}</span>
                        </button>

                        <button
                            className={`flex flex-col items-center gap-1 transition-all text-[10px] uppercase font-bold tracking-widest ${status === 'review' ? 'text-white opacity-80 hover:scale-110 hover:text-yellow-400' : 'text-slate-500 cursor-not-allowed'}`}
                            disabled={status !== 'review'}
                            onClick={() => setShowEmailModal(true)}
                        >
                            {isUploading ? <RefreshCw className="animate-spin" size={24} /> : <Mail size={24} />}
                            <span>{isUploading ? 'Ukládám' : 'Email'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {toastMessage && <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[60] bg-indigo-600/90 backdrop-blur shadow-2xl text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 animate-in slide-in-from-top-4 fade-in"><div className="w-2 h-2 bg-white rounded-full animate-ping"></div> {toastMessage}</div>}

            {/* COUNTDOWN OVERLAY */}
            {countdownValue !== null && (
                <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="text-[20rem] font-black text-white drop-shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-bounce leading-none">
                        {countdownValue}
                    </div>
                </div>
            )}

            {/* NEW GALLERY MODAL */}
            {showGallery && (
                <GalleryGrid
                    photos={galleryPhotos}
                    selectedIds={selectedPhotoIds}
                    onToggle={toggleSelection}
                    onDelete={bulkDelete}
                    onPrint={printSelected}
                    onEmail={bulkEmail}
                    onClose={() => setShowGallery(false)}
                />
            )}

            {/* EMAIL MODAL */}
            {showEmailModal && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in">
                    <div className="bg-slate-900 p-10 rounded-3xl w-full max-w-lg space-y-6 shadow-2xl border border-slate-700">
                        <h3 className="text-2xl font-bold text-white text-center">
                            {selectedPhotoIds.length > 0 ? `Odeslat ${selectedPhotoIds.length} fotek emailem` : 'Odeslat fotku emailem'}
                        </h3>
                        <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="vas@email.cz" className="w-full p-5 rounded-xl bg-slate-950 border border-slate-600 text-white focus:border-indigo-500 outline-none text-lg text-center" autoFocus />
                        <button onClick={sendEmail} className="w-full bg-indigo-600 hover:bg-indigo-500 p-5 rounded-xl text-white font-bold text-xl transition-all shadow-lg shadow-indigo-900/50">Odeslat 🚀</button>
                        <button onClick={() => setShowEmailModal(false)} className="w-full text-slate-400 hover:text-white p-2">Zrušit</button>
                    </div>
                </div>
            )}
        </div>
    );
}
