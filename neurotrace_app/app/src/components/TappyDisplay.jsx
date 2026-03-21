import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TAPPY_PROTOCOL } from '../constants/tappyProtocol';

export function TappyDisplay({ 
    leftCount, 
    rightCount, 
    keystrokeCount, 
    warmupCount, 
    isWarmup, 
    lastKey, 
    targetKeystrokes = TAPPY_PROTOCOL.TARGET_KEYSTROKES 
}) {
    const [leftFlash, setLeftFlash] = useState(false);
    const [rightFlash, setRightFlash] = useState(false);
    const [expectedKey, setExpectedKey] = useState('L'); // Alternating state

    // Flash timers
    useEffect(() => {
        if (lastKey === 'L') {
            setLeftFlash(true);
            setExpectedKey('R');
            const timer = setTimeout(() => setLeftFlash(false), 150);
            return () => clearTimeout(timer);
        } else if (lastKey === 'R') {
            setRightFlash(true);
            setExpectedKey('L');
            const timer = setTimeout(() => setRightFlash(false), 150);
            return () => clearTimeout(timer);
        }
    }, [lastKey, keystrokeCount, warmupCount]);

    const progress = Math.min(100, (keystrokeCount / targetKeystrokes) * 100);

    return (
        <div className="w-full max-w-5xl mx-auto my-10 space-y-8 select-none">
            {/* Phase Banner */}
            <AnimatePresence>
                {isWarmup && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-6 py-3 rounded-2xl flex items-center justify-center gap-3 font-black text-sm uppercase tracking-widest shadow-sm"
                    >
                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                        Motor Warmup Active (Clearing transients...) — {warmupCount} / {TAPPY_PROTOCOL.WARMUP_KEYSTROKES}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Panels */}
            <div className="grid grid-cols-2 gap-8 h-[340px]">
                {/* Left Panel (A) */}
                <div 
                    className={`relative rounded-[3rem] border-4 transition-all duration-150 flex flex-col items-center justify-center gap-4 ${
                        leftFlash 
                        ? 'border-brand-500 bg-brand-50/50 shadow-2xl scale-105' 
                        : (expectedKey === 'L' ? 'border-brand-200 bg-white/50 border-dashed' : 'border-slate-100 bg-white shadow-sm overflow-hidden opacity-80')
                    }`}
                >
                    {expectedKey === 'L' && !leftFlash && (
                        <div className="absolute inset-0 rounded-[3rem] border-4 border-brand-400/20 animate-ping" />
                    )}
                    
                    <div className="w-24 h-24 rounded-3xl bg-slate-900 text-white flex items-center justify-center text-5xl font-black shadow-xl">
                        {TAPPY_PROTOCOL.LEFT_LABEL}
                    </div>
                    <div className="text-center">
                        <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest leading-none">Left Hand</p>
                        <p className="text-3xl font-black text-slate-800 mt-1">{leftCount}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">Valid Strokes</p>
                    </div>
                </div>

                {/* Right Panel (L) */}
                <div 
                    className={`relative rounded-[3rem] border-4 transition-all duration-150 flex flex-col items-center justify-center gap-4 ${
                        rightFlash 
                        ? 'border-brand-500 bg-brand-50/50 shadow-2xl scale-105' 
                        : (expectedKey === 'R' ? 'border-brand-200 bg-white/50 border-dashed' : 'border-slate-100 bg-white shadow-sm overflow-hidden opacity-80')
                    }`}
                >
                    {expectedKey === 'R' && !rightFlash && (
                        <div className="absolute inset-0 rounded-[3rem] border-4 border-brand-400/20 animate-ping" />
                    )}
                    
                    <div className="w-24 h-24 rounded-3xl bg-slate-900 text-white flex items-center justify-center text-5xl font-black shadow-xl">
                        {TAPPY_PROTOCOL.RIGHT_LABEL}
                    </div>
                    <div className="text-center">
                        <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest leading-none">Right Hand</p>
                        <p className="text-3xl font-black text-slate-800 mt-1">{rightCount}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">Valid Strokes</p>
                    </div>
                </div>
            </div>

            {/* Unified Progress Bar */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50">
                <div className="flex justify-between items-end mb-4 px-2">
                    <div>
                        <p className="text-xs font-black text-slate-900 uppercase">Test Progression</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target: {targetKeystrokes}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-3xl font-black text-brand-600 leading-none">{keystrokeCount}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">of {targetKeystrokes} strokes</p>
                    </div>
                </div>
                <div className="h-6 w-full bg-slate-100 rounded-full overflow-hidden p-1 shadow-inner">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className={`h-full rounded-full shadow-lg ${
                            keystrokeCount >= targetKeystrokes 
                            ? 'bg-emerald-500 shadow-emerald-500/30' 
                            : (keystrokeCount >= 150 ? 'bg-brand-500 shadow-brand-500/30' : 'bg-slate-300')
                        }`}
                    />
                </div>
            </div>
        </div>
    );
}
