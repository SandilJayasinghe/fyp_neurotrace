import React, { memo } from 'react';
import { Keyboard, Activity, Info, ShieldCheck } from 'lucide-react';

/**
 * Premium Dark Theme Prompt Display
 * Memoized for performance — only re-renders when cursor/charStatuses change.
 */
 export const PromptDisplay = memo(function PromptDisplay({ 
  cursor = 0,
  charStatuses = [],
  state = "IDLE",
  PROMPT_TEXT = ""
}) {
  return (
    <div className="relative w-full h-full bg-white p-8 rounded-[3.5rem] border border-slate-200 shadow-xl flex flex-col items-center overflow-hidden group">
      {/* 1. Subtle Background Glow */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-sky-500/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-sky-500/10 transition-all duration-1000" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />

      {/* 2. Diagnostic Protocol Banner */}
      <div className="relative flex items-center gap-3 mb-6 bg-slate-50 backdrop-blur-md px-6 py-2.5 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top duration-700">
        <Activity size={18} className="text-sky-600 animate-pulse" />
        <p className="text-[10px] font-black uppercase text-slate-700 tracking-[0.2em] italic">
          Active Motor Validation Protocol
        </p>
      </div>

      {/* 3. Interactive Prompt Area */}
      <div className="relative w-full flex-1 bg-slate-50/50 p-9 rounded-[3rem] border border-slate-200 shadow-inner group/prompt">
        <p className="relative z-10 text-lg font-medium leading-[1.8] select-none cursor-default font-mono text-justify break-words tracking-tight">
          {PROMPT_TEXT.split('').map((char, i) => {
            const status = charStatuses[i];
            const isCurrent = i === cursor && state === 'ACTIVE';

            let className;
            if (isCurrent) {
              className = "text-sky-600 border-b-[3px] border-sky-400 pb-1 shadow-[0_4px_6px_-1px_rgba(14,165,233,0.1)]";
            } else if (status === 'correct') {
              className = "text-slate-900";
            } else if (status === 'incorrect') {
              className = "text-rose-500";
            } else {
              className = "text-slate-400";
            }

            return (
              <span key={i} className={`${className} inline transition-colors duration-200`}>
                {char === ' ' ? '\u00A0' : char}
              </span>
            );
          })}
        </p>

        {/* 4. Metadata Overlays */}
        <div className="absolute top-6 right-8 flex items-center gap-3 text-slate-600">
          <Keyboard size={14} />
          <span className="text-[8px] font-black uppercase tracking-[0.3em]">Telemetry Active</span>
        </div>
        
        <div className="absolute bottom-6 left-8 flex items-center gap-2 text-slate-600">
           <ShieldCheck size={14} className="text-emerald-500/60" />
           <span className="text-[8px] font-black uppercase tracking-[0.3em]">Privacy Verified</span>
        </div>
      </div>

      {/* 5. Clinical Threshold Feedback */}
      <div className="mt-8 flex items-center gap-3 bg-slate-50 px-6 py-2.5 rounded-full border border-slate-200 shadow-sm">
         <Info size={14} className="text-sky-600" />
         <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest italic">
            Enter character <span className="text-sky-600 font-black px-1.5 bg-sky-50 rounded-md border border-sky-100">"{PROMPT_TEXT[cursor] === ' ' ? 'Space' : PROMPT_TEXT[cursor]}"</span> to progress
         </p>
      </div>
    </div>
  );
});
