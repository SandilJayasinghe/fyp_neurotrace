import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Info, ChevronRight, Download, RotateCcw, Activity } from 'lucide-react';
import { RiskGauge } from './Parkinson/RiskGauge';

export function DiagnosticResult({ result, onReset }) {
  if (!result) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
      {/* 1. Protocol Disclaimer (Step 8 Request) */}
      <div className="bg-brand-50 border border-brand-100 p-6 rounded-[2.5rem] flex gap-5 items-center shadow-sm">
        <div className="bg-brand-500 p-3 rounded-2xl text-white shadow-lg shadow-brand-500/20">
          <Info size={24} />
        </div>
        <div>
          <h4 className="text-brand-900 font-black text-sm uppercase tracking-tight">Tappy Natural Protocol Analysis</h4>
          <p className="text-brand-700/70 text-[11px] font-medium leading-relaxed mt-1 max-w-2xl">
            This screening used the **Tappy-Natural protocol** — transforming free-text typing into bimanual motor labels (L/R) — which matches the training data's biometric encoding. Results reflect micro-motor timing patterns only (HT/IKI variability) and are not a clinical diagnosis.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Main Risk Display */}
        <div className="col-span-12 lg:col-span-5">
            <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 flex flex-col items-center">
                <RiskGauge probability={result.probability} />
                
                <div className="w-full mt-10 pt-10 border-t border-slate-100 space-y-4">
                    <div className="flex justify-between items-center px-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confidence</span>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                            result.confidence_band === 'High' ? 'bg-emerald-50 text-emerald-600' : 'bg-yellow-50 text-yellow-600'
                        }`}>
                            {result.confidence_band} Confidence
                        </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${result.confidence * 100}%` }}
                            className="h-full bg-brand-500 rounded-full shadow-lg shadow-brand-500/30"
                        />
                    </div>
                </div>
            </div>
        </div>

        {/* Feature Impact & Decision Path */}
        <div className="col-span-12 lg:col-span-7 space-y-6">
            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50">
               <div className="flex items-center gap-3 mb-6">
                  <Activity size={18} className="text-brand-500" />
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Biometric Pattern Impact</h3>
               </div>
               
               <div className="space-y-4">
                  {result.top_features?.map((f, i) => (
                    <div key={i} className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl group hover:bg-slate-100 transition-colors">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${
                            f.direction === '↑' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'
                        }`}>
                            {f.direction}
                        </div>
                        <div className="flex-1">
                            <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{f.name.replace(/_/g, ' ')}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Importance: {f.importance}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-sm font-black text-slate-900">{f.value}</p>
                           <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Score</p>
                        </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                <ShieldCheck className="absolute -bottom-10 -right-10 text-white opacity-5 w-48 h-48" />
                <h3 className="text-lg font-black tracking-tight mb-4 flex items-center gap-2">
                    <ChevronRight size={20} className="text-brand-400" /> Inference Path
                </h3>
                <div className="space-y-2 opacity-80 pl-2 border-l border-white/10">
                    {result.decision_path?.slice(0, 3).map((line, i) => (
                        <p key={i} className="text-[11px] font-medium font-mono leading-relaxed">{line}</p>
                    ))}
                    <p className="text-[10px] italic mt-2 text-white/40">+ {result.decision_path?.length - 3} decision nodes processed</p>
                </div>
            </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between pt-8">
          <button 
             onClick={onReset}
             className="flex items-center gap-3 px-8 py-4 bg-white border border-slate-100 rounded-2xl text-slate-600 font-black hover:bg-slate-50 transition-all active:scale-95 shadow-lg shadow-slate-200/50"
          >
             <RotateCcw size={20} /> START NEW SCREENING
          </button>
          
          <div className="flex gap-4">
              <button className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-900/10">
                 <Download size={20} /> EXPORT CLINICAL PDF
              </button>
          </div>
      </div>
    </div>
  );
}
