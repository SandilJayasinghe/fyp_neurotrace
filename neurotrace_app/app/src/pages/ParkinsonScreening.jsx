import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  RefreshCcw, 
  Play, 
  AlertCircle,
  ShieldCheck,
  Target,
  BarChart3,
  Gauge,
  Cpu,
  Fingerprint,
  Eye,
  Lock,
  Keyboard
} from 'lucide-react';
import { useTypingTest } from '../hooks/useTypingTest';
import { PromptDisplay } from '../components/Parkinson/PromptDisplay';
import { MetricsVisualizer } from '../components/MetricsVisualizer';

export function ParkinsonScreening({ onResult }) {
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
    PROMPT_TEXT
  } = useTypingTest();

  const [showExplorer, setShowExplorer] = useState(false);
  const [keyboardInfo, setKeyboardInfo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef();
  const token = localStorage.getItem('token');
  const [uploadTriggered, setUploadTriggered] = useState(false);
  const [pendingAnalyse, setPendingAnalyse] = useState(false);

  useEffect(() => {
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.invoke('keyboard:getInfo').then(info => {
        if (info) setKeyboardInfo(info);
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (result && onResult && typeof result === 'object' && Object.keys(result).length > 0 && !error) {
      onResult(result);
    }
  }, [result, onResult, error]);

  useEffect(() => {
    if (uploadTriggered && result && onResult) {
      setUploadTriggered(false);
      onResult(result);
    }
  }, [uploadTriggered, result, onResult]);

  useEffect(() => {
    if (pendingAnalyse && validCount >= 150) {
      setPendingAnalyse(false);
      analyse(token);
    }
  }, [pendingAnalyse, validCount, analyse, token]);

  useEffect(() => {
    if (state === 'ACTIVE') {
      const preventJump = (e) => {
        if ([' ', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.key)) {
          e.preventDefault();
        }
      };
      window.addEventListener('keydown', preventJump);
      return () => window.removeEventListener('keydown', preventJump);
    }
  }, [state]);

  const rawBuffer = JSON.parse(localStorage.getItem('temp_buffer') || '[]');
  
  const handleConfirmIntegrity = async () => {
    setShowExplorer(false);
    if (canAnalyse) await analyse(token);
  };

  const handleFileUpload = async (e) => {
    setUploadError(null);
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      let keystrokes = [];
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        keystrokes = JSON.parse(text);
      } else if (file.name.endsWith('.csv')) {
        const text = await file.text();
        const lines = text.trim().split(/\r?\n/);
        const headers = lines[0].split(',');
        keystrokes = lines.slice(1).map(line => {
          const vals = line.split(',');
          const obj = {};
          headers.forEach((h, i) => { obj[h.trim()] = vals[i]; });
          return obj;
        });
      } else {
        setUploadError('Unsupported file type. Use .json or .csv');
        setUploading(false);
        return;
      }

      const cleaned = keystrokes
        .map((k) => {
          let keyVal = k.key || k.keyId || '';
          let key = typeof keyVal === 'string' ? keyVal : String(keyVal);
          let hold_time = parseFloat(k.hold_time);
          let flight_time = k.flight_time === null || k.flight_time === undefined || k.flight_time === '' || k.flight_time === 'null' ? null : parseFloat(k.flight_time);
          let latency = k.latency === null || k.latency === undefined || k.latency === '' || k.latency === 'null' ? null : parseFloat(k.latency);
          
          if (!(hold_time >= 0 && hold_time <= 10000)) return null;
          if (flight_time !== null && !isNaN(flight_time) && (flight_time < -5000 || flight_time > 20000)) return null;
          if (latency !== null && !isNaN(latency) && (latency < 0 || latency > 20000)) return null;
          
          return { keyId: key, hold_time, flight_time: isNaN(flight_time) ? null : flight_time, latency: isNaN(latency) ? null : latency };
        })
        .filter(Boolean);
      if (cleaned.length < 150) {
        setUploadError('File must contain at least 150 valid keystrokes (L/R, valid times).');
        setUploading(false);
        return;
      }
      localStorage.setItem('temp_buffer', JSON.stringify(cleaned));
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('setValidCount', { detail: cleaned.length }));
      }
      setUploadTriggered(true);
      setPendingAnalyse(true);
    } catch (err) {
      setUploadError('Failed to parse file: ' + err.message);
    }
    setUploading(false);
  };

  // MOVE ERROR CHECK HERE - AFTER ALL HOOKS
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 text-red-800 p-8">
        <h1 className="text-3xl font-black mb-4">Something went wrong</h1>
        <p className="mb-2">{error}</p>
        <button onClick={reset} className="mt-4 px-6 py-3 bg-red-600 text-white rounded-xl font-bold">Try Again</button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch relative pb-10">
      <div className="lg:col-span-4 space-y-6 flex flex-col animate-in slide-in-from-left duration-700">
        <div className="bg-[#0a0f1d] p-7 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden flex-1 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-[80px]" />
          
          <div className="flex justify-between items-center mb-10">
             <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2 italic">
                <Cpu size={14} className="text-sky-400" /> Command Hub
             </h2>
             <span className="text-[8px] font-black text-slate-700 tracking-tighter uppercase px-2 py-0.5 border border-slate-800 rounded-md italic">v{validCount >= 150 ? "3.1-PRO" : "3.1-DEV"}</span>
          </div>

          <div className="space-y-6">
            <div className="p-6 bg-slate-950/40 rounded-2xl border border-slate-900 border-dashed space-y-4">
                 <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Signal Yield</span>
                    <span className={`text-[10px] font-black tabular-nums transition-colors ${validCount >= 150 ? "text-emerald-400" : "text-sky-400"}`}>
                        {validCount}/150
                    </span>
                 </div>
                 <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden shadow-inner">
                    <motion.div 
                        className={`h-full shadow-lg transition-colors ${validCount >= 150 ? "bg-emerald-500 shadow-emerald-500/20" : "bg-sky-500 shadow-sky-500/20"}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (validCount / 150) * 100)}%` }}
                    />
                 </div>
            </div>

            {state === 'IDLE' && (
              <div className="mb-2">
                <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest text-center">Randomized Clinical Prompt</p>
                <p className="text-[9px] text-slate-500 text-center px-2">A unique paragraph is selected for each session to ensure valid motor capture. Please type naturally as the AI analyzes your subtle timing signals.</p>
              </div>
            )}

            {keyboardInfo ? (
              <div className={`px-4 py-2.5 rounded-xl border flex items-center justify-between text-[10px] font-bold uppercase tracking-widest ${
                !keyboardInfo.keyboard_name || keyboardInfo.detection_method === 'assumed'
                  ? 'border-amber-500/20 bg-amber-500/5 text-amber-500'
                  : keyboardInfo.polling_hz >= 500
                  ? 'border-teal-500/20 bg-teal-500/5 text-teal-400'
                  : 'border-slate-700 bg-slate-900/30 text-slate-500'
              }`}>
                <span className="truncate">⌨ {keyboardInfo.keyboard_name || 'Unknown'}</span>
                <span className={`flex-shrink-0 ml-2 ${
                  keyboardInfo.polling_hz >= 500 ? 'text-teal-400' : keyboardInfo.polling_hz >= 250 ? 'text-white' : 'text-amber-400'
                }`}>
                  {keyboardInfo.polling_hz}Hz · ±{(1000/keyboardInfo.polling_hz).toFixed(0)}ms
                </span>
              </div>
            ) : (
              <div className="px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900/30 text-slate-600 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                <RefreshCcw size={10} className="animate-spin" /> Detecting keyboard...
              </div>
            )}

            {state === 'IDLE' ? (
              <>
                <button 
                  onClick={startTest}
                  className="w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl italic bg-sky-500 text-white shadow-sky-500/20 hover:bg-sky-400"
                  disabled={uploading}
                >
                  <Play size={18} fill="white" /> Start Typing Test
                </button>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-2 bg-slate-800 text-white hover:bg-sky-600 transition-colors"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    disabled={uploading}
                  >
                    Upload Keystroke Data (JSON/CSV)
                  </button>
                  <input
                    type="file"
                    accept=".json,.csv"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                  {uploadError && <span className="text-red-400 text-xs mt-1">{uploadError}</span>}
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={() => setShowExplorer(true)}
                  className={`py-4 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 border transition-all italic ${
                    validCount >= 150 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20" 
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-sky-500/10"
                  }`}
                >
                  <Eye size={14} /> {validCount >= 150 ? "Confirm & Proceed" : "View Telemetry"}
                </button>
                {state === 'ACTIVE' && canAnalyse && (
                   <button 
                    onClick={() => analyse(token)}
                    className="py-4 bg-white text-slate-950 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-sky-400 hover:text-white transition-all italic shadow-xl shadow-sky-500/10"
                   >
                    <Target size={14} /> Finish & Predict
                   </button>
                )}
                <button 
                  onClick={reset}
                  className="py-3 bg-slate-950/40 text-slate-700 rounded-xl font-black text-[8px] uppercase tracking-[0.15em] flex items-center justify-center gap-3 hover:text-rose-400 transition-all border border-transparent hover:border-rose-500/20 italic"
                >
                  <RefreshCcw size={12} /> Sync / Reset
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#0a0f1d] p-7 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-8 flex items-center gap-2 italic">
                <Gauge size={14} className="text-sky-400" /> Biometric Monitor
            </h2>
            <div className="grid grid-cols-2 gap-4">
                 <MiniMetric label="Stability" value={`${liveMetrics.rhythmStability}%`} color="text-amber-400" />
                 <MiniMetric label="Accuracy" value={`${liveMetrics.accuracy}%`} color={liveMetrics.accuracy > 90 ? 'text-emerald-400' : 'text-rose-400'} />
                 <MiniMetric label="HT Mean" value={`${liveMetrics.meanHT}ms`} color="text-white" />
                 <MiniMetric label="Velocity" value={`${liveMetrics.wpm}WPM`} color="text-sky-400" />
            </div>
            <div className="mt-8 pt-8 border-t border-slate-900 flex justify-between items-center opacity-30">
                 <div className="flex items-center gap-2">
                    <ShieldCheck size={12} className="text-emerald-400" />
                    <span className="text-[7px] font-black uppercase tracking-widest text-slate-500">AES-256 Native</span>
                 </div>
                 <Lock size={12} className="text-slate-700" />
            </div>
        </div>
      </div>

      <div className="lg:col-span-8 space-y-6 flex flex-col h-full animate-in zoom-in duration-700">
        <div className="flex-1 min-h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCcw size={40} className="text-sky-400 animate-spin" />
              <span className="ml-4 text-sky-400 font-bold text-lg">Processing your result...</span>
            </div>
          ) : (
            <PromptDisplay 
                cursor={cursor}
                charStatuses={charStatuses}
                state={state}
                PROMPT_TEXT={PROMPT_TEXT}
            />
          )}
        </div>

        <div className="p-10 bg-slate-950/20 rounded-[3rem] border border-slate-900 h-40 flex items-center justify-center relative overflow-hidden group">
             <AnimatePresence mode="wait">
                 {state === 'PROCESSING' ? (
                     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-5">
                         <RefreshCcw size={40} className="text-sky-400 animate-spin" />
                         <p className="text-white font-black text-[10px] uppercase tracking-[0.4em] italic pl-2">AI Feature Extraction Phase</p>
                     </motion.div>
                 ) : state === 'ACTIVE' ? (
                     <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-10">
                         <Activity size={24} className="text-sky-500/20 group-hover:text-sky-400 transition-colors" />
                         <div className="text-center">
                             <p className="text-slate-500 font-black text-[10px] uppercase tracking-[0.5em] italic">Session Integrity: High</p>
                             <p className="text-slate-700 text-[8px] font-bold uppercase tracking-[0.2em] mt-2 px-6 py-1 border border-slate-900 rounded-full group-hover:border-sky-500/20 transition-all">Validated Hand Protocol v2</p>
                         </div>
                         <Fingerprint size={24} className="text-sky-500/20" />
                     </motion.div>
                 ) : (
                     <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                         <Play size={32} className="text-slate-900 mx-auto mb-4" fill="currentColor" />
                         <p className="text-slate-700 font-black text-[10px] uppercase tracking-[0.4em] italic mb-2 pl-2">Neural Engine Standby</p>
                         <div className="h-0.5 w-12 bg-slate-900/50 mx-auto" />
                     </motion.div>
                 )}
             </AnimatePresence>

             {error && (
              <div className="absolute inset-x-0 bottom-6 px-10">
                <div className="flex items-center gap-3 px-6 py-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                  <AlertCircle size={14} className="text-rose-400" />
                  <span className="text-[10px] font-black uppercase text-rose-500 tracking-widest italic">
                    {typeof error === 'string' ? error : (error?.msg || error?.detail || JSON.stringify(error))}
                  </span>
                </div>
              </div>
             )}
        </div>
      </div>

      <AnimatePresence>
        {showExplorer && (
            <MetricsVisualizer 
                keystrokes={rawBuffer} 
                stats={liveMetrics} 
                canAnalyse={canAnalyse}
                onClose={() => setShowExplorer(false)} 
                onConfirm={handleConfirmIntegrity}
            />
        )}
      </AnimatePresence>
    </div>
  );
}

function MiniMetric({ label, value, color }) {
    return (
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-900 border-dashed group hover:border-slate-800 transition-all flex flex-col justify-center items-center gap-2">
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest italic group-hover:text-sky-400 transition-colors">{label}</span>
            <span className={`text-sm font-black italic tabular-nums ${color}`}>{value}</span>
        </div>
    );
}