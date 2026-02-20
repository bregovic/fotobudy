'use client';
import { useState, useEffect, useRef, memo } from 'react';
import { Image as ImageIcon, Printer, Settings, Mail, RefreshCw, RefreshCcw, X, AlertTriangle, Send, Trash2, CameraOff, Home, Palette, Pipette, MousePointer2, Wand2, Layout, Cloud, Wifi, WifiOff, Terminal, Video, FolderOpen, Shield, Lock, CheckCircle2, MessageSquare, ArrowLeft, ArrowRight, Calendar, ChevronDown, Timer } from 'lucide-react';
import Link from 'next/link';

const SESSION_ID = 'main';
const DEFAULT_IP = '127.0.0.1';
const DEFAULT_CMD_PORT = 5513;
// const PORTS_TO_SCAN = [5555, 5514, 5521, 5520, 5513]; // Moved inside useEffect



// --- PHOTO EDITOR COMPONENT ---
const PhotoEditor = ({ photoUrl, assets, onSave, onCancel }: any) => {
    const [settings, setSettings] = useState({
        bg: null as string | null,
        sticker: null as string | null,
        isBW: false,
        chromaColor: '#00FF00',
        tolerance: 100,
        isChromaActive: false
    });
    const [transform, setTransform] = useState({ rotate: 0, scale: 1, x: 0, y: 0 });
    const [processing, setProcessing] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDragging = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });

    // Pinch to Zoom
    const pointerCache = useRef<Map<number, { x: number, y: number }>>(new Map());
    const prevDist = useRef<number | null>(null);

    useEffect(() => {
        const render = async () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return;

            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = photoUrl;
            await new Promise(r => { img.onload = r; img.onerror = r; });

            // Base Dimensions (Swapped if 90/270deg)
            const isPortrait = transform.rotate % 180 !== 0; // 90 or 270
            const baseW = isPortrait ? img.naturalHeight : img.naturalWidth;
            const baseH = isPortrait ? img.naturalWidth : img.naturalHeight;

            // Scale for Preview (max 800px)
            const previewScale = Math.min(1, 800 / baseW);
            canvas.width = baseW * previewScale;
            canvas.height = baseH * previewScale;

            // DRAWING CONTEXT
            // 1. Fill Background (Black or Image)
            if (settings.bg) {
                try {
                    const bg = new Image(); bg.crossOrigin = "Anonymous"; bg.src = settings.bg;
                    await new Promise(r => { bg.onload = r; bg.onerror = r; });
                    const ratio = Math.max(canvas.width / bg.naturalWidth, canvas.height / bg.naturalHeight);
                    const bw = bg.naturalWidth * ratio; const bh = bg.naturalHeight * ratio;
                    ctx.drawImage(bg, (canvas.width - bw) / 2, (canvas.height - bh) / 2, bw, bh);
                } catch { }
            } else {
                ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // 2. Photo (Transformed)
            ctx.save();
            // Move to center
            ctx.translate(canvas.width / 2, canvas.height / 2);
            // Apply User Transform
            ctx.rotate((transform.rotate * Math.PI) / 180);
            ctx.scale(transform.scale, transform.scale);
            ctx.translate(transform.x, transform.y); // Pan

            // Draw Image Centered (Relative to itself)
            const drawScale = previewScale;
            ctx.drawImage(img, -img.naturalWidth * drawScale / 2, -img.naturalHeight * drawScale / 2, img.naturalWidth * drawScale, img.naturalHeight * drawScale);
            ctx.restore();

            // 3. Chroma (Pixel Manipulation)
            if (settings.isChromaActive) {
                const tempC = document.createElement('canvas');
                tempC.width = canvas.width; tempC.height = canvas.height;
                const tCtx = tempC.getContext('2d', { willReadFrequently: true });
                if (tCtx) {
                    tCtx.save();
                    tCtx.translate(canvas.width / 2, canvas.height / 2);
                    tCtx.rotate((transform.rotate * Math.PI) / 180);
                    tCtx.scale(transform.scale, transform.scale);
                    tCtx.translate(transform.x, transform.y);
                    tCtx.drawImage(img, -img.naturalWidth * drawScale / 2, -img.naturalHeight * drawScale / 2, img.naturalWidth * drawScale, img.naturalHeight * drawScale);
                    tCtx.restore();

                    const frameData = tCtx.getImageData(0, 0, canvas.width, canvas.height);
                    const l = frameData.data.length;
                    const targetR = parseInt(settings.chromaColor.slice(1, 3), 16);
                    const targetG = parseInt(settings.chromaColor.slice(3, 5), 16);
                    const targetB = parseInt(settings.chromaColor.slice(5, 7), 16);

                    for (let i = 0; i < l; i += 4) {
                        const r = frameData.data[i], g = frameData.data[i + 1], b = frameData.data[i + 2];
                        if (Math.sqrt((r - targetR) ** 2 + (g - targetG) ** 2 + (b - targetB) ** 2) < settings.tolerance) frameData.data[i + 3] = 0;
                    }
                    tCtx.putImageData(frameData, 0, 0);
                    ctx.drawImage(tempC, 0, 0);
                }
            }

            // 4. Sticker
            if (settings.sticker) {
                const s = new Image();
                s.crossOrigin = "Anonymous";
                s.src = settings.sticker;
                await new Promise(r => { s.onload = r; s.onerror = r; });
                const sW = canvas.width * 0.3;
                const sH = s.naturalHeight * (sW / s.naturalWidth);
                ctx.drawImage(s, canvas.width - sW - 20, canvas.height - sH - 20, sW, sH);
            }

            // 5. Global BW
            if (settings.isBW) {
                const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const d = id.data;
                for (let i = 0; i < d.length; i += 4) {
                    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                    d[i] = g; d[i + 1] = g; d[i + 2] = g;
                }
                ctx.putImageData(id, 0, 0);
            }
        };
        render();
    }, [settings, photoUrl, transform]);

    // Handle Pan & Zoom
    const handlePointerDown = (e: React.PointerEvent) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pointerCache.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointerCache.current.size === 1) {
            isDragging.current = true;
            lastPos.current = { x: e.clientX, y: e.clientY };
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        const cache = pointerCache.current;
        if (!cache.has(e.pointerId)) return;

        // Update current pointer
        cache.set(e.pointerId, { x: e.clientX, y: e.clientY });

        // If 2 pointers -> PINCH ZOOM
        if (cache.size === 2) {
            const points = Array.from(cache.values());
            const curDist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);

            if (prevDist.current !== null) {
                const delta = curDist - prevDist.current;
                setTransform(t => ({
                    ...t,
                    scale: Math.max(0.5, Math.min(3, t.scale + (delta * 0.005)))
                }));
            }
            prevDist.current = curDist;
            return;
        }

        // If 1 pointer -> DRAG
        if (cache.size === 1 && isDragging.current) {
            const dx = e.clientX - lastPos.current.x;
            const dy = e.clientY - lastPos.current.y;
            lastPos.current = { x: e.clientX, y: e.clientY };
            setTransform(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        pointerCache.current.delete(e.pointerId);
        if (pointerCache.current.size < 2) prevDist.current = null;
        if (pointerCache.current.size === 0) isDragging.current = false;
    };

    const handleSave = async () => {
        setProcessing(true);
        // High-res rendering logic (similar to preview but full size)
        // For simplicity, we can use the logic from processNewPhoto or just replicate basic steps here
        // Replicating basic steps to ensure independence
        try {
            const img = new Image(); img.crossOrigin = "Anonymous"; img.src = photoUrl;
            await new Promise(r => img.onload = r);

            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            // ... (Full res implementation of above logic) ...
            // 1. BG
            if (settings.bg) {
                const bg = new Image(); bg.crossOrigin = "Anonymous"; bg.src = settings.bg;
                await new Promise(r => bg.onload = r);
                const ratio = Math.max(canvas.width / bg.naturalWidth, canvas.height / bg.naturalHeight);
                const bw = bg.naturalWidth * ratio; const bh = bg.naturalHeight * ratio;
                ctx?.drawImage(bg, (canvas.width - bw) / 2, (canvas.height - bh) / 2, bw, bh);
            } else {
                ctx!.fillStyle = '#000'; ctx!.fillRect(0, 0, canvas.width, canvas.height);
            }

            // 2. Photo Layer + Transforms + Chroma
            const pC = document.createElement('canvas');
            pC.width = canvas.width; pC.height = canvas.height;
            const pCtx = pC.getContext('2d');

            if (pCtx) {
                pCtx.save();
                pCtx.translate(canvas.width / 2, canvas.height / 2);
                pCtx.rotate((transform.rotate * Math.PI) / 180);
                pCtx.scale(transform.scale, transform.scale);
                // Adjust pan for full res (scale up from preview)
                // transform.x is in preview px. 
                // We need to scale pan to full resolution.
                // Ratio = canvas.width (full) / previewWidth
                // We don't have previewWidth here easily.
                // But we know 'canvas.width' IS 'img.naturalWidth' (swapped if landscape) logic?
                // Wait, 'canvas.width' here is set to 'img.naturalWidth' (line 130).
                // Let's re-calc baseW properly.
                const isPortrait = transform.rotate % 180 !== 0; // 90 or 270
                const baseW = isPortrait ? img.naturalHeight : img.naturalWidth;
                const baseH = isPortrait ? img.naturalWidth : img.naturalHeight;
                canvas.width = baseW; canvas.height = baseH; // Update to rotated dimensions

                // Need ratio to scale pan inputs
                // Preview was roughly 800px.
                const previewScale = Math.min(1, 800 / baseW);
                const fullScale = 1 / previewScale;

                pCtx.translate(transform.x * fullScale, transform.y * fullScale);

                // Draw Image centered
                pCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
                pCtx.restore();

                // Chroma
                if (settings.isChromaActive) {
                    const fd = pCtx.getImageData(0, 0, canvas.width, canvas.height);
                    const l = fd.data.length;
                    const tR = parseInt(settings.chromaColor.slice(1, 3), 16), tG = parseInt(settings.chromaColor.slice(3, 5), 16), tB = parseInt(settings.chromaColor.slice(5, 7), 16);
                    for (let i = 0; i < l; i += 4) {
                        if (Math.sqrt((fd.data[i] - tR) ** 2 + (fd.data[i + 1] - tG) ** 2 + (fd.data[i + 2] - tB) ** 2) < settings.tolerance) fd.data[i + 3] = 0;
                    }
                    pCtx.putImageData(fd, 0, 0);
                }
                ctx!.drawImage(pC, 0, 0);
            }

            // 3. BW & Sticker
            if (settings.isBW && ctx) {
                const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const d = id.data;
                for (let i = 0; i < d.length; i += 4) { const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; d[i] = g; d[i + 1] = g; d[i + 2] = g; }
                ctx.putImageData(id, 0, 0);
            }
            if (settings.sticker && ctx) {
                const s = new Image(); s.crossOrigin = "Anonymous"; s.src = settings.sticker;
                await new Promise(r => s.onload = r);
                const sW = canvas.width * 0.3; const sH = s.naturalHeight * (sW / s.naturalWidth);
                ctx.drawImage(s, canvas.width - sW - 50, canvas.height - sH - 50, sW, sH);
            }

            // Export
            canvas.toBlob(blob => {
                onSave(blob);
            }, 'image/jpeg', 0.95);

        } catch (e) {
            console.error(e);
            setProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[80] bg-slate-950 flex flex-col animate-in fade-in slide-in-from-bottom-10">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
                <h2 className="text-xl font-bold text-white flex gap-2"><Palette className="text-pink-500" /> Editor Fotek</h2>
                <div className="flex gap-4">
                    <button onClick={onCancel} className="px-6 py-2 rounded-full text-slate-400 hover:bg-slate-800">Zrušit</button>
                    <button onClick={handleSave} disabled={processing} className="px-8 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg flex items-center gap-2">
                        {processing ? <RefreshCw className="animate-spin" /> : <CheckCircle2 />} Uložit
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Canvas Area */}
                {/* Canvas Area with Pointer Events */}
                <div
                    className="flex-1 bg-black flex items-center justify-center p-8 relative overflow-hidden touch-none"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                >
                    <canvas ref={canvasRef} className="max-w-full max-h-full shadow-2xl border border-slate-700 cursor-move" />
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-2 rounded-full text-white text-xs pointer-events-none backdrop-blur animate-in fade-in">
                        👆 Tažením posuňte • 🔍 Zoom 2x prsty / posuvníkem
                    </div>
                    {processing && <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none"><RefreshCw className="text-white animate-spin" size={48} /></div>}
                </div>

                {/* Sidebar Controls */}
                <div className="w-80 bg-slate-900 border-l border-slate-800 p-6 overflow-y-auto space-y-8 shadow-xl">

                    {/* Effects */}
                    <div>
                        {/* TRANSFORMS */}
                        <div>
                            <h3 className="font-bold text-blue-400 mb-4 flex items-center gap-2"><Layout size={18} /> Úpravy (Ořez)</h3>
                            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-4">
                                <div className="flex gap-2">
                                    <button onClick={() => setTransform(t => ({ ...t, rotate: (t.rotate + 90) % 360 }))} className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-bold flex flex-col items-center gap-1 text-xs">
                                        <RefreshCcw size={20} /> Otočit 90°
                                    </button>
                                    <button onClick={() => setTransform(t => ({ ...t, scale: 1, x: 0, y: 0 }))} className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-bold flex flex-col items-center gap-1 text-xs">
                                        <RefreshCw size={20} /> Reset
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-slate-400"><span>Zoom</span><span>{(transform.scale * 100).toFixed(0)}%</span></div>
                                    <input
                                        type="range" min="0.5" max="3" step="0.1"
                                        value={transform.scale}
                                        onChange={e => setTransform(t => ({ ...t, scale: Number(e.target.value) }))}
                                        className="w-full accent-blue-500 h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Effects */}
                        <div>
                            <h3 className="font-bold text-slate-300 mb-4 flex items-center gap-2">✨ Efekty</h3>
                            <div className="flex items-center justify-between bg-slate-800 p-3 rounded-lg border border-slate-700 cursor-pointer" onClick={() => setSettings(s => ({ ...s, isBW: !s.isBW }))}>
                                <span>Černobíle</span>
                                <div className={`w-10 h-6 rounded-full p-1 transition-colors ${settings.isBW ? 'bg-indigo-500' : 'bg-slate-600'}`}>
                                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${settings.isBW ? 'translate-x-4' : ''}`} />
                                </div>
                            </div>
                        </div>

                        {/* Green Screen */}
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-green-400 flex items-center gap-2"><Pipette size={16} /> Klíčování</h3>
                                <button onClick={() => setSettings(s => ({ ...s, isChromaActive: !s.isChromaActive }))} className={`text-xs px-2 py-1 rounded ${settings.isChromaActive ? 'bg-green-600' : 'bg-slate-700'}`}>{settings.isChromaActive ? 'ON' : 'OFF'}</button>
                            </div>
                            {settings.isChromaActive && (
                                <div className="space-y-4 animate-in fade-in">
                                    <div>
                                        <label className="text-xs text-slate-500">Barva</label>
                                        <div className="flex gap-2 mt-1">
                                            {['#00FF00', '#0000FF', '#FF00FF'].map(c => (
                                                <div key={c} onClick={() => setSettings(s => ({ ...s, chromaColor: c }))} className={`w-8 h-8 rounded-full cursor-pointer border-2 ${settings.chromaColor === c ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                                            ))}
                                            <input type="color" value={settings.chromaColor} onChange={e => setSettings(s => ({ ...s, chromaColor: e.target.value }))} className="w-8 h-8 bg-transparent" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500">Tolerance: {settings.tolerance}</label>
                                        <input type="range" min="10" max="200" value={settings.tolerance} onChange={e => setSettings(s => ({ ...s, tolerance: Number(e.target.value) }))} className="w-full mt-1 accent-green-500" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Backgrounds */}
                        <div>
                            <h3 className="font-bold text-purple-400 mb-4">🖼️ Pozadí</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <div onClick={() => setSettings(s => ({ ...s, bg: null }))} className={`aspect-video bg-slate-800 border-2 rounded flex items-center justify-center text-xs cursor-pointer ${!settings.bg ? 'border-purple-500' : 'border-slate-700'}`}>Žádné</div>
                                {assets.filter((a: any) => a.type === 'BACKGROUND').map((a: any) => (
                                    <img key={a.id} src={a.url} onClick={() => setSettings(s => ({ ...s, bg: a.url }))} className={`w-full aspect-video object-cover rounded border-2 cursor-pointer ${settings.bg === a.url ? 'border-purple-500' : 'border-slate-700'}`} />
                                ))}
                            </div>
                        </div>

                        {/* Stickers */}
                        <div>
                            <h3 className="font-bold text-pink-400 mb-4">🦄 Samolepky</h3>
                            <div className="grid grid-cols-3 gap-2">
                                <div onClick={() => setSettings(s => ({ ...s, sticker: null }))} className={`aspect-square bg-slate-800 border-2 rounded flex items-center justify-center text-xs cursor-pointer ${!settings.sticker ? 'border-pink-500' : 'border-slate-700'}`}>Žádná</div>
                                {assets.filter((a: any) => a.type === 'STICKER').map((a: any) => (
                                    <img key={a.id} src={a.url} onClick={() => setSettings(s => ({ ...s, sticker: a.url }))} className={`w-full aspect-square object-contain bg-slate-900 rounded border-2 cursor-pointer ${settings.sticker === a.url ? 'border-pink-500' : 'border-slate-700'}`} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const LiveView = memo(({ streamUrl, isBW, isScanning, error, className, onRestart, onStreamError, onClick, printWidth, printHeight }: any) => {
    // Calculate aspect ratio for guide
    const guideStyle: React.CSSProperties = {};
    if (printWidth && printHeight) {
        const ratio = printWidth / printHeight;
        // We want to overlay a box with this aspect ratio centered
        // Since we don't know the exact container dimensions easily without ref, 
        // we can use a trick: aspect-ratio on a centralized div if supported, or percentages.
        // But simpler: Just a border that is "contain" mode? 
        // No, we want a guide ON TOP of the image which covers the whole container.
        // Assuming the video fills the container (object-contain), the black bars are part of the container.
        // If we want to show what will be printed from the SENSOR (video), we assume the video is 3:2 (standard SLR).
        // If print is also 3:2, they match.
        // If print is different, we show crop.

        // Let's assume we want to show a guide relative to the CONTAINER, 
        // assuming the video fills the container height or width.
        // A simple approach is a centered box with aspect-ratio.
        guideStyle.aspectRatio = `${printWidth}/${printHeight}`;
        guideStyle.maxHeight = '100%';
        guideStyle.maxWidth = '100%';
        guideStyle.height = 'auto'; // will be constrained by aspect ratio
        guideStyle.width = 'auto';
    }

    return (
        <div className={`relative bg-black overflow-hidden flex items-center justify-center ${className}`} onClick={onClick}>
            {error ? (
                <div className="flex flex-col items-center justify-center text-red-500 animate-pulse">
                    <AlertTriangle size={48} className="mb-2" />
                    <p className="font-bold">Chyba kamery</p>
                    {onRestart && <button onClick={(e) => { e.stopPropagation(); onRestart(); }} className="mt-4 px-4 py-2 bg-red-900/50 rounded-full text-white text-xs hover:bg-red-800">Restart</button>}
                </div>
            ) : isScanning ? (
                <div className="flex flex-col items-center justify-center text-blue-400">
                    <RefreshCw className="animate-spin mb-2" size={48} />
                    <p className="font-bold text-xs">Hledám kameru...</p>
                </div>
            ) : (
                <>
                    <img
                        src={streamUrl}
                        className={`w-full h-full object-contain ${isBW ? 'grayscale' : ''}`}
                        onError={onStreamError}
                        alt="Live View"
                    />
                    {/* Print Guide Overlay */}
                    {/* Print Guide Removed */}
                </>
            )}
        </div>
    );
});
LiveView.displayName = 'LiveView';

// --- MODIFIED GALLERY GRID ---
const GalleryGrid = ({ photos, selectedIds, onToggle, onDelete, onPrint, onEmail, onClose, events, selectedEventId, onEventChange, onEdit, hasMore, onLoadMore }: any) => {
    const [viewPhotoIndex, setViewPhotoIndex] = useState<number | null>(null);

    // Nav Logic
    useEffect(() => {
        if (viewPhotoIndex === null) return;
        const handleK = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') next();
            if (e.key === 'ArrowLeft') prev();
            if (e.key === 'Escape') setViewPhotoIndex(null);
        };
        window.addEventListener('keydown', handleK);
        return () => window.removeEventListener('keydown', handleK);
    }, [viewPhotoIndex, photos]);

    const [ts, setTs] = useState(0);
    const [te, setTe] = useState(0);
    const handleTS = (e: React.TouchEvent) => setTs(e.targetTouches[0].clientX);
    const handleTM = (e: React.TouchEvent) => setTe(e.targetTouches[0].clientX);
    const handleTE = () => {
        if (!ts || !te) return;
        if (ts - te > 50) next();
        if (ts - te < -50) prev();
        setTs(0); setTe(0);
    };
    const next = () => { if (viewPhotoIndex !== null && viewPhotoIndex < photos.length - 1) setViewPhotoIndex(viewPhotoIndex + 1); };
    const prev = () => { if (viewPhotoIndex !== null && viewPhotoIndex > 0) setViewPhotoIndex(viewPhotoIndex - 1); };

    return (
        <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col animate-in slide-in-from-bottom-10 fade-in duration-200">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between p-4 md:p-6 bg-slate-900 border-b border-slate-800 shadow-xl z-10 gap-4">
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-start">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl md:text-3xl font-bold text-white flex items-center gap-2 md:gap-3"><ImageIcon className="text-purple-400 w-6 h-6 md:w-8 md:h-8" /> Galerie</h2>
                        <span className="bg-slate-800 text-slate-400 px-2 py-1 md:px-3 rounded-full text-[10px] md:text-xs font-mono whitespace-nowrap">{photos.length} fotek</span>
                    </div>

                    {/* Event Selector */}
                    {events && (
                        <div className="relative group ml-0 md:ml-4 flex-1 md:flex-none">
                            <select
                                value={selectedEventId || ''}
                                onChange={(e) => onEventChange(e.target.value)}
                                className="appearance-none w-full md:w-auto bg-slate-800 border border-slate-700 hover:border-slate-500 text-white pl-3 pr-8 py-1.5 md:py-2 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-xs md:text-sm"
                            >
                                <option value="">Aktuální akce</option>
                                {events.map((ev: any) => (
                                    <option key={ev.id} value={ev.id}>
                                        {ev.name} {ev.isActive ? '(Active)' : ''}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" size={12} />
                        </div>
                    )}
                </div>
                <div className="flex gap-2 w-full md:w-auto justify-end overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                    {selectedIds.length === 1 && (
                        <button onClick={() => onEdit(selectedIds[0])} className="bg-pink-600 text-white px-3 py-2 md:px-6 md:py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-pink-500 transition-colors shadow-lg shadow-pink-900/20 whitespace-nowrap text-xs md:text-base"><Palette size={16} className="md:w-5 md:h-5" /> <span className="hidden md:inline">Upravit</span></button>
                    )}
                    {selectedIds.length > 0 && (
                        <>
                            <button onClick={onDelete} className="bg-red-900/50 text-red-200 px-3 py-2 md:px-6 md:py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-red-900 transition-colors whitespace-nowrap text-xs md:text-base"><Trash2 size={16} className="md:w-5 md:h-5" /> <span className="hidden md:inline">Smazat</span> ({selectedIds.length})</button>
                            <button onClick={onPrint} className="bg-blue-600 text-white px-3 py-2 md:px-6 md:py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20 whitespace-nowrap text-xs md:text-base"><Printer size={16} className="md:w-5 md:h-5" /> <span className="hidden md:inline">Tisk</span> ({selectedIds.length})</button>
                            <button onClick={onEmail} className="bg-indigo-600 text-white px-3 py-2 md:px-6 md:py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/20 whitespace-nowrap text-xs md:text-base"><Mail size={16} className="md:w-5 md:h-5" /> <span className="hidden md:inline">Email</span> ({selectedIds.length})</button>
                        </>
                    )}
                    <button onClick={onClose} className="bg-slate-800 text-white p-2 md:p-3 rounded-full hover:bg-slate-700 transition-colors flex-shrink-0"><X size={20} className="md:w-7 md:h-7" /></button>
                </div>
            </div>

            {/* LIGHTBOX */}
            {viewPhotoIndex !== null && photos[viewPhotoIndex] && (
                <div
                    className="fixed inset-0 z-[60] bg-black flex items-center justify-center animate-in fade-in duration-200"
                    onTouchStart={handleTS} onTouchMove={handleTM} onTouchEnd={handleTE}
                >
                    <img src={photos[viewPhotoIndex].url} className="max-w-full max-h-full object-contain select-none" draggable={false} />

                    {/* Controls */}
                    <button onClick={() => setViewPhotoIndex(null)} className="absolute top-6 right-6 text-white/50 hover:text-white p-4 bg-black/50 rounded-full hover:bg-black/80"><X size={32} /></button>



                    {viewPhotoIndex > 0 && (
                        <button onClick={prev} className="absolute left-6 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-4 bg-black/50 rounded-full hover:bg-black/80"><ArrowLeft size={48} /></button>
                    )}
                    {viewPhotoIndex < photos.length - 1 && (
                        <button onClick={next} className="absolute right-6 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-4 bg-black/50 rounded-full hover:bg-black/80"><ArrowRight size={48} /></button>
                    )}
                </div>
            )}

            {/* Standard Grid (Left-to-Right) */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 content-start">
                {photos.map((p: any, idx: number) => (
                    <div key={p.id} onClick={() => setViewPhotoIndex(idx)} className={`relative w-full bg-slate-900 rounded-xl overflow-hidden group transition-all duration-200 border border-slate-800 hover:shadow-xl hover:scale-[1.02] cursor-pointer ${selectedIds.includes(p.id) ? 'ring-4 ring-indigo-500 scale-[1.02]' : ''}`} style={{ paddingBottom: '66.66%' }}>
                        {/* Image - Cover to fill the grid cell (Absolute due to padding hack) */}
                        <img src={p.url} className="absolute inset-0 w-full h-full object-cover block" loading="lazy" />

                        {/* Top-Right Checkbox */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggle(p.id); }}
                            className={`absolute top-2 right-2 p-2 rounded-full transition-all z-20 hover:scale-110 ${selectedIds.includes(p.id) ? 'bg-indigo-600 text-white shadow-lg' : 'bg-black/30 text-white/80 hover:bg-black/60 hover:text-white'}`}
                        >
                            {selectedIds.includes(p.id) ? <CheckCircle2 size={28} /> : <div className="w-7 h-7 rounded-full border-2 border-white/90" />}
                        </button>
                    </div>
                ))}

                {/* Pagination / Load More Button */}
                {hasMore && photos.length > 0 && (
                    <div className="col-span-full flex justify-center mt-8 mb-20">
                        <button
                            onClick={onLoadMore}
                            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-bold shadow-lg transition-transform hover:scale-105 active:scale-95 text-xl"
                        >
                            Načíst další fotky
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default function KioskPage() {
    const [status, setStatus] = useState<'idle' | 'countdown' | 'processing' | 'review'>('idle');
    const [timerSeconds, setTimerSeconds] = useState(3); // Default 3s
    const [showTimerMenu, setShowTimerMenu] = useState(false);
    // const [countdown, setCountdown] = useState(0); // REMOVED LEGACY LOCAL STATE
    const lastBeepRef = useRef<number | null>(null);

    const playBeep = (type: 'tick' | 'final') => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === 'final') {
                osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch (A5)
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.5);
            } else {
                osc.frequency.setValueAtTime(600, ctx.currentTime); // Mid pitch
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.1);
            }
        } catch (e) { /* Audio context blocked or error */ }
    };
    const [lastPhoto, setLastPhoto] = useState<string | null>(null);
    const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showGallery, setShowGallery] = useState(false);
    const [galleryPhotos, setGalleryPhotos] = useState<any[]>([]);
    const [galleryPage, setGalleryPage] = useState(1);
    const [galleryHasMore, setGalleryHasMore] = useState(true);
    const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
    const [galleryEventId, setGalleryEventId] = useState<string>('');
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailInput, setEmailInput] = useState('');
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Settings & Admin
    const [showSettings, setShowSettings] = useState(false);
    const [activeTab, setActiveTab] = useState('user');
    const [sessionSettings, setSessionSettings] = useState({
        localPhotoPath: 'C:\\Fotos',
        commandPort: 5513,
        selectedBg: null as string | null,
        chromaKeyColor: '#00FF00',
        chromaTolerance: 100,
        isBW: false,
        selectedSticker: null as string | null,
        email: '',
        printWidth: 148, // mm (Canon Postcard standard)
        printHeight: 100, // mm
        smtp: { host: '', port: '', user: '', pass: '' }
    });
    const [assets, setAssets] = useState<{ id: string, url: string, type: 'BACKGROUND' | 'STICKER' }[]>([]);
    const [assetPrompt, setAssetPrompt] = useState('');
    const [isGeneratingAsset, setIsGeneratingAsset] = useState(false);

    // Load assets on mount
    useEffect(() => {
        fetchAssets();
    }, []);

    const fetchAssets = async () => {
        try {
            const res = await fetch('/api/assets/list');
            const data = await res.json();
            if (data.success) {
                const newAssets = [
                    ...data.backgrounds.map((b: any) => ({ id: b.name, url: b.url, type: 'BACKGROUND' })),
                    ...data.stickers.map((s: any) => ({ id: s.name, url: s.url, type: 'STICKER' }))
                ];
                setAssets(newAssets);
            }
        } catch (e) { console.error("Assets load failed", e); }
    };

    const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'background' | 'sticker') => {
        const file = e.target.files?.[0];
        if (!file) return;

        const fd = new FormData();
        fd.append('file', file);
        fd.append('type', type);

        try {
            const res = await fetch('/api/assets/upload', { method: 'POST', body: fd });
            const d = await res.json();
            if (d.success) { showToast('Nahráno ✅'); fetchAssets(); }
            else showToast('Chyba nahrávání');
        } catch { showToast('Chyba'); }
    };

    const handleAIGenerate = async (isSticker: boolean) => {
        if (!assetPrompt) return;
        setIsGeneratingAsset(true);
        try {
            const res = await fetch('/api/assets/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: assetPrompt, isSticker })
            });
            const d = await res.json();
            if (d.success) { showToast('Vygenerováno ✅'); fetchAssets(); setAssetPrompt(''); }
            else showToast('Chyba AI: ' + d.error);
        } catch { showToast('Chyba spojení'); }
        setIsGeneratingAsset(false);
    };

    // ... (rest of the file until printSelected)

    const printSelected = async () => {
        // 1. Determine what to print
        let targetUrl = '';
        let targetId = '';

        if (status === 'review' && lastPhoto) {
            targetUrl = lastPhoto;
        } else if (selectedPhotoIds.length === 1) {
            targetId = selectedPhotoIds[0];
            const p = galleryPhotos.find(x => x.id === targetId);
            if (p) targetUrl = p.url;
        }

        if (!targetUrl) return;

        showToast('Příprava tisku... ✂️');

        try {
            // A) CROP IMAGE TO PRINT ASPECT RATIO
            // Load Image
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = targetUrl;
            await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });

            // Calculate Crop
            const printRatio = sessionSettings.printWidth / sessionSettings.printHeight; // e.g. 1.5
            const imgRatio = img.naturalWidth / img.naturalHeight;

            let cx = 0, cy = 0, cw = img.naturalWidth, ch = img.naturalHeight;

            // If Image is wider than Print -> Crop Sides
            if (imgRatio > printRatio) {
                cw = img.naturalHeight * printRatio;
                cx = (img.naturalWidth - cw) / 2;
            }
            // If Image is taller than Print -> Crop Top/Bottom
            else {
                ch = img.naturalWidth / printRatio;
                cy = (img.naturalHeight - ch) / 2;
            }

            // Draw to Canvas
            const canvas = document.createElement('canvas');
            canvas.width = sessionSettings.printWidth * 12; // approx 300 DPI (118 px/cm) -> 12 px/mm -> 150mm * 12 = 1800px
            canvas.height = sessionSettings.printHeight * 12; // 100mm * 12 = 1200px
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas init failed');

            // Draw Cropped
            ctx.drawImage(img, cx, cy, cw, ch, 0, 0, canvas.width, canvas.height);

            // B) UPLOAD PREPARED FILE
            canvas.toBlob(async (blob) => {
                if (!blob) throw new Error("Blob failed");
                const formData = new FormData();
                formData.append('file', blob, `print_job_${Date.now()}.jpg`);
                formData.append('type', 'PRINT');
                formData.append('isPrint', 'true'); // Tell server to keep quality

                const upRes = await fetch('/api/media/upload', { method: 'POST', body: formData });
                const upData = await upRes.json();

                if (!upData.success) throw new Error('Upload print job failed');

                // Extract relative path from URL (remove /photos/ prefix)
                // URL: /photos/slug/file.jpg -> slug/file.jpg
                const relativePath = upData.url.replace(/^\/photos\//, '');

                // C) SEND TO PRINTER
                showToast('Tisk... 🖨️');
                const printRes = await fetch('/api/print', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: upData.filename, // "print_job_..."
                        path: relativePath
                    })
                });

                if (!printRes.ok) throw new Error('Print trigger failed');
                showToast('Odesláno na tiskárnu ✅');

            }, 'image/jpeg', 0.95);

        } catch (e) {
            console.error(e);
            showToast('Chyba tisku ❌');
        }
    };

    // Tech / Stream
    const [cameraIp, setCameraIp] = useState(DEFAULT_IP);
    const [activePort, setActivePort] = useState<number | null>(null);
    const [autoCmdPort, setAutoCmdPort] = useState<number | null>(null);
    const [isScanning, setIsScanning] = useState(true);
    const [failedPorts, setFailedPorts] = useState<number[]>([]);
    const [cloudStreamEnabled, setCloudStreamEnabled] = useState(true);
    const [streamStatus, setStreamStatus] = useState('offline');
    const [streamLog, setStreamLog] = useState<string[]>([]);
    // Removed duplicate assets definition
    const [isPickingColor, setIsPickingColor] = useState(false);
    const [streamToken, setStreamToken] = useState(0); // init with 0 to avoid hydration mismatch

    // --- EVENT LOGIC ---
    const [events, setEvents] = useState<any[]>([]);
    const [newEventName, setNewEventName] = useState('');
    const [newEventPassword, setNewEventPassword] = useState('');

    // Tech Auth for Modal
    const [techAuth, setTechAuth] = useState(false);
    const [techPasswordInput, setTechPasswordInput] = useState('');

    // --- OVERLAY LOGIC ---
    const [overlayConfig, setOverlayConfig] = useState<{ path: string, url?: string, x: number, y: number, w: number } | null>(null);

    useEffect(() => {
        if (showSettings) {
            fetch('/api/event/config').then(r => r.json()).then(d => {
                if (d.overlay) {
                    // Try to find URL if we only have path (from assets)
                    // But assets might not be loaded yet or format differs.
                    // Ideally we save URL too or match by ID.
                    // For now, let's trust we can match it or use it.
                    setOverlayConfig(d.overlay);
                } else {
                    setOverlayConfig(null);
                }
            });
        }
    }, [showSettings]);

    const handleOverlaySave = async () => {
        try {
            await fetch('/api/event/update-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ overlay: overlayConfig })
            });
            showToast('Samolepka aktivní ✅');
        } catch { showToast('Chyba uložení'); }
    };

    // Environment Check
    const [isLocal, setIsLocal] = useState(() => {
        if (typeof window !== 'undefined') {
            const h = window.location.hostname;
            return h === 'localhost' || h === '127.0.0.1';
        }
        return false;
    });

    useEffect(() => {
        console.log(`[ENV] isLocal: ${isLocal}`);
        if (!isLocal) {
            setIsScanning(false);
            setActivePort(null);
            setCloudStreamEnabled(false);
        }
    }, [isLocal]);

    const loadEvents = () => {
        fetch('/api/event')
            .then(res => {
                if (!res.ok) throw new Error(res.statusText);
                return res.text().then(text => {
                    try { return JSON.parse(text); }
                    catch (e) { console.error('JSON Error:', text); return []; }
                });
            })
            .then(data => { if (Array.isArray(data)) setEvents(data); })
            .catch(e => console.error(e));
    };

    const activateEvent = async (id: string, name: string) => {
        try {
            await fetch('/api/event/active', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            showToast(`Aktivní: ${name} ✅`);
            loadEvents();
        } catch (e) { showToast('Chyba změny!'); }
    };

    const createEvent = async () => {
        if (!newEventName) return;
        try {
            const res = await fetch('/api/event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newEventName, password: newEventPassword, makeActive: true })
            });
            const d = await res.json();
            if (d.success) {
                showToast('Vytvořeno & Aktivní ✅');
                setNewEventName('');
                setNewEventPassword('');
                loadEvents();
            } else showToast('Chyba: ' + d.error);
        } catch (e) { showToast('Chyba vytvoření'); }
    };

    useEffect(() => {
        loadEvents();
    }, []);

    const processingRef = useRef(false);

    const showToast = (msg: string) => { setToastMessage(msg); setTimeout(() => setToastMessage(null), 3000); };
    const addLog = (msg: string) => setStreamLog(p => [msg, ...p].slice(0, 50));

    // 1. Auto-detect Command Port (API)
    useEffect(() => {
        const detectCmd = async () => {
            const candidates = [5520, 5513];
            for (const port of candidates) {
                try {
                    const controller = new AbortController();
                    setTimeout(() => controller.abort(), 500);
                    await fetch(`http://${cameraIp}:${port}/`, { mode: 'no-cors', signal: controller.signal });
                    console.log(`🔌 Nalezen Command Port: ${port}`);
                    setAutoCmdPort(port);
                    return; // Found it!
                } catch (e) { }
            }
        };
        if (typeof window !== 'undefined') detectCmd();
    }, [cameraIp]);

    useEffect(() => {
        let mounted = true;

        // Load Settings
        const savedCmdPort = localStorage.getItem('tech_cmd_port');
        const savedPath = localStorage.getItem('tech_photo_path');
        if (savedCmdPort) setSessionSettings(s => ({ ...s, commandPort: parseInt(savedCmdPort) }));
        if (savedPath) setSessionSettings(s => ({ ...s, localPhotoPath: savedPath }));

        // Load Server Settings (SMTP)
        fetch('/api/settings').then(r => r.json()).then(data => {
            if (data.smtp_config) {
                setSessionSettings(s => ({ ...s, smtp: data.smtp_config }));
            }
        }).catch(e => console.error(e));

        const resetInterval = setInterval(() => setFailedPorts([]), 30000);

        const scanPorts = async () => {
            if (!mounted) return;

            // On cloud, don't scan local ports (prevents console errors)
            if (!isLocal) {
                setIsScanning(false);
                return;
            }

            setIsScanning(true);

            // Prioritize Bridge (5555), then others
            const candidates = [5555, 5600, 5599, 5514, 5521, 5520, 5513].filter(p => !failedPorts.includes(p));

            if (candidates.length === 0 || failedPorts.length > 0) {
                try {
                    // Only try to wake up if local
                    if (isLocal) {
                        fetch(`http://${DEFAULT_IP}:5520/?cmd=LiveView_Show`, { mode: 'no-cors' }).catch(() => { });
                        fetch(`http://${DEFAULT_IP}:5513/?cmd=LiveView_Show`, { mode: 'no-cors' }).catch(() => { });
                    }
                } catch (e) { }

                setFailedPorts([]);
                setTimeout(scanPorts, 1000);
                return;
            }

            for (const port of candidates) {
                if (!mounted) return;
                try {
                    const controller = new AbortController();
                    const id = setTimeout(() => controller.abort(), 1000);

                    let path = '/liveview.jpg';
                    if (port === 5555) path = '/stream.mjpg';
                    else if (port === 5521 || port === 5514 || port === 5599 || port === 5600) path = '/live';

                    // For MJPEG streams (5555), fetching body can hang. 
                    // But for initial check we just need response headers or connection success.
                    const url = `http://${DEFAULT_IP}:${port}${path}`;
                    await fetch(url, { method: 'GET', signal: controller.signal, mode: 'no-cors' });

                    clearTimeout(id);
                    if (mounted) { setActivePort(port); setIsScanning(false); return; }
                } catch (e) { }
            }
            if (mounted) setTimeout(scanPorts, 2000);
        };
        scanPorts();
        return () => { mounted = false; clearInterval(resetInterval); };
    }, [failedPorts, isLocal]);

    // Fix Hydration Mismatch
    const [isClient, setIsClient] = useState(false);
    useEffect(() => setIsClient(true), []);

    // Stream URLs
    const getDisplayUrl = () => {
        if (!isClient) return ''; // SSR safe
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocal && activePort) {
            if (activePort === 5555) {
                // Bridge: MJPEG stream with token — token change forces browser to reconnect
                // This is critical for onStreamError recovery to work!
                return `http://${DEFAULT_IP}:5555/stream.mjpg?r=${streamToken}`;
            }

            // Direct Camera Connection (snapshot with token)
            return `http://${cameraIp}:${activePort}/liveview.jpg?t=${streamToken}`;
        }
        return `/api/stream/snapshot?t=${Date.now()}`;
    };
    const [cloudTick, setCloudTick] = useState(0);
    useEffect(() => {
        if (!isClient) return;
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (!isLocal) { const i = setInterval(() => setCloudTick(Date.now()), 200); return () => clearInterval(i); }
    }, [isClient]);

    // Proactive MJPEG stream reconnect every 25s
    // Chrome may silently drop MJPEG connections — this forces a fresh connection before that happens.
    useEffect(() => {
        if (!isClient) return;
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (!isLocal || !activePort) return;
        const i = setInterval(() => {
            setStreamToken(Date.now());
        }, 25000);
        return () => clearInterval(i);
    }, [isClient, activePort]);


    // Auto-restart LiveView when returning to idle
    useEffect(() => {
        if (status === 'idle') {
            const t = setTimeout(() => {
                // Always try to kick the stream when returning from review/processing
                restartLiveView();
            }, 500);
            return () => clearTimeout(t);
        }
    }, [status]);

    // Calculate final URL only on client to avoid hydration mismatch
    const finalStreamUrl = isClient ? (
        (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
            ? `/api/stream/snapshot?t=${cloudTick}`
            : getDisplayUrl()
    ) : '';


    // Stream Status (Bridge now handles cloud upload)
    useEffect(() => {
        const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

        if (isLocal && activePort) {
            setStreamStatus('live');
            addLog('Stream aktivní (Bridge uploaduje na cloud)');
        } else if (!isLocal) {
            // On cloud, we just receive - no status tracking needed
            setStreamStatus('cloud');
        } else {
            setStreamStatus('offline');
        }
    }, [activePort]);

    // Data Poll
    const lastProcessedIdRef = useRef<string | null>(null);
    const isFirstPoll = useRef(true);

    // Sync Settings to Server (Debounced)
    // Sync Photo Path (Debounced)
    useEffect(() => {
        const t = setTimeout(() => {
            if (sessionSettings.localPhotoPath) {
                fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'photo_path', value: sessionSettings.localPhotoPath })
                }).catch(e => console.error("Path sync failed", e));
            }
        }, 1000);
        return () => clearTimeout(t);
    }, [sessionSettings.localPhotoPath]);

    // Sync SMTP Config (Debounced)
    useEffect(() => {
        const t = setTimeout(() => {
            if (sessionSettings.smtp) {
                fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ smtp_config: sessionSettings.smtp })
                }).catch(e => console.error("SMTP sync failed", e));
            }
        }, 1000);
        return () => clearTimeout(t);
    }, [sessionSettings.smtp]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedIp = localStorage.getItem('camera_ip'); if (savedIp) setCameraIp(savedIp);
        }
        fetch('/api/session', { method: 'POST', body: JSON.stringify({ id: SESSION_ID }) }).catch(console.error);
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/poll?sessionId=${SESSION_ID}`); const data = await res.json();

                // Remote trigger
                if (data.pending && status === 'idle' && !processingRef.current) startCountdown();

                // New photo detection
                if (data.latest && data.latest.id) {

                    // FIRST RUN CHECK: Don't process what was already there on reload
                    if (isFirstPoll.current) {
                        lastProcessedIdRef.current = data.latest.id;
                        isFirstPoll.current = false;
                        console.log("ℹ️ Initial Poll: Synced ID, skipping process.");
                        return;
                    }

                    if (data.latest.id !== lastProcessedIdRef.current) {
                        // IGNORE self-generated web photos or temporary files
                        if (data.latest.url.includes('/photos/web_') || data.latest.url.includes('edited_') || data.latest.url.includes('print_')) {
                            // Mark as seen so we don't re-check constanty
                            if (lastProcessedIdRef.current !== data.latest.id) {
                                lastProcessedIdRef.current = data.latest.id;
                            }
                            return;
                        }

                        console.log("🔍 Poll detected new ID:", data.latest.id, "Last:", lastProcessedIdRef.current, "URL:", data.latest.url, "Status:", status);
                        lastProcessedIdRef.current = data.latest.id; // Mark as seen immediately

                        // 2. If it's a new ORIGINAL photo, process it (unless we are already reviewing one).
                        if (status === 'idle' || status === 'countdown' || status === 'processing') {
                            console.log("⚡ Auto-processing new photo...");
                            processNewPhoto(data.latest.url);
                        } else {
                            console.log("⚠️ Photo received but ignored (App is busy/reviewing).");
                        }
                    }
                }
            } catch (e) { }
        }, 1000);
        return () => clearInterval(interval);
    }, [status, sessionSettings]);

    // --- COUNTDOWN SYNC LOGIC ---
    const [countdownValue, setCountdownValue] = useState<number | null>(null);

    useEffect(() => {
        if (!activePort || status === 'review') return;

        const interval = setInterval(async () => {
            // Only poll status if we are local (connected to Bridge)
            try {
                const res = await fetch(`http://${cameraIp}:5555/status`);
                const data = await res.json();

                if (data.countdownTarget > 0) {
                    const remaining = Math.ceil((data.countdownTarget - data.now) / 1000);
                    if (remaining > 0) {
                        // Only force status if not already processing
                        if (status !== 'processing') setStatus('countdown');
                        setCountdownValue(remaining);

                        // Audio Feedback
                        if (remaining !== lastBeepRef.current) {
                            if (remaining === 3 || remaining === 2) playBeep('tick');
                            if (remaining === 1) playBeep('final');
                            lastBeepRef.current = remaining;
                        }
                    } else {
                        lastBeepRef.current = null;
                        setCountdownValue(null);
                    }
                } else {
                    setCountdownValue(null);
                    // Reset only if we were previously counting down
                    if (status === 'countdown') setStatus('idle');
                }
            } catch (e) { }
        }, 200);
        return () => clearInterval(interval);
    }, [activePort, cameraIp, status]);

    // Process Photo (Simple Review)
    const processNewPhoto = async (originalUrl: string) => {
        if (isUploading) return;
        setLastPhoto(originalUrl);
        setStatus('review');

        setTimeout(() => {
            setLastPhoto(null);
            setStatus('idle');
            // Úplně obnoví stream URL pro MJPEG, aby prohlížeč neuvízl v mrtvém připojení z pohotového stavu
            setStreamToken(Date.now());
            // Znovu probudí Live View v zrcadlovce (DCC ho po vyfocení zastaví)
            setTimeout(restartLiveView, 500);
        }, 3000); // Zobrazíme náhled na 3 vteřiny (z 2)
    };

    const handleEditorSave = async (blob: Blob) => {
        const formData = new FormData();
        formData.append('file', blob, `edited_${Date.now()}.jpg`);
        formData.append('type', 'PHOTO');

        try {
            const res = await fetch('/api/media/upload', { method: 'POST', body: formData });
            const d = await res.json();
            if (d.success) {
                showToast('Uloženo ✅');
                setEditingPhotoId(null);
                if (showGallery) fetchGalleryPhotos(galleryEventId);
            } else showToast('Chyba uložení');
        } catch { showToast('Chyba'); }
    };

    // Actions
    const handlePreviewClick = (e: React.MouseEvent<HTMLImageElement>) => {
        if (!isPickingColor) return;
        const img = e.currentTarget; const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight; const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.drawImage(img, 0, 0); const rect = img.getBoundingClientRect(); const x = (e.clientX - rect.left) * (img.naturalWidth / rect.width); const y = (e.clientY - rect.top) * (img.naturalHeight / rect.height); const p = ctx.getImageData(x, y, 1, 1).data;
        const hex = "#" + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase(); setSessionSettings({ ...sessionSettings, chromaKeyColor: hex }); setIsPickingColor(false); showToast(`Barva: ${hex}`);
    };
    // Unified Countdown: Trigger server with delay
    const startCountdown = () => {
        if (processingRef.current || status !== 'idle') return;
        setStatus('countdown'); // immediately lock the UI from double clicks
        takePhoto(timerSeconds * 1000);
    };

    // Auto-Rescue Escape Hatch
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (status === 'processing' || status === 'countdown') {
            timeout = setTimeout(() => {
                // If it takes more than 15s total to take and process a photo, the camera failed
                if (status === 'processing' || status === 'countdown') {
                    console.log("Escape Hatch Triggered: Resetting UI to idle");
                    showToast('Chyba: Zrcadlovka neodpověděla včas. Restartuji senzor.');
                    // Force the backend bridge to unlock itself so it stops broadcasting countdown ticks
                    fetch(`http://${cameraIp}:5555/shoot`, { method: 'POST', body: JSON.stringify({ delay: 0, cancel: true }), headers: { 'Content-Type': 'application/json' } }).catch(() => { });
                    restartLiveView();
                }
            }, 10000 + (timerSeconds * 1000)); // Snižujeme na 10 vteřin pro rychlejší obzivení
        }
        return () => clearTimeout(timeout);
    }, [status, timerSeconds, cameraIp]);

    const takePhoto = async (delay = 0) => {
        try {
            if (!isLocal) {
                // [WEB MODE] Send trigger command to server DB
                console.log(`📸 WEB TRIGGER: Sending CAPTURE command to server (Delay: ${delay}ms)`);

                // 1. Simulate Visual Countdown
                if (delay > 0) {
                    setStatus('countdown');
                    setCountdownValue(Math.ceil(delay / 1000));

                    let remaining = Math.ceil(delay / 1000);
                    const i = setInterval(() => {
                        remaining--;
                        setCountdownValue(remaining > 0 ? remaining : null);
                        if (remaining <= 0) {
                            clearInterval(i);
                            // Timer finished, waiting for photo...
                        }
                    }, 1000);
                }

                await fetch('/api/command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cmd: 'CAPTURE', params: { delay } })
                });
                return;
            }

            // [LOCAL MODE] Use Bridge Server (Port 5555) for synchronized shooting
            // Even if camera is on another port, Bridge handles it.
            const url = `http://${cameraIp}:5555/shoot`;

            console.log(`📸 Sending Trigger to Bridge: ${url} (Delay: ${delay}ms)`);

            // Send trigger with optional delay
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ delay })
            }).catch(e => console.error("Trigger Failed", e));

        } catch (e) {
            console.error("Camera Error:", e);
            showToast('Chyba komunikace');
        }
    };

    const restartLiveView = async () => {
        try {
            if (activePort === 5555) {
                // Kiosk Bridge mode (Lokální server zajišťuje WakeUp všech portů)
                fetch(`http://${cameraIp}:5555/wake`).catch(e => { });
            } else {
                // Přímé volání DCC
                const dccPort = autoCmdPort || 5520;
                fetch(`http://${cameraIp}:${dccPort}/?cmd=LiveView_Show`, { mode: 'no-cors' }).catch(e => { });
                if (dccPort !== 5513) fetch(`http://${cameraIp}:5513/?cmd=LiveView_Show`, { mode: 'no-cors' }).catch(e => { });
                if (activePort) {
                    fetch(`http://${cameraIp}:${activePort}/?cmd=LiveView_Show`, { mode: 'no-cors' }).catch(e => { });
                }
            }

            // 2. Clear failure logs
            setFailedPorts([]);

            // 3. Reset scanning logic ONLY if we don't have an active port
            if (!activePort) {
                setIsScanning(true);
            } else {
                // If we have an active port, just refresh token without blocking UI
                setStreamToken(Date.now());
            }
            setStreamStatus('live');
            setStatus('idle'); // Ensure UI returns to IDLE if stuck

        } catch (e) {
            // Silent fail
        }
    };

    // --- GALLERY LOGIC START ---
    const fetchGalleryPhotos = async (eventId: string = '', pageNum: number = 1, append: boolean = false) => {
        try {
            const baseUrl = eventId ? `/api/media/list?eventId=${eventId}` : '/api/media/list';
            const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + `page=${pageNum}`;
            const res = await fetch(url);
            const data = await res.json();
            if (Array.isArray(data)) {
                setGalleryHasMore(data.length === 60);
                if (append) {
                    setGalleryPhotos(prev => {
                        const newUrls = new Set(data.map(d => d.url));
                        const filteredPrev = prev.filter(p => !newUrls.has(p.url));
                        return [...filteredPrev, ...data];
                    });
                } else {
                    setGalleryPhotos(data);
                }
            }
        } catch (e) { }
    };

    const openGallery = async () => {
        setShowGallery(true); setSelectedPhotoIds([]); setGalleryPage(1);
        fetchGalleryPhotos(galleryEventId, 1, false);
    };

    useEffect(() => {
        if (showGallery) {
            setGalleryPage(1);
            fetchGalleryPhotos(galleryEventId, 1, false);
        }
    }, [galleryEventId]);

    useEffect(() => {
        if (showGallery && galleryPage > 1) {
            fetchGalleryPhotos(galleryEventId, galleryPage, true);
        }
    }, [galleryPage]);
    const toggleSelection = (id: string) => {
        setSelectedPhotoIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };
    const bulkDelete = async () => {
        if (!confirm('Opravdu chcete smazat vybrané fotky?')) return;
        try {
            await fetch('/api/media/delete', { method: 'POST', body: JSON.stringify({ ids: selectedPhotoIds }) });
            setGalleryPhotos(prev => prev.filter(p => !selectedPhotoIds.includes(p.id))); setSelectedPhotoIds([]); showToast('Smazáno 🗑️');
        } catch (e) { showToast('Chyba mazání'); }
    };

    const updateSmtp = (key: string, val: string) => {
        setSessionSettings(prev => {
            const next = { ...prev, smtp: { ...prev.smtp, [key]: val } };
            return next;
        });
    };

    const bulkEmail = async () => {
        if (selectedPhotoIds.length > 3) { showToast('Max 3 fotky!'); return; }
        setShowEmailModal(true); // Open Modal with context
    };
    const sendEmail = async () => {
        if (!emailInput.includes('@')) { showToast('Email?'); return; }
        showToast('Odesílám...');

        // Find URLs for selected IDs
        let urlsToSend: string[] = [];
        if (status === 'review' && lastPhoto) urlsToSend = [lastPhoto];
        else urlsToSend = galleryPhotos.filter(p => selectedPhotoIds.includes(p.id)).map(p => p.url);

        try {
            // 1. Try Direct Send (Preferred for Autonomy)
            const res = await fetch('/api/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: emailInput, photoUrls: urlsToSend })
            });

            if (res.ok) {
                showToast('ODESLÁNO (WEB) ✅');
                setShowEmailModal(false);
                return;
            }

            // 2. If Direct Failed (e.g. no config) AND we are on Web -> Fallback to Kiosk Bridge
            if (!isLocal) {
                console.warn("Web Email failed, trying Kiosk Bridge...", res.status);
                showToast('Zkouším přes Kiosk...');

                await fetch('/api/command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        cmd: 'SEND_EMAIL',
                        params: { email: emailInput, photoUrls: urlsToSend }
                    })
                });

                showToast('ODESLÁNO (KIOSK) ✅');
                setShowEmailModal(false);
                return;
            }

            throw new Error('Email API failed');
        } catch (e) { showToast('Chyba odeslání ❌'); console.error(e); }
    };

    // --- GALLERY LOGIC END ---

    // Environment Check moved up

    // ... (existing code)

    return (
        <div className="relative w-full h-full bg-slate-950 overflow-hidden flex flex-col items-center justify-center select-none">
            {/* Debug / Cloud Indicator */}
            {isClient && !isLocal && <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600/50 px-3 py-1 rounded-full text-[10px] font-bold text-white z-[60] backdrop-blur-sm pointer-events-none">☁️ CLOUD VIEW</div>}

            {/* Layers */}
            <div className="absolute inset-0 bg-black flex items-center justify-center">
                {status === 'processing' ? <div className="text-white flex flex-col items-center animate-pulse"><RefreshCw className="animate-spin mb-4" size={48} /><span className="text-2xl font-bold">Zpracovávám...</span></div>
                    : status === 'review' && lastPhoto ? <img src={lastPhoto} className="w-full h-full object-contain bg-slate-900" />
                        : <div className="w-full h-full relative flex items-center justify-center">
                            <LiveView
                                streamUrl={finalStreamUrl}
                                isBW={sessionSettings.isBW}
                                isScanning={isScanning && !activePort} // Only show loader if we have NO active port
                                error={isClient && isLocal && !isScanning && !activePort}
                                className="w-full h-full object-contain"
                                onRestart={restartLiveView}
                                onStreamError={() => { console.warn("Stream drop, retrying..."); setStreamToken(Date.now()); }}
                                onClick={startCountdown}
                                printWidth={sessionSettings.printWidth}
                                printHeight={sessionSettings.printHeight}
                            />


                        </div>}
            </div>

            {/* Legacy Overlay Removed */}

            {/* EDITOR OVERLAY */}
            {editingPhotoId && (
                <PhotoEditor
                    photoUrl={galleryPhotos.find(p => p.id === editingPhotoId)?.url}
                    assets={assets}
                    onSave={handleEditorSave}
                    onCancel={() => setEditingPhotoId(null)}
                />
            )}

            {/* SETTINGS MODAL */}
            {showSettings && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in zoom-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-0 max-w-6xl w-full shadow-2xl text-white h-[90vh] flex flex-col overflow-hidden">

                        {/* HEADER */}
                        <div className="flex bg-slate-950 border-b border-slate-800 p-6 justify-between items-center">
                            <h2 className="text-2xl font-bold flex items-center gap-3"><Settings size={28} /> Nastavení</h2>
                            <div className="flex bg-slate-800 rounded-full p-1 border border-slate-700">
                                <button onClick={() => setActiveTab('user')} className={`px-6 py-2 rounded-full font-bold flex gap-2 transition-all ${activeTab === 'user' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>
                                    <Calendar size={16} /> Událost
                                </button>
                                <button onClick={() => setActiveTab('admin')} className={`px-6 py-2 rounded-full font-bold flex gap-2 transition-all ${activeTab === 'admin' ? 'bg-red-900/40 text-red-300' : 'text-slate-400 hover:text-white'}`}>
                                    <Shield size={16} /> Technické
                                </button>
                                {techAuth && (
                                    <button onClick={() => setActiveTab('assets')} className={`px-6 py-2 rounded-full font-bold flex gap-2 transition-all ${activeTab === 'assets' ? 'bg-pink-900/40 text-pink-300' : 'text-slate-400 hover:text-white'}`}>
                                        <Palette size={16} /> Grafika
                                    </button>
                                )}
                            </div>
                            <button onClick={() => { setShowSettings(false); setStreamToken(Date.now()); setTimeout(restartLiveView, 300); }} className="p-2 hover:bg-white/10 rounded-full"><X size={24} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 bg-slate-900">

                            {/* === EVENT TAB (USER) === */}
                            {activeTab === 'user' && (
                                <div className="space-y-8">
                                    {/* 1. EVENT MANAGER */}
                                    <div className="p-6 bg-slate-950 border border-indigo-500/30 rounded-2xl shadow-lg space-y-6">
                                        <h3 className="text-xl font-bold text-indigo-400 flex items-center gap-2"><Calendar /> Správa Události</h3>

                                        {/* ACTIVE EVENT SELECTOR (LOOKUP) */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">Vyberte aktivní událost</label>
                                            <div className="relative">
                                                <select
                                                    className="w-full p-4 bg-slate-900 border border-indigo-500 rounded-xl text-lg font-bold text-white outline-none appearance-none cursor-pointer hover:bg-slate-800 transition-colors"
                                                    onChange={(e) => {
                                                        const id = e.target.value;
                                                        const ev = events.find((x: any) => x.id === id);
                                                        if (ev) activateEvent(ev.id, ev.name);
                                                    }}
                                                    value={events.find((e: any) => e.isActive)?.id || ''}
                                                >
                                                    <option value="" disabled>-- Vyberte událost --</option>
                                                    {events.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((ev: any) => (
                                                        <option key={ev.id} value={ev.id}>
                                                            {ev.name} ({new Date(ev.createdAt).toLocaleDateString()})
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-500">
                                                    <ArrowRight size={20} className="rotate-90" />
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-500">Tato událost bude použita pro ukládání fotek a galerii.</p>
                                        </div>

                                        <div className="w-full h-px bg-slate-800"></div>

                                        {/* CREATE NEW */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">Vytvořit novou</label>
                                            <div className="flex flex-col md:flex-row gap-4">
                                                <input
                                                    type="text"
                                                    value={newEventName}
                                                    onChange={(e) => setNewEventName(e.target.value)}
                                                    placeholder="Název (např. Svatba Jana)"
                                                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-4 text-white focus:border-indigo-500 outline-none transition-colors"
                                                />
                                                <input
                                                    type="text"
                                                    value={newEventPassword}
                                                    onChange={(e) => setNewEventPassword(e.target.value)}
                                                    placeholder="Heslo (volitelné)"
                                                    className="w-full md:w-48 bg-slate-900 border border-slate-700 rounded-xl p-4 text-white focus:border-indigo-500 outline-none transition-colors"
                                                />
                                                <button onClick={createEvent} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-xl font-bold shadow-lg transition-all active:scale-95 whitespace-nowrap">
                                                    Vytvořit
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* BRANDING OVERLAY EDITOR */}
                                    <div className="p-6 bg-slate-950 border border-indigo-500/30 rounded-2xl shadow-lg space-y-6">
                                        <h3 className="text-xl font-bold text-pink-400 flex items-center gap-2"><Palette /> Značka Akce (Samolepka)</h3>
                                        <div className="flex flex-col xl:flex-row gap-8 items-start">

                                            {/* Preview */}
                                            <div className="relative w-full max-w-[400px] aspect-[3/2] bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shadow-xl mx-auto xl:mx-0 order-first xl:order-last">
                                                <div className="absolute inset-0 flex items-center justify-center text-slate-700 font-black text-5xl select-none">FOTO</div>
                                                {/* Grid Lines */}
                                                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-20"><div className="border-r border-b border-white"></div><div className="border-r border-b border-white"></div><div className="border-b border-white"></div><div className="border-r border-b border-white"></div><div className="border-r border-b border-white"></div><div className="border-b border-white"></div></div>

                                                {overlayConfig && (
                                                    <img
                                                        src={overlayConfig.url || `/assets/stickers/${overlayConfig.path.split(/[/\\]/).pop()}`}
                                                        className="absolute select-none pointer-events-none"
                                                        style={{
                                                            left: `${overlayConfig.x * 100}%`,
                                                            top: `${overlayConfig.y * 100}%`,
                                                            width: `${overlayConfig.w * 100}%`,
                                                            transform: 'translate(0, 0)', // Top-Left origin
                                                        }}
                                                    />
                                                )}
                                            </div>

                                            {/* Controls */}
                                            <div className="flex-1 w-full space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-slate-400 uppercase">Vybrat grafiku</label>
                                                    <select
                                                        className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none active:border-pink-500"
                                                        value={overlayConfig ? overlayConfig.path.split(/[/\\]/).pop() : ''}
                                                        onChange={(e) => {
                                                            const id = e.target.value;
                                                            if (!id) { setOverlayConfig(null); return; }
                                                            const s = assets.find(a => a.id === id);
                                                            if (s) {
                                                                setOverlayConfig({
                                                                    path: `public/assets/stickers/${s.id}`, // Path for server (Node.js)
                                                                    url: s.url, // URL for preview
                                                                    x: 0.8, y: 0.8, w: 0.15 // Default to bottom-right corner
                                                                });
                                                            }
                                                        }}
                                                    >
                                                        <option value="">-- Žádná (Vypnuto) --</option>
                                                        {assets.filter(a => a.type === 'STICKER').map(s => (
                                                            <option key={s.id} value={s.id}>{s.id}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {overlayConfig && (
                                                    <div className="space-y-4 p-4 bg-slate-900 rounded-xl border border-slate-800">
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between text-xs text-slate-400"><span>Horizontálně (X)</span><span>{(overlayConfig.x * 100).toFixed(0)}%</span></div>
                                                            <input type="range" min="0" max="1" step="0.01" value={overlayConfig.x} onChange={e => setOverlayConfig({ ...overlayConfig, x: parseFloat(e.target.value) })} className="w-full accent-pink-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between text-xs text-slate-400"><span>Vertikálně (Y)</span><span>{(overlayConfig.y * 100).toFixed(0)}%</span></div>
                                                            <input type="range" min="0" max="1" step="0.01" value={overlayConfig.y} onChange={e => setOverlayConfig({ ...overlayConfig, y: parseFloat(e.target.value) })} className="w-full accent-pink-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between text-xs text-slate-400"><span>Velikost (Šířka)</span><span>{(overlayConfig.w * 100).toFixed(0)}%</span></div>
                                                            <input type="range" min="0.05" max="1" step="0.01" value={overlayConfig.w} onChange={e => setOverlayConfig({ ...overlayConfig, w: parseFloat(e.target.value) })} className="w-full accent-pink-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                                                        </div>
                                                    </div>
                                                )}

                                                <button onClick={handleOverlaySave} className="w-full bg-pink-600 hover:bg-pink-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-pink-900/20 active:scale-95 transition-all">
                                                    💾 Uložit nastavení značky
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-slate-800 rounded-xl border border-slate-700 text-center text-slate-400 text-sm">
                                        💡 Úpravy fotek (pozadí, samolepky) jsou nyní dostupné přímo v Galerii u každé fotky.
                                    </div>

                                    {/* CLOSE APP BUTTON (Unprotected) */}
                                    <div className="flex justify-end pt-4 border-t border-slate-800">
                                        <button onClick={() => {
                                            if (confirm('Opravdu chcete zavřít aplikaci?')) {
                                                window.close();
                                                window.location.href = '/';
                                            }
                                        }} className="px-6 py-2 bg-red-900/30 hover:bg-red-900/80 text-red-200 rounded-lg font-bold transition-colors flex items-center gap-2 text-sm">
                                            <X size={16} /> Zavřít Aplikaci
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* === TECH TAB (ADMIN) === */}
                            {activeTab === 'admin' && (
                                <>
                                    {!techAuth ? (
                                        <div className="flex flex-col items-center justify-center h-full space-y-6">
                                            <Lock size={64} className="text-red-500 mb-4" />
                                            <h3 className="text-2xl font-bold">Technická sekce</h3>
                                            <p className="text-slate-400">Zadejte heslo pro přístup k nastavení systému.</p>
                                            <div className="flex gap-4">
                                                <input
                                                    type="password"
                                                    autoFocus
                                                    value={techPasswordInput}
                                                    onChange={e => setTechPasswordInput(e.target.value)}
                                                    className="bg-slate-950 border border-slate-700 rounded-xl p-4 text-center text-xl outline-none focus:border-red-500 w-64"
                                                    placeholder="******"
                                                />
                                                <button
                                                    onClick={() => { if (techPasswordInput === 'Starter123') setTechAuth(true); else showToast('Špatné heslo!'); }}
                                                    className="bg-red-600 hover:bg-red-500 px-6 rounded-xl font-bold"
                                                >
                                                    Odemknout
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
                                            <div className="p-6 bg-slate-800 border border-slate-700 rounded-xl"><div className="flex justify-between mb-4"><h3 className="font-bold flex gap-2"><Cloud size={20} className="text-blue-400" /> Web Stream</h3><button onClick={() => activePort ? setCloudStreamEnabled(!cloudStreamEnabled) : showToast('Žádná kamera!')} className={`px-4 py-1 rounded text-xs font-bold ${cloudStreamEnabled ? 'bg-blue-600' : 'bg-slate-700'}`}>{cloudStreamEnabled ? 'ON' : 'OFF'}</button></div><div className="bg-black p-4 rounded text-xs font-mono h-32 overflow-y-auto border border-slate-700 text-slate-300">{streamLog.map((l, i) => <div key={i}>{l}</div>)}</div></div>
                                            <div className="p-6 bg-slate-800 border border-slate-700 rounded-xl space-y-4">
                                                <h3 className="font-bold flex gap-2"><Terminal size={20} className="text-yellow-400" /> Nastavení</h3>
                                                <div className="flex justify-between p-2 bg-slate-900 rounded border border-slate-700"><span className="text-sm">IP Kamery</span><input className="bg-transparent text-right outline-none text-yellow-400 w-32" value={cameraIp} onChange={e => { setCameraIp(e.target.value); localStorage.setItem('camera_ip', e.target.value); }} /></div>
                                                <div className="flex justify-between p-2 bg-slate-900 rounded border border-slate-700"><span className="text-sm">Port (Shoot)</span><input type="number" className="bg-transparent text-right outline-none text-yellow-400 w-20" value={sessionSettings.commandPort} onChange={e => { const v = Number(e.target.value); setSessionSettings(s => ({ ...s, commandPort: v })); localStorage.setItem('tech_cmd_port', String(v)); }} /></div>
                                                <div className="flex justify-between p-2 bg-slate-900 rounded border border-slate-700">
                                                    <span className="text-sm">Rozměr tisku (mm)</span>
                                                    <input
                                                        className="bg-transparent text-right outline-none text-yellow-400 w-32 font-mono"
                                                        defaultValue={`${sessionSettings.printWidth}x${sessionSettings.printHeight}`}
                                                        onBlur={e => {
                                                            const parts = e.target.value.toLowerCase().split('x');
                                                            if (parts.length === 2) {
                                                                const w = Number(parts[0].trim());
                                                                const h = Number(parts[1].trim());
                                                                if (!isNaN(w) && !isNaN(h)) {
                                                                    setSessionSettings(s => ({ ...s, printWidth: w, printHeight: h }));
                                                                    showToast(`Tisk: ${w}x${h}mm`);
                                                                }
                                                            }
                                                        }}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') e.currentTarget.blur();
                                                        }}
                                                        placeholder="150x100"
                                                    />
                                                </div>
                                                <button onClick={() => restartLiveView()} className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 rounded font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-colors"><RefreshCw size={16} /> Restart LiveView</button>
                                            </div>
                                            <div className="md:col-span-2 p-6 bg-slate-800 border border-slate-700 rounded-xl space-y-2"><h3 className="font-bold flex gap-2 text-green-400"><FolderOpen size={20} /> Cesta k fotkám</h3><input className="w-full bg-slate-900 p-3 rounded border border-slate-700 font-mono text-sm" value={sessionSettings.localPhotoPath} onChange={e => { setSessionSettings(s => ({ ...s, localPhotoPath: e.target.value })); localStorage.setItem('tech_photo_path', e.target.value); }} /><p className="text-xs text-slate-500">Nastavte stejnou cestu i v DigicamControl.</p></div>
                                            <div className="md:col-span-2 p-6 bg-slate-800 border border-slate-700 rounded-xl flex justify-between items-center"><span className="text-slate-300 font-bold flex gap-2"><Mail size={20} className="text-indigo-400" /> Admin Email</span><input className="bg-slate-900 p-2 rounded border border-slate-700 w-64 text-sm" placeholder="admin@fotobudka.cz" value={sessionSettings.email} onChange={e => setSessionSettings(s => ({ ...s, email: e.target.value }))} /></div>

                                            {/* SMTP CONFIGURATION */}
                                            <div className="md:col-span-2 p-6 bg-slate-800 border border-slate-700 rounded-xl space-y-4">
                                                <h3 className="font-bold flex gap-2 text-indigo-400"><Mail size={20} /> Nastavení Emailu (SMTP)</h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1"><label className="text-xs text-slate-500">SMTP Host</label><input className="w-full bg-slate-900 p-2 rounded border border-slate-700 text-sm" placeholder="smtp.gmail.com" value={sessionSettings.smtp?.host || ''} onChange={e => updateSmtp('host', e.target.value)} /></div>
                                                    <div className="space-y-1"><label className="text-xs text-slate-500">Port</label><input className="w-full bg-slate-900 p-2 rounded border border-slate-700 text-sm" placeholder="465" value={sessionSettings.smtp?.port || ''} onChange={e => updateSmtp('port', e.target.value)} /></div>
                                                    <div className="space-y-1"><label className="text-xs text-slate-500">Uživatel</label><input className="w-full bg-slate-900 p-2 rounded border border-slate-700 text-sm" placeholder="vas.email@gmail.com" value={sessionSettings.smtp?.user || ''} onChange={e => updateSmtp('user', e.target.value)} /></div>
                                                    <div className="space-y-1">
                                                        <label className="text-xs text-slate-500">Heslo</label>
                                                        <input type="password" className="w-full bg-slate-900 p-2 rounded border border-slate-700 text-sm" placeholder="16-místné heslo aplikace" value={sessionSettings.smtp?.pass || ''} onChange={e => updateSmtp('pass', e.target.value)} />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] text-slate-400">💡 <strong>Gmail:</strong> Musíte použít "Heslo aplikace" (ne vaše běžné heslo). <br />Jděte na: Google Účet {'>'} Zabezpečení {'>'} Dvoufázové ověření {'>'} Hesla aplikací.</p>
                                                </div>
                                                <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded">
                                                    <p className="text-xs text-slate-500">Změny se ukládají automaticky.</p>
                                                    <button onClick={async () => {
                                                        try {
                                                            const res = await fetch('/api/email', { method: 'POST', body: JSON.stringify({ email: sessionSettings.smtp?.user, isTest: true }) });
                                                            const d = await res.json();
                                                            if (d.success) showToast('Test OK ✅'); else showToast('Chyba: ' + d.error);
                                                        } catch (e) { showToast('Chyba spojení'); }
                                                    }} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-bold">Odeslat test</button>
                                                </div>
                                            </div>

                                            <div className="md:col-span-2 flex justify-end gap-4 p-6">
                                                <button onClick={() => {
                                                    // Attempt to close window (works for PWA/Chrome App mode)
                                                    window.close();
                                                    // Also redirect to home just in case
                                                    window.location.href = '/';
                                                }} className="px-6 py-2 bg-red-900/50 hover:bg-red-900 text-red-200 rounded font-bold transition-colors flex items-center gap-2">
                                                    <X size={20} /> Zavřít Aplikaci
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* === ASSETS TAB (ADMIN ONLY) === */}
                            {activeTab === 'assets' && techAuth && (
                                <div className="space-y-8 animate-in fade-in">
                                    <div className="p-6 bg-slate-950 border border-pink-500/30 rounded-2xl shadow-lg space-y-6">
                                        <h3 className="text-xl font-bold text-pink-400 flex items-center gap-2"><Wand2 /> AI Generátor & Upload</h3>

                                        <div className="flex gap-4">
                                            <input
                                                value={assetPrompt}
                                                onChange={e => setAssetPrompt(e.target.value)}
                                                placeholder="Popište obrázek (např. 'Vánoční stromeček na pláži')"
                                                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-4 text-white focus:border-pink-500 outline-none"
                                            />
                                            <button
                                                onClick={() => handleAIGenerate(false)}
                                                disabled={isGeneratingAsset || !assetPrompt}
                                                className="px-6 py-2 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap"
                                            >
                                                {isGeneratingAsset ? <RefreshCw className="animate-spin" /> : <Wand2 />}
                                                Gen. Pozadí
                                            </button>
                                        </div>
                                        <div className="flex gap-4 text-xs text-slate-500">
                                            <label className="cursor-pointer hover:text-white flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-lg border border-slate-800">
                                                <input type="file" className="hidden" accept="image/*" onChange={e => handleAssetUpload(e, 'background')} />
                                                📁 Nahrát Pozadí (JPG)
                                            </label>
                                            <label className="cursor-pointer hover:text-white flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-lg border border-slate-800">
                                                <input type="file" className="hidden" accept="image/*" onChange={e => handleAssetUpload(e, 'sticker')} />
                                                🦄 Nahrát Samolepku (PNG)
                                            </label>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Backgrounds List */}
                                        <div>
                                            <h3 className="font-bold text-slate-300 mb-4">🖼️ Dostupná Pozadí</h3>
                                            <div className="grid grid-cols-2 gap-2">
                                                {assets.filter(a => a.type === 'BACKGROUND').map(a => (
                                                    <div key={a.id} className="relative group aspect-video">
                                                        <img src={a.url} className="w-full h-full object-cover rounded-lg border border-slate-700" />
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                            {/* Delete logic simplified: just hide for now or need API */}
                                                            <span className="text-xs text-white bg-black/50 px-2 py-1 rounded">{a.id}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {assets.filter(a => a.type === 'BACKGROUND').length === 0 && <p className="text-slate-500 text-xs">Žádná pozadí.</p>}
                                            </div>
                                        </div>

                                        {/* Stickers List */}
                                        <div>
                                            <h3 className="font-bold text-slate-300 mb-4">🦄 Dostupné Samolepky</h3>
                                            <div className="grid grid-cols-4 gap-2">
                                                {assets.filter(a => a.type === 'STICKER').map(a => (
                                                    <div key={a.id} className="relative group aspect-square bg-slate-900 rounded-lg border border-slate-700 p-2">
                                                        <img src={a.url} className="w-full h-full object-contain" />
                                                    </div>
                                                ))}
                                                {assets.filter(a => a.type === 'STICKER').length === 0 && <p className="text-slate-500 text-xs">Žádné samolepky.</p>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}

            {/* DOCK */}
            <div className="absolute top-6 left-6 z-50"><Link href="/" className="p-4 bg-white/10 text-white rounded-full backdrop-blur-md hover:bg-white/20 hover:scale-105 transition-all shadow-lg block"><Home size={28} /></Link></div>

            {/* QUICK RESTART BUTTON */}
            <div className="absolute top-6 right-6 z-50">
                <button
                    onClick={() => { setStreamToken(Date.now()); restartLiveView(); }}
                    className="p-4 bg-white/10 text-white/40 rounded-full backdrop-blur-md hover:bg-white/20 hover:text-white hover:scale-105 transition-all shadow-lg flex items-center justify-center group"
                    title="Restartovat obraz kamery"
                >
                    <RefreshCw size={24} className="group-active:animate-spin" />
                </button>
            </div>            {/* MAIN CONTROLS */}
            <div className="absolute bottom-6 md:bottom-12 z-30 w-full flex justify-center p-2 md:p-4">
                <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-full p-2 md:p-4 flex items-center shadow-2xl scale-90 md:scale-125 origin-bottom max-w-full">
                    <div className="flex gap-2 md:gap-6 px-2 md:px-4 border-r border-white/10 pr-2 md:pr-6">
                        <button className="flex flex-col items-center gap-1 text-white opacity-80 hover:scale-110 transition-all text-[8px] md:text-[10px] uppercase font-bold tracking-widest hover:text-blue-400" onClick={() => setShowSettings(true)}><Settings size={20} className="md:w-6 md:h-6" /> <span>Nastavení</span></button>
                        <button className="flex flex-col items-center gap-1 text-white opacity-80 hover:scale-110 transition-all text-[8px] md:text-[10px] uppercase font-bold tracking-widest hover:text-purple-400" onClick={openGallery}><ImageIcon size={20} className="md:w-6 md:h-6" /> <span>Galerie</span></button>
                    </div>
                    <div className="mx-2 md:mx-8 relative">
                        {status === 'review' ? (
                            <button className="w-16 h-16 md:w-24 md:h-24 rounded-full border-4 border-red-500 flex items-center justify-center bg-red-500/20 hover:scale-105 transition-all shadow-red-900/50 shadow-lg" onClick={() => { setStatus('idle'); setLastPhoto(null); setStreamToken(Date.now()); setTimeout(restartLiveView, 100); }}><RefreshCw size={30} className="md:w-10 md:h-10" color="#fff" /></button>
                        ) : (
                            <button className="w-20 h-20 md:w-28 md:h-28 rounded-full border-[6px] border-white flex items-center justify-center bg-white/10 hover:bg-white/30 transition-all active:scale-95 shadow-lg shadow-white/10" onClick={startCountdown} disabled={status !== 'idle'}><div className="w-14 h-14 md:w-20 md:h-20 bg-white rounded-full shadow-inner"></div></button>
                        )}
                    </div>
                    <div className="flex gap-3 md:gap-6 px-2 md:px-4 border-l border-white/10 pl-2 md:pl-6">
                        <button
                            className={`flex flex-col items-center gap-1 transition-all text-[8px] md:text-[10px] uppercase font-bold tracking-widest ${status === 'review' ? 'text-white opacity-80 hover:scale-110 hover:text-green-400' : 'text-slate-500 cursor-not-allowed hidden md:flex'}`} // Hidden print on mobile when idle to save space? Keep checks
                            disabled={status !== 'review'}
                            onClick={printSelected}
                        >
                            {isUploading ? <RefreshCw className="animate-spin md:w-6 md:h-6" size={20} /> : <Printer size={20} className="md:w-6 md:h-6" />}
                            <span>{isUploading ? 'Ukládám' : 'Tisk'}</span>
                        </button>

                        <button
                            className={`flex flex-col items-center gap-1 transition-all text-[8px] md:text-[10px] uppercase font-bold tracking-widest ${status === 'review' ? 'text-white opacity-80 hover:scale-110 hover:text-yellow-400' : 'text-slate-500 cursor-not-allowed'}`}
                            disabled={status !== 'review'}
                            onClick={() => setShowEmailModal(true)}
                        >
                            {isUploading ? <RefreshCw className="animate-spin md:w-6 md:h-6" size={20} /> : <Mail size={20} className="md:w-6 md:h-6" />}
                            <span>{isUploading ? 'Ukládám' : 'Email'}</span>
                        </button>

                        {/* TIMER SELECTOR */}
                        <div className="relative">
                            <button
                                className={`flex flex-col items-center gap-1 transition-all text-[8px] md:text-[10px] uppercase font-bold tracking-widest ${status === 'idle' ? 'text-white opacity-80 hover:scale-110 hover:text-cyan-400' : 'text-slate-500 cursor-not-allowed'}`}
                                disabled={status !== 'idle'}
                                onClick={() => setShowTimerMenu(!showTimerMenu)}
                            >
                                <div className="relative">
                                    <Timer size={20} className="md:w-6 md:h-6" />
                                    <span className="absolute -top-2 -right-2 bg-cyan-500 text-black text-[8px] md:text-[9px] font-bold px-1 rounded-full normal-case">{timerSeconds}s</span>
                                </div>
                                <span>Časovač</span>
                            </button>

                            {showTimerMenu && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 bg-slate-900 border border-slate-700 rounded-xl p-2 flex flex-col gap-1 shadow-xl animate-in fade-in slide-in-from-bottom-2 z-50">
                                    {[0, 3, 5, 10, 20].map(s => (
                                        <button
                                            key={s}
                                            onClick={() => { setTimerSeconds(s); setShowTimerMenu(false); }}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap ${timerSeconds === s ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                                        >
                                            {s === 0 ? 'Ihned' : `${s} sek`}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {toastMessage && <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[60] bg-indigo-600/90 backdrop-blur shadow-2xl text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 animate-in slide-in-from-top-4 fade-in"><div className="w-2 h-2 bg-white rounded-full animate-ping"></div> {toastMessage}</div>}

            {/* COUNTDOWN OVERLAY */}
            {countdownValue !== null && (
                <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="text-[20rem] font-black text-white drop-shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-bounce leading-none">
                        {countdownValue}
                    </div>
                </div>
            )}

            {/* NEW GALLERY MODAL */}
            {showGallery && (
                <GalleryGrid
                    photos={galleryPhotos}
                    selectedIds={selectedPhotoIds}
                    onToggle={toggleSelection}
                    onDelete={bulkDelete}
                    onPrint={printSelected}
                    onEmail={bulkEmail}
                    onClose={() => { setShowGallery(false); setStreamToken(Date.now()); setTimeout(restartLiveView, 300); }}
                    events={events} // Pass events from KioskPage state
                    selectedEventId={galleryEventId}
                    onEventChange={(id: string) => setGalleryEventId(id)}
                    onEdit={(id: string) => setEditingPhotoId(id)}
                    hasMore={galleryHasMore}
                    onLoadMore={() => setGalleryPage(p => p + 1)}
                />
            )}

            {/* EMAIL MODAL */}
            {showEmailModal && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in">
                    <div className="bg-slate-900 p-10 rounded-3xl w-full max-w-lg space-y-6 shadow-2xl border border-slate-700">
                        <h3 className="text-2xl font-bold text-white text-center">
                            {selectedPhotoIds.length > 0 ? `Odeslat ${selectedPhotoIds.length} fotek emailem` : 'Odeslat fotku emailem'}
                        </h3>
                        <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="vas@email.cz" className="w-full p-5 rounded-xl bg-slate-950 border border-slate-600 text-white focus:border-indigo-500 outline-none text-lg text-center" autoFocus />
                        <button onClick={sendEmail} className="w-full bg-indigo-600 hover:bg-indigo-500 p-5 rounded-xl text-white font-bold text-xl transition-all shadow-lg shadow-indigo-900/50">Odeslat 🚀</button>
                        <button onClick={() => setShowEmailModal(false)} className="w-full text-slate-400 hover:text-white p-2">Zrušit</button>
                    </div>
                </div>
            )}
            {/* VERSION INDICATOR */}
            <div className="absolute bottom-2 right-2 text-[10px] text-slate-700 pointer-events-none z-10 font-mono opacity-50">
                v1.2 (Assets+Sync)
            </div>
        </div>
    );
}
