'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function RemoteContent() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session');
    const [counting, setCounting] = useState(false);
    const [count, setCount] = useState(3);
    const [error, setError] = useState('');

    const handleShoot = async () => {
        if (counting) return;
        setCounting(true);
        setCount(3);
        setError('');

        // Simulate countdown logic locally for UX
        const timer = setInterval(() => {
            setCount((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0; // Trigger action
                }
                return prev - 1;
            });
        }, 1000);

        // Wait for countdown to finish before sending trigger?
        // Or send trigger immediately and let kiosk do countdown?
        // Logic: User sees 3..2..1.. then Request is sent.

        setTimeout(async () => {
            setCounting(false); // Reset UI
            // Send Trigger
            try {
                const res = await fetch('/api/trigger', {
                    method: 'POST',
                    body: JSON.stringify({ sessionId })
                });
                const data = await res.json();
                if (!data.success) {
                    setError('Nepodařilo se odeslat příkaz.');
                }
            } catch (e) {
                console.error(e);
                setError('Chyba připojení.');
            }
        }, 3500); // 3s countdown + buffer
    };

    if (!sessionId) {
        return (
            <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
                <h1 style={{ color: 'var(--error)' }}>Chyba připojení</h1>
                <p>Není zadán kód relace. Naskenujte QR kód znovu.</p>
            </div>
        );
    }

    return (
        <div className="container" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ position: 'absolute', top: '1rem', left: '1rem', opacity: 0.5, fontSize: '0.8rem' }}>
                ID: {sessionId}
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
                            flexDirection: 'column'
                        }}
                    >
                        <span style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📷</span>
                        VYFOTIT
                    </button>

                    {error && <p style={{ color: 'var(--error)', marginTop: '1rem' }}>{error}</p>}

                    <div style={{ marginTop: '4rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%', maxWidth: '400px' }}>
                        <button className="glass-panel" style={{ padding: '1.25rem', color: 'white', border: 'none', background: 'rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                            🖼️ Pozadí
                        </button>
                        <button className="glass-panel" style={{ padding: '1.25rem', color: 'white', border: 'none', background: 'rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                            🖨️ Tisk
                        </button>
                    </div>
                </>
            )}
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
