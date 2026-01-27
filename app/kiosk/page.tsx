'use client';
import { useState, useEffect, useRef } from 'react';
import { Camera, Image as ImageIcon, Printer, Settings, Mail, RefreshCw, X, AlertTriangle } from 'lucide-react';

const SESSION_ID = 'main';

export default function KioskPage() {
    const [status, setStatus] = useState<'idle' | 'countdown' | 'review'>('idle');
    const [countdown, setCountdown] = useState(3);
    const [lastPhoto, setLastPhoto] = useState<string | null>(null);
    const processingRef = useRef(false);
    const [showSettings, setShowSettings] = useState(false);
    const [isHttps, setIsHttps] = useState(false);

    // Auto-init logic
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsHttps(window.location.protocol === 'https:');
        }

        fetch('/api/session', {
            method: 'POST',
            body: JSON.stringify({ id: SESSION_ID }),
        }).catch(console.error);

        // Polling loop
        const interval = setInterval(async () => {
            // Pokud běží odpočet nebo se fotí, neptáme se serveru
            if (processingRef.current || status !== 'idle') return;

            try {
                const res = await fetch(`/api/poll?sessionId=${SESSION_ID}`);
                const data = await res.json();
                if (data.pending) {
                    console.log("Remote trigger received!");
                    startCountdown();
                }
            } catch (e) { }
        }, 1000);
        return () => clearInterval(interval);
    }, [status]);

    const startCountdown = () => {
        console.log("Starting countdown...");
        if (processingRef.current) return;
        processingRef.current = true;

        setStatus('countdown');
        let count = 3;
        setCountdown(count);

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
        console.log("Taking photo...");
        try {
            // Trigger Bridge (Use 127.0.0.1 explicitly)
            const res = await fetch('http://127.0.0.1:5555/shoot', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setLastPhoto(`http://127.0.0.1:5555${data.url}`);
                setStatus('review');
            }
        } catch (e) {
            console.error(e);
            alert('Nepodařilo se spojit s kamerou. Ujistěte se, že:\n1. Běží node local-service/server.js\n2. Pokud jste na HTTPS, povolili jste "Nezabezpečený obsah".');
            setStatus('idle');
        } finally {
            processingRef.current = false;
        }
    };

    const printPhoto = async () => {
        if (!lastPhoto) return;
        const filename = lastPhoto.split('/').pop();
        try {
            await fetch('http://127.0.0.1:5555/print', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });
            alert('Odesláno na tiskárnu! 🖨️');
        } catch (e) {
            alert('Chyba tisku.');
        }
    };

    return (
        <div className="relative w-full h-full bg-gray-100 overflow-hidden flex flex-col items-center justify-center">

            {/* HTTPS Warning Overlay */}
            {isHttps && status === 'idle' && (
                <div className="absolute top-4 left-4 z-40 bg-yellow-100 text-yellow-800 p-3 rounded-xl flex items-center gap-3 text-sm shadow-sm max-w-sm">
                    <AlertTriangle size={20} />
                    <div>
                        <b>Používáte HTTPS (Railway)</b><br />
                        Kamera běží na HTTP. Pokud to zlobí, otevřete stránku přes <a href="http://127.0.0.1:3000/kiosk" className="underline font-bold">http://localhost:3000</a>
                    </div>
                </div>
            )}

            {/* 1. LAYER: MAIN CONTENT (Live View or Photo) */}
            <div className="absolute inset-0 bg-black">
                {status === 'review' && lastPhoto ? (
                    <img src={lastPhoto} className="w-full h-full object-contain bg-slate-900" />
                ) : (
                    <div className="w-full h-full relative">
                        {/* Live Stream MJPEG (Use 127.0.0.1) */}
                        <img
                            src="http://127.0.0.1:5514/live"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                // Fallback to port 5513
                                if (e.currentTarget.src.includes('5514')) e.currentTarget.src = "http://127.0.0.1:5513/liveview.jpg";
                                else e.currentTarget.style.display = 'none';
                            }}
                        />
                    </div>
                )}
            </div>

            {/* 2. LAYER: OVERLAYS */}

            {/* Countdown Overlay */}
            {status === 'countdown' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-20">
                    <div className="text-[15rem] font-black text-white drop-shadow-2xl animate-bounce">
                        {countdown}
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettings && (
                <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-8">
                    <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold">Nastavení</h2>
                            <button onClick={() => setShowSettings(false)}><X /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 rounded-xl">
                                <h3 className="font-semibold mb-2">Pozadí</h3>
                                <div className="flex gap-2">
                                    {['#fff', '#000', 'linear-gradient(45deg, #ff9a9e 0%, #fad0c4 99%, #fad0c4 100%)'].map((bg, i) => (
                                        <div key={i} className="w-12 h-12 rounded-full border-2 border-slate-200 cursor-pointer" style={{ background: bg }}></div>
                                    ))}
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-xl">
                                <h3 className="font-semibold mb-2">Tiskárna</h3>
                                <p className="text-sm text-slate-500">Výchozí systémová tiskárna</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. LAYER: CONTROLS (Bottom Dock) */}
            <div className="absolute bottom-8 z-30 w-full flex justify-center p-4">
                <div className="dock-container">

                    {/* Left Group */}
                    <div className="flex gap-2">
                        <button className="icon-btn" onClick={() => setShowSettings(true)}>
                            <Settings size={24} />
                            <span>Nastavení</span>
                        </button>
                        <button className="icon-btn">
                            <ImageIcon size={24} />
                            <span>Galerie</span>
                        </button>
                    </div>

                    {/* Center Trigger with active effect */}
                    <div className="mx-4">
                        {status === 'review' ? (
                            <button className="shutter-btn" onClick={() => { setStatus('idle'); processingRef.current = false; }} style={{ borderColor: '#ef4444' }}>
                                <RefreshCw size={32} color="#ef4444" />
                            </button>
                        ) : (
                            <button
                                className="shutter-btn transform active:scale-90 transition-transform duration-100"
                                onClick={() => {
                                    console.log("Shutter clicked!");
                                    startCountdown();
                                }}
                            >
                                <div className="shutter-inner"></div>
                            </button>
                        )}
                    </div>

                    {/* Right Group */}
                    <div className="flex gap-2">
                        <button
                            className="icon-btn"
                            disabled={status !== 'review'}
                            style={{ opacity: status === 'review' ? 1 : 0.3 }}
                            onClick={printPhoto}
                        >
                            <Printer size={24} />
                            <span>Tisk</span>
                        </button>
                        <button
                            className="icon-btn"
                            disabled={status !== 'review'}
                            style={{ opacity: status === 'review' ? 1 : 0.3 }}
                            onClick={() => alert('Zatím neimplementováno')}
                        >
                            <Mail size={24} />
                            <span>Email</span>
                        </button>
                    </div>

                </div>
            </div>

        </div>
    );
}
