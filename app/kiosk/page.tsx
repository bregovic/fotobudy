'use client';
import { useState, useEffect, useRef, memo } from 'react';
import { Image as ImageIcon, Printer, Settings, Mail, RefreshCw, X, AlertTriangle, Send, Trash2, CameraOff, Home, Palette, Pipette, MousePointer2, Wand2, Layout } from 'lucide-react';
import Link from 'next/link';

const SESSION_ID = 'main';
const DEFAULT_IP = '127.0.0.1';

// --- OPTIMIZED LIVE VIEW COMPONENT ---
// Tímto oddělením zabráníme překreslování celé stránky při každém snímku
const LiveView = memo(({
    useCloudStream,
    cameraIp,
    isBW,
    isConfigured,
    onClick,
    className
}: {
    useCloudStream: boolean,
    cameraIp: string,
    isBW: boolean,
    isConfigured: boolean,
    onClick?: (e: React.MouseEvent<HTMLImageElement>) => void,
    className?: string
}) => {
    const [tick, setTick] = useState(Date.now());
    const streamUrl = !isConfigured ? '' : (useCloudStream ? `/api/stream/snapshot?t=${tick}` : `http://${cameraIp}:5521/live`);

    return (
        <img
            src={streamUrl}
            className={`${className} ${isBW ? 'grayscale' : ''}`}
            crossOrigin="anonymous"
            onClick={onClick}
            onLoad={() => { if (useCloudStream) setTimeout(() => setTick(Date.now()), 10); }}
            onError={(e) => {
                const t = e.currentTarget;
                if (useCloudStream) setTimeout(() => setTick(Date.now()), 1000);
                else if (t.src.includes('5521')) t.src = `http://${cameraIp}:5520/liveview.jpg`;
            }}
        />
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

    const [isHttps, setIsHttps] = useState(false);
    const [cameraIp, setCameraIp] = useState(DEFAULT_IP);
    const [useCloudStream, setUseCloudStream] = useState(false);
    const [isConfigured, setIsConfigured] = useState(false);

    const lastSeenTimeRef = useRef<number>(0);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const showToast = (msg: string) => {
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setToastMessage(msg);
        toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
    };

    // --- INITIALIZATION ---
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const isSecure = window.location.protocol === 'https:';
            setIsHttps(isSecure);
            const savedIp = localStorage.getItem('camera_ip');
            if (savedIp) setCameraIp(savedIp);

            fetch('/api/settings')
                .then(res => res.json())
                .then(data => {
                    // 1. Priorita: Nastavení z databáze
                    if (data.use_cloud_stream !== undefined && data.use_cloud_stream !== null && data.use_cloud_stream !== '') {
                        setUseCloudStream(data.use_cloud_stream === 'true');
                    }
                    // 2. Fallback: Automatická detekce
                    else if (isSecure || window.location.hostname.includes('railway.app')) {
                        setUseCloudStream(true);
                    }
                })
                .catch(() => { if (isSecure) setUseCloudStream(true); });

            fetch('/api/assets').then(res => res.json()).then(data => {
                if (Array.isArray(data)) setAssets(data);
            });

            setIsConfigured(true);
        }

        fetch('/api/session', { method: 'POST', body: JSON.stringify({ id: SESSION_ID }) }).catch(console.error);

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/poll?sessionId=${SESSION_ID}`);
                const data = await res.json();

                if (data.pending && status === 'idle' && !processingRef.current) {
                    startCountdown();
                }

                if (data.latest && data.latest.createdAt) {
                    const photoTime = new Date(data.latest.createdAt).getTime();
                    const now = Date.now();

                    if ((now - photoTime) < 30000 && photoTime > lastSeenTimeRef.current) {
                        if (data.latest.url.includes('edited_')) {
                            lastSeenTimeRef.current = photoTime;
                        } else {
                            lastSeenTimeRef.current = photoTime;
                            processNewPhoto(data.latest.url);
                        }
                    }
                }
            } catch (e) { }
        }, 1000);
        return () => clearInterval(interval);
    }, [status, sessionSettings]);

    // --- PROCESSING LOGIC ---
    const processNewPhoto = async (originalUrl: string) => {
        setStatus('processing');
        processingRef.current = false;

        showToast('Aplikuji efekty... ✨');
        try {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = originalUrl;
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });

            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('No context');

            ctx.drawImage(img, 0, 0);

            if (sessionSettings.selectedBg) {
                const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const l = frame.data.length / 4;
                const rKey = parseInt(sessionSettings.chromaKeyColor.slice(1, 3), 16);
                const gKey = parseInt(sessionSettings.chromaKeyColor.slice(3, 5), 16);
                const bKey = parseInt(sessionSettings.chromaKeyColor.slice(5, 7), 16);
                const tol = sessionSettings.chromaTolerance;

                for (let i = 0; i < l; i++) {
                    const r = frame.data[i * 4 + 0];
                    const g = frame.data[i * 4 + 1];
                    const b = frame.data[i * 4 + 2];
                    if (Math.abs(r - rKey) < tol && Math.abs(g - gKey) < tol && Math.abs(b - bKey) < tol) {
                        frame.data[i * 4 + 3] = 0;
                    }
                }
                ctx.putImageData(frame, 0, 0);

                const bgImg = new Image();
                bgImg.crossOrigin = "Anonymous";
                bgImg.src = sessionSettings.selectedBg;
                await new Promise(r => bgImg.onload = r);
                ctx.globalCompositeOperation = 'destination-over';
                ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
                ctx.globalCompositeOperation = 'source-over';
            }

            if (sessionSettings.selectedSticker) {
                const stickerImg = new Image();
                stickerImg.crossOrigin = "Anonymous";
                stickerImg.src = sessionSettings.selectedSticker;
                await new Promise(r => stickerImg.onload = r);

                let sWidth = canvas.width * 0.3;
                let sHeight = (stickerImg.height / stickerImg.width) * sWidth;
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
                    setLastPhoto(uploadData.url);
                    setStatus('review');
                    if (sessionSettings.email && !originalUrl.startsWith('blob:')) { }
                    showToast('Efekty aplikovány! ✨');
                } else {
                    setLastPhoto(originalUrl); setStatus('review');
                    showToast('Chyba ukládání');
                }
            }, 'image/jpeg', 0.9);

        } catch (e) {
            console.error(e);
            showToast('Chyba efektů, zobrazuji originál.');
            setLastPhoto(originalUrl); setStatus('review');
        }
    };

    const handlePreviewClick = (e: React.MouseEvent<HTMLImageElement>) => {
        if (!isPickingColor) return;
        const img = e.currentTarget;
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const rect = img.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (img.naturalWidth / rect.width);
        const y = (e.clientY - rect.top) * (img.naturalHeight / rect.height);
        const p = ctx.getImageData(x, y, 1, 1).data;
        const hex = "#" + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase();
        setSessionSettings({ ...sessionSettings, chromaKeyColor: hex });
        setIsPickingColor(false);
        showToast(`Barva vybrána: ${hex}`);
    };

    const startCountdown = () => {
        if (processingRef.current) return;
        setCountdown(3); setStatus('countdown'); processingRef.current = true;
        let count = 3;
        const timer = setInterval(() => {
            count--;
            if (count > 0) setCountdown(count);
            else { clearInterval(timer); takePhoto(); }
        }, 1000);
    };

    const takePhoto = async () => {
        setCountdown(0); setStatus('processing');
        setTimeout(() => { if (processingRef.current) { processingRef.current = false; setStatus('idle'); showToast("Timeout"); } }, 15000);
        try {
            const url = useCloudStream ? '/api/command' : `http://${cameraIp}:5555/shoot`;
            await fetch(url, { method: 'POST', body: useCloudStream ? JSON.stringify({ cmd: 'SHOOT' }) : undefined });
        } catch (e) { showToast('Chyba kamery'); processingRef.current = false; setStatus('idle'); }
    };

    // Auto Email / Print etc
    const autoSendEmail = async (photoUrl: string, email: string) => { /* ... */ };
    const openGallery = async () => {
        setShowGallery(true); setConfirmDeleteId(null);
        try { const res = await fetch('/api/media/list'); const data = await res.json(); if (Array.isArray(data)) setGalleryPhotos(data); } catch (e) { }
    };
    const deletePhoto = async (id: string, url: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirmDeleteId !== id) { setConfirmDeleteId(id); return; }
        await fetch('/api/media/delete', { method: 'POST', body: JSON.stringify({ url }) });
        setGalleryPhotos(prev => prev.filter(p => p.id !== id));
        setConfirmDeleteId(null);
    };
    const printPhoto = async () => {
        if (!lastPhoto) return; showToast('Tisk... 🖨️');
        try { await fetch(`http://${cameraIp}:5555/print`, { method: 'POST', body: JSON.stringify({ filename: lastPhoto.split('/').pop() }) }); } catch (e) { }
    };
    const sendEmail = async () => {
        if (!emailInput.includes('@')) { showToast('Email?'); return; }
        showToast('Odesílám...');
        try { await fetch('/api/email', { method: 'POST', body: JSON.stringify({ email: emailInput, photoUrl: lastPhoto }) }); showToast('OK ✅'); setShowEmailModal(false); } catch (e) { showToast('Chyba ❌'); }
    };

    return (
        <div className="relative w-full h-full bg-gray-100 overflow-hidden flex flex-col items-center justify-center">

            {/* LIVE / REVIEW LAYER */}
            <div className="absolute inset-0 bg-black flex items-center justify-center">
                {status === 'processing' ? (
                    <div className="text-white flex flex-col items-center animate-pulse"><RefreshCw className="animate-spin mb-4" size={48} /><span className="text-2xl font-bold">Zpracovávám...</span></div>
                ) : status === 'review' && lastPhoto ? (
                    <img src={lastPhoto} className="w-full h-full object-contain bg-slate-900" />
                ) : (
                    <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
                        {/* POUŽITÍ OPTIMALIZOVANÉ KOMPONENTY */}
                        <LiveView
                            useCloudStream={useCloudStream}
                            cameraIp={cameraIp}
                            isBW={sessionSettings.isBW}
                            isConfigured={isConfigured}
                            className="w-full h-full object-contain"
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
                <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in zoom-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-4xl w-full shadow-2xl text-white max-h-full overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold">Nastavení Focení</h2>
                            <button onClick={() => { setShowSettings(false); setIsPickingColor(false); }} className="p-2 bg-white/10 rounded-full hover:bg-white/20"><X /></button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                {/* Basic Options... */}
                                <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl">
                                    <h3 className="font-semibold mb-4">Základní</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between"><span>Auto-Email</span><input type="email" placeholder="email@..." value={sessionSettings.email} onChange={e => setSessionSettings({ ...sessionSettings, email: e.target.value })} className="bg-slate-950 p-2 rounded border border-slate-700 w-40 text-sm" /></div>
                                        <div className="flex items-center justify-between"><span>Černobíle</span><input type="checkbox" checked={sessionSettings.isBW} onChange={e => setSessionSettings({ ...sessionSettings, isBW: e.target.checked })} className="w-5 h-5 accent-indigo-500" /></div>
                                    </div>
                                </div>

                                {/* Chroma Key Settings */}
                                <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl">
                                    <h3 className="font-semibold mb-4 flex items-center gap-2"><Pipette size={18} /> Klíčování</h3>

                                    {/* PREVIEW + DROPPER in settings */}
                                    <div className="mb-4 relative rounded-lg overflow-hidden border border-slate-600 bg-black aspect-video group">
                                        {/* Zde také použijeme LiveView pro konzistenci, ale s click handlerem */}
                                        <LiveView
                                            useCloudStream={useCloudStream}
                                            cameraIp={cameraIp}
                                            isBW={sessionSettings.isBW}
                                            isConfigured={isConfigured}
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
                                    {/* ... sliders ... */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between"><span>Barva</span><div className="flex items-center gap-2"><input type="color" value={sessionSettings.chromaKeyColor} onChange={e => setSessionSettings({ ...sessionSettings, chromaKeyColor: e.target.value })} className="bg-transparent border-0 w-8 h-8 cursor-pointer" /><span className="text-xs font-mono">{sessionSettings.chromaKeyColor}</span></div></div>
                                        <div><div className="flex justify-between text-sm mb-1"><span>Tolerance</span><span>{sessionSettings.chromaTolerance}</span></div><input type="range" min="10" max="250" value={sessionSettings.chromaTolerance} onChange={e => setSessionSettings({ ...sessionSettings, chromaTolerance: Number(e.target.value) })} className="w-full accent-green-500" /></div>
                                    </div>
                                </div>
                            </div>

                            {/* Creative Selection ... (same as before) */}
                            <div className="space-y-6">
                                <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl">
                                    <h3 className="font-semibold mb-4 text-green-400">🖼️ Pozadí</h3>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div onClick={() => setSessionSettings({ ...sessionSettings, selectedBg: null })} className={`aspect-video bg-slate-900 border-2 rounded cursor-pointer flex items-center justify-center text-xs ${sessionSettings.selectedBg === null ? 'border-green-500' : 'border-transparent'}`}>Nic</div>
                                        {assets.filter(a => a.type === 'BACKGROUND').map(a => (<img key={a.id} src={a.url} onClick={() => setSessionSettings({ ...sessionSettings, selectedBg: a.url })} className={`w-full aspect-video object-cover rounded cursor-pointer border-2 ${sessionSettings.selectedBg === a.url ? 'border-green-500' : 'border-transparent'}`} />))}
                                    </div>
                                </div>
                                <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl">
                                    <h3 className="font-semibold mb-4 text-pink-400 flex justify-between items-center"><span>🦄 Samolepka</span></h3>
                                    <div className="mb-4 flex gap-1 p-1 bg-slate-900 rounded-lg">
                                        {([['tl', 'TL'], ['tr', 'TR'], ['center', 'Center'], ['bl', 'BL'], ['br', 'BR'], ['cover', 'Cover']] as const).map(([pos, label]) => (
                                            <button key={pos} onClick={() => setSessionSettings(s => ({ ...s, stickerPosition: pos as any }))} className={`flex-1 py-1 text-[10px] font-bold rounded ${sessionSettings.stickerPosition === pos ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white'}`}>{label}</button>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        <div onClick={() => setSessionSettings({ ...sessionSettings, selectedSticker: null })} className={`aspect-square bg-slate-900 border-2 rounded cursor-pointer flex items-center justify-center text-xs ${sessionSettings.selectedSticker === null ? 'border-pink-500' : 'border-transparent'}`}>Nic</div>
                                        {assets.filter(a => a.type === 'STICKER').map(a => (<img key={a.id} src={a.url} onClick={() => setSessionSettings({ ...sessionSettings, selectedSticker: a.url })} className={`w-full aspect-square object-contain bg-slate-900 rounded cursor-pointer border-2 ${sessionSettings.selectedSticker === a.url ? 'border-pink-500' : 'border-transparent'}`} />))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DOCK ... (same as before) */}
            <div className="absolute top-4 left-4 z-50">
                <Link href="/" className="p-3 bg-white/10 text-white rounded-full backdrop-blur-md flex items-center justify-center hover:bg-white/20"><Home size={24} /></Link>
            </div>

            {status === 'review' && lastPhoto && (
                <div className="absolute top-4 right-4 z-50 animate-in fade-in slide-in-from-top-4">
                    <button onClick={() => processNewPhoto(lastPhoto)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-full font-bold shadow-2xl transition-transform active:scale-95">
                        <Wand2 size={20} /> Upravit
                    </button>
                </div>
            )}

            <div className="absolute bottom-10 z-30 w-full flex justify-center p-4">
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-full p-4 flex items-center shadow-2xl">
                    <div className="flex gap-4 px-4">
                        <button className="flex flex-col items-center gap-1 text-white opacity-80 hover:scale-110 transition-all text-xs" onClick={() => setShowSettings(true)}><Settings size={20} /> <span>Nastavení</span></button>
                        <button className="flex flex-col items-center gap-1 text-white opacity-80 hover:scale-110 transition-all text-xs" onClick={openGallery}><ImageIcon size={20} /> <span>Galerie</span></button>
                    </div>
                    <div className="mx-6 relative">
                        {status === 'review' ? (
                            <button className="w-20 h-20 rounded-full border-4 border-red-500 flex items-center justify-center bg-red-500/20 hover:scale-105" onClick={() => { setStatus('idle'); setLastPhoto(null); }}><RefreshCw size={32} color="#fff" /></button>
                        ) : (
                            <button className="w-24 h-24 rounded-full border-4 border-white flex items-center justify-center bg-white/20 hover:bg-white/30" onClick={startCountdown} disabled={status !== 'idle'}><div className="w-16 h-16 bg-white rounded-full"></div></button>
                        )}
                    </div>
                    <div className="flex gap-4 px-4">
                        <button className="flex flex-col items-center gap-1 text-white opacity-80 hover:scale-110 transition-all text-xs" disabled={status !== 'review'} onClick={printPhoto}><Printer size={20} /> <span>Tisk</span></button>
                        <button className="flex flex-col items-center gap-1 text-white opacity-80 hover:scale-110 transition-all text-xs" disabled={status !== 'review'} onClick={() => setShowEmailModal(true)}><Mail size={20} /> <span>Email</span></button>
                    </div>
                </div>
            </div>
            {toastMessage && <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[60] bg-black/80 text-white px-6 py-3 rounded-full">{toastMessage}</div>}

            {showGallery && (
                <div className="absolute inset-0 z-50 bg-black/90 flex flex-col p-8">
                    <button onClick={() => setShowGallery(false)} className="absolute top-4 right-4 p-4 text-white"><X size={32} /></button>
                    <div className="grid grid-cols-4 gap-4 overflow-y-auto mt-10">
                        {galleryPhotos.map(p => (
                            <div key={p.id} className="relative group aspect-video bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
                                <img src={p.url} onClick={() => { setLastPhoto(p.url); setStatus('review'); setShowGallery(false); }} className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" />
                                <button onClick={(e) => deletePhoto(p.id, p.url, e)} className={`absolute top-2 right-2 p-2 rounded-full text-white bg-black/50 hover:bg-red-600 transition-colors ${confirmDeleteId === p.id ? 'bg-red-600' : ''}`}>
                                    {confirmDeleteId === p.id ? <Trash2 size={20} /> : <X size={20} />}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showEmailModal && (
                <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-8">
                    <div className="bg-slate-900 p-8 rounded-xl w-full max-w-md space-y-4">
                        <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="Email" className="w-full p-4 rounded text-black" />
                        <button onClick={sendEmail} className="w-full bg-indigo-600 p-4 rounded text-white font-bold">Odeslat</button>
                        <button onClick={() => setShowEmailModal(false)} className="w-full text-slate-400">Zrušit</button>
                    </div>
                </div>
            )}
        </div>
    );
}
