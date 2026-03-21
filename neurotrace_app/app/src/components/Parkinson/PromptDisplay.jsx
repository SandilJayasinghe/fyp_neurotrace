import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, Activity, Info, ShieldCheck } from 'lucide-react';

/**
 * Premium Dark Theme Prompt Display
 * Strictly Interactive & Live Validation
 */
export function PromptDisplay({ 
  cursor = 0,
  charStatuses = [],
  state = "IDLE",
  PROMPT_TEXT = ""
}) {
  return (
    <div className="relative w-full h-full bg-[#0a0f1d] p-8 rounded-[3.5rem] border border-slate-800/50 shadow-2xl flex flex-col items-center overflow-hidden group">
      {/* 1. Cinematic Background Glow */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-sky-500/10 rounded-full blur-[100px] pointer-events-none group-hover:bg-sky-500/15 transition-all duration-1000" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-blue-600/5 rounded-full blur-[80px] pointer-events-none" />

      {/* 2. Diagnostic Protocol Banner */}
      <div className="relative flex items-center gap-3 mb-6 bg-slate-900/50 backdrop-blur-md px-6 py-2.5 rounded-2xl border border-slate-800 shadow-xl animate-in fade-in slide-in-from-top duration-700">
        <Activity size={18} className="text-sky-400 animate-pulse" />
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] italic">
          Active Motor Validation Protocol
        </p>
      </div>

      {/* 3. Interactive Prompt Area */}
      <div className="relative w-full flex-1 bg-slate-950/40 backdrop-blur-sm p-9 rounded-[3rem] border border-slate-800/50 shadow-inner group/prompt">
        <p className="relative z-10 text-lg font-medium leading-[1.8] select-none cursor-default font-mono transition-all text-justify break-words tracking-tight">
          {PROMPT_TEXT.split('').map((char, i) => {
            let style = "text-slate-700/60"; // pending
            let cursorStyle = "";
            let glow = "";

            if (charStatuses[i] === 'correct') {
              style = "text-slate-100";
            } else if (charStatuses[i] === 'incorrect') {
              style = "text-rose-500 animate-shake";
              glow = "drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]";
            }

            if (i === cursor && state === 'ACTIVE') {
              cursorStyle = "border-b-[3px] border-sky-400 pb-1 text-sky-300 animate-[pulse_1.5s_infinite] shadow-[0_10px_10px_-5px_rgba(56,189,248,0.2)]";
              style = "text-sky-300";
            }

            return (
              <span 
                key={i} 
                className={`${style} ${cursorStyle} ${glow} transition-all duration-200 inline-block`}
              >
                {char === ' ' ? '\u00A0' : char}
              </span>
            );
          })}
        </p>

        {/* 4. Metadata Overlays */}
        <div className="absolute top-6 right-8 flex items-center gap-3 text-slate-800">
          <Keyboard size={14} />
          <span className="text-[8px] font-black uppercase tracking-[0.3em]">Telemetry Active</span>
        </div>
        
        <div className="absolute bottom-6 left-8 flex items-center gap-2 text-slate-800">
           <ShieldCheck size={14} className="text-emerald-500/40" />
           <span className="text-[8px] font-black uppercase tracking-[0.3em]">Privacy Verified</span>
        </div>
      </div>

      {/* 5. Clinical Threshold Feedback */}
      <div className="mt-8 flex items-center gap-3 bg-slate-900/30 px-6 py-2 rounded-full border border-slate-800/50">
         <Info size={14} className="text-sky-400" />
         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">
            Enter character <span className="text-sky-400 font-black px-1.5 bg-sky-950/50 rounded-md">"{PROMPT_TEXT[cursor] === ' ' ? 'Space' : PROMPT_TEXT[cursor]}"</span> to progress
         </p>
      </div>
    </div>
  );
}
