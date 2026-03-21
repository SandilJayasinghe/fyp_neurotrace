
import React, { useRef } from 'react';
import { Activity, Play, CheckCircle, RotateCcw, ArrowRight, Keyboard } from 'lucide-react';
import { useTypingTest, PROMPT_TEXT } from '../hooks/useTypingTest';

const KeystrokeTest = ({ onFinish }) => {
  const textareaRef = useRef(null);
  const {
    state,
    cursor,
    charStatuses,
    validCount,
    errorCount,
    liveMetrics,
    result,
    error,
    isLoading,
    canAnalyse,
    startTest,
    analyse,
    reset,
    PROMPT_TEXT: promptText,
    processKeystroke
  } = useTypingTest();

  // Keydown handler to process user input
  const handleKeyDown = (e) => {
    if (state !== 'ACTIVE') return;
    // Only process visible characters and space
    if (e.key.length === 1 || e.key === 'Backspace') {
      processKeystroke({
        char: e.key,
        // Optionally add more fields if needed
      });
      e.preventDefault();
    }
  };

  // Focus textarea on start
  React.useEffect(() => {
    if (state === 'ACTIVE' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [state]);

  // Handle finish (when result is available)
  React.useEffect(() => {
    if (state === 'RESULTS' && result) {
      onFinish && onFinish(result);
    }
  }, [state, result, onFinish]);


  return (
    <div className="max-w-4xl mx-auto p-8 animate-fade-in">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-sky-500 rounded-2xl shadow-lg shadow-sky-500/20">
          <Activity className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white">Clinical Typing Test</h2>
          <p className="text-slate-400">Step 1 of 1</p>
        </div>
      </div>

      <div
        className="bg-slate-800/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-700/50 p-10 shadow-2xl overflow-hidden relative"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{ outline: 'none' }}
      >
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <Keyboard className="w-32 h-32 text-white" />
        </div>

        {/* Phase Indicator */}
        <div className="mb-10">
          <p className="text-xs font-black text-sky-500 uppercase tracking-widest mb-4">Please type the following text exactly:</p>
          <div className="text-2xl font-medium text-slate-100 leading-relaxed bg-slate-900/50 p-6 rounded-2xl border border-slate-800" style={{ minHeight: 120 }}>
            {/* Render prompt with cursor */}
            {promptText.split('').map((ch, i) => (
              <span
                key={i}
                style={{
                  background: i === cursor ? 'rgba(56,189,248,0.2)' : 'transparent',
                  color: i === cursor ? '#38bdf8' : undefined,
                  textDecoration: charStatuses[i] === 'incorrect' ? 'underline wavy red' : undefined,
                  fontWeight: i === cursor ? 700 : undefined,
                }}
              >
                {ch}
              </span>
            ))}
          </div>
        </div>

        {/* Input Area */}
        <div className="relative">
          {state !== 'ACTIVE' && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] rounded-2xl">
              <button
                onClick={startTest}
                className="flex items-center gap-3 bg-white text-slate-900 font-black py-4 px-10 rounded-2xl hover:bg-sky-400 hover:text-white transition-all shadow-2xl active:scale-95"
                disabled={isLoading}
              >
                <Play className="w-5 h-5 fill-current" /> Start High-Precision Recording
              </button>
            </div>
          )}
        </div>

        {/* Live Feedback / Progress */}
        <div className="mt-8 flex items-center justify-between">
          <div className="flex gap-4">
            <div className="text-sm font-bold text-slate-500">
              Accuracy: <span className="text-white">{liveMetrics.accuracy}%</span>
            </div>
            <div className="text-sm font-bold text-slate-500">
              WPM: <span className="text-white">{liveMetrics.wpm}</span>
            </div>
          </div>
          {result && (
            <div className="flex gap-6 animate-slide-up">
              <div className="px-5 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <p className="text-[10px] text-emerald-400 uppercase font-bold tracking-widest">Avg Hold</p>
                <p className="text-xl font-black text-white">{liveMetrics.meanHT}<span className="text-[10px] ml-1">ms</span></p>
              </div>
              <div className="px-5 py-2 bg-sky-500/10 border border-sky-500/20 rounded-xl">
                <p className="text-[10px] text-sky-400 uppercase font-bold tracking-widest">Avg Flight</p>
                <p className="text-xl font-black text-white">{liveMetrics.meanIKI}<span className="text-[10px] ml-1">ms</span></p>
              </div>
            </div>
          )}
        </div>

        {result && (
          <div className="mt-10 pt-10 border-t border-slate-700/50 flex justify-end gap-4">
            <button
              onClick={reset}
              className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-slate-400 font-bold rounded-xl hover:text-white transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Retry
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center gap-2 text-xs text-slate-500 font-medium">
        <CheckCircle className="w-4 h-4 text-emerald-500" /> Kernel-level low-latency hook active (WH_KEYBOARD_LL)
      </div>
    </div>
  );
};

export default KeystrokeTest;
