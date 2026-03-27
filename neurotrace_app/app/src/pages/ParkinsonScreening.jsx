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
    hardwareStatus,
    canAnalyse,
    startTest,
    analyse,
    reset,
    loadExternalData,
    keystrokes,
    PROMPT_TEXT
  } = useTypingTest();

  const [showExplorer, setShowExplorer] = useState(false);
  const [keyboardInfo, setKeyboardInfo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef();
  const token = localStorage.getItem('token');
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
      const text = await file.text();
      let rawData = [];
      
      if (file.name.toLowerCase().endsWith('.json')) {
        rawData = JSON.parse(text);
      } else {
        // Advanced CSV/TSV parsing
        const lines = text.split(/\r\n|\r|\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) throw new Error('File is empty or missing headers');
        
        const delimiter = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
        const strip = s => (s || '').trim().replace(/^["']|["']$/g, '');
        const headers = lines[0].split(delimiter).map(strip);
        
        rawData = lines.slice(1).map(line => {
          const vals = line.split(delimiter).map(strip);
          const obj = {};
          headers.forEach((h, i) => { if (vals[i] !== undefined) obj[h] = vals[i]; });
          return obj;
        });
      }

      if (!Array.isArray(rawData)) {
        if (typeof rawData === 'object' && rawData !== null) rawData = [rawData];
        else throw new Error('Invalid data format');
      }

      // Helper for fuzzy header matching
      const getVal = (row, patterns) => {
        const key = Object.keys(row).find(k => {
          const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          return patterns.some(p => norm === p || norm.includes(p));
        });
        return key ? row[key] : null;
      };

      const cleaned = rawData.map(row => {
        const keyVal = getVal(row, ['keyid', 'key', 'char', 'hand', 'character']) || 'Unknown';
        const htVal = getVal(row, ['holdtime', 'ht', 'hold', 'duration']);
        const ftVal = getVal(row, ['flighttime', 'ft', 'iki', 'interkey', 'flight']);
        const latVal = getVal(row, ['latency', 'lat']);
        
        const ht = parseFloat(htVal);
        if (isNaN(ht) || ht <= 0 || ht > 10000) return null;

        return {
          keyId: String(keyVal),
          hold_time: ht,
          flight_time: (ftVal !== null && ftVal !== '') ? parseFloat(ftVal) : null,
          latency: (latVal !== null && latVal !== '') ? parseFloat(latVal) : null,
          type: row.type || row.hand || 'Unknown'
        };
      }).filter(Boolean);

      console.log(`[Upload] Parsed ${rawData.length} rows, ${cleaned.length} valid points.`);

      if (cleaned.length < 150) {
        throw new Error(`Insufficient valid data. Found only ${cleaned.length} valid points after filtering (need 150). Make sure your CSV has headers like "hold_time" or "HT".`);
      }

      loadExternalData(cleaned);
      setPendingAnalyse(true);
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError('Upload Failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  // MOVE ERROR CHECK HERE - AFTER ALL HOOKS
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 text-red-800 p-8">
        <h1 className="text-3xl font-black mb-4">Something went wrong</h1>
        <p className="mb-2">{error}</p>
        <button onClick={reset} className="mt-4 px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors">Try Again</button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch relative pb-10">
      <div className="lg:col-span-4 space-y-6 flex flex-col animate-in slide-in-from-left duration-700">
        <div className="bg-white p-7 rounded-[2.5rem] border border-slate-200 shadow-xl relative overflow-hidden flex-1 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-[80px]" />
          
          <div className="flex justify-between items-center mb-10">
             <h2 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] flex items-center gap-2 italic">
                <Cpu size={14} className="text-sky-600" /> Command Hub
             </h2>
             <span className="text-[8px] font-black text-slate-600 tracking-tighter uppercase px-2 py-0.5 border border-slate-200 rounded-md italic">v{validCount >= 150 ? "3.1-PRO" : "3.1-DEV"}</span>
          </div>

          <div className="space-y-6">
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 border-dashed space-y-4">
                 <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic">Signal Yield</span>
                    <span className={`text-[10px] font-black tabular-nums transition-colors ${validCount >= 150 ? "text-emerald-600" : "text-sky-600"}`}>
                        {validCount}/150
                    </span>
                 </div>
                 <div className="h-1.5 w-full bg-slate-200/50 rounded-full overflow-hidden shadow-inner">
                    <motion.div 
                        className={`h-full shadow-lg transition-colors ${validCount >= 150 ? "bg-emerald-500 shadow-emerald-500/20" : "bg-sky-500 shadow-sky-500/20"}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (validCount / 150) * 100)}%` }}
                    />
                 </div>
            </div>

            {state === 'IDLE' && (
              <div className="mb-2">
                <p className="text-[10px] font-black text-sky-600 uppercase tracking-widest text-center">Randomized Clinical Prompt</p>
                <p className="text-[9px] text-slate-600 text-center px-2">A unique paragraph is selected for each session to ensure valid motor capture. Please type naturally as the AI analyzes your subtle timing signals.</p>
              </div>
            )}

            {keyboardInfo ? (
              <div className={`px-4 py-2.5 rounded-xl border flex items-center justify-between text-[10px] font-bold uppercase tracking-widest ${
                !keyboardInfo.keyboard_name || keyboardInfo.detection_method === 'assumed'
                  ? 'border-amber-500/20 bg-amber-500/5 text-amber-600'
                  : keyboardInfo.polling_hz >= 500
                  ? 'border-teal-500/20 bg-teal-500/5 text-teal-600'
                  : 'border-slate-100 bg-slate-50 text-slate-600'
              }`}>
                <span className="truncate">⌨ {keyboardInfo.keyboard_name || 'Unknown'}</span>
                <span className={`flex-shrink-0 ml-2 ${
                  keyboardInfo.polling_hz >= 500 ? 'text-teal-600' : keyboardInfo.polling_hz >= 250 ? 'text-slate-900' : 'text-amber-600'
                }`}>
                  {keyboardInfo.polling_hz}Hz · ±{(1000/keyboardInfo.polling_hz).toFixed(0)}ms
                </span>
              </div>
            ) : (
              <div className="px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-slate-600 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                <RefreshCcw size={10} className="animate-spin" /> Detecting keyboard...
              </div>
            )}

            {hardwareStatus && !hardwareStatus.success && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-rose-600 font-black text-[9px] uppercase tracking-widest">
                  <AlertCircle size={14} /> Hardware Link Failure
                </div>
                <p className="text-[9px] text-rose-700 font-medium leading-relaxed">
                  The high-precision recorder couldn't start. 
                  <br /><br />
                  <b>Possible Fixes:</b>
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    <li>Run Tremora as <b>Administrator</b></li>
                    <li>Check if Antivirus is blocking the app</li>
                    <li>Ensure no other high-precision recorders are active</li>
                  </ul>
                </p>
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
                    className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-2 bg-slate-100 text-slate-700 hover:bg-sky-600 hover:text-white transition-all border border-slate-200"
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
                    ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100/50" 
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Eye size={14} /> {validCount >= 150 ? "Confirm & Proceed" : "View Telemetry"}
                </button>
                {state === 'ACTIVE' && canAnalyse && (
                <button 
                   onClick={() => analyse(token)}
                   className="py-4 bg-sky-600 text-white rounded-xl font-black text-[9px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-sky-500 transition-all italic shadow-lg shadow-sky-600/20"
                  >
                   <Target size={14} /> Finish & Predict
                  </button>
                )}
                <button 
                  onClick={reset}
                  className="py-3 bg-slate-50 text-slate-600 rounded-xl font-black text-[8px] uppercase tracking-[0.15em] flex items-center justify-center gap-3 hover:text-rose-600 transition-all border border-slate-100 hover:border-rose-200 italic"
                >
                  <RefreshCcw size={12} /> Sync / Reset
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-7 rounded-[2.5rem] border border-slate-200 shadow-xl relative overflow-hidden">
            <h2 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-8 flex items-center gap-2 italic">
                <Gauge size={14} className="text-sky-600" /> Biometric Monitor
            </h2>
            <div className="grid grid-cols-2 gap-4">
                 <MiniMetric label="Stability" value={`${liveMetrics.rhythmStability}%`} color="text-amber-600" />
                 <MiniMetric label="Accuracy" value={`${liveMetrics.accuracy}%`} color={liveMetrics.accuracy > 90 ? 'text-emerald-600' : 'text-rose-600'} />
                 <MiniMetric label="HT Mean" value={`${liveMetrics.meanHT}ms`} color="text-slate-900" />
                 <MiniMetric label="Velocity" value={`${liveMetrics.wpm}WPM`} color="text-sky-600" />
            </div>
            <div className="mt-8 pt-8 border-t border-slate-100 flex justify-between items-center opacity-70">
                 <div className="flex items-center gap-2">
                    <ShieldCheck size={12} className="text-emerald-500" />
                    <span className="text-[7px] font-black uppercase tracking-widest text-slate-600">AES-256 Native</span>
                 </div>
                 <Lock size={12} className="text-slate-500" />
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

        <div className="p-10 bg-white rounded-[3rem] border border-slate-200 h-40 flex items-center justify-center relative overflow-hidden group shadow-sm">
             <AnimatePresence mode="wait">
                 {state === 'PROCESSING' ? (
                     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-5">
                         <RefreshCcw size={40} className="text-sky-600 animate-spin" />
                         <p className="text-slate-900 font-black text-[10px] uppercase tracking-[0.4em] italic pl-2">AI Feature Extraction Phase</p>
                     </motion.div>
                 ) : state === 'ACTIVE' ? (
                     <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-10">
                         <Activity size={24} className="text-sky-600/20 group-hover:text-sky-600 transition-colors" />
                         <div className="text-center">
                             <p className="text-slate-600 font-black text-[10px] uppercase tracking-[0.5em] italic">Session Integrity: High</p>
                             <p className="text-slate-500 text-[8px] font-bold uppercase tracking-[0.2em] mt-2 px-6 py-1 border border-slate-100 rounded-full group-hover:border-sky-500/20 transition-all">Validated Hand Protocol v2</p>
                         </div>
                         <Fingerprint size={24} className="text-sky-600/20" />
                     </motion.div>
                 ) : (
                     <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                         <Play size={32} className="text-slate-200 mx-auto mb-4" fill="currentColor" />
                         <p className="text-slate-500 font-black text-[10px] uppercase tracking-[0.4em] italic mb-2 pl-2">Neural Engine Standby</p>
                         <div className="h-0.5 w-12 bg-slate-100 mx-auto" />
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
                keystrokes={keystrokes} 
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
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 border-dashed group hover:border-slate-200 transition-all flex flex-col justify-center items-center gap-2">
            <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest italic group-hover:text-sky-600 transition-colors">{label}</span>
            <span className={`text-sm font-black italic tabular-nums ${color}`}>{value}</span>
        </div>
    );
}