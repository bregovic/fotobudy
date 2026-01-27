'use client';
import { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Printer, Settings, Mail, RefreshCw, X, AlertTriangle, Send, Trash2, CameraOff, Home } from 'lucide-react';
import Link from 'next/link';

const SESSION_ID = 'main';
const DEFAULT_IP = '127.0.0.1';

// Session Settings Type
type SessionSettings = {
    email: string;
    isBW: boolean;
    isPrivate: boolean;
};

export default function KioskPage() {
    const [status, setStatus] = useState<'idle' | 'countdown' | 'review'>('idle');
    const [countdown, setCountdown] = useState(3);
    const [lastPhoto, setLastPhoto] = useState<string | null>(null);
    const processingRef = useRef(false);

    // UI States
    const [showSettings, setShowSettings] = useState(false);
    const [showGallery, setShowGallery] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false); // Pro manuální poslání
    const [emailInput, setEmailInput] = useState('');
    const [galleryPhotos, setGalleryPhotos] = useState<any[]>([]);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    // Session Settings (User Configurable)
    const [sessionSettings, setSessionSettings] = useState<SessionSettings>({
        email: '',
        isBW: false,
        isPrivate: false
    });

    const [isHttps, setIsHttps] = useState(false);

    // Configuration (System)
    const [cameraIp, setCameraIp] = useState(DEFAULT_IP);
    const [useCloudStream, setUseCloudStream] = useState(false);
    const [isConfigured, setIsConfigured] = useState(false);

    const lastSeenTimeRef = useRef<number>(0);

    // Stream Handling
    const [streamError, setStreamError] = useState(false);

    // Toast Notification System
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const showToast = (msg: string) => {
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setToastMessage(msg);
        toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
    };

    // --- INITIALIZATION & POLLING ---
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const isSecure = window.location.protocol === 'https:';
            setIsHttps(isSecure);
            const savedIp = localStorage.getItem('camera_ip');
            if (savedIp) setCameraIp(savedIp);

            // Cloud Stream se nyní načítá POUZE z LocalStorage (nastaveno v Profilu)
            const savedCloud = localStorage.getItem('use_cloud_stream');
            if (savedCloud === 'true') {
                setUseCloudStream(true);
            } else if (isSecure || window.location.hostname.includes('railway.app')) {
                // Fallback pro Railway, pokud není explicitně zakázáno/nastaveno
                setUseCloudStream(true);
            }

            setIsConfigured(true);
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
                    startCountdown();
                }

                // 2. New Photo Detection
                if (data.latest && data.latest.createdAt) {
                    const photoTime = new Date(data.latest.createdAt).getTime();
                    const now = Date.now();

                    if ((now - photoTime) < 30000 && photoTime > lastSeenTimeRef.current) {
                        console.log("New photo detected!", data.latest);
                        lastSeenTimeRef.current = photoTime;
                        setLastPhoto(data.latest.url);
                        setStatus('review');
                        setCountdown(0);
                        processingRef.current = false;

                        // AUTO-EMAIL
                        if (sessionSettings.email && sessionSettings.email.includes('@')) {
                            autoSendEmail(data.latest.url, sessionSettings.email);
                        }
                    }
                }
            } catch (e) { }
        }, 1000);
        return () => clearInterval(interval);
    }, [status, sessionSettings]); // Přidáno sessionSettings do deps, aby auto-email měl aktuální hodnotu

    // --- ACTIONS ---
    const saveIp = (ip: string) => { setCameraIp(ip); localStorage.setItem('camera_ip', ip); };

    const autoSendEmail = async (photoUrl: string, email: string) => {
        showToast('Automaticky odesílám email... 📨');
        let smtpConfig = null;
        try {
            const saved = localStorage.getItem('smtp_config');
            if (saved) smtpConfig = JSON.parse(saved);

            await fetch('/api/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, photoUrl, smtpConfig })
            });
            showToast('Auto-Email odeslán! ✅');
        } catch (e) {
            console.error(e);
        }
    };

    const startCountdown = () => {
        if (processingRef.current) return;

        setCountdown(3);
        setStatus('countdown');
        processingRef.current = true;

        let count = 3;
        const timer = setInterval(() => {
            count--;
            if (count > 0) {
                setCountdown(count);
            } else {
                clearInterval(timer);
                takePhoto();
            }
        }, 1000);
    };

    const takePhoto = async () => {
        setCountdown(0);
        setStatus('idle');

        // Timeout safety
        setTimeout(() => {
            if (processingRef.current) {
                processingRef.current = false;
                showToast("Trvalo to moc dlouho. Zkuste to znovu.");
            }
        }, 15000);

        if (useCloudStream) {
            try {
                await fetch('/api/command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cmd: 'SHOOT' })
                });
            } catch (e) {
                showToast('Chyba cloud triggeru.');
                processingRef.current = false;
            }
        } else {
            try {
                const res = await fetch(`http://${cameraIp}:5555/shoot`, { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    // Lokální bridge okamžitě vrací URL, nemusíme čekat na poll
                    // Ale poll to zachytí taky. Duplicita? Poll má timestamps check, takže OK.
                    // Pro jistotu zde nic nenastavujeme a necháme to na Polling, 
                    // aby fungoval Auto-Email konzistentně na jednom místě.
                }
                // processingRef necháme true, dokud poll nenajde fotku nebo nevyprší timeout
            } catch (e) {
                showToast('Chyba spojení s kamerou.');
                processingRef.current = false;
            }
        }
    };

    const openGallery = async () => {
        setShowGallery(true);
        setConfirmDeleteId(null);
        try {
            const res = await fetch('/api/media/list');
            if (!res.ok) throw new Error('Failed to load gallery');
            const data = await res.json();
            if (Array.isArray(data)) setGalleryPhotos(data);
        } catch (e) { console.error(e); }
    };

    const deletePhoto = async (id: string, url: string, e: React.MouseEvent) => {
        e.stopPropagation();

        if (confirmDeleteId !== id) {
            setConfirmDeleteId(id);
            return;
        }

        try {
            const res = await fetch('/api/media/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            if (res.ok) {
                setGalleryPhotos(prev => prev.filter(p => p.id !== id));
                showToast('Fotka smazána 🗑️');
            } else {
                showToast('Chyba mazání ❌');
            }
        } catch (err) { showToast('Chyba komunikace'); }
    };

    const printPhoto = async () => {
        if (!lastPhoto) return;
        const filename = lastPhoto.split('/').pop();
        showToast('Odesílám na tiskárnu... 🖨️');
        try {
            await fetch(`http://${cameraIp}:5555/print`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });
        } catch (e) { showToast('Chyba tisku ❌'); }
    };

    const sendEmail = async () => {
        if (!emailInput.includes('@')) {
            showToast('Zadej platný email!');
            return;
        }
        showToast('Odesílám email... 📨');

        let smtpConfig = null;
        try {
            const saved = localStorage.getItem('smtp_config');
            if (saved) smtpConfig = JSON.parse(saved);
        } catch (e) { }

        try {
            const res = await fetch('/api/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: emailInput,
                    photoUrl: lastPhoto,
                    smtpConfig: smtpConfig
                })
            });
            const data = await res.json();

            if (data.simulated) showToast('✉️ Simulace: Email jakože odeslán.');
            else if (data.success) showToast('Email odeslán! ✅');
            else showToast('Chyba odesílání ❌');

            setShowEmailModal(false);
            setEmailInput('');
        } catch (e) { showToast('Chyba komunikace ❌'); }
    };

    // Live View Polling
    const [liveTick, setLiveTick] = useState(Date.now());

    // --- RENDER ---
    return (
        <div className="relative w-full h-full bg-gray-100 overflow-hidden flex flex-col items-center justify-center">

            {/* HOME BUTTON */}
            <div className="absolute top-4 left-4 z-50">
                <Link href="/" className="p-3 bg-white/10 text-white rounded-full backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-colors">
                    <Home size={24} />
                </Link>
            </div>

            {/* TOAST NOTIFICATION */}
            {toastMessage && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
                    <div className="bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-white/10">
                        <span className="font-medium text-sm">{toastMessage}</span>
                    </div>
                </div>
            )}

            {/* Warning Overlay */}
            {isHttps && !useCloudStream && cameraIp === '127.0.0.1' && status === 'idle' && (
                <div className="absolute top-20 left-4 z-40 bg-yellow-100 text-yellow-800 p-3 rounded-xl flex items-center gap-3 text-sm shadow-sm max-w-sm">
                    <AlertTriangle size={20} />
                    <div>Zapněte <b>Cloud Stream</b> v Profilu.</div>
                </div>
            )}

            {/* MAIN LAYER */}
            <div className="absolute inset-0 bg-black flex items-center justify-center">

                {status === 'review' && lastPhoto ? (
                    <img
                        src={lastPhoto}
                        className={`w-full h-full object-contain bg-slate-900 ${sessionSettings.isBW ? 'grayscale' : ''}`} // Aplikace ČB filtru
                    />
                ) : (
                    <div className="w-full h-full relative overflow-hidden flex items-center justify-center">

                        {streamError && useCloudStream && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 z-10 bg-slate-900/50">
                                <CameraOff size={48} className="mb-2 opacity-50" />
                                <p className="text-sm font-light tracking-wider animate-pulse">Hledám kameru...</p>
                            </div>
                        )}

                        <img
                            src={!isConfigured ? '' : (useCloudStream ? `/api/stream/snapshot?t=${liveTick}` : `http://${cameraIp}:5521/live`)}
                            className={`w-full h-full object-contain transition-opacity duration-500 ${streamError && useCloudStream ? 'opacity-0' : 'opacity-100'} ${sessionSettings.isBW ? 'grayscale' : ''}`} // Aplikace ČB filtru
                            onLoad={() => {
                                setStreamError(false);
                                if (useCloudStream) setTimeout(() => setLiveTick(Date.now()), 10);
                            }}
                            onError={(e) => {
                                setStreamError(true);
                                const target = e.currentTarget;
                                if (useCloudStream) setTimeout(() => setLiveTick(Date.now()), 3000);
                                else if (target.src.includes('5521')) target.src = `http://${cameraIp}:5520/liveview.jpg`;
                            }}
                        />
                    </div>
                )}
            </div>

            {/* OVERLAYS */}
            {status === 'countdown' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-50">
                    <div className={`text-[15rem] font-black text-white drop-shadow-2xl animate-bounce ${sessionSettings.isBW ? 'grayscale' : ''}`}>{countdown}</div>
                </div>
            )}

            {status === 'idle' && processingRef.current && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-50 pointer-events-auto"
                    onClick={() => {
                        processingRef.current = false;
                        showToast('Ukládání zrušeno.');
                    }}>
                    <div className="text-white font-bold text-xl animate-pulse">Ukládání...</div>
                </div>
            )}

            {/* SETTINGS MODAL (User Facing) */}
            {showSettings && (
                <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in zoom-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-lg w-full shadow-2xl text-white">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-bold">Nastavení Focení</h2>
                            <button onClick={() => setShowSettings(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20"><X /></button>
                        </div>

                        <div className="space-y-4">

                            {/* Auto Email */}
                            <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl">
                                <label className="block text-sm text-slate-400 mb-2">Automaticky posílat na Email</label>
                                <input
                                    type="email"
                                    placeholder="tvuj@email.cz"
                                    value={sessionSettings.email}
                                    onChange={(e) => setSessionSettings({ ...sessionSettings, email: e.target.value })}
                                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-lg focus:border-indigo-500 outline-none text-white font-mono"
                                />
                                <p className="text-xs text-slate-500 mt-2">Každá vyfocená fotka se hned odešle.</p>
                            </div>

                            {/* B&W Toggle */}
                            <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-between">
                                <div><h3 className="font-semibold text-lg">⚫ Černobílá fotka</h3><p className="text-slate-400 text-sm mt-1">Noir styl</p></div>
                                <button
                                    onClick={() => setSessionSettings({ ...sessionSettings, isBW: !sessionSettings.isBW })}
                                    className={`w-14 h-8 rounded-full transition-colors relative ${sessionSettings.isBW ? 'bg-indigo-500' : 'bg-slate-600'}`}
                                >
                                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform shadow-sm ${sessionSettings.isBW ? 'translate-x-7' : 'translate-x-1'}`}></div>
                                </button>
                            </div>

                            {/* Private Toggle */}
                            <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-between">
                                <div><h3 className="font-semibold text-lg">🔒 Soukromé fotky</h3><p className="text-slate-400 text-sm mt-1">Jen pro vás (neukládat do historie?)</p></div>
                                <button
                                    onClick={() => setSessionSettings({ ...sessionSettings, isPrivate: !sessionSettings.isPrivate })}
                                    className={`w-14 h-8 rounded-full transition-colors relative ${sessionSettings.isPrivate ? 'bg-indigo-500' : 'bg-slate-600'}`}
                                >
                                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform shadow-sm ${sessionSettings.isPrivate ? 'translate-x-7' : 'translate-x-1'}`}></div>
                                </button>
                            </div>

                            {!useCloudStream && (
                                <div className="p-4 rounded-xl bg-slate-950/50 text-center border border-dashed border-slate-800 mt-4">
                                    <label className="block text-xs text-slate-500 mb-1">Bridge IP (Expert)</label>
                                    <input type="text" value={cameraIp} onChange={(e) => saveIp(e.target.value)} className="w-32 bg-transparent text-center text-xs text-slate-400 outline-none" />
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}

            {/* ... GALLERY, EMAIL MODAL, CONTROLS (Standard) ... */}

            {showGallery && (
                <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col p-8 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-3xl font-bold text-white">Galerie</h2>
                        <button onClick={() => setShowGallery(false)} className="p-4 bg-white/10 rounded-full text-white hover:bg-white/20"><X size={32} /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
                        {galleryPhotos.map((photo) => (
                            <div key={photo.id} className="aspect-[3/2] bg-slate-800 rounded-xl overflow-hidden relative group">
                                <img src={photo.url} className={`w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity ${sessionSettings.isBW ? 'grayscale' : ''}`} loading="lazy" onError={(e) => { const parent = e.currentTarget.parentElement; if (parent) parent.style.display = 'none'; }} />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                    <button className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform" onClick={() => { setLastPhoto(photo.url); setStatus('review'); setShowGallery(false); }}><Printer size={20} /></button>
                                    <button className={`p-3 rounded-full hover:scale-110 transition-colors ${confirmDeleteId === photo.id ? 'bg-red-600 text-white animate-pulse' : 'bg-white/20 text-white hover:bg-red-500'}`} onClick={(e) => deletePhoto(photo.id, photo.url, e)}><Trash2 size={20} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* EMAIL MODAL */}
            {showEmailModal && (
                <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in zoom-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-lg w-full shadow-2xl text-white">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-bold">Odeslat na Email</h2>
                            <button onClick={() => setShowEmailModal(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20"><X /></button>
                        </div>
                        <div className="space-y-6">
                            <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl">
                                <label className="block text-sm text-slate-400 mb-2">Tvůj Email</label>
                                <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="tvuj@email.cz" autoFocus className="w-full p-4 bg-slate-950 border border-slate-700 rounded-lg focus:border-indigo-500 outline-none text-white text-lg placeholder-slate-600" />
                            </div>
                            <button onClick={sendEmail} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 active:scale-95"><Send size={24} /> Odeslat fotku</button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTROLS DOCK */}
            <div className="absolute bottom-10 z-30 w-full flex justify-center p-4">
                <div className="dock-container bg-black/40 backdrop-blur-xl border border-white/10 rounded-full p-4 flex items-center shadow-2xl">
                    <div className="flex gap-4 px-4">
                        <button className="flex flex-col items-center gap-1 text-white opacity-80 hover:opacity-100 hover:scale-110 transition-all font-medium text-xs" onClick={() => setShowSettings(true)}><Settings size={20} /> <span>Nastavení</span></button>
                        <button className="flex flex-col items-center gap-1 text-white opacity-80 hover:opacity-100 hover:scale-110 transition-all font-medium text-xs" onClick={openGallery}><ImageIcon size={20} /> <span>Galerie</span></button>
                    </div>
                    <div className="mx-6 relative">
                        {status === 'review' ? (
                            <button className="w-20 h-20 rounded-full border-4 border-red-500 flex items-center justify-center bg-red-500/20 hover:scale-105 transition-all shadow-lg active:scale-95" onClick={() => { setStatus('idle'); processingRef.current = false; }}><RefreshCw size={32} color="#fff" /></button>
                        ) : (
                            <button className="w-24 h-24 rounded-full border-4 border-white flex items-center justify-center bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.3)]" onClick={startCountdown}><div className="w-16 h-16 bg-white rounded-full shadow-inner"></div></button>
                        )}
                    </div>
                    <div className="flex gap-4 px-4">
                        <button className="flex flex-col items-center gap-1 text-white opacity-80 hover:opacity-100 hover:scale-110 transition-all font-medium text-xs disabled:opacity-30" disabled={status !== 'review'} onClick={printPhoto}><Printer size={20} /> <span>Tisk</span></button>
                        <button className="flex flex-col items-center gap-1 text-white opacity-80 hover:opacity-100 hover:scale-110 transition-all font-medium text-xs disabled:opacity-30" disabled={status !== 'review'} onClick={() => setShowEmailModal(true)}><Mail size={20} /> <span>Email</span></button>
                    </div>
                </div>
            </div>
        </div>
    );
}
