'use client';
import { useState, useEffect, useRef } from 'react';
import { Camera, Image as ImageIcon, Printer, Settings, Mail, RefreshCw, X, AlertTriangle } from 'lucide-react';

const SESSION_ID = 'main';
const DEFAULT_IP = '127.0.0.1';

export default function KioskPage() {
    const [status, setStatus] = useState<'idle' | 'countdown' | 'review'>('idle');
    const [countdown, setCountdown] = useState(3);
    const [lastPhoto, setLastPhoto] = useState<string | null>(null);
    const processingRef = useRef(false);
    const [showSettings, setShowSettings] = useState(false);
    const [isHttps, setIsHttps] = useState(false);

    // Konfigurovatelná IP adresa kamery (pro přístup z mobilu)
    const [cameraIp, setCameraIp] = useState(DEFAULT_IP);

    // Auto-init logic
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsHttps(window.location.protocol === 'https:');
            // Načíst uloženou IP
            const savedIp = localStorage.getItem('camera_ip');
            if (savedIp) setCameraIp(savedIp);
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
                // Tady se ptáme našeho Next.js serveru (ne kamery), takže relativní cesta je ok
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

    const saveIp = (ip: string) => {
        setCameraIp(ip);
        localStorage.setItem('camera_ip', ip);
    };

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
            // Trigger Bridge (Use configured IP)
            const res = await fetch(`http://${cameraIp}:5555/shoot`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setLastPhoto(`http://${cameraIp}:5555${data.url}`);
                setStatus('review');
            }
        } catch (e) {
            console.error(e);
            alert(`Nepodařilo se spojit s kamerou na ${cameraIp}.\nZkontrolujte IP adresu v nastavení a zda běží Bridge.`);
            setStatus('idle');
        } finally {
            processingRef.current = false;
        }
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
        } catch (e) {
            alert('Chyba tisku.');
        }
    };

    return (
        <div className="relative w-full h-full bg-gray-100 overflow-hidden flex flex-col items-center justify-center">

            {/* HTTPS Warning Overlay - only show if using localhost on https */}
            {isHttps && cameraIp === '127.0.0.1' && status === 'idle' && (
                <div className="absolute top-4 left-4 z-40 bg-yellow-100 text-yellow-800 p-3 rounded-xl flex items-center gap-3 text-sm shadow-sm max-w-sm">
                    <AlertTriangle size={20} />
                    <div>
                        <b>Používáte HTTPS</b><br />
                        Kamera běží lokálně. Pokud to zlobí, otevřete stránku přes HTTP nebo nastavte veřejnou IP tunelu.
                    </div>
                </div>
            )}

            {/* 1. LAYER: MAIN CONTENT (Live View or Photo) */}
            <div className="absolute inset-0 bg-black">
                {status === 'review' && lastPhoto ? (
                    <img src={lastPhoto} className="w-full h-full object-contain bg-slate-900" />
                ) : (
                    <div className="w-full h-full relative">
                        {/* Live Stream MJPEG (Use Configured IP) */}
                        <img
                            src={`http://${cameraIp}:5521/live`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                const target = e.currentTarget;
                                // Fallbacks logic with dynamic IP
                                if (target.src.includes('5521')) {
                                    target.src = `http://${cameraIp}:5520/liveview.jpg`;
                                }
                                else if (target.src.includes('5520')) {
                                    // As a last resort, try just the base IP if the user provided a direct stream URL? No, keep it simple.
                                    // Just valid ports.
                                    target.style.display = 'none';
                                }
                            }}
                        />

                        {/* Fallback help text */}
                        <div className="absolute inset-0 -z-10 flex items-center justify-center text-slate-500 text-center p-4">
                            <div>
                                <p className="font-bold mb-2">Hledám signál kamery...</p>
                                <p className="font-mono text-sm bg-slate-200 px-2 py-1 rounded mb-2">{cameraIp}</p>
                                <p className="text-sm">Zkouším porty 5521, 5520.</p>
                                <p className="text-xs mt-2 opacity-70">Běží DigiCamControl (jako Správce)?</p>
                            </div>
                        </div>

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

                            {/* IP Config */}
                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                                <h3 className="font-semibold mb-2 flex items-center gap-2">🔗 IP Adresa Kamery</h3>
                                <input
                                    type="text"
                                    value={cameraIp}
                                    onChange={(e) => saveIp(e.target.value)}
                                    className="w-full p-2 border border-slate-300 rounded-lg font-mono text-sm"
                                    placeholder="např. 192.168.0.105"
                                />
                                <p className="text-xs text-slate-500 mt-2">
                                    Pro místní PC zadejte <b>127.0.0.1</b>.<br />
                                    Pro ovládání z mobilu zadejte <b>IP adresu počítače</b>.
                                </p>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-xl">
                                <h3 className="font-semibold mb-2">Výplň</h3>
                                <div className="flex gap-2">
                                    {['#fff', '#000', 'linear-gradient(45deg, #ff9a9e 0%, #fad0c4 99%, #fad0c4 100%)'].map((bg, i) => (
                                        <div key={i} className="w-12 h-12 rounded-full border-2 border-slate-200 cursor-pointer" style={{ background: bg }}></div>
                                    ))}
                                </div>
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

                    {/* Center Trigger */}
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
