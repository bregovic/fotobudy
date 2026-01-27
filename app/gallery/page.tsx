'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Home, Image as ImageIcon, X } from 'lucide-react';

export default function GalleryPage() {
    const [photos, setPhotos] = useState<any[]>([]);
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/media/list')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setPhotos(data);
            })
            .catch(console.error);
    }, []);

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4">

            {/* Header */}
            <div className="flex items-center justify-between mb-8 max-w-6xl mx-auto mt-4">
                <Link href="/" className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors flex items-center gap-2">
                    <Home size={20} />
                    <span>Zpět</span>
                </Link>
                <h1 className="text-3xl font-bold flex items-center gap-2"><ImageIcon /> Galerie</h1>
                <div className="w-10" /> {/* Spacer */}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                {photos.map((photo) => (
                    <div
                        key={photo.id}
                        className="aspect-[3/2] bg-slate-900 rounded-xl overflow-hidden cursor-pointer hover:scale-105 transition-transform shadow-lg border border-white/5"
                        onClick={() => setSelectedPhoto(photo.url)}
                    >
                        <img
                            src={photo.url}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                                const parent = e.currentTarget.parentElement;
                                if (parent) parent.style.display = 'none';
                            }}
                        />
                    </div>
                ))}
            </div>

            {/* Empty State */}
            {photos.length === 0 && (
                <div className="text-center text-slate-500 mt-20">
                    <p>Zatím žádné fotky...</p>
                </div>
            )}

            {/* Fullscreen Overlay */}
            {selectedPhoto && (
                <div
                    className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setSelectedPhoto(null)}
                >
                    <button className="absolute top-4 right-4 p-4 text-white hover:text-red-400">
                        <X size={40} />
                    </button>
                    <img
                        src={selectedPhoto}
                        className="max-w-full max-h-full rounded-lg shadow-2xl"
                    />
                </div>
            )}
        </div>
    );
}
