import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Activity,
  BarChart3,
  Clock,
  Target,
  FileJson,
  FileSpreadsheet,
  TrendingDown,
  Cpu,
  ArrowRight
} from 'lucide-react';

export function MetricsVisualizer({ keystrokes, stats, onClose, onConfirm, canAnalyse }) {
  const htCanvasRef = useRef(null);
  const ikiCanvasRef = useRef(null);
  
  useEffect(() => {
    if (!keystrokes || keystrokes.length < 2) return;
    
    drawTrace(htCanvasRef, keystrokes.map(k => k.hold_time), '#38bdf8', 'Hold Time (ms)', stats.meanHT);
    drawTrace(ikiCanvasRef, keystrokes.map(k => k.latency).filter(i => i !== null), '#818cf8', 'Inter-Key Interval (ms)', stats.meanIKI);
  }, [keystrokes, stats]);

  const drawTrace = (ref, data, color, label, mean) => {
    if (!ref.current || !data || data.length === 0) return;
    
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const yMax = Math.max(...data) * 1.2 || 300;
    const xStep = w / (data.length - 1 || 1);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
        const y = h - (i * h / 4);
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
    }
    ctx.stroke();

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + '44');
    grad.addColorStop(1, 'transparent');

    ctx.beginPath();
    ctx.moveTo(0, h - (data[0] / yMax * h));
    for (let i = 1; i < data.length; i++) {
        ctx.lineTo(i * xStep, h - (data[i] / yMax * h));
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fillStyle = grad;
    ctx.fill();

    const meanY = h - (mean / yMax * h);
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = '#00000018';
    ctx.beginPath();
    ctx.moveTo(0, meanY);
    ctx.lineTo(w, meanY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = color;
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`${label}`, 12, 20);
    ctx.fillStyle = '#64748b';
    ctx.fillText(`μ: ${mean.toFixed(1)}ms`, w - 80, 20);
  };

  const exportData = (format) => {
    let content = '';
    let mime = '';
    let ext = '';
    if (format === 'json') {
      content = JSON.stringify({ metadata: { generated_at: new Date().toISOString(), stats }, data: keystrokes }, null, 2);
      mime = 'application/json';
      ext = 'json';
    } else {
      const headers = ['hand', 'hold_time', 'flight_time', 'latency'];
      const rows = keystrokes.map(k => [k.key, k.hold_time, k.flight_time, k.latency].join(','));
      content = [headers.join(','), ...rows].join('\n');
      mime = 'text/csv';
      ext = 'csv';
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tremora_biometrics_${Date.now()}.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white border border-slate-200 rounded-[4rem] w-full max-w-5xl h-[85vh] shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div className="flex items-center gap-5">
                <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100 text-sky-600">
                    <BarChart3 size={24} />
                </div>
                <div>
                   <h2 className="text-slate-900 text-2xl font-black italic uppercase tracking-wider">Telemetry Integrity Review</h2>
                   <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1 italic">Signal Source Verification Module</p>
                </div>
            </div>
            <button onClick={onClose} className="p-4 bg-white text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all border border-slate-200">
                <X size={20} />
            </button>
        </div>

        <div className="flex-1 p-10 overflow-y-auto space-y-10 selection:bg-sky-500/20">
            <div className="grid grid-cols-4 gap-6">
                <MiniCard icon={<Activity size={16}/>} label="Signal Stability" value={`${stats.rhythmStability}%`} color="text-amber-600" />
                <MiniCard icon={<Target size={16}/>} label="Session Accuracy" value={`${stats.accuracy}%`} color="text-emerald-600" />
                <MiniCard icon={<Clock size={16}/>} label="Capture Speed" value={`${stats.wpm} WPM`} color="text-sky-600" />
                <MiniCard icon={<Cpu size={16}/>} label="Data Points" value={keystrokes.length} color="text-slate-900" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 shadow-sm group/canvas">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-6 flex items-center gap-2 italic">
                        <TrendingDown size={14} className="text-sky-600/40" /> Hold Time Trace (HT)
                    </p>
                    <canvas ref={htCanvasRef} width={500} height={200} className="w-full opacity-90" />
                 </div>
                 <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 shadow-sm group/canvas">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-6 flex items-center gap-2 italic">
                        <Clock size={14} className="text-sky-600/40" /> Latency Trace (IKI)
                    </p>
                    <canvas ref={ikiCanvasRef} width={500} height={200} className="w-full opacity-90" />
                 </div>
            </div>
        </div>

        <div className="p-10 border-t border-slate-100 flex justify-between items-center bg-slate-50">
            <div className="flex gap-4">
                <button onClick={() => exportData('json')} className="px-6 py-4 bg-white text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 hover:bg-sky-500/10 hover:text-sky-600 border border-slate-200 transition-all shadow-sm">
                    <FileJson size={14}/> JSON
                </button>
                <button onClick={() => exportData('csv')} className="px-6 py-4 bg-white text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 hover:bg-emerald-500/10 hover:text-emerald-600 border border-slate-200 transition-all shadow-sm">
                    <FileSpreadsheet size={14}/> CSV
                </button>
            </div>
            
            <button 
              onClick={onConfirm}
              className={`px-12 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] italic flex items-center gap-3 transition-all shadow-xl ${
                canAnalyse 
                ? 'bg-sky-600 text-white hover:bg-sky-500 hover:scale-[1.03] active:scale-95 shadow-[0_4px_12px_rgba(14,165,233,0.3)]' 
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
              }`}
            >
                Confirm Integrity & Proceed <ArrowRight size={18} />
            </button>
        </div>
      </motion.div>
    </div>
  );
}

function MiniCard({ icon, label, value, color }) {
    return (
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 flex flex-col gap-3 group hover:border-sky-500/20 transition-all shadow-sm">
            <div className="flex items-center gap-3 text-slate-400 group-hover:text-sky-600 transition-colors">
                {icon}
                <span className="text-[8px] font-black uppercase tracking-[0.2em]">{label}</span>
            </div>
            <span className={`text-2xl font-black italic tracking-tight ${color} flex items-end gap-1`}>{value}</span>
        </div>
    );
}