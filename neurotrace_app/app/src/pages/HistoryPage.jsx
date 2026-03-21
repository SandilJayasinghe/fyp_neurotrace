import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, Search, ArrowRight, Trash2, BarChart2, Calendar, Database, FolderOpen } from 'lucide-react';
import { MetricsVisualizer } from '../components/MetricsVisualizer';

export function HistoryPage() {
  const [sessions, setSessions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState(null);

  const loadSessions = async () => {
    setLoading(true);
    const data = await window.electron.ipcRenderer.invoke('session:list');
    setSessions(data);
    setLoading(false);
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const deleteSession = async (id) => {
    if (!window.confirm('Are you sure you want to delete this session?')) return;
    const res = await window.electron.ipcRenderer.invoke('session:delete', { session_id: id });
    if (res.success) {
      setSessions(s => s.filter(x => x.session_id !== id));
    }
  };

  const openInFolder = async (id) => {
    await window.electron.ipcRenderer.invoke('session:openFile', { type: 'json', session_id: id });
  };

  const filtered = sessions.filter(s => 
    s.recorded_at.includes(searchTerm) || 
    s.session_id.includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-slate-50 p-10 font-sans">
      <header className="max-w-6xl mx-auto flex justify-between items-end mb-12">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <div className="bg-brand-500 p-2 rounded-xl text-white shadow-lg shadow-brand-500/20">
                <History size={32} />
             </div>
             Screening History
          </h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2 pl-14 underline decoration-slate-200 underline-offset-4">
            Localized Biometric Records
          </p>
        </div>

        <div className="flex items-center gap-4">
            <button 
                onClick={() => window.electron.ipcRenderer.invoke('session:openFolder')}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-slate-100 rounded-xl text-slate-600 font-bold text-xs hover:border-brand-500/20 hover:text-brand-600 transition-all shadow-sm"
            >
                <FolderOpen size={16} /> Show All Records
            </button>
            <div className="relative w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Search by ID or Date..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                />
            </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                        <th className="px-8 py-6 text-left">Timestamp / ID</th>
                        <th className="px-8 py-6 text-center">Screening Result</th>
                        <th className="px-8 py-6 text-center">Accuracy</th>
                        <th className="px-8 py-6 text-center">WPM</th>
                        <th className="px-8 py-6 text-center">Strokes</th>
                        <th className="px-8 py-6 text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {loading ? (
                        <tr><td colSpan="5" className="px-8 py-20 text-center text-slate-400 font-bold italic">Loading records...</td></tr>
                    ) : filtered.length === 0 ? (
                        <tr><td colSpan="5" className="px-8 py-20 text-center text-slate-400 font-bold italic">No sessions found.</td></tr>
                    ) : (
                        filtered.map(s => (
                            <motion.tr 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                key={s.session_id} 
                                className="group hover:bg-slate-50/50 transition-colors"
                            >
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-brand-50 rounded-lg text-brand-600">
                                            <Calendar size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-800">{new Date(s.recorded_at).toLocaleString()}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ID: {s.session_id}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6 text-center">
                                    {s.ai_result ? (
                                        <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter shadow-sm border ${s.ai_result.label === 1 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                                            {s.ai_result.label === 1 ? 'PD RISK' : 'HEALTHY'}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold text-slate-300 uppercase italic">Not Analyzed</span>
                                    )}
                                </td>
                                <td className="px-8 py-6 text-center">
                                    <span className={`px-3 py-1 rounded-full text-[11px] font-black ${parseFloat(s.accuracy) > 85 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-600'}`}>
                                        {s.accuracy}%
                                    </span>
                                </td>
                                <td className="px-8 py-6 text-center text-slate-700 font-black text-sm">{s.wpm}</td>
                                <td className="px-8 py-6 text-center">
                                    <div className="flex items-center justify-center gap-2 text-slate-400 font-bold text-[10px] uppercase">
                                        <Database size={12} /> {s.total_keystrokes}
                                    </div>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button 
                                            onClick={async () => {
                                                const data = await window.electron.ipcRenderer.invoke('session:load', { session_id: s.session_id });
                                                setActiveSession(data);
                                            }}
                                            className="p-2.5 text-slate-400 hover:text-brand-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200 shadow-sm shadow-slate-100"
                                        >
                                            <BarChart2 size={18} />
                                        </button>
                                        <button 
                                            onClick={() => openInFolder(s.session_id)}
                                            className="p-2.5 text-slate-400 hover:text-brand-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200"
                                            title="Show in Folder"
                                        >
                                            <FolderOpen size={18} />
                                        </button>
                                        <button 
                                            onClick={() => deleteSession(s.session_id)}
                                            className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                        <div className="w-10 flex justify-center items-center text-slate-200 group-hover:text-brand-500 transition-colors">
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
            session={activeSession} 
            onClose={() => setActiveSession(null)} 
          />
        )}
      </AnimatePresence>
      
      {/* Background Decor */}
      <div className="fixed top-0 right-0 w-full h-full -z-10 pointer-events-none opacity-[0.03]">
         <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-indigo-500 rounded-full blur-[140px]" />
      </div>
    </div>
  );
}
