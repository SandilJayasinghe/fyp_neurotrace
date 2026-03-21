import React from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, 
  Database, 
  Clock, 
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Timer
} from 'lucide-react';

export function LiveMetrics({ 
  validCount = 0, 
  errorCount = 0,
  meanHT = 0, 
  meanIKI = 0,
  wpm = 0,
  isRecording = false
}) {
  const progress = Math.min((validCount / 150) * 100, 100);
  const total = validCount + errorCount;
  const accuracyNum = total > 0 ? (validCount / total) * 100 : 100;
  const accuracy = accuracyNum.toFixed(1);

  const stats = [
    { label: 'Keystrokes', value: validCount, sub: 'of 150 minimum', icon: Database, color: 'text-brand-500', bg: 'bg-brand-50' },
    { label: 'Accuracy', value: `${accuracy}%`, sub: 'diagnostic threshold', icon: CheckCircle2, color: accuracyNum < 80 ? 'text-rose-500' : 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'Errors', value: errorCount, sub: 'incorrect letters', icon: XCircle, color: 'text-rose-500', bg: 'bg-rose-50' },
    { label: 'Mean Hold', value: `${meanHT} ms`, sub: 'hold time', icon: Clock, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { label: 'Mean IKI', value: `${meanIKI} ms`, sub: 'inter-key interval', icon: Activity, color: 'text-brand-500', bg: 'bg-slate-50' },
  ];

  return (
    <div className="space-y-12">
      {/* 1. Progress Monitor */}
      <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50">
           <div className="flex justify-between items-end mb-8">
               <div className="space-y-1">
                   <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <Database className="text-brand-500" size={24} /> Motor Signal Intensity
                   </h2>
                   <div className="flex items-center gap-2 mt-2">
                        <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                           {isRecording ? 'Capturing Biometric telemetry' : 'Recorder Standby'}
                        </span>
                   </div>
               </div>
               <div className="text-right">
                  <p className={`text-xs font-black uppercase tracking-tighter leading-none ${validCount >= 150 ? 'text-emerald-500' : 'text-slate-300'}`}>
                      {validCount >= 150 ? 'Analysis Ready (Max Conf)' : 'Collecting...'}
                  </p>
                  <p className="text-3xl font-black text-slate-900 mt-2">{validCount} <span className="text-[10px] text-slate-400">/ 150</span></p>
               </div>
           </div>
           
           <div className="h-4 w-full bg-slate-50 rounded-full overflow-hidden p-1 shadow-inner relative">
               <motion.div 
                   animate={{ width: `${progress}%` }}
                   className={`h-full rounded-full transition-colors ${
                       validCount >= 150 ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : 'bg-brand-500 shadow-lg shadow-brand-500/30'
                   }`}
               />
               <div className="absolute top-0 bottom-0 right-0 w-[2px] bg-slate-100" />
           </div>
      </div>

      {/* 2. Real-time Motor Grid */}
      <div className="grid grid-cols-5 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-7 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 hover:scale-[1.03] transition-all group overflow-hidden relative">
            <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} mb-6 transition-transform group-hover:rotate-12 duration-500 inline-block`}>
               <stat.icon size={22} />
            </div>
            <div className="space-y-1">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
               <p className="text-2xl font-black text-slate-900">{stat.value}</p>
               <p className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">{stat.sub}</p>
            </div>
            
            {/* WPM Badge for first card */}
            {i === 0 && (
                <div className="absolute top-4 right-4 bg-slate-900 text-white px-2 py-1 rounded-lg text-[9px] font-black italic tracking-widest shadow-lg">
                    {wpm} WPM
                </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
