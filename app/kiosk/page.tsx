'use client';
import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

// Používáme jednu globální session pro zjednodušení (stačí pro jednu fotobudku)
const SESSION_ID = 'main';

export default function KioskPage() {
    const [remoteUrl, setRemoteUrl] = useState('');
    const [status, setStatus] = useState('Initializing...');
    const [lastPhoto, setLastPhoto] = useState<string | null>(null);
    const processingRef = useRef(false);

    useEffect(() => {
        // 1. Nastavit URL pro ovladač (bez parametrů)
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.origin);
            url.pathname = '/remote';
            setRemoteUrl(url.toString());
        }

        // Registrace 'main' session
        fetch('/api/session', {
            method: 'POST',
            body: JSON.stringify({ id: SESSION_ID }),
        }).catch(err => console.error('Session reg failed', err));

        setStatus('Ready');

        // 2. Poll for commands (posloucháme na kanálu 'main')
        const interval = setInterval(async () => {
            if (processingRef.current) return;

            try {
                const res = await fetch(`/api/poll?sessionId=${SESSION_ID}`);
                const data = await res.json();

                if (data.pending && data.command) {
                    processingRef.current = true;
                    setStatus('📸 Focení...');

                    try {
                        // 3. Call Local Bridge
                        const bridgeRes = await fetch('http://localhost:5555/shoot', { method: 'POST' });
                        const bridgeData = await bridgeRes.json();

                        if (bridgeData.success) {
                            setLastPhoto(`http://localhost:5555${bridgeData.url}`);
                            setStatus('Hotovo!');

                            // 4. Mark complete
                            await fetch('/api/complete', {
                                method: 'POST',
                                body: JSON.stringify({ id: data.command.id, filename: bridgeData.filename })
                            });

                            setTimeout(() => setStatus('Ready (Čekám na příkaz)'), 3000);
                        }
                    } catch (e) {
                        console.error(e);
                        setStatus('Chyba: Zkontrolujte Bridge aplikaci (localhost:5555)');
                    } finally {
                        processingRef.current = false;
                    }
                }
            } catch (e) {
                console.error('Poll error', e);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="container" style={{ textAlign: 'center', paddingTop: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', justifyContent: 'flex-start' }}>

            {/* Hlavní zobrazení */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                {lastPhoto ? (
                    <div className="glass-panel" style={{ padding: '1rem', animation: 'fadeIn 0.5s' }}>
                        <img src={lastPhoto} alt="Captured" style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: '12px' }} />
                    </div>
                ) : (
                    <>
                        <h2 className="title-gradient" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
                            Připojte se
                        </h2>
                        <div className="glass-panel" style={{ padding: '2rem', background: 'white', borderRadius: '24px' }}>
                            <QRCodeSVG value={remoteUrl} size={300} />
                        </div>
                        <div style={{ marginTop: '2rem', fontSize: '1.2rem', color: '#94a3b8' }}>
                            Naskenujte QR kód nebo jděte na <br />
                            <b>{remoteUrl ? remoteUrl.replace('https://', '').replace('http://', '') : '...'}</b>
                        </div>
                    </>
                )}
            </div>

            {/* Stavový řádek */}
            <div style={{ padding: '2rem', width: '100%', maxWidth: '800px' }}>
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Status: <b>{status}</b></span>
                    <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Bridge připojen</span>
                </div>
            </div>
        </div>
    );
}
