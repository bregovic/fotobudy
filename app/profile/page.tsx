'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Home, Save, Lock, LogOut, RefreshCw, X, Image as ImageIcon } from 'lucide-react';

export default function ProfilePage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');

    // SMTP Settings
    const [smtpHost, setSmtpHost] = useState('');
    const [smtpPort, setSmtpPort] = useState('587');
    const [smtpUser, setSmtpUser] = useState('');
    const [smtpPass, setSmtpPass] = useState('');

    // Email Template Settings
    const [emailSubject, setEmailSubject] = useState('Tvoje fotka z FotoBuddy! 🥳');
    const [emailBody, setEmailBody] = useState('Ahoj! Tady je tvoje fotka z akce. Užij si ji!');

    // AI Settings
    const [openAiKey, setOpenAiKey] = useState('');

    // System Settings
    const [useCloudStream, setUseCloudStream] = useState(false);

    // Assets (Graphics)
    const [assets, setAssets] = useState<any[]>([]);

    // Loading State
    const [loading, setLoading] = useState(false);

    // Načtení z DB
    useEffect(() => {
        setLoading(true);

        // 1. Settings
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                // SMTP
                if (data.smtp_config) {
                    setSmtpHost(data.smtp_config.host || '');
                    setSmtpPort(data.smtp_config.port || '587');
                    setSmtpUser(data.smtp_config.user || '');
                    setSmtpPass(data.smtp_config.pass || '');
                }
                // Template
                if (data.email_template) {
                    setEmailSubject(data.email_template.subject || 'Tvoje fotka z FotoBuddy! 🥳');
                    setEmailBody(data.email_template.body || 'Ahoj! Tady je tvoje fotka z akce. Užij si ji!');
                }
                // AI
                if (data.openai_api_key) setOpenAiKey(data.openai_api_key);

                // Cloud
                if (data.use_cloud_stream) setUseCloudStream(data.use_cloud_stream === 'true');
            })
            .catch(console.error);

        // 2. Assets
        fetchAssets();

        setLoading(false);
    }, []);

    const fetchAssets = () => {
        fetch('/api/assets')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setAssets(data);
            })
            .catch(console.error);
    };

    const uploadAsset = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);

        try {
            const res = await fetch('/api/assets', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                fetchAssets();
                alert('Nahráno! ✅');
            } else {
                alert('Chyba nahrávání: ' + (data.error || 'Neznámá chyba'));
            }
        } catch (e: any) { console.error(e); alert('Chyba komunikace: ' + e.message); }
    };

    const deleteAsset = async (id: string) => {
        if (!confirm('Opravdu smazat?')) return;
        try {
            await fetch('/api/assets', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            setAssets(prev => prev.filter(a => a.id !== id));
        } catch (e) { alert('Chyba mazání'); }
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === 'Heslo123') {
            setIsAuthenticated(true);
        } else {
            alert('Špatné heslo!');
        }
    };

    const handleSave = async (silent = false) => {
        setLoading(true);
        const settings = {
            smtp_config: {
                host: smtpHost,
                port: smtpPort,
                user: smtpUser,
                pass: smtpPass
            },
            email_template: {
                subject: emailSubject,
                body: emailBody
            },
            openai_api_key: openAiKey,
            use_cloud_stream: String(useCloudStream)
        };

        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (!silent) alert('Nastavení uloženo do databáze! ✅');
            setLoading(false);
            return true;
        } catch (e) {
            if (!silent) alert('Chyba ukládání!');
            setLoading(false);
            return false;
        }
    };

    const handleTestEmail = async () => {
        if (!smtpUser.includes('@')) { alert('Vyplňte správně email uživatele (bude použit jako odesílatel i příjemce testu).'); return; }

        // 1. Uložit aktuální nastavení
        const saved = await handleSave(true);
        if (!saved) return;

        // 2. Odeslat test
        if (!confirm(`Nastavení uloženo.\nTeď odešlu testovací email na: ${smtpUser}\nPokračovat?`)) return;

        try {
            const res = await fetch('/api/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: smtpUser, isTest: true })
            });
            const d = await res.json();

            if (d.success) {
                alert(`✅ Test úspěšný!\nServer odpověděl: ${d.response}\nMessage ID: ${d.messageId}\n\nPokud email nedorazil, zkontrolujte SPAM.`);
            } else {
                alert('❌ Chyba odesílání:\n' + d.error);
            }
        } catch (e) { alert('Chyba komunikace se serverem.'); }
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setPassword('');
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
                <Link href="/" className="absolute top-4 left-4 p-3 bg-white/10 rounded-full hover:bg-white/20">
                    <Home size={24} />
                </Link>
                <div className="w-full max-w-sm bg-slate-900 p-8 rounded-2xl shadow-2xl border border-slate-700">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-slate-800 rounded-full">
                            <Lock size={40} className="text-emerald-500" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-center mb-6">Přihlášení do správy</h2>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Zadejte heslo"
                            className="w-full p-4 bg-slate-950 border border-slate-700 rounded-xl text-center text-xl tracking-widest focus:border-emerald-500 outline-none transition-colors"
                            autoFocus
                        />
                        <button type="submit" className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-lg transition-transform active:scale-95">
                            Odemknout
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4">
            <div className="flex items-center justify-between mb-8 max-w-2xl mx-auto mt-4">
                <Link href="/" className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors flex items-center gap-2">
                    <Home size={20} />
                    <span>Zpět</span>
                </Link>
                <h1 className="text-2xl font-bold">Nastavení (Cloud DB)</h1>
                <button onClick={handleLogout} className="p-3 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500/30">
                    <LogOut size={20} />
                </button>
            </div>

            <div className="max-w-2xl mx-auto bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-700 space-y-8">

                {/* System Section */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-blue-400 border-b border-blue-500/30 pb-2">⚙️ Systém</h3>
                    <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-700">
                        <div>
                            <h4 className="font-medium text-white">Cloud Stream Režim</h4>
                            <p className="text-sm text-slate-500">Používat snapshoty místo přímého streamu (Nutné pro HTTPS/Railway).</p>
                        </div>
                        <button
                            onClick={() => setUseCloudStream(!useCloudStream)}
                            className={`w-14 h-8 rounded-full transition-colors relative ${useCloudStream ? 'bg-blue-600' : 'bg-slate-700'}`}
                        >
                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform shadow-sm ${useCloudStream ? 'translate-x-7' : 'translate-x-1'}`}></div>
                        </button>
                    </div>
                </div>

                {/* GRAPHICS MANAGER Section */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-yellow-400 border-b border-yellow-500/30 pb-2">🎨 Správce Grafiky</h3>

                    {/* Backgrounds */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                        <label className="block text-sm font-bold text-slate-300 mb-4">🖼️ Pozadí (pro klíčování)</label>
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            {assets.filter(a => a.type === 'BACKGROUND').map(asset => (
                                <div key={asset.id} className="relative group aspect-video bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
                                    <img src={asset.url} className="w-full h-full object-cover" />
                                    <button onClick={() => deleteAsset(asset.id)} className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                                </div>
                            ))}
                            <label className="flex flex-col items-center justify-center bg-slate-900 hover:bg-slate-800 border border-dashed border-slate-700 rounded-lg cursor-pointer transition-colors aspect-video hover:border-yellow-500 hover:text-yellow-500">
                                <span className="text-2xl">+</span>
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadAsset(e, 'BACKGROUND')} />
                            </label>
                        </div>
                    </div>

                    {/* Stickers */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                        <label className="block text-sm font-bold text-slate-300 mb-4">🦄 Samolepky / Loga</label>
                        <div className="grid grid-cols-4 gap-2">
                            {assets.filter(a => a.type === 'STICKER').map(asset => (
                                <div key={asset.id} className="relative group aspect-square bg-slate-800 rounded-lg overflow-hidden border border-slate-700 p-2">
                                    <img src={asset.url} className="w-full h-full object-contain" />
                                    <button onClick={() => deleteAsset(asset.id)} className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                                </div>
                            ))}
                            <label className="flex flex-col items-center justify-center bg-slate-900 hover:bg-slate-800 border border-dashed border-slate-700 rounded-lg cursor-pointer transition-colors aspect-square hover:border-yellow-500 hover:text-yellow-500">
                                <span className="text-2xl">+</span>
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadAsset(e, 'STICKER')} />
                            </label>
                        </div>
                    </div>
                </div>

                {/* EMAIL TEMPLATE Section */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-pink-400 border-b border-pink-500/30 pb-2">💌 Šablona Emailu</h3>
                    <div>
                        <label className="block text-sm text-slate-500 mb-1">Předmět e-mailu</label>
                        <input
                            type="text"
                            value={emailSubject}
                            onChange={(e) => setEmailSubject(e.target.value)}
                            className="w-full p-3 bg-slate-950 rounded-lg border border-slate-700 focus:border-pink-500 outline-none"
                            placeholder="Tvoje fotka z akce!"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-500 mb-1">Text zprávy</label>
                        <textarea
                            value={emailBody}
                            onChange={(e) => setEmailBody(e.target.value)}
                            className="w-full p-3 bg-slate-950 rounded-lg border border-slate-700 focus:border-pink-500 outline-none min-h-[100px]"
                            placeholder="Díky, že jste dorazili..."
                        />
                    </div>
                </div>

                {/* SMTP Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2">
                        <h3 className="text-lg font-semibold text-emerald-400">📧 Email & SMTP</h3>
                        <button onClick={handleTestEmail} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs rounded border border-slate-600 transition-colors">
                            Odeslat test ⚡
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm text-slate-500 mb-1">Host (např. smtp.gmail.com)</label>
                            <input type="text" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} className="w-full p-3 bg-slate-950 rounded-lg border border-slate-700 focus:border-emerald-500 outline-none" placeholder="smtp.gmail.com" />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-500 mb-1">Port</label>
                            <input type="text" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} className="w-full p-3 bg-slate-950 rounded-lg border border-slate-700 focus:border-emerald-500 outline-none" placeholder="587" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-slate-500 mb-1">Uživatel (Email)</label>
                        <input type="text" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} className="w-full p-3 bg-slate-950 rounded-lg border border-slate-700 focus:border-emerald-500 outline-none" placeholder="tvuj@email.cz" />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-500 mb-1">Heslo (App Password / API Key)</label>
                        <input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} className="w-full p-3 bg-slate-950 rounded-lg border border-slate-700 focus:border-emerald-500 outline-none" placeholder="••••••••" />
                    </div>
                </div>

                {/* AI Section */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-purple-400 border-b border-purple-500/30 pb-2">🧠 AI Integrace</h3>
                    <div>
                        <label className="block text-sm text-slate-500 mb-1">OpenAI API Key</label>
                        <input
                            type="password"
                            value={openAiKey}
                            onChange={(e) => setOpenAiKey(e.target.value)}
                            className="w-full p-3 bg-slate-950 rounded-lg border border-slate-700 focus:border-purple-500 outline-none font-mono text-sm"
                            placeholder="sk-..."
                        />
                    </div>
                </div>

                <div className="pt-6 border-t border-slate-800">
                    <button onClick={() => handleSave(false)} disabled={loading} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-500/20 transition-all">
                        {loading ? <RefreshCw className="animate-spin" /> : <Save size={20} />}
                        {loading ? 'Ukládám...' : 'Uložit nastavení'}
                    </button>
                    <p className="text-center text-xs text-slate-500 mt-4">
                        Nastavení se ukládá do cloud databáze.
                    </p>
                </div>

            </div>
        </div>
    );
}
