'use client';
import { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Printer, Settings, Mail, RefreshCw, X, AlertTriangle } from 'lucide-react';

const SESSION_ID = 'main';
const DEFAULT_IP = '127.0.0.1';

export default function KioskPage() {
    const [status, setStatus] = useState<'idle' | 'countdown' | 'review'>('idle');
    const [countdown, setCountdown] = useState(3);
    const [lastPhoto, setLastPhoto] = useState<string | null>(null);
    const processingRef = useRef(false);

    // UI States
    const [showSettings, setShowSettings] = useState(false);
    const [showGallery, setShowGallery] = useState(false);
    const [galleryPhotos, setGalleryPhotos] = useState<any[]>([]);

    const [isHttps, setIsHttps] = useState(false);

    // Configuration
    const [cameraIp, setCameraIp] = useState(DEFAULT_IP);
    const [useCloudStream, setUseCloudStream] = useState(false);

    const lastSeenTimeRef = useRef<number>(0);

    // --- INITIALIZATION & POLLING ---
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const isSecure = window.location.protocol === 'https:';
            setIsHttps(isSecure);

            const savedIp = localStorage.getItem('camera_ip');
            if (savedIp) setCameraIp(savedIp);

            const savedCloud = localStorage.getItem('use_cloud_stream');
            const isRailway = window.location.hostname.includes('railway.app');

            if (isSecure || isRailway || savedCloud === 'true') {
                console.log("Forcing Cloud Stream due to HTTPS/Railway");
                setUseCloudStream(true);
                if (isRailway) localStorage.setItem('use_cloud_stream', 'true');
            }
        }

        fetch('/api/session', {
            method: 'POST',
            body: JSON.stringify({ id: SESSION_ID }),
        }).catch(console.error);

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/poll?sessionId=${SESSION_ID}`);
                const data = await res.json();

                // 1. Remote Trigger
                if (data.pending && status === 'idle' && !processingRef.current) {
                    console.log("Remote trigger received!");
                    startCountdown();
                }

                // 2. New Photo Detection
                if (data.latest && data.latest.createdAt) {
                    const photoTime = new Date(data.latest.createdAt).getTime();
                    const now = Date.now();
                    const isFresh = (now - photoTime) < 30000;

                    if (isFresh && photoTime > lastSeenTimeRef.current) {
                        console.log("New photo detected!", data.latest);
                        lastSeenTimeRef.current = photoTime;
                        setLastPhoto(data.latest.url);
                        setStatus('review');
                        setCountdown(0);
                        processingRef.current = false;
                    }
                }
            } catch (e) { }
        }, 1000);
        return () => clearInterval(interval);
    }, [status]);

    // --- ACTIONS ---

    const saveIp = (ip: string) => { setCameraIp(ip); localStorage.setItem('camera_ip', ip); };
    const saveCloud = (val: boolean) => { setUseCloudStream(val); localStorage.setItem('use_cloud_stream', String(val)); };

    const startCountdown = () => {
        if (processingRef.current) return;
        processingRef.current = true;
        setStatus('countdown');
        let count = 3;
        setCountdown(count);
        const timer = setInterval(() => {
            count--;
            if (count > 0) setCountdown(count);
            else { clearInterval(timer); takePhoto(); }
        }, 1000);
    };

    const takePhoto = async () => {
        setCountdown(0);
        setStatus('idle');

        if (useCloudStream) {
            try {
                await fetch('/api/command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cmd: 'SHOOT' })
                });
            } catch (e) { alerting('Chyba cloud triggeru.'); processingRef.current = false; }
        } else {
            try {
                const res = await fetch(`http://${cameraIp}:5555/shoot`, { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    setLastPhoto(data.url.startsWith('http') ? data.url : `http://${cameraIp}:5555${data.url}`);
                    setStatus('review');
                }
            } catch (e) { alerting('Chyba spojení s kamerou.'); }
            processingRef.current = false;
        }
    };

    const openGallery = async () => {
        setShowGallery(true);
        try {
            const res = await fetch('/api/media/list');
            const data = await res.json();
            if (Array.isArray(data)) setGalleryPhotos(data);
        } catch (e) { console.error(e); }
    };

    const printPhoto = async () => {
        if (!lastPhoto) return;
        const filename = lastPhoto.split('/').pop();
        try {
            await fetch(`http://${cameraIp}:5555/print`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });
            alert('Odesláno na tiskárnu! 🖨️');
        } catch (e) { alert('Chyba tisku.'); }
    };

    const alerting = (msg: string) => { if (typeof window !== 'undefined') alert(msg); };

    // Live View: "Zdvořilé stahování" (Adaptive Polling)
    const [liveTick, setLiveTick] = useState(Date.now());

    // Interval už nepotřebujeme, řídí se to samo událostmi onLoad/onError v <img>

    // --- RENDER ---
    return (
        <div className="relative w-full h-full bg-gray-100 overflow-hidden flex flex-col items-center justify-center">

            {/* Warning Overlay */}
            {isHttps && !useCloudStream && cameraIp === '127.0.0.1' && status === 'idle' && (
                <div className="absolute top-4 left-4 z-40 bg-yellow-100 text-yellow-800 p-3 rounded-xl flex items-center gap-3 text-sm shadow-sm max-w-sm">
                    <AlertTriangle size={20} />
                    <div>Zapněte <b>Cloud Stream</b> pro správnou funkci.</div>
                </div>
            )}

            {/* MAIN LAYER */}
            <div className="absolute inset-0 bg-black flex items-center justify-center">

                {status === 'review' && lastPhoto ? (
                    <img src={lastPhoto} className="w-full h-full object-contain bg-slate-900" />
                ) : (
                    <div className="w-full h-full relative overflow-hidden">
                        {/* Snapshot Mode (Webcam Style) */}
                        <img
                            src={useCloudStream ? `/api/stream/snapshot?t=${liveTick}` : `http://${cameraIp}:5521/live`}
                            className="w-full h-full object-contain transition-opacity duration-200"

                            // Tady je to kouzlo: Další snímek si vyžádáme až když tenhle dorazí
                            onLoad={() => {
                                if (useCloudStream) setTimeout(() => setLiveTick(Date.now()), 10);
                            }}
                            onError={(e) => {
                                const target = e.currentTarget;
                                // Pokud selže cloud, zkusíme to za chvíli znovu
                                if (useCloudStream) {
                                    setTimeout(() => setLiveTick(Date.now()), 500);
                                }
                                // Fallback pro lokální režim
                                else if (target.src.includes('5521')) {
                                    target.src = `http://${cameraIp}:5520/liveview.jpg`;
                                }
                            }}
                        />
                        <div className="absolute inset-0 -z-10 flex items-center justify-center text-slate-500">
                            <p>Spojuji se s kamerou...</p>
                        </div>

                        {/* Frame - zachováno, ale může být mírně mimo, pokud se fotka letterboxuje. 
                            Prozatím necháme jako vizuální prvek, ale uživatel vidí celý záběr. */}
                        <div className="absolute inset-0 border-[20px] border-black/80 pointer-events-none z-10 rounded-[30px] m-4 shadow-2xl"></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none z-10"></div>
                    </div>
                )}
            </div>

            {/* OVERLAYS */}
            {status === 'countdown' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-20">
                    <div className="text-[15rem] font-black text-white drop-shadow-2xl animate-bounce">{countdown}</div>
                </div>
            )}

            {status === 'idle' && processingRef.current && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
                    <div className="text-white font-bold text-xl animate-pulse">Ukládání...</div>
                </div>
            )}

            {/* GALLERY */}
            {showGallery && (
                <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col p-8 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-3xl font-bold text-white">Galerie</h2>
                        <button onClick={() => setShowGallery(false)} className="p-4 bg-white/10 rounded-full text-white hover:bg-white/20"><X size={32} /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
                        {galleryPhotos.map((photo) => (
                            <div key={photo.id} className="aspect-[3/2] bg-slate-800 rounded-xl overflow-hidden relative group">
                                <img
                                    src={photo.url}
                                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                    loading="lazy"
                                    onError={(e) => {
                                        // Pokud fotka na serveru chybí, skryjeme celý rámeček
                                        const parent = e.currentTarget.parentElement;
                                        if (parent) parent.style.display = 'none';
                                    }}
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform" onClick={() => { setLastPhoto(photo.url); setStatus('review'); setShowGallery(false); }}>
                                        <Printer size={20} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {galleryPhotos.length === 0 && <div className="col-span-full text-white text-center opacity-50">Žádné fotky.</div>}
                    </div>
                </div>
            )}

            {/* SETTINGS */}
            {showSettings && (
                <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in zoom-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-lg w-full shadow-2xl text-white">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-bold">Nastavení</h2>
                            <button onClick={() => setShowSettings(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20"><X /></button>
                        </div>

                        <div className="space-y-4">
                            {/* Cloud Stream Toggle */}
                            <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-lg">☁️ Cloud Stream</h3>
                                    <p className="text-slate-400 text-sm mt-1">Snapshot režim (Webcam style)</p>
                                </div>
                                <button onClick={() => saveCloud(!useCloudStream)} className={`w-14 h-8 rounded-full transition-colors relative ${useCloudStream ? 'bg-indigo-500' : 'bg-slate-600'}`}>
                                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform shadow-sm ${useCloudStream ? 'translate-x-7' : 'translate-x-1'}`}></div>
                                </button>
                            </div>

                            {/* Local IP fallback (only if Cloud is OFF) */}
                            {!useCloudStream && (
                                <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl">
                                    <label className="block text-sm text-slate-400 mb-2">Lokální IP Bridge</label>
                                    <input
                                        type="text"
                                        value={cameraIp}
                                        onChange={(e) => saveIp(e.target.value)}
                                        className="w-full p-3 bg-slate-950 border border-slate-700 rounded-lg focus:border-indigo-500 outline-none text-white font-mono"
                                    />
                                </div>
                            )}

                            {/* Info */}
                            <div className="p-4 rounded-xl bg-slate-950/50 text-center">
                                <p className="text-xs text-slate-500">ID Session: {SESSION_ID}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTROLS DOCK */}
            <div className="absolute bottom-10 z-30 w-full flex justify-center p-4">
                <div className="dock-container bg-black/40 backdrop-blur-xl border border-white/10 rounded-full p-4 flex items-center shadow-2xl">
                    <div className="flex gap-4 px-4">
                        <button className="flex flex-col items-center gap-1 text-white opacity-80 hover:opacity-100 hover:scale-110 transition-all font-medium text-xs" onClick={() => setShowSettings(true)}>
                            <Settings size={20} /> <span>Nastavení</span>
                        </button>
                        <button className="flex flex-col items-center gap-1 text-white opacity-80 hover:opacity-100 hover:scale-110 transition-all font-medium text-xs" onClick={openGallery}>
                            <ImageIcon size={20} /> <span>Galerie</span>
                        </button>
                    </div>

                    <div className="mx-6 relative">
                        {status === 'review' ? (
                            <button className="w-20 h-20 rounded-full border-4 border-red-500 flex items-center justify-center bg-red-500/20 hover:scale-105 transition-all shadow-lg active:scale-95" onClick={() => { setStatus('idle'); processingRef.current = false; }}>
                                <RefreshCw size={32} color="#fff" />
                            </button>
                        ) : (
                            <button className="w-24 h-24 rounded-full border-4 border-white flex items-center justify-center bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.3)]" onClick={startCountdown}>
                                <div className="w-16 h-16 bg-white rounded-full shadow-inner"></div>
                            </button>
                        )}
                    </div>

                    <div className="flex gap-4 px-4">
                        <button className="flex flex-col items-center gap-1 text-white opacity-80 hover:opacity-100 hover:scale-110 transition-all font-medium text-xs disabled:opacity-30" disabled={status !== 'review'} onClick={printPhoto}>
                            <Printer size={20} /> <span>Tisk</span>
                        </button>
                        <button className="flex flex-col items-center gap-1 text-white opacity-80 hover:opacity-100 hover:scale-110 transition-all font-medium text-xs disabled:opacity-30" disabled={status !== 'review'} onClick={() => alert('Email')}>
                            <Mail size={20} /> <span>Email</span>
                        </button>
                    </div>

                </div>
            </div>

        </div>
    );
}
