'use client';
import { useState, useEffect, useRef } from 'react';
import { Camera, Image as ImageIcon, Printer, Settings, Mail, RefreshCw, X } from 'lucide-react';

const SESSION_ID = 'main';

export default function KioskPage() {
    const [status, setStatus] = useState<'idle' | 'countdown' | 'review'>('idle');
    const [countdown, setCountdown] = useState(3);
    const [lastPhoto, setLastPhoto] = useState<string | null>(null);
    const processingRef = useRef(false);
    const [showSettings, setShowSettings] = useState(false);

    // Auto-init logic
    useEffect(() => {
        fetch('/api/session', {
            method: 'POST',
            body: JSON.stringify({ id: SESSION_ID }),
        }).catch(console.error);

        // Polling loop to keep existing remote functionality working if someone scans QR
        const interval = setInterval(async () => {
            if (processingRef.current || status !== 'idle') return;
            try {
                // We can check if status is idle before checking for new triggers
                // But we need to use ref for status or ignore
                // For now, simpler:
                const res = await fetch(`/api/poll?sessionId=${SESSION_ID}`);
                const data = await res.json();
                if (data.pending) {
                    // Must trigger state update carefully
                    startCountdown();
                }
            } catch (e) { }
        }, 1000);
        return () => clearInterval(interval);
    }, [status]); // Add status to dep to avoid race conditions with polling

    const startCountdown = () => {
        // Prevent double trigger
        if (processingRef.current) return;
        processingRef.current = true; // Temporary lock

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
        try {
            // Trigger Bridge
            const res = await fetch('http://localhost:5555/shoot', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setLastPhoto(`http://localhost:5555${data.url}`);
                setStatus('review');
            }
        } catch (e) {
            alert('Nepodařilo se spojit s kamerou. Běží "node local-service/server.js"?');
            setStatus('idle');
        } finally {
            processingRef.current = false;
        }
    };

    const printPhoto = async () => {
        if (!lastPhoto) return;
        const filename = lastPhoto.split('/').pop();
        try {
            await fetch('http://localhost:5555/print', {
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

            {/* 1. LAYER: MAIN CONTENT (Live View or Photo) */}
            <div className="absolute inset-0 bg-black">
                {status === 'review' && lastPhoto ? (
                    <img src={lastPhoto} className="w-full h-full object-contain bg-slate-900" />
                ) : (
                    <div className="w-full h-full relative">
                        {/* Live Stream MJPEG */}
                        <img
                            src="http://localhost:5514/live"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                // Fallback to static JPG
                                if (e.currentTarget.src.includes('5514')) e.currentTarget.src = "http://localhost:5513/liveview.jpg";
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

                    {/* Center Trigger */}
                    <div className="mx-4">
                        {status === 'review' ? (
                            <button className="shutter-btn" onClick={() => { setStatus('idle'); processingRef.current = false; }} style={{ borderColor: '#ef4444' }}>
                                <RefreshCw size={32} color="#ef4444" />
                            </button>
                        ) : (
                            <button className="shutter-btn" onClick={startCountdown}>
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
