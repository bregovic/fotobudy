'use client';
import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const SESSION_ID = 'main'; // Globální session pro zjednodušení

function RemoteContent() {
    const searchParams = useSearchParams();
    // Použijeme parametr session, pokud existuje (pro zpětnou kompatibilitu), jinak 'main'
    const sessionId = searchParams.get('session') || SESSION_ID;
    const [counting, setCounting] = useState(false);
    const [count, setCount] = useState(3);
    const [error, setError] = useState('');

    const router = useRouter();

    const handleShoot = async () => {
        if (counting) return;
        setCounting(true);
        setCount(3);
        setError('');

        // 1. Send Trigger IMMEDIATELY with delay
        try {
            fetch('/api/trigger', {
                method: 'POST',
                body: JSON.stringify({ sessionId, delay: 3500 }) // 3.5s delay on server
            }).catch(e => setError('Chyba odeslání'));
        } catch (e) { }

        // 2. Start Local UI Countdown (optimistically synced)
        const timer = setInterval(() => {
            setCount((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    // Keep "0" (Camera emoji) visible for a bit
                    setTimeout(() => setCounting(false), 2000);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    return (
        <div className="container" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>

            {/* Live View Background */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, opacity: 0.3, pointerEvents: 'none' }}>
                <img
                    src="/api/stream"
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => e.currentTarget.style.display = 'none'}
                />
            </div>

            <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ position: 'absolute', top: '-4rem', left: '0', opacity: 0.5, fontSize: '0.8rem' }}>
                    Remote
                </div>

                {counting ? (
                    <div style={{ fontSize: '10rem', fontWeight: 'bold', color: 'white', animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite' }}>
                        {count === 0 ? '📸' : count}
                    </div>
                ) : (
                    <>
                        <h1 className="title-gradient" style={{ marginBottom: '3rem', fontSize: '2.5rem' }}>Ovladač</h1>

                        <button
                            onClick={handleShoot}
                            className="btn-primary"
                            style={{
                                width: '220px',
                                height: '220px',
                                borderRadius: '50%',
                                fontSize: '1.8rem',
                                boxShadow: '0 0 60px rgba(59, 130, 246, 0.4)',
                                border: '6px solid rgba(255,255,255,0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'column',
                                background: 'rgba(59, 130, 246, 0.9)'
                            }}
                        >
                            <span style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📷</span>
                            VYFOTIT
                        </button>

                        {error && <p style={{ color: 'var(--error)', marginTop: '1rem', background: 'rgba(0,0,0,0.8)', padding: '0.5rem', borderRadius: '0.5rem' }}>{error}</p>}

                        <div style={{ marginTop: '4rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%', maxWidth: '400px' }}>
                            <button
                                onClick={() => router.push('/remote/gallery')}
                                className="glass-panel"
                                style={{ padding: '1.25rem', color: 'white', border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', backdropFilter: 'blur(10px)' }}
                            >
                                🖼️ Galerie
                            </button>
                            <button
                                onClick={() => router.push('/remote/gallery')}
                                className="glass-panel"
                                style={{ padding: '1.25rem', color: 'white', border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', backdropFilter: 'blur(10px)' }}
                            >
                                🖨️ Tisk
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default function RemotePage() {
    return (
        <Suspense fallback={<div className="container" style={{ textAlign: 'center', marginTop: '50%' }}>Načítání ovladače...</div>}>
            <RemoteContent />
        </Suspense>
    );
}
