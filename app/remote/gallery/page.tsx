'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Calendar, Download, Image as ImageIcon, X, RefreshCcw, Camera } from 'lucide-react';

interface Media {
    id: string; // filename
    url: string;
    createdAt: string;
}

interface Event {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    createdAt: string;
}

export default function GalleryPage() {
    const router = useRouter();
    const [photos, setPhotos] = useState<Media[]>([]);
    const [selectedPhoto, setSelectedPhoto] = useState<Media | null>(null);
    const [printing, setPrinting] = useState(false);

    // Event Selection
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>('');

    // Load Events
    useEffect(() => {
        fetch('/api/event')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setEvents(data);
                    // Default to active or first
                    const active = data.find(e => e.isActive);
                    if (active) setSelectedEventId(active.id);
                    else if (data.length > 0) setSelectedEventId(data[0].id);
                }
            })
            .catch(err => console.error(err));
    }, []);

    // Load Photos when Event Changes
    useEffect(() => {
        if (!selectedEventId) return;

        fetch(`/api/media/list?eventId=${selectedEventId}`)
            .then(res => res.json())
            .then(data => setPhotos(data))
            .catch(err => console.error(err));
    }, [selectedEventId]);

    const handlePrint = async () => {
        if (!selectedPhoto) return;
        setPrinting(true);
        try {
            const res = await fetch('/api/print', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: selectedPhoto.id })
            });
            if (res.ok) {
                alert('Odesláno na tiskárnu ✅'); // Simple alert for now, could be toast
                setPrinting(false);
            } else {
                alert('Chyba tisku ❌');
                setPrinting(false);
            }
        } catch (e) {
            alert('Chyba spojení');
            setPrinting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col">
            {/* Header */}
            <header className="p-6 bg-slate-900 border-b border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg z-10">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button
                        onClick={() => router.back()}
                        className="p-3 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-200 transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-2">
                        <ImageIcon className="text-indigo-400" /> Galerie
                    </h1>
                </div>

                {/* Event Selector */}
                <div className="flex items-center gap-3 bg-slate-800 p-2 rounded-xl border border-slate-700 w-full md:w-auto">
                    <Calendar size={20} className="text-slate-400 ml-2" />
                    <select
                        value={selectedEventId}
                        onChange={(e) => setSelectedEventId(e.target.value)}
                        className="bg-transparent text-white font-bold outline-none w-full md:w-64 cursor-pointer"
                    >
                        {events.length === 0 && <option value="">Načítám události...</option>}
                        {events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(ev => (
                            <option key={ev.id} value={ev.id} className="bg-slate-900">
                                {ev.name} {ev.isActive ? '(Aktivní)' : ''}
                            </option>
                        ))}
                    </select>
                </div>
            </header>

            {/* Gallery Grid */}
            <main className="flex-1 p-4 md:p-6 overflow-y-auto">
                {photos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                        <Camera size={48} className="mb-4 opacity-50" />
                        <p>Zatím žádné fotky v této události.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {photos.map(p => (
                            <div
                                key={p.id}
                                onClick={() => setSelectedPhoto(p)}
                                className="aspect-[3/2] bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:border-indigo-500 hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer group relative"
                            >
                                <img
                                    src={p.url}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    alt="Photo"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">Zvětšit</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Lightbox */}
            {selectedPhoto && (
                <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
                    {/* Toolbar */}
                    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-gradient-to-b from-black/80 to-transparent">
                        <button onClick={() => setSelectedPhoto(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors"><X size={24} /></button>
                        <div className="flex gap-4">
                            <a href={selectedPhoto.url} download className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-full font-bold backdrop-blur-md transition-all">
                                <Download size={20} /> <span className="hidden md:inline">Stáhnout</span>
                            </a>
                            <button
                                onClick={handlePrint}
                                disabled={printing}
                                className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold shadow-lg transition-all ${printing ? 'bg-slate-600 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                            >
                                <Printer size={20} /> <span className="hidden md:inline">{printing ? 'Odesílám...' : 'Vytisknout'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Image */}
                    <div className="flex-1 flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
                        <img
                            src={selectedPhoto.url}
                            className="max-w-full max-h-[85vh] object-contain shadow-2xl rounded-lg select-none"
                            onClick={(e) => e.stopPropagation()} // Prevent close on image click
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
