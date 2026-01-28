'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Home, Image as ImageIcon, X, Printer, Mail, Send } from 'lucide-react';

export default function GalleryPage() {
    const [photos, setPhotos] = useState<any[]>([]);
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

    // Konfigurace pro akce
    const [cameraIp, setCameraIp] = useState('127.0.0.1');
    const [smtpConfig, setSmtpConfig] = useState<any>(null);

    // Email Modal stavy
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailInput, setEmailInput] = useState('');

    // Toast notifikace
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const showToast = (msg: string) => {
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setToastMessage(msg);
        toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
    };

    // Načtení fotek a konfigurace
    useEffect(() => {
        // Fotky
        fetch('/api/media/list')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setPhotos(data);
            })
            .catch(console.error);

        // Konfigurace z LocalStorage (sdílená s Kioskem/Profilem)
        if (typeof window !== 'undefined') {
            const savedIp = localStorage.getItem('camera_ip');
            if (savedIp) setCameraIp(savedIp);

            const savedSmtp = localStorage.getItem('smtp_config');
            if (savedSmtp) {
                try {
                    setSmtpConfig(JSON.parse(savedSmtp));
                } catch (e) { }
            }
        }
    }, []);

    // --- ACTIONS ---

    const printPhoto = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Aby se nezavřel overlay
        if (!selectedPhoto) return;

        const filename = selectedPhoto.split('/').pop();
        showToast('Odesílám na tiskárnu... 🖨️');

        try {
            // Tisk probíhá přes lokální bridge (stejně jako v kiosku)
            await fetch(`http://${cameraIp}:5555/print`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });
        } catch (err) {
            showToast('Chyba tisku (běží Bridge?) ❌');
        }
    };

    const openEmailModal = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowEmailModal(true);
    };

    const sendEmail = async () => {
        if (!emailInput.includes('@')) {
            showToast('Zadej platný email!');
            return;
        }
        showToast('Odesílám email... 📨');

        try {
            const res = await fetch('/api/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: emailInput,
                    photoUrl: selectedPhoto,
                    smtpConfig: smtpConfig
                })
            });
            const data = await res.json();

            if (data.success) showToast('Email odeslán! ✅');
            else showToast('Chyba odesílání ❌');

            setShowEmailModal(false);
            setEmailInput('');
        } catch (e) { showToast('Chyba komunikace ❌'); }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4 relative">

            {/* Toast Container */}
            {toastMessage && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
                    <div className="bg-white/10 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-white/20 font-medium">
                        {toastMessage}
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-8 max-w-6xl mx-auto mt-4">
                <Link href="/" className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors flex items-center gap-2">
                    <Home size={20} />
                    <span>Zpět</span>
                </Link>
                <h1 className="text-3xl font-bold flex items-center gap-2"><ImageIcon /> Galerie</h1>
                <div className="w-10" />
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
                            className="w-full h-full object-cover transition-opacity duration-500"
                            loading="lazy"
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
                    className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => { if (!showEmailModal) setSelectedPhoto(null); }}
                >
                    <button className="absolute top-4 right-4 p-4 text-white/50 hover:text-white transition-colors" onClick={() => setSelectedPhoto(null)}>
                        <X size={40} />
                    </button>

                    <div className="relative max-w-5xl w-full flex-1 flex items-center justify-center p-4">
                        <img
                            src={selectedPhoto}
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()} // Kliknutí na fotku nezavře overlay
                        />
                    </div>

                    {/* Actions Bar */}
                    <div className="mb-8 flex gap-4" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={printPhoto}
                            className="flex items-center gap-2 px-8 py-4 bg-white text-black rounded-full font-bold hover:scale-105 transition-transform shadow-lg active:scale-95"
                        >
                            <Printer size={24} /> Tisk
                        </button>
                        <button
                            onClick={openEmailModal}
                            className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-full font-bold hover:bg-indigo-500 transition-colors shadow-lg active:scale-95"
                        >
                            <Mail size={24} /> Email
                        </button>
                    </div>
                </div>
            )}

            {/* EMAIL MODAL (Nested) */}
            {showEmailModal && (
                <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in zoom-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-lg w-full shadow-2xl text-white">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-bold">Odeslat na Email</h2>
                            <button onClick={() => setShowEmailModal(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20"><X /></button>
                        </div>
                        <div className="space-y-6">
                            <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl">
                                <label className="block text-sm text-slate-400 mb-2">Tvůj Email</label>
                                <input
                                    type="email"
                                    value={emailInput}
                                    onChange={(e) => setEmailInput(e.target.value)}
                                    placeholder="tvuj@email.cz"
                                    autoFocus
                                    className="w-full p-4 bg-slate-950 border border-slate-700 rounded-lg focus:border-indigo-500 outline-none text-white text-lg placeholder-slate-600"
                                />
                            </div>
                            <button onClick={sendEmail} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 active:scale-95">
                                <Send size={24} /> Odeslat fotku
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
