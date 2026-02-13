import Image from 'next/image';
import Link from 'next/link';
import { Camera, Image as ImageIcon, User, Sparkles, Settings } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">

      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 bg-[radial-gradient(circle_at_50%_50%,_#1f1f3a_0%,_#000_100%)]" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px] animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] animate-float" style={{ animationDelay: '2s' }} />

      {/* Header */}
      <div className="text-center mb-12 relative z-10 flex flex-col items-center">
        {/* Logo Blick & Cvak (Optimalizované) */}
        <div className="relative w-80 md:w-96 hover:scale-105 transition-transform duration-500 drop-shadow-2xl flex justify-center">
          <Image
            src="/logo.png"
            alt="Blick & Cvak"
            width={500}
            height={300}
            priority // Načíst ihned!
            className="w-full h-auto object-contain"
          />
        </div>
      </div>

      {/* Navigation Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl relative z-10 px-4">

        {/* Card 1: Focení */}
        <Link href="/kiosk" className="group">
          <div className="glass glass-hover h-64 rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="bg-slate-800/50 p-6 rounded-full mb-6 group-hover:scale-110 transition-transform duration-300 shadow-xl border border-white/10">
              <Camera size={40} className="text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Focení</h2>
            <p className="text-sm text-slate-400">Vstoupit do fotokoutku</p>
          </div>
        </Link>

        {/* Card 2: Video Vzkazy */}
        <Link href="/video" className="group">
          <div className="glass glass-hover h-64 rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="bg-slate-800/50 p-6 rounded-full mb-6 group-hover:scale-110 transition-transform duration-300 shadow-xl border border-white/10">
              <span className="text-red-400 text-4xl">🎥</span>
            </div>
            <h2 className="text-2xl font-bold mb-2">Video Vzkazy</h2>
            <p className="text-sm text-slate-400">Nahrát vzkaz (15s)</p>
          </div>
        </Link>

        {/* Card 3: Galerie */}
        <Link href="/gallery" className="group">
          <div className="glass glass-hover h-64 rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 relative overflow-hidden">
            <div className="bg-slate-800/50 p-6 rounded-full mb-6 group-hover:scale-110 transition-transform duration-300 shadow-xl border border-white/10">
              <ImageIcon size={40} className="text-purple-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Galerie</h2>
            <p className="text-sm text-slate-400">Prohlížet fotografie</p>
          </div>
        </Link>

        {/* Card 4: Nastavení (dříve Profil) */}
        <Link href="/profile" className="group">
          <div className="glass glass-hover h-64 rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 relative overflow-hidden">
            <div className="bg-slate-800/50 p-6 rounded-full mb-6 group-hover:scale-110 transition-transform duration-300 shadow-xl border border-white/10">
              <Settings size={40} className="text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Nastavení</h2>
            <p className="text-sm text-slate-400">Správa událostí a systému</p>
          </div>
        </Link>

      </div>


    </main>
  );
}
