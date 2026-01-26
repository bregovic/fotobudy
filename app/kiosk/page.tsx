'use client';
import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function KioskPage() {
    const [sessionId, setSessionId] = useState('');
    const [remoteUrl, setRemoteUrl] = useState('');
    const [status, setStatus] = useState('Initializing...');
    const [lastPhoto, setLastPhoto] = useState<string | null>(null);
    const processingRef = useRef(false);

    useEffect(() => {
        // 1. Generate ID and Register
        const id = Math.random().toString(36).substring(2, 7).toUpperCase();
        setSessionId(id);

        // Check if we are client side before using window
        if (typeof window !== 'undefined') {
            setRemoteUrl(`${window.location.origin}/remote?session=${id}`);
        }

        fetch('/api/session', {
            method: 'POST',
            body: JSON.stringify({ id }),
        }).catch(err => console.error('Session reg failed', err));

        setStatus('Ready');

        // 2. Poll for commands
        const interval = setInterval(async () => {
            if (processingRef.current) return;

            try {
                const res = await fetch(`/api/poll?sessionId=${id}`);
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

                            setTimeout(() => setStatus('Ready (Waiting for command)'), 3000);
                        }
                    } catch (e) {
                        console.error(e);
                        setStatus('Error: Check Bridge (localhost:5555)');
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

    if (!sessionId) return <div className="container" style={{ textAlign: 'center', marginTop: '20%' }}>Načítání systému...</div>;

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
                        <div style={{ marginTop: '2rem', fontSize: '1.5rem', fontFamily: 'monospace' }}>
                            Kód: <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{sessionId}</span>
                        </div>
                    </>
                )}
            </div>

            {/* Stavový řádek */}
            <div style={{ padding: '2rem', width: '100%', maxWidth: '800px' }}>
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Status: <b>{status}</b></span>
                    <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Bridge: http://localhost:5555</span>
                </div>
            </div>
        </div>
    );
}
