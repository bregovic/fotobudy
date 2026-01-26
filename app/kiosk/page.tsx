'use client';
import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

// Používáme jednu globální session
const SESSION_ID = 'main';

export default function KioskPage() {
    const [remoteUrl, setRemoteUrl] = useState('');
    const [status, setStatus] = useState<'idle' | 'countdown' | 'capturing' | 'review'>('idle');
    const [countdown, setCountdown] = useState(3);
    const [lastPhoto, setLastPhoto] = useState<string | null>(null);
    const processingRef = useRef(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.origin);
            url.pathname = '/remote';
            setRemoteUrl(url.toString());
        }

        fetch('/api/session', {
            method: 'POST',
            body: JSON.stringify({ id: SESSION_ID }),
        }).catch(err => console.error('Session reg failed', err));

        const interval = setInterval(async () => {
            if (processingRef.current) return;

            try {
                const res = await fetch(`/api/poll?sessionId=${SESSION_ID}`);
                const data = await res.json();

                if (data.pending && data.command) {
                    processingRef.current = true;

                    // 1. Spustit odpočet
                    setStatus('countdown');
                    let count = 3;
                    setCountdown(count);

                    const countTimer = setInterval(() => {
                        count--;
                        setCountdown(count);
                        if (count === 0) {
                            clearInterval(countTimer);
                            performCapture(data.command.id);
                        }
                    }, 1000);
                }
            } catch (e) {
                console.error('Poll error', e);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const performCapture = async (commandId: number) => {
        setStatus('capturing');
        try {
            const bridgeRes = await fetch('http://localhost:5555/shoot', { method: 'POST' });
            const bridgeData = await bridgeRes.json();

            if (bridgeData.success) {
                setLastPhoto(`http://localhost:5555${bridgeData.url}`);
                setStatus('review');

                await fetch('/api/complete', {
                    method: 'POST',
                    body: JSON.stringify({ id: commandId, filename: bridgeData.filename })
                });

                // Zobrazit fotku na 5 sekund, pak zpět na Live View
                setTimeout(() => {
                    setStatus('idle');
                    processingRef.current = false;
                }, 5000);
            }
        } catch (e) {
            console.error(e);
            setStatus('idle');
            processingRef.current = false;
            alert('Chyba spojení s kamerou.');
        }
    };

    return (
        <div className="container" style={{ textAlign: 'center', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1rem' }}>

            {/* Hlavní scéna */}
            <div style={{ flex: 1, position: 'relative', borderRadius: '24px', overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

                {/* 1. LIVE VIEW (DigiCamControl Stream) */}
                {status === 'idle' || status === 'countdown' ? (
                    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                        {/* Live stream z DCC webserveru (nutno zapnout v DCC: File->Settings->Web Server->Port 5513) */}
                        <img
                            src="http://localhost:5513/liveview.jpg"
                            onError={(e) => {
                                // Fallback pokud nebeží stream
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement!.style.background = '#1e293b'; // Fallback color
                            }}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />

                        {/* Fallback text pokud se nenačte obrázek */}
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 0, color: '#64748b', pointerEvents: 'none' }}>
                            <p>Live View</p>
                            <p style={{ fontSize: '0.8rem' }}>(Zapněte v DigiCamControl: File - Settings - Webserver - Port 5513)</p>
                            <div style={{ marginTop: '2rem' }}>Připojit se:</div>
                            <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', display: 'inline-block', marginTop: '1rem' }}>
                                <QRCodeSVG value={remoteUrl} size={150} />
                            </div>
                        </div>
                    </div>
                ) : null}

                {/* 2. ODPOČET */}
                {status === 'countdown' && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(5px)', zIndex: 10 }}>
                        <div style={{ fontSize: '15rem', fontWeight: 900, color: 'white', textShadow: '0 0 50px rgba(59, 130, 246, 0.8)', animation: 'ping 1s infinite' }}>
                            {countdown}
                        </div>
                    </div>
                )}

                {/* 3. FLASH EFFECT */}
                {status === 'capturing' && (
                    <div style={{ position: 'absolute', inset: 0, background: 'white', animation: 'fadeOut 0.5s forwards', zIndex: 20 }}></div>
                )}

                {/* 4. VÝSLEDEK (Review) */}
                {status === 'review' && lastPhoto && (
                    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000', zIndex: 5 }}>
                        <img src={lastPhoto} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        <div style={{ position: 'absolute', bottom: '2rem', left: 0, right: 0, textAlign: 'center' }}>
                            <span className="glass-panel" style={{ padding: '0.5rem 1.5rem', color: 'white', fontSize: '1.2rem' }}>
                                🎉 Skvělá fotka!
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Spodní info panel - jen když se nic neděje */}
            {status === 'idle' && (
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', padding: '0 1rem', color: '#64748b', fontSize: '0.9rem' }}>
                    <span>🔗 {remoteUrl.replace('https://', '').replace('http://', '')}</span>
                    <span>📷 Canon 5D Mark II</span>
                </div>
            )}
        </div>
    );
}
