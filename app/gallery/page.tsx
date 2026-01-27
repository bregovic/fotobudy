'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Home, Lock, Search, Download, Share2, X } from 'lucide-react';

// Falešná data pro ukázku (dokud nepřipojíme DB)
const MOCK_PHOTOS = [
    { id: 1, url: '/test_foto.jpg', private: false },
    { id: 2, url: '/photos/foto_1769527011887.png', private: false }, // Existující fotky
    // ... další by přišly z DB
];

export default function GalleryPage() {
    const [photos, setPhotos] = useState<any[]>([]);
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
    const [filter, setFilter] = useState<'public' | 'private'>('public');

    useEffect(() => {
        // Tady bychom fetchovali z API: /api/photos
        setPhotos(MOCK_PHOTOS);
    }, []);

    return (
        <div className="min-h-screen bg-slate-900 text-white p-4 pb-20">

            {/* Header */}
            <header className="flex items-center justify-between mb-8 max-w-7xl mx-auto pt-4">
                <Link href="/" className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                    <Home size={24} />
                </Link>
                <div className="flex gap-4">
                    <button
                        onClick={() => setFilter('public')}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${filter === 'public' ? 'bg-white text-slate-900' : 'bg-white/5 text-slate-400'}`}
                    >
                        Veřejné
                    </button>
                    <button
                        onClick={() => setFilter('private')}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${filter === 'private' ? 'bg-purple-500 text-white' : 'bg-white/5 text-slate-400'}`}
                    >
                        <Lock size={14} /> Soukromé
                    </button>
                </div>
            </header>

            {/* Gallery Grid */}
            <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 max-w-7xl mx-auto space-y-4">
                {photos.map((photo, i) => (
                    <div key={i} className="break-inside-avoid relative group rounded-2xl overflow-hidden cursor-zoom-in" onClick={() => setSelectedPhoto(photo.url)}>
                        <img
                            src={photo.url}
                            className="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                            onError={(e) => e.currentTarget.style.display = 'none'}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                            <span className="text-xs text-slate-300 font-mono">{new Date().toLocaleDateString()}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Lightbox / Detail */}
            {selectedPhoto && (
                <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
                    <button className="absolute top-4 right-4 p-4 text-white/50 hover:text-white">
                        <X size={32} />
                    </button>

                    <div className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
                        <img src={selectedPhoto} className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl" />

                        <div className="flex gap-4 mt-6">
                            <a href={selectedPhoto} download className="flex items-center gap-2 px-6 py-3 bg-white text-slate-900 rounded-full font-bold hover:bg-slate-200">
                                <Download size={20} /> Stáhnout
                            </a>
                            <button className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded-full font-bold hover:bg-white/20">
                                <Share2 size={20} /> Sdílet
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {photos.length === 0 && (
                <div className="text-center py-20 opacity-50">
                    <p>Zatím žádné fotky...</p>
                </div>
            )}

        </div>
    );
}
