'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Media {
    id: string; // filename
    url: string;
    createdAt: string;
}

export default function GalleryPage() {
    const router = useRouter();
    const [photos, setPhotos] = useState<Media[]>([]);
    const [selectedPhoto, setSelectedPhoto] = useState<Media | null>(null);
    const [printing, setPrinting] = useState(false);

    useEffect(() => {
        fetch('/api/media/list')
            .then(res => res.json())
            .then(data => setPhotos(data))
            .catch(err => console.error(err));
    }, []);

    const handlePrint = async () => {
        if (!selectedPhoto) return;
        setPrinting(true);
        try {
            const res = await fetch('/api/print', {
                method: 'POST',
                body: JSON.stringify({ filename: selectedPhoto.id })
            });
            if (res.ok) {
                alert('Odesláno na tiskárnu ✅');
                setSelectedPhoto(null);
            } else {
                alert('Chyba tisku ❌');
            }
        } catch (e) {
            alert('Chyba spojení');
        } finally {
            setPrinting(false);
        }
    };

    return (
        <div className="container" style={{ padding: '1rem', minHeight: '100vh', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <button
                    onClick={() => router.back()}
                    style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}
                >
                    ⬅️ Zpět
                </button>
                <h1 className="title-gradient" style={{ margin: 0, fontSize: '1.5rem' }}>Galerie</h1>
                <div style={{ width: '2rem' }}></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.5rem' }}>
                {photos.map(p => (
                    <div
                        key={p.id}
                        onClick={() => setSelectedPhoto(p)}
                        style={{ aspectRatio: '3/2', overflow: 'hidden', borderRadius: '0.5rem', position: 'relative' }}
                    >
                        <img
                            src={p.url}
                            loading="lazy"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    </div>
                ))}
            </div>

            {selectedPhoto && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.9)', zIndex: 100,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                }}>
                    <img
                        src={selectedPhoto.url}
                        style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', marginBottom: '2rem' }}
                    />

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            onClick={handlePrint}
                            disabled={printing}
                            className="btn-primary"
                            style={{ padding: '1rem 2rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            {printing ? 'Odesílám...' : '🖨️ VYTISKNOUT'}
                        </button>

                        <button
                            onClick={() => setSelectedPhoto(null)}
                            style={{
                                padding: '1rem', background: 'rgba(255,255,255,0.1)', border: 'none',
                                borderRadius: '0.5rem', color: 'white', cursor: 'pointer'
                            }}
                        >
                            ❌ Zavřít
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
