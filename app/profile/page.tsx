'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Home, Save, Lock, LogOut } from 'lucide-react';

export default function ProfilePage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');

    // SMTP Settings
    const [smtpHost, setSmtpHost] = useState('');
    const [smtpPort, setSmtpPort] = useState('587');
    const [smtpUser, setSmtpUser] = useState('');
    const [smtpPass, setSmtpPass] = useState('');

    // AI Settings
    const [openAiKey, setOpenAiKey] = useState('');

    // Načtení při startu
    useEffect(() => {
        const savedSmtp = localStorage.getItem('smtp_config');
        if (savedSmtp) {
            try {
                const config = JSON.parse(savedSmtp);
                setSmtpHost(config.host || '');
                setSmtpPort(config.port || '587');
                setSmtpUser(config.user || '');
                setSmtpPass(config.pass || '');
            } catch (e) { }
        }

        const savedKey = localStorage.getItem('openai_api_key');
        if (savedKey) setOpenAiKey(savedKey);

        // Auto-login logic (skipped)
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === 'Heslo123') { // Jednoduché heslo
            setIsAuthenticated(true);
        } else {
            alert('Špatné heslo!');
        }
    };

    const handleSave = () => {
        const smtpConfig = {
            host: smtpHost,
            port: smtpPort,
            user: smtpUser,
            pass: smtpPass
        };
        localStorage.setItem('smtp_config', JSON.stringify(smtpConfig));
        localStorage.setItem('openai_api_key', openAiKey);

        alert('Nastavení uloženo! ✅\nZměny se projeví v Kiosku.');
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
                <h1 className="text-2xl font-bold">Nastavení</h1>
                <button onClick={handleLogout} className="p-3 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500/30">
                    <LogOut size={20} />
                </button>
            </div>

            <div className="max-w-2xl mx-auto bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-700 space-y-8">

                {/* SMTP Section */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-emerald-400 border-b border-emerald-500/30 pb-2">📧 Email & SMTP</h3>

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
                        <p className="text-xs text-slate-600 mt-2">Klíč se ukládá pouze lokálně v prohlížeči.</p>
                    </div>
                </div>

                <div className="pt-6 border-t border-slate-800">
                    <button onClick={handleSave} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-500/20 transition-all">
                        <Save size={20} /> Uložit nastavení
                    </button>
                    <p className="text-center text-xs text-slate-500 mt-4">
                        Nastavení se ukládá pouze v tomto prohlížeči (LocalStorage). <br />
                        Pokud používáte Gmail, musíte vygenerovat <b>App Password</b>.
                    </p>
                </div>

            </div>
        </div>
    );
}
