import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, Search, ArrowRight, ArrowLeft, Trash2, BarChart2, Calendar, Database, FolderOpen, FileText } from 'lucide-react';
import { MetricsVisualizer } from '../components/MetricsVisualizer';

export function HistoryPage({ onBack, onViewResult }) {
  const [sessions, setSessions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState(null);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await window.electron.ipcRenderer.invoke('session:list');
      setSessions(data);
    } catch (e) {
      console.error('[History] Failed to load:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const deleteSession = async (id) => {
    if (!window.confirm('Delete this clinical record from local storage?')) return;
    const res = await window.electron.ipcRenderer.invoke('session:delete', { session_id: id });
    if (res.success) {
      setSessions(s => s.filter(x => x.session_id !== id));
    }
  };

  const openInFolder = async () => {
    await window.electron.ipcRenderer.invoke('session:openFolder');
  };

  const handleRowClick = async (session_id) => {
    const data = await window.electron.ipcRenderer.invoke('session:load', { session_id });
    if (data) setActiveSession(data);
  };

  const filtered = sessions.filter(s => 
    s.recorded_at?.toString().toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.session_id?.toString().toLowerCase().includes(searchTerm.toLowerCase())
  );

  /**
   * Internal helper to prepare stats for MetricsVisualizer 
   * since older sessions might be missing some summary fields.
   */
  const prepareStats = (session) => {
    if (!session) return null;
    const keystrokes = session.keystrokes || [];
    const summary = session.summary || {};
    
    const hts = keystrokes.map(k => k.hold_time || 0);
    const ikis = keystrokes.map(k => k.latency).filter(v => v !== null && v > 0);
    
    return {
        accuracy: summary.accuracy ?? 100,
        wpm: summary.wpm ?? 0,
        meanHT: hts.length > 0 ? hts.reduce((a, b) => a + b, 0) / hts.length : 100,
        meanIKI: ikis.length > 0 ? ikis.reduce((a, b) => a + b, 0) / ikis.length : 150,
        rhythmStability: 95, // Fallback for historical data
        total_keystrokes: keystrokes.length
    };
  };

  return (
    <div className="min-h-screen animate-in fade-in duration-700">
      <button 
        onClick={onBack}
        className="mb-8 flex items-center gap-2 text-slate-700 hover:text-sky-600 font-black uppercase tracking-[0.2em] text-[10px] transition-all group"
      >
        <div className="p-2 bg-white border border-slate-200 rounded-lg group-hover:border-sky-500/30">
          <ArrowLeft size={14} />
        </div>
        Back to Assessment
      </button>

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-sky-50 border border-sky-100 rounded-2xl text-sky-600">
                <History size={28} />
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">
              Analysis History
            </h1>
          </div>
          <p className="text-slate-700 font-black uppercase tracking-[0.3em] text-[10px] ml-16 italic">
            Localized Biometric Records Matrix
          </p>
        </div>

        <div className="flex items-center gap-4">
            <button 
                onClick={openInFolder}
                className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-500 font-black text-[10px] uppercase tracking-widest hover:border-sky-500/30 hover:text-sky-600 transition-all shadow-sm"
            >
                <FolderOpen size={14} /> Open Records Folder
            </button>
            <div className="relative w-80">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-700" size={16} />
                <input 
                    type="text" 
                    placeholder="Search ID or Date..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-12 pr-5 text-xs font-bold text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/10 focus:border-orange-500/30 transition-all shadow-sm"
                />
            </div>
        </div>
      </header>
      {/* SECTION: Mean Average Statistics (New Step 10 Implementation) */}
      {!loading && sessions.length > 0 && (() => {
          const validProbs = sessions.map(s => Number(s.ai_result?.probability || s.ai_result?.riskLabel || 0)).filter(v => v > 0);
          const avgProb = validProbs.length > 0 ? (validProbs.reduce((a, b) => a + b, 0) / validProbs.length) : 0;
          
          const validWPMs = sessions.map(s => Number(s.summary?.wpm || s.wpm || 0)).filter(v => v > 0);
          const avgWPM = validWPMs.length > 0 ? (validWPMs.reduce((a, b) => a + b, 0) / validWPMs.length) : 0;
          
          const validAccs = sessions.map(s => Number(s.summary?.accuracy || s.accuracy || 0)).filter(v => v > 0);
          const avgAccuracy = validAccs.length > 0 ? (validAccs.reduce((a, b) => a + b, 0) / validAccs.length) : 0;
          
          return (
            <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10 animate-in slide-in-from-top duration-500">
                <StatCard label="Mean Risk Score" value={`${(avgProb * 100).toFixed(1)}%`} sub="Longitudinal Average" color="text-sky-600" />
                <StatCard label="Average Velocity" value={`${avgWPM.toFixed(0)} WPM`} sub="Typing Speed Mean" color="text-slate-900" />
                <StatCard label="Consistency" value={`${avgAccuracy.toFixed(1)}%`} sub="Avg. Session Accuracy" color="text-emerald-600" />
                <div className="bg-white border border-slate-200 p-6 rounded-[2rem] flex flex-col justify-center shadow-sm">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 italic">Total Dataset</span>
                    <span className="text-xl font-black text-slate-900 italic">{sessions.length} Sessions</span>
                </div>
            </section>
          );
      })()}

      <main>
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden min-h-[400px]">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-slate-50 text-slate-600 text-[9px] font-black uppercase tracking-[0.25em] border-b border-slate-100">
                        <th className="px-8 py-7 text-left">Temporal Metric / Instance ID</th>
                        <th className="px-8 py-7 text-center">Diagnostic Verdict</th>
                        <th className="px-8 py-7 text-center">Quality</th>
                        <th className="px-8 py-7 text-center">Metric (WPM)</th>
                        <th className="px-8 py-7 text-center">Data Vol</th>
                        <th className="px-8 py-7 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {loading ? (
                        <tr><td colSpan="6" className="px-8 py-32 text-center text-slate-500 font-black uppercase tracking-widest text-xs animate-pulse italic">Retrieving secure records...</td></tr>
                    ) : filtered.length === 0 ? (
                        <tr><td colSpan="6" className="px-8 py-32 text-center text-slate-600 font-black uppercase tracking-widest text-xs italic opacity-40">No historical sessions found on this node.</td></tr>
                    ) : (
                        filtered.map((s, idx) => (
                            <motion.tr 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                key={s.session_id || `session-${idx}`}
                                onClick={() => handleRowClick(s.session_id)}
                                className="group hover:bg-sky-500/[0.02] cursor-pointer transition-colors relative"
                            >
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600 border border-slate-100 group-hover:border-sky-500/20 group-hover:text-sky-600 transition-all">
                                            <Calendar size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-800 tracking-tight">{new Date(s.recorded_at).toLocaleString()}</p>
                                            <p className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] mt-0.5 opacity-50">NODE_ID: {s.session_id}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6 text-center">
                                    {s.ai_result ? (
                                        <div className="flex flex-col items-center gap-1">
                                            <span className={`px-4 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${s.ai_result.probability >= (s.ai_result.threshold_used || 0.65) ? 'bg-rose-50 text-rose-600 border-rose-100 shadow-sm' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                                {s.ai_result.probability >= (s.ai_result.threshold_used || 0.65) ? 'Elevated Signal' : 'Normal Range'}
                                            </span>
                                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{(((s.ai_result?.probability || s.ai_result?.riskLabel || 0) * 100).toFixed(1))}% Score</span>
                                        </div>
                                    ) : (
                                        <span className="text-[9px] font-black text-slate-700 uppercase italic tracking-widest opacity-30 underline decoration-slate-800">Unprocessed</span>
                                    )}
                                </td>
                                <td className="px-8 py-6 text-center">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${s.accuracy > 85 ? 'text-sky-600' : 'text-slate-600'}`}>
                                        {s.accuracy}%
                                    </span>
                                </td>
                                <td className="px-8 py-6 text-center text-slate-900 font-black text-base tracking-tighter italic">{s.wpm}</td>
                                <td className="px-8 py-6 text-center">
                                    <div className="flex items-center justify-center gap-2 text-slate-600 font-bold text-[10px] uppercase tracking-widest">
                                        <Database size={11} className="opacity-70" /> {s.total_keystrokes}
                                    </div>
                                </td>
                                <td className="px-8 py-6 text-right relative z-20">
                                    <div className="flex justify-end gap-2 pr-2">
                                         <button 
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                const data = await window.electron.ipcRenderer.invoke('session:load', { session_id: s.session_id });
                                                if (data?.ai_result && onViewResult) {
                                                  onViewResult(data.ai_result);
                                                }
                                            }}
                                            className="p-3 bg-white border border-slate-200 text-slate-600 hover:text-sky-600 hover:border-sky-500/30 rounded-xl transition-all shadow-sm"
                                            title="View Diagnostic Report"
                                        >
                                            <FileText size={16} />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); deleteSession(s.session_id); }}
                                            className="p-3 bg-white border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-500/30 rounded-xl transition-all shadow-sm"
                                            title="Purge Record"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                        <div className="w-8 flex justify-center items-center text-slate-500 group-hover:text-sky-600 group-hover:translate-x-1 transition-all">
                                            <ArrowRight size={18} />
                                        </div>
                                    </div>
                                </td>
                            </motion.tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </main>

      <AnimatePresence>
        {activeSession && (
          <MetricsVisualizer 
            keystrokes={activeSession.keystrokes} 
            stats={prepareStats(activeSession)}
            onClose={() => setActiveSession(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
    return (
        <div className="bg-white border border-slate-200 p-6 rounded-[2rem] flex flex-col gap-1 hover:border-sky-500/20 transition-all shadow-sm">
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">{label}</span>
            <span className={`text-2xl font-black italic tabular-nums ${color}`}>{value}</span>
            <span className="text-[9px] font-bold text-slate-700 uppercase tracking-tighter mt-1">{sub}</span>
        </div>
    );
}
