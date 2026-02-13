'use client';
import { useState, useRef, useEffect } from 'react';
import { Camera, StopCircle, Play, Save, Trash2, Home } from 'lucide-react';
import Link from 'next/link';

export default function VideoBooth() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const [chunks, setChunks] = useState<Blob[]>([]);
    const [status, setStatus] = useState<'idle' | 'recording' | 'review'>('idle');
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState(15);

    // Start Camera
    useEffect(() => {
        if (status === 'idle') {
            startCamera();
        }
        return () => {
            stopCamera();
        }
    }, [status]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (e) {
            console.error("Webcam error:", e);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
    };

    const startRecording = () => {
        if (!videoRef.current?.srcObject) return;

        const stream = videoRef.current.srcObject as MediaStream;
        const recorder = new MediaRecorder(stream);

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                setChunks(prev => [...prev, e.data]);
            }
        };

        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            setVideoUrl(url);
            setStatus('review');
        };

        setChunks([]);
        recorder.start();
        mediaRecorderRef.current = recorder;
        setStatus('recording');
        setTimeLeft(15);

        // Timer
        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    stopRecording();
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Cleanup interval on stop manually? 
        // Better logic needed but this works for basic concept.
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    };

    const saveVideo = async () => {
        if (!videoUrl) return;

        try {
            // Získáme Blob z URL
            const blob = await fetch(videoUrl).then(r => r.blob());
            const formData = new FormData();
            formData.append('file', blob, 'vzkaz.webm');
            formData.append('type', 'VIDEO');

            // Poslat na API
            setStatus('idle'); // Hned resetujeme UI pro dalšího hosta
            alert('Video se ukládá na pozadí! 🚀'); // Lepší by byla toast notifikace

            const res = await fetch('/api/media/upload', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error('Upload selhal');
            console.log("Video uloženo!");
            setVideoUrl(null);

        } catch (e) {
            console.error(e);
            alert('Chyba při ukládání videa.');
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center relative overflow-hidden">

            {/* Header */}
            <div className="absolute top-4 left-4 z-20">
                <Link href="/" className="p-3 bg-white/10 rounded-full backdrop-blur-md flex items-center gap-2">
                    <Home size={20} /> Zpět
                </Link>
            </div>

            {/* Main Viewport */}
            <div className="w-full max-w-4xl aspect-video bg-gray-900 rounded-3xl overflow-hidden relative shadow-2xl border border-white/10">

                {status === 'review' && videoUrl ? (
                    <video src={videoUrl} controls className="w-full h-full object-cover" />
                ) : (
                    <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
                )}

                {/* Overlays */}
                {status === 'recording' && (
                    <div className="absolute top-4 right-4 bg-red-600 px-4 py-2 rounded-full font-mono animate-pulse flex items-center gap-2">
                        <div className="w-3 h-3 bg-white rounded-full" />
                        REC {timeLeft}s
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="mt-8 flex gap-6">
                {status === 'idle' && (
                    <button onClick={startRecording} className="w-20 h-20 rounded-full bg-red-500 border-4 border-white flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_30px_rgba(239,68,68,0.5)]">
                        <div className="w-8 h-8 bg-white rounded-sm" />
                    </button>
                )}

                {status === 'recording' && (
                    <button onClick={stopRecording} className="w-20 h-20 rounded-full bg-gray-800 border-4 border-white flex items-center justify-center hover:scale-105 transition-transform">
                        <StopCircle size={40} />
                    </button>
                )}

                {status === 'review' && (
                    <>
                        <button onClick={() => { setStatus('idle'); setVideoUrl(null); }} className="px-8 py-3 bg-gray-700 rounded-full hover:bg-gray-600 flex items-center gap-2">
                            <Trash2 size={20} /> Zahodit
                        </button>
                        <button onClick={saveVideo} className="px-8 py-3 bg-blue-600 rounded-full hover:bg-blue-500 flex items-center gap-2 font-bold shadow-lg shadow-blue-500/30">
                            <Save size={20} /> Uložit vzkaz
                        </button>
                    </>
                )}
            </div>

            <h2 className="mt-8 text-slate-500 font-light uppercase tracking-widest text-sm">Zanechte nám videovzkaz</h2>
        </div>
    );
}
