'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Home, Image as ImageIcon, X, Printer, Mail, Send, Trash2, ChevronDown } from 'lucide-react';

export default function GalleryPage() {
    const [photos, setPhotos] = useState<any[]>([]);
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

    // Eventy
    const [events, setEvents] = useState<any[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>(''); // '' = Aktuální/Výchozí

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

    // Password Modal
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [pendingEventId, setPendingEventId] = useState<string | null>(null);

    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    // --- NAČÍTÁNÍ FOTEK (A STRÁNKOVÁNÍ) ---
    useEffect(() => {
        const fetchPhotos = () => {
            const baseUrl = selectedEventId ? `/api/media/list?eventId=${selectedEventId}` : '/api/media/list';
            const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + `page=${page}`;

            fetch(url)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setHasMore(data.length === 60);
                        if (page === 1) {
                            setPhotos(data);
                        } else {
                            setPhotos(prev => {
                                const newUrls = new Set(data.map(d => d.url));
                                const filteredPrev = prev.filter(p => !newUrls.has(p.url));
                                return [...filteredPrev, ...data];
                            });
                        }
                    }
                })
                .catch(console.error);
        };
        fetchPhotos();
    }, [selectedEventId, page]);

    // --- NAČÍTÁNÍ KONFIGURACE A SLEDOVÁNÍ (POLLING) ---
    useEffect(() => {
        // Reset stránkování při změně události
        setPage(1);

        const fetchEvents = () => {
            fetch('/api/event')
                .then(res => res.json())
                .then(data => { if (Array.isArray(data)) setEvents(data); })
                .catch(console.error);
        };
        fetchEvents();

        // Polling pro automatickou aktualizaci - hlídá pouze 1. stranu (nové fotky)
        const pollNewPhotos = () => {
            const baseUrl = selectedEventId ? `/api/media/list?eventId=${selectedEventId}` : '/api/media/list';
            const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + `page=1`;
            fetch(url)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setPhotos(prev => {
                            if (prev.length === 0) return data;
                            // Najdi nové fotky (ty co nemáme v `prev`) a ty navíc prependni (přidej na začátek)
                            const prevUrls = new Set(prev.map(p => p.url));
                            const newPhotos = data.filter(d => !prevUrls.has(d.url));
                            if (newPhotos.length > 0) {
                                return [...newPhotos, ...prev];
                            }
                            return prev;
                        });
                    }
                })
                .catch(console.error);
        };

        const interval = setInterval(pollNewPhotos, 5000);

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

        return () => clearInterval(interval);
    }, [selectedEventId]);

    // --- EVENT SELECTION HANDLER ---
    const handleEventChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newId = e.target.value;
        if (!newId) {
            setSelectedEventId('');
            return;
        }

        const targetEvent = events.find(ev => ev.id === newId);

        // Pokud má heslo, vyžádat ho
        if (targetEvent?.hasPassword) {
            setPendingEventId(newId);
            setPasswordInput('');
            setShowPasswordModal(true);
        } else {
            // Bez hesla -> rovnou přepnout
            setSelectedEventId(newId);
        }
    };

    const verifyPassword = async () => {
        if (!pendingEventId) return;

        try {
            const res = await fetch('/api/event/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId: pendingEventId, password: passwordInput })
            });

            const data = await res.json();
            if (data.success) {
                setSelectedEventId(pendingEventId);
                setShowPasswordModal(false);
                setPasswordInput('');
                showToast('Přístup povolen ✅');
            } else {
                showToast('Špatné heslo ❌');
            }
        } catch (e) {
            showToast('Chyba ověření ❌');
        }
    };

    // --- ACTIONS ---

    const deletePhoto = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!selectedPhoto) return;

        if (!confirm('Opravdu smazat tuto fotku?')) return;

        try {
            const res = await fetch('/api/media/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: selectedPhoto })
            });

            if (res.ok) {
                showToast('Fotka smazána! 🗑️');
                setPhotos(prev => prev.filter(p => p.url !== selectedPhoto));
                setSelectedPhoto(null);
            } else {
                showToast('Chyba při mazání ❌');
            }
        } catch (error) {
            showToast('Chyba komunikace ❌');
        }
    };

    const printPhoto = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Aby se nezavřel overlay
        if (!selectedPhoto) return;

        const filename = selectedPhoto.split('/').pop();
        const relativePath = selectedPhoto.replace(/^\/photos\//, '').replace(/^\/api\/media\/image\//, '');

        showToast('Odesílám na tiskárnu... 🖨️');

        try {
            // Tisk probíhá přes API (které to předá Kiosku nebo frontě)
            const res = await fetch('/api/print', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, path: relativePath })
            });

            if (res.ok) {
                showToast('Odesláno do fronty pro tisk ✅');
            } else {
                showToast('Chyba odeslání požadavku ❌');
            }
        } catch (err) {
            showToast('Chyba sítě při tisku ❌');
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

        // Detekce prostředí: Jsme na Localhostu?
        const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

        // Pokud nejsme na localhostu (jsme na cloudu) NEBO nemáme config => pošleme příkaz do kiosku
        // To plní požadavek "z webu poslat do lokální aplikace"
        if (!isLocal || !smtpConfig) {
            showToast(isLocal ? 'Chybí SMTP config, zkouším Kiosk...' : 'Odesílám požadavek domů... 🏠');

            try {
                const filename = selectedPhoto?.split('/').pop();
                await fetch('/api/command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        cmd: 'SEND_EMAIL',
                        params: {
                            email: emailInput,
                            filename: filename,
                            photoUrl: selectedPhoto
                        }
                    })
                });
                showToast('Požadavek odeslán! ✅');
                setShowEmailModal(false);
                setEmailInput('');
            } catch (e) {
                showToast('Chyba odesílání požadavku ❌');
            }
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
            else {
                // Fallback: Pokud selže přímé odeslání (např. chyba SMTP), zkusíme to přes Command
                console.warn("Direct email failed, trying command fallback...");
                throw new Error("Direct send failed");
            }

            setShowEmailModal(false);
            setEmailInput('');
        } catch (e) {
            // FALLBACK: Zkusit poslat příkaz
            try {
                showToast('Chyba. Zkouším poslat přes Kiosk... 🔄');
                const filename = selectedPhoto?.split('/').pop();
                await fetch('/api/command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        cmd: 'SEND_EMAIL',
                        params: {
                            email: emailInput,
                            filename: filename,
                            photoUrl: selectedPhoto
                        }
                    })
                });
                showToast('Odesláno do fronty Kiosku! ✅');
                setShowEmailModal(false);
                setEmailInput('');
            } catch (errFallback) {
                showToast('Nepodařilo se odeslat ani do fronty ❌');
            }
        }
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

                <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-bold flex items-center gap-2"><ImageIcon /> Galerie</h1>

                    {/* Event Selector */}
                    <div className="relative group">
                        <select
                            value={selectedEventId}
                            onChange={handleEventChange}
                            className="appearance-none bg-slate-800 border border-slate-700 hover:border-slate-500 text-white pl-4 pr-10 py-2 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                        >
                            <option value="">Aktuální akce</option>
                            {events.map(ev => (
                                <option key={ev.id} value={ev.id}>
                                    {ev.name} {ev.isActive ? '(Active)' : ''} {ev.hasPassword ? '🔒' : ''}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" size={16} />
                    </div>
                </div>

                <div className="w-10" />
            </div>

            {/* Grid Layout (Chronological) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 max-w-6xl mx-auto">
                {photos.map((photo) => (
                    <div
                        key={photo.id}
                        className="relative group bg-slate-900 rounded-xl overflow-hidden cursor-pointer shadow-lg border border-white/5 aspect-[3/2]"
                        onClick={() => setSelectedPhoto(photo.url)}
                    >
                        <img
                            src={photo.url}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            loading="lazy"
                            alt="Gallery photo"
                        />

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <ImageIcon className="text-white drop-shadow-lg transform scale-0 group-hover:scale-125 transition-all duration-300" size={32} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Empty State */}
            {photos.length === 0 && (
                <div className="text-center text-slate-500 mt-20">
                    <p>Zatím žádné fotky...</p>
                </div>
            )}

            {/* Pagination / Load More */}
            {hasMore && photos.length > 0 && (
                <div className="flex justify-center mt-12 mb-20">
                    <button
                        onClick={() => setPage(p => p + 1)}
                        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-bold shadow-lg transition-transform hover:scale-105 active:scale-95"
                    >
                        Načíst další fotky
                    </button>
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
                        <button
                            onClick={deletePhoto}
                            className="flex items-center gap-2 px-8 py-4 bg-red-600/20 text-red-500 border border-red-600/50 rounded-full font-bold hover:bg-red-600 hover:text-white transition-all shadow-lg active:scale-95 ml-4"
                        >
                            <Trash2 size={24} /> Smazat
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

            {/* PASSWORD MODAL */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in zoom-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-md w-full shadow-2xl text-white">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold flex items-center gap-2">🔒 Heslo alba</h2>
                            <button onClick={() => setShowPasswordModal(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20"><X /></button>
                        </div>

                        <div className="space-y-6">
                            <p className="text-slate-400">Tato galerie je chráněna heslem. Pro pokračování zadejte přístupový kód.</p>

                            <input
                                type="password"
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                placeholder="Zadej heslo..."
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && verifyPassword()}
                                className="w-full p-4 bg-slate-950 border border-slate-700 rounded-lg focus:border-indigo-500 outline-none text-white text-lg placeholder-slate-600 text-center tracking-widest"
                            />

                            <button onClick={verifyPassword} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
                                Odemknout galerii
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
