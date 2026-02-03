'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Home, Save, Lock, LogOut, RefreshCw, X, Image as ImageIcon, Settings, Calendar, ShieldCheck } from 'lucide-react';

export default function ProfilePage() {
    const [activeTab, setActiveTab] = useState<'event' | 'tech'>('event');
    const [techAuth, setTechAuth] = useState(false);
    const [techPasswordInput, setTechPasswordInput] = useState('');

    // --- STATES ---

    // Events
    const [events, setEvents] = useState<any[]>([]);
    const [activeEventId, setActiveEventId] = useState<string | null>(null);
    const [newEventName, setNewEventName] = useState('');
    const [newEventPassword, setNewEventPassword] = useState('');

    // SMTP Settings (Tech)
    const [smtpHost, setSmtpHost] = useState('');
    const [smtpPort, setSmtpPort] = useState('587');
    const [smtpUser, setSmtpUser] = useState('');
    const [smtpPass, setSmtpPass] = useState('');

    // Email Template (Kiosk)
    const [emailSubject, setEmailSubject] = useState('Tvoje fotka z Blick & Cvak! 🥳');
    const [emailBody, setEmailBody] = useState('Ahoj! Tady je tvoje fotka z akce. Užij si ji!');

    // AI Settings (Tech)
    const [openAiKey, setOpenAiKey] = useState('');

    // System Settings (Tech)
    const [useCloudStream, setUseCloudStream] = useState(false);

    // Assets (Kiosk)
    const [assets, setAssets] = useState<any[]>([]);

    // Loading State
    const [loading, setLoading] = useState(false);
    const [emailLog, setEmailLog] = useState<string | null>(null);

    // --- INITIAL LOAD ---
    useEffect(() => {
        loadSettings();
        loadAssets();
        loadEvents();
    }, []);

    // --- API CALLS ---

    const loadSettings = () => {
        setLoading(true);
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.smtp_config) {
                    setSmtpHost(data.smtp_config.host || '');
                    setSmtpPort(data.smtp_config.port || '587');
                    setSmtpUser(data.smtp_config.user || '');
                    setSmtpPass(data.smtp_config.pass || '');
                }
                if (data.email_template) {
                    setEmailSubject(data.email_template.subject || 'Tvoje fotka z FotoBuddy! 🥳');
                    setEmailBody(data.email_template.body || 'Ahoj! Tady je tvoje fotka z akce. Užij si ji!');
                }
                if (data.openai_api_key) setOpenAiKey(data.openai_api_key);
                const cloudVal = data.use_cloud_stream;
                if (cloudVal !== undefined && cloudVal !== null && cloudVal !== '') {
                    setUseCloudStream(String(cloudVal).toLowerCase() === 'true' || String(cloudVal) === '1');
                } else if (typeof window !== 'undefined' && (window.location.protocol === 'https:' || window.location.hostname.includes('railway.app'))) {
                    setUseCloudStream(true);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    const loadAssets = () => {
        fetch('/api/assets')
            .then(res => res.json())
            .then(data => { if (Array.isArray(data)) setAssets(data); });
    };

    const loadEvents = () => {
        fetch('/api/event')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setEvents(data);
                    const active = data.find((e: any) => e.isActive);
                    if (active) setActiveEventId(active.id);
                }
            });
    };

    const createEvent = async () => {
        if (!newEventName) return alert('Zadejte název události');
        try {
            const res = await fetch('/api/event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newEventName,
                    password: newEventPassword,
                    makeActive: true // Auto activate
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('Událost vytvořena a aktivována! ✅');
                setNewEventName('');
                setNewEventPassword('');
                loadEvents();
            } else {
                alert('Chyba: ' + data.error);
            }
        } catch (e) { alert('Chyba vytváření události'); }
    };

    const activateEvent = async (id: string) => {
        try {
            await fetch('/api/event/active', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            setActiveEventId(id);
            alert('Událost aktivována! Folder se změní. 📂');
            loadEvents();
        } catch (e) { alert('Chyba přepnutí události'); }
    };

    const handleSaveSettings = async (silent = false) => {
        setLoading(true);
        const settings = {
            smtp_config: { host: smtpHost, port: smtpPort, user: smtpUser, pass: smtpPass },
            email_template: { subject: emailSubject, body: emailBody },
            openai_api_key: openAiKey,
            use_cloud_stream: String(useCloudStream)
        };
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (!res.ok) throw new Error('Failed');
            if (!silent) alert('Nastavení uloženo! ✅');
        } catch (e) { if (!silent) alert('Chyba ukládání!'); }
        setLoading(false);
    };

    const uploadAsset = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);
        await fetch('/api/assets', { method: 'POST', body: formData });
        loadAssets();
    };

    const deleteAsset = async (id: string) => {
        if (!confirm('Opravdu smazat?')) return;
        await fetch('/api/assets', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        setAssets(prev => prev.filter(a => a.id !== id));
    };

    const unlockTech = (e: React.FormEvent) => {
        e.preventDefault();
        if (techPasswordInput === 'Starter123') {
            setTechAuth(true);
            setActiveTab('tech');
        } else {
            alert('Špatné heslo!');
        }
    };

    if (activeTab === 'tech' && !techAuth) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
                <div className="w-full max-w-sm bg-slate-900 p-8 rounded-2xl shadow-2xl border border-slate-700">
                    <h2 className="text-2xl font-bold text-center mb-6">Technické nastavení</h2>
                    <p className="text-slate-400 text-center mb-4 text-sm">Zadejte heslo technika</p>
                    <form onSubmit={unlockTech} className="space-y-4">
                        <input
                            type="password"
                            value={techPasswordInput}
                            onChange={(e) => setTechPasswordInput(e.target.value)}
                            className="w-full p-4 bg-slate-950 border border-slate-700 rounded-xl text-center text-xl focus:border-red-500 outline-none"
                            placeholder="******"
                            autoFocus
                        />
                        <button type="submit" className="w-full py-4 bg-red-600 hover:bg-red-500 rounded-xl font-bold">Odemknout</button>
                        <button onClick={() => setActiveTab('event')} type="button" className="w-full py-2 text-slate-500 hover:text-white">Zpět</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 max-w-4xl mx-auto mt-4">
                <Link href="/" className="p-3 bg-white/10 rounded-full hover:bg-white/20 flex items-center gap-2">
                    <Home size={20} /> <span>Domů</span>
                </Link>
                <h1 className="text-2xl font-bold">Nastavení</h1>
                <div className="w-20"></div>
            </div>

            {/* Tabs */}
            <div className="flex justify-center mb-8 gap-4">
                <button
                    onClick={() => setActiveTab('event')}
                    className={`px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-all ${activeTab === 'event' ? 'bg-indigo-600 shadow-lg scale-105' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                    <Calendar size={20} /> Událost & Kiosk
                </button>
                <button
                    onClick={() => setActiveTab('tech')}
                    className={`px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-all ${activeTab === 'tech' ? 'bg-red-600 shadow-lg scale-105' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                    <Settings size={20} /> Technické
                </button>
            </div>

            <div className="max-w-4xl mx-auto space-y-8">

                {/* === EVENT TAB === */}
                {activeTab === 'event' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">

                        {/* 1. Event Management */}
                        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700">
                            <h3 className="text-xl font-bold text-indigo-400 mb-6 flex items-center gap-2"><Calendar /> Správa Události</h3>

                            {/* Create New */}
                            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-6">
                                <h4 className="font-bold mb-3 text-sm text-slate-300">Nová akce (Svatba, Oslava...)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <input
                                        type="text"
                                        placeholder="Název (např. Svatba Mirek)"
                                        value={newEventName}
                                        onChange={(e) => setNewEventName(e.target.value)}
                                        className="p-3 bg-slate-900 border border-slate-700 rounded-lg outline-none focus:border-indigo-500"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Heslo (nepovinné)"
                                        value={newEventPassword}
                                        onChange={(e) => setNewEventPassword(e.target.value)}
                                        className="p-3 bg-slate-900 border border-slate-700 rounded-lg outline-none focus:border-indigo-500"
                                    />
                                    <button onClick={createEvent} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors">
                                        Vytvořit a Aktivovat
                                    </button>
                                </div>
                            </div>

                            {/* List */}
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                <h4 className="font-bold mb-2 text-sm text-slate-300">Seznam událostí</h4>
                                {events.map(event => (
                                    <div key={event.id} className={`flex items-center justify-between p-3 rounded-lg border ${event.isActive ? 'bg-indigo-900/30 border-indigo-500' : 'bg-slate-950 border-slate-800'}`}>
                                        <div>
                                            <div className="font-bold">{event.name}</div>
                                            <div className="text-xs text-slate-500">/{event.slug}</div>
                                        </div>
                                        {event.isActive ? (
                                            <span className="text-indigo-400 text-sm font-bold flex items-center gap-1"><ShieldCheck size={16} /> Aktivní</span>
                                        ) : (
                                            <button onClick={() => activateEvent(event.id)} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs rounded border border-slate-600">Aktivovat</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 2. Visuals (Assets) */}
                        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700">
                            <h3 className="text-xl font-bold text-yellow-500 mb-6 flex items-center gap-2"><ImageIcon /> Vzhled Kiosku</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Backgrounds */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-400 mb-2">Pozadí (Klíčování)</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {assets.filter(a => a.type === 'BACKGROUND').map(asset => (
                                            <div key={asset.id} className="relative group aspect-video bg-slate-950 rounded border border-slate-800 overflow-hidden">
                                                <img src={asset.url} className="w-full h-full object-cover" />
                                                <button onClick={() => deleteAsset(asset.id)} className="absolute top-1 right-1 bg-red-600 p-1 rounded-full opacity-0 group-hover:opacity-100"><X size={10} /></button>
                                            </div>
                                        ))}
                                        <label className="aspect-video flex items-center justify-center bg-slate-950 border border-dashed border-slate-700 rounded cursor-pointer hover:border-yellow-500 hover:text-yellow-500 transition-colors">
                                            + <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadAsset(e, 'BACKGROUND')} />
                                        </label>
                                    </div>
                                </div>

                                {/* Stickers */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-400 mb-2">Samolepky / Loga</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {assets.filter(a => a.type === 'STICKER').map(asset => (
                                            <div key={asset.id} className="relative group aspect-square bg-slate-950 rounded border border-slate-800 overflow-hidden p-1">
                                                <img src={asset.url} className="w-full h-full object-contain" />
                                                <button onClick={() => deleteAsset(asset.id)} className="absolute top-1 right-1 bg-red-600 p-1 rounded-full opacity-0 group-hover:opacity-100"><X size={10} /></button>
                                            </div>
                                        ))}
                                        <label className="aspect-square flex items-center justify-center bg-slate-950 border border-dashed border-slate-700 rounded cursor-pointer hover:border-yellow-500 hover:text-yellow-500 transition-colors">
                                            + <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadAsset(e, 'STICKER')} />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. Email Template */}
                        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700">
                            <h3 className="text-xl font-bold text-pink-500 mb-4">💌 Šablona Emailu (Pro hosty)</h3>
                            <div className="grid grid-cols-1 gap-4">
                                <input
                                    type="text"
                                    value={emailSubject}
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                    className="p-3 bg-slate-950 border border-slate-800 rounded outline-none focus:border-pink-500"
                                    placeholder="Předmět emailu"
                                />
                                <textarea
                                    value={emailBody}
                                    onChange={(e) => setEmailBody(e.target.value)}
                                    className="p-3 bg-slate-950 border border-slate-800 rounded outline-none focus:border-pink-500 min-h-[80px]"
                                    placeholder="Text emailu"
                                />
                            </div>
                            <div className="mt-4 flex justify-end">
                                <button onClick={() => handleSaveSettings(false)} className="px-6 py-2 bg-pink-600 hover:bg-pink-500 rounded-full font-bold">Uložit Šablonu</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* === TECH TAB === */}
                {activeTab === 'tech' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                        <div className="bg-slate-900 p-8 rounded-2xl border border-red-900/30 shadow-2xl">
                            <h3 className="text-2xl font-bold text-red-500 mb-8 border-b border-red-900/50 pb-4">⚙️ Technické Nastavení (Restricted)</h3>

                            {/* SMTP */}
                            <div className="mb-8">
                                <h4 className="text-lg font-bold text-slate-300 mb-4">SMTP Server (Email)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <input type="text" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} className="p-3 bg-slate-950 border border-slate-700 rounded" placeholder="Host (smtp.gmail.com)" />
                                    <input type="text" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} className="p-3 bg-slate-950 border border-slate-700 rounded" placeholder="Port (587)" />
                                    <input type="text" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} className="p-3 bg-slate-950 border border-slate-700 rounded" placeholder="Uživatel" />
                                    <input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} className="p-3 bg-slate-950 border border-slate-700 rounded" placeholder="Heslo" />
                                </div>
                            </div>

                            {/* System */}
                            <div className="mb-8">
                                <h4 className="text-lg font-bold text-slate-300 mb-4">Systém</h4>
                                <div className="flex items-center justify-between p-4 bg-slate-950 rounded border border-slate-700">
                                    <span>Cloud Stream Mode (Snapshots)</span>
                                    <button onClick={() => setUseCloudStream(!useCloudStream)} className={`w-12 h-6 rounded-full relative transition-colors ${useCloudStream ? 'bg-green-600' : 'bg-slate-700'}`}>
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${useCloudStream ? 'translate-x-7' : 'translate-x-1'}`}></div>
                                    </button>
                                </div>
                                <div className="mt-4">
                                    <label className="block text-sm text-slate-500 mb-1">OpenAI API Key</label>
                                    <input type="password" value={openAiKey} onChange={(e) => setOpenAiKey(e.target.value)} className="w-full p-3 bg-slate-950 border border-slate-700 rounded font-mono" />
                                </div>
                            </div>

                            <button onClick={() => handleSaveSettings(false)} className="w-full py-4 bg-red-600 hover:bg-red-500 rounded-xl font-bold shadow-lg">
                                Uložit Technické Změny
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
