import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Database, 
  BrainCircuit, 
  ShieldCheck, 
  Clock, 
  AlertCircle,
  Play,
  RotateCcw,
  TrendingUp,
  History,
  Info,
  ChevronRight
} from 'lucide-react';
import axios from 'axios';
import { HistoryChart } from '../components/HistoryChart';
import { RiskGauge } from '../components/Parkinson/RiskGauge';

const API = 'http://127.0.0.1:8000';

export function Dashboard() {
  const [bufferCount, setBufferCount] = useState(0);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [recentStats, setRecentStats] = useState({ ht: 0, iki: 0 });
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [lastResult, setLastResult] = useState(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  // 1. Initial Load & Privacy Check
  useEffect(() => {
    const hasAccepted = localStorage.getItem('pd_privacy_accepted');
    if (!hasAccepted) setShowPrivacy(true);

    loadHistory();
    updateBufferCount();
  }, []);

  // 2. Real-time Telemetry Listener
  useEffect(() => {
    const cleanup = window.electron.ipcRenderer.on('buffer:update', (event, data) => {
      setBufferCount(data.count);
      const avg = (arr) => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
      setRecentStats({
        ht: avg(data.recentHT),
        iki: avg(data.recentIKI)
      });
    });
    return () => { if (cleanup) cleanup(); };
  }, []);

  const updateBufferCount = async () => {
    const count = await window.electron.ipcRenderer.invoke('buffer:getCount');
    setBufferCount(count);
  };

  const loadHistory = async () => {
    const history = await window.electron.ipcRenderer.invoke('analysis:list');
    const sorted = history.sort((a, b) => a.timestamp - b.timestamp);
    setAnalysisHistory(sorted);
    if (sorted.length > 0) setLastResult(sorted[sorted.length - 1]);
  };

  const toggleMonitoring = async () => {
    if (isMonitoring) {
      await window.electron.ipcRenderer.invoke('capture:stop');
    } else {
      await window.electron.ipcRenderer.invoke('capture:start');
    }
    setIsMonitoring(!isMonitoring);
  };

  const runAnalysis = async () => {
    if (bufferCount < 500) return;
    setIsAnalysing(true);
    try {
        const buffer = await window.electron.ipcRenderer.invoke('buffer:getSnapshot');
        const { data } = await axios.post(`${API}/predict`, {
            session_id: `passive_${Date.now()}`,
            keystrokes: buffer,
        });

        const analysisRecord = {
            ...data,
            timestamp: Date.now(),
            buffer_size: buffer.length
        };

        await window.electron.ipcRenderer.invoke('analysis:save', analysisRecord);
        await loadHistory();
        setLastResult(analysisRecord);
    } catch (err) {
        console.error('Analysis failed', err);
    } finally {
        setIsAnalysing(false);
    }
  };

  const acceptPrivacy = () => {
    localStorage.setItem('pd_privacy_accepted', 'true');
    setShowPrivacy(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Privacy Modal (Step 7) */}
      <AnimatePresence>
        {showPrivacy && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-6"
            >
                <div className="bg-white max-w-2xl w-full p-12 rounded-[3.5rem] shadow-2xl space-y-8">
                    <div className="p-4 bg-brand-50 rounded-2xl text-brand-600 inline-block">
                        <ShieldCheck size={40} />
                    </div>
                    <div>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tight">How This App Works</h2>
                        <div className="mt-8 space-y-4 text-slate-500 font-medium leading-relaxed">
                            <p>This app monitors your typing patterns in the background to detect changes in motor control associated with Parkinson's disease.</p>
                            <p>It records: **how long you hold each key**, the **time between keystrokes**, and **which hand you use**. It does **NOT** record which keys you press or what you type.</p>
                            <p>All data stays on this device. Nothing is sent to any server except the local analysis service running on your computer.</p>
                            <p className="text-xs text-slate-400 italic">This is a research screening tool, not a medical diagnosis.</p>
                        </div>
                    </div>
                    <div className="flex gap-4 pt-4">
                        <button onClick={acceptPrivacy} className="flex-1 bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-all active:scale-95">
                            I Understand, Continue
                        </button>
                        <button onClick={() => window.close()} className="px-8 border border-slate-200 text-slate-400 font-bold rounded-2xl hover:bg-slate-50">
                            Quit
                        </button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-12 gap-8">
        {/* Section 1: Collection Status */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                             <Database className="text-brand-500" size={24} /> Keystroke Motor Monitor
                        </h2>
                        <div className="flex items-center gap-2 mt-2">
                             <div className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Monitoring {isMonitoring ? 'Active' : 'Paused'}
                             </span>
                        </div>
                    </div>
                    <button 
                        onClick={toggleMonitoring}
                        className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                            isMonitoring ? 'bg-slate-100 text-slate-500' : 'bg-brand-500 text-white shadow-lg'
                        }`}
                    >
                        {isMonitoring ? 'Pause Monitor' : 'Resume Monitor'}
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="flex justify-between items-end">
                        <div className="space-y-1">
                            <p className="text-4xl font-black text-slate-900 tabular-nums">{bufferCount}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">In analysis buffer (Max 2000)</p>
                        </div>
                        <div className="text-right">
                             <p className={`text-xs font-black uppercase tracking-tighter ${bufferCount >= 1000 ? 'text-emerald-500' : (bufferCount >= 500 ? 'text-brand-500' : 'text-slate-300')}`}>
                                {bufferCount >= 1000 ? 'High Confidence Level' : (bufferCount >= 500 ? 'Usable Data' : 'Collecting...')}
                             </p>
                        </div>
                    </div>
                    <div className="h-4 w-full bg-slate-50 rounded-full overflow-hidden p-1 shadow-inner">
                        <motion.div 
                            animate={{ width: `${(bufferCount / 2000) * 100}%` }}
                            className={`h-full rounded-full transition-colors ${
                                bufferCount >= 1000 ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : 'bg-brand-500 shadow-lg shadow-brand-500/30'
                            }`}
                        />
                    </div>
                </div>

                {/* Section 5: Session Stats */}
                <div className="grid grid-cols-3 gap-6 mt-10 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <div className="text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Mean Hold</p>
                        <p className="text-2xl font-black text-slate-900">{recentStats.ht} <span className="text-[10px] text-slate-400">ms</span></p>
                    </div>
                    <div className="text-center border-x border-slate-200">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Mean IKI</p>
                        <p className="text-2xl font-black text-slate-900">{recentStats.iki} <span className="text-[10px] text-slate-400">ms</span></p>
                    </div>
                    <div className="text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Stability</p>
                        <p className="text-2xl font-black text-emerald-500">98%</p>
                    </div>
                </div>
            </div>

            {/* Section 4: History Chart */}
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50">
               <div className="flex items-center gap-3 mb-6">
                   <TrendingUp className="text-brand-500" size={20} />
                   <h3 className="text-lg font-black text-slate-900 tracking-tight">Systemic Trend Analysis</h3>
               </div>
               <HistoryChart points={analysisHistory} />
            </div>
        </div>

        {/* Right Section: Analysis & Result */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
            {/* Section 2: Analyse Now Button */}
            <div className={`p-8 rounded-[2.5rem] border shadow-2xl transition-all ${
                bufferCount >= 500 ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
            }`}>
                <h3 className={`text-lg font-black tracking-tight mb-2 ${bufferCount >= 500 ? 'text-white' : 'text-slate-900'}`}>Run Analysis</h3>
                <p className={`text-xs font-medium mb-8 ${bufferCount >= 500 ? 'text-slate-400' : 'text-slate-400'}`}>
                    {bufferCount >= 500 
                      ? 'Ready for screening. Analysis will evaluate the motor telemetry stored in the local buffer.' 
                      : `Need 500+ keystrokes to ensure statistical significance. Currently at ${bufferCount}.`}
                </p>
                <button 
                  disabled={bufferCount < 500 || isAnalysing}
                  onClick={runAnalysis}
                  className={`w-full py-5 rounded-2xl font-black transition-all flex items-center justify-center gap-3 ${
                    bufferCount >= 500
                    ? 'bg-brand-500 text-white shadow-xl shadow-brand-500/20 hover:scale-[1.02] active:scale-95'
                    : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                  }`}
                >
                  {isAnalysing ? (
                      <RotateCcw className="animate-spin" size={20} />
                  ) : (
                      <><BrainCircuit size={20} /> ANALYSE NOW</>
                  )}
                </button>
            </div>

            {/* Section 3: Latest Result Card */}
            {lastResult && (
                <div className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200/50 overflow-hidden border border-slate-100">
                    <div className="p-8 pb-0">
                         <RiskGauge probability={lastResult.probability} />
                    </div>
                    <div className="p-8 bg-slate-900 text-white">
                        <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-4">Top Motor Feature Impacts</p>
                        <div className="space-y-3">
                            {lastResult.top_features?.slice(0, 3).map((f, i) => (
                                <div key={i} className="flex justify-between items-center text-[11px] font-medium border-b border-white/5 pb-2 last:border-0">
                                    <span className="opacity-60">{f.name.replace(/_/g, ' ')}</span>
                                    <span className={f.direction === '↑' ? 'text-rose-400' : 'text-emerald-400'}>{f.direction} {f.importance}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-center opacity-40">
                             <span className="text-[9px] font-bold">Analysis Run: {new Date(lastResult.timestamp).toLocaleString()}</span>
                             <RotateCcw size={12} className="cursor-pointer hover:rotate-180 transition-all" onClick={runAnalysis} />
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
