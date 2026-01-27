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
    const [useCloudStream, setUseCloudStream] = useState(false);

    // Auto-init logic
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsHttps(window.location.protocol === 'https:');
            // Načíst uloženou IP
            const savedIp = localStorage.getItem('camera_ip');
            if (savedIp) setCameraIp(savedIp);
            // Načíst cloud stream preferenci
            const savedCloud = localStorage.getItem('use_cloud_stream');

            // AUTOMATIKA: Pokud běžíme na veřejné Railway doméně, MUSÍME použít Cloud Stream.
            // Localhost tam nefunguje.
            const isRailway = window.location.hostname.includes('railway.app');

            if (isRailway || savedCloud === 'true') {
                setUseCloudStream(true);
                if (isRailway) localStorage.setItem('use_cloud_stream', 'true'); // Uložit pro příště
            }
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

    const saveCloud = (val: boolean) => {
        setUseCloudStream(val);
        localStorage.setItem('use_cloud_stream', String(val));
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
        console.log("Taking photo sequence...");

        if (useCloudStream) {
            // Provizorní řešení - zkusíme hitnout Bridge přímo (pro případ že jsme na stejné wifi)
            // TODO: Implementovat Cloud Trigger API
            try {
                const res = await fetch(`http://${cameraIp}:5555/shoot`, { method: 'POST' });
                const data = await res.json();
                // Pro cloud stream nemůžeme použít lokální URL pro review, musíme počkat na upload
                // Zatím jen fallback
                if (data.success) {
                    setLastPhoto(data.url.startsWith('http') ? data.url : `http://${cameraIp}:5555${data.url}`);
                    setStatus('review');
                }
            } catch (e) {
                alert('Focení v Cloud režimu zatím vyžaduje být na stejné WiFi (funkce Cloud Trigger se připravuje). Spusťte focení na počítači.');
                setStatus('idle');
            }
        } else {
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
            }
        }
        processingRef.current = false;
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
            {isHttps && !useCloudStream && cameraIp === '127.0.0.1' && status === 'idle' && (
                <div className="absolute top-4 left-4 z-40 bg-yellow-100 text-yellow-800 p-3 rounded-xl flex items-center gap-3 text-sm shadow-sm max-w-sm">
                    <AlertTriangle size={20} />
                    <div>
                        <b>Používáte HTTPS</b><br />
                        Pro fungování kamery zapněte v nastavení <b>Cloud Stream</b> nebo použijte localhost.
                    </div>
                </div>
            )}

            {/* 1. LAYER: MAIN CONTENT (Live View or Photo) */}
            <div className="absolute inset-0 bg-black flex items-center justify-center">
                {status === 'review' && lastPhoto ? (
                    <img src={lastPhoto} className="w-full h-full object-contain bg-slate-900" />
                ) : (
                    <div className="w-full h-full relative overflow-hidden">
                        {/* Live Stream MJPEG or Cloud Stream */}
                        <img
                            src={useCloudStream ? '/api/stream' : `http://${cameraIp}:5521/live`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                if (useCloudStream) return; // Necháme to na loaderu
                                const target = e.currentTarget;
                                if (target.src.includes('5521')) target.src = `http://${cameraIp}:5520/liveview.jpg`;
                                else target.style.display = 'none';
                            }}
                        />

                        {/* Fallback help text (under the image) */}
                        <div className="absolute inset-0 -z-10 flex items-center justify-center text-slate-500 text-center p-4">
                            <div>
                                <p className="font-bold mb-2 text-white">Načítám obraz...</p>
                                <p className="text-sm text-gray-400">Pokud toto vidíte dlouho, zkontrolujte Bridge.</p>
                            </div>
                        </div>

                        {/* DECORATIVE FRAME OVERLAY */}
                        <div className="absolute inset-0 border-[20px] border-black/80 pointer-events-none z-10 rounded-[30px] m-4 shadow-2xl"></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none z-10"></div>
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

                            {/* Cloud Stream Toggle */}
                            <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold mb-1">☁️ Cloud Stream</h3>
                                    <p className="text-xs text-slate-500">Pro přístup z internetu (bez kabelu/Wifi)</p>
                                </div>
                                <button
                                    onClick={() => saveCloud(!useCloudStream)}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${useCloudStream ? 'bg-purple-600' : 'bg-slate-300'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${useCloudStream ? 'translate-x-6' : 'translate-x-1'}`}></div>
                                </button>
                            </div>

                            {/* IP Config - show only if cloud stream is OFF */}
                            {!useCloudStream && (
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
                            )}

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
            <div className="absolute bottom-10 z-30 w-full flex justify-center p-4">
                <div className="dock-container bg-black/40 backdrop-blur-xl border border-white/10 rounded-full p-4 flex items-center shadow-2xl">

                    {/* Left Group */}
                    <div className="flex gap-4 px-4">
                        <button className="flex flex-col items-center gap-1 text-white opacity-80 hover:opacity-100 hover:scale-110 transition-all font-medium text-xs" onClick={() => setShowSettings(true)}>
                            <div className="p-3 bg-white/10 rounded-full border border-white/10">
                                <Settings size={20} />
                            </div>
                            <span>Nastavení</span>
                        </button>
                        <button className="flex flex-col items-center gap-1 text-white opacity-80 hover:opacity-100 hover:scale-110 transition-all font-medium text-xs">
                            <div className="p-3 bg-white/10 rounded-full border border-white/10">
                                <ImageIcon size={20} />
                            </div>
                            <span>Galerie</span>
                        </button>
                    </div>

                    {/* Center Trigger */}
                    <div className="mx-6 relative">
                        {status === 'review' ? (
                            <button className="w-20 h-20 rounded-full border-4 border-red-500 flex items-center justify-center bg-red-500/20 hover:scale-105 transition-all shadow-lg active:scale-95" onClick={() => { setStatus('idle'); processingRef.current = false; }}>
                                <RefreshCw size={32} color="#fff" />
                            </button>
                        ) : (
                            <button
                                className="w-24 h-24 rounded-full border-4 border-white flex items-center justify-center bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                                onClick={() => {
                                    console.log("Shutter clicked!");
                                    startCountdown();
                                }}
                            >
                                <div className="w-16 h-16 bg-white rounded-full shadow-inner"></div>
                            </button>
                        )}
                    </div>

                    {/* Right Group */}
                    <div className="flex gap-4 px-4">
                        <button
                            className="flex flex-col items-center gap-1 text-white opacity-80 hover:opacity-100 hover:scale-110 transition-all font-medium text-xs disabled:opacity-30 disabled:hover:scale-100"
                            disabled={status !== 'review'}
                            onClick={printPhoto}
                        >
                            <div className="p-3 bg-white/10 rounded-full border border-white/10">
                                <Printer size={20} />
                            </div>
                            <span>Tisk</span>
                        </button>
                        <button
                            className="flex flex-col items-center gap-1 text-white opacity-80 hover:opacity-100 hover:scale-110 transition-all font-medium text-xs disabled:opacity-30 disabled:hover:scale-100"
                            disabled={status !== 'review'}
                            onClick={() => alert('Zatím neimplementováno')}
                        >
                            <div className="p-3 bg-white/10 rounded-full border border-white/10">
                                <Mail size={20} />
                            </div>
                            <span>Email</span>
                        </button>
                    </div>

                </div>
            </div>

        </div>
    );
}
