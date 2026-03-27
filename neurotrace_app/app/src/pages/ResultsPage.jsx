import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  Microscope,
  Dna,
  FileText,
  AlertTriangle,
  RefreshCcw,
  Target,
  History,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowLeft
} from 'lucide-react';
import { RiskGauge } from '../components/Parkinson/RiskGauge';
import { addSessionResult, getSessionHistory, getMultiSessionVerdict } from '../hooks/useSessionHistory';
import { generateReportHTML } from '../utils/reportGenerator';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  ResponsiveContainer, Tooltip as RechartsTooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell,
  AreaChart, Area
} from 'recharts';

export default function ResultsPage({ result, user, onRestart }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef();
  const [uploadError, setUploadError] = useState(null);
  const [rawBuffer, setRawBuffer] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('temp_buffer') || '[]');
    } catch {
      return [];
    }
  });
  const [showFeatures, setShowFeatures] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadReport = async () => {
    if (!window.electron?.ipcRenderer) return;
    setIsDownloading(true);
    try {
      const html = generateReportHTML(result, sessionHistory);
      const response = await window.electron.ipcRenderer.invoke('report:savePDF', html);
      if (response?.success) {
        console.log('[Report] Saved to:', response.filePath);
      }
    } catch (e) {
      console.error('[Report] Failed to save PDF:', e);
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    if (result) {
      const updated = addSessionResult(result);
      setSessionHistory(updated);
    }
  }, [result?.probability, result?.n_keystrokes]);

  // Handle upload
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
      // Save to localStorage for compatibility
      localStorage.setItem('temp_buffer', JSON.stringify(keystrokes));
      setRawBuffer(keystrokes);
      // Trigger analysis (simulate test completion)
      window.location.reload();
    } catch (err) {
      setUploadError('Failed to parse file: ' + err.message);
    }
    setUploading(false);
  };

  // Download helpers
  const downloadBuffer = (type = 'json') => {
    const buffer = rawBuffer;
    if (!buffer || !buffer.length) return;
    let dataStr, filename;
    if (type === 'json') {
      dataStr = JSON.stringify(buffer, null, 2);
      filename = 'keystrokes.json';
    } else {
      const headers = Object.keys(buffer[0]);
      const csvRows = [headers.join(',')].concat(
        buffer.map(row => headers.map(h => row[h]).join(','))
      );
      dataStr = csvRows.join('\n');
      filename = 'keystrokes.csv';
    }
    const blob = new Blob([dataStr], { type: type === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const multiVerdict = getMultiSessionVerdict(sessionHistory, result.threshold_used || 0.65);
  const timestamp = new Date().toLocaleString();

  const FEATURE_INFO = {
    'HT': { label: 'Hold Duration', meaning: 'Muscle release speed & finger stiffness' },
    'FT': { label: 'Flight Speed', meaning: 'Velocity of movement between keystrokes' },
    'IKI': { label: 'Press Rhythm', meaning: 'General coordination and timing consistency' },
    'LAT': { label: 'Tap Rhythm', meaning: 'General coordination and timing consistency' },
    'LATENCY': { label: 'Response Lag', meaning: 'Cognitive processing and reaction speed' },
    'ENTROPY': { label: 'Rhythm Chaos', meaning: 'Stability of the neurological motor clock' },
    'PENT': { label: 'Motor Complexity', meaning: 'Predictability and order of the typing rhythm' },
    'DFA': { label: 'Rhythm Consistency', meaning: 'Long-range stability of the motor control loop' },
    'STD': { label: 'Variability', meaning: 'Consistency of timing during the session' },
    'SKEW': { label: 'Asymmetry', meaning: 'Timing bias between hand or finger groups' },
    'WPM': { label: 'Typing Velocity', meaning: 'Overall motor performance speed' },
    'BG': { label: 'Common Key Pattern', meaning: 'Timing signature of your 5 most frequent key pairs' },
    'DRIFT': { label: 'Signal Drift', meaning: 'How your timing patterns shifted from the start to the end of the session' },
    'FATIG': { label: 'Motor Fatigue', meaning: 'A measurable decline in motor speed or efficiency over the test duration' }
  };

  const getLayman = (name) => {
    const lower = name.toLowerCase();
    let metric = "";
    if (lower.includes('_mean')) metric = " (Average)";
    else if (lower.includes('_std')) metric = " (Variability)";
    else if (lower.includes('_skew')) metric = " (Asymmetry)";
    else if (lower.includes('_q1')) metric = " (Lower Band)";
    else if (lower.includes('_q3')) metric = " (Upper Band)";
    else if (lower.includes('_max')) metric = " (Peak)";

    const upper = name.toUpperCase();
    for (const [key, info] of Object.entries(FEATURE_INFO)) {
      if (upper.includes(key)) {
        let label = info.label;
        if (key === 'BG') {
          const match = upper.match(/BG(\d)/);
          if (match) label = `${info.label} #${match[1]}`;
        }
        return { label: label + metric, meaning: info.meaning };
      }
    }
    return { label: name + metric, meaning: 'Subtle motor timing pattern' };
  };

  const formatName = (name) => {
    if (!name) return "";
    const info = getLayman(name);
    return info.label;
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-6 animate-in fade-in duration-1000 selection:bg-sky-500/20 text-slate-800">
      <button 
        onClick={onRestart}
        className="mb-8 flex items-center gap-2 text-slate-700 hover:text-sky-600 font-black uppercase tracking-[0.2em] text-[10px] transition-all group"
      >
        <div className="p-2 bg-white border border-slate-200 rounded-lg group-hover:border-sky-500/30">
          <ArrowLeft size={14} />
        </div>
        Back to Assessment
      </button>

      {/* UPLOAD/IMPORT RAW KEYSTROKES */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <button
          className="px-5 py-2 bg-sky-700 text-white rounded-lg font-bold hover:bg-sky-600 transition-colors"
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
        {uploadError && <span className="text-red-400 ml-4">{uploadError}</span>}
      </div>
      {/* DOWNLOAD RAW KEYSTROKES */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <button
          className="px-5 py-2 bg-emerald-700 text-white rounded-lg font-bold hover:bg-emerald-600 transition-colors"
          onClick={() => downloadBuffer('json')}
        >
          Download Keystrokes (JSON)
        </button>
        <button
          className="px-5 py-2 bg-emerald-700 text-white rounded-lg font-bold hover:bg-emerald-600 transition-colors"
          onClick={() => downloadBuffer('csv')}
        >
          Download Keystrokes (CSV)
        </button>
      </div>
      
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 italic tracking-tighter uppercase">Analysis Report</h1>
          <p className="text-slate-600 text-[10px] sm:text-xs font-bold uppercase tracking-widest mt-1">{timestamp}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto">
          <span className="text-[10px] sm:text-sm font-bold text-slate-700 mr-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 hidden sm:block">{user?.email || 'user@tremora.dev'}</span>
          <button 
            type="button"
            onClick={handleDownloadReport}
            disabled={isDownloading}
            className="flex-1 sm:flex-none px-4 sm:px-6 py-3 bg-slate-100 border-slate-200 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors uppercase tracking-widest text-[9px] sm:text-[10px] disabled:opacity-50 disabled:cursor-wait"
          >
            <FileText size={14} />
            {isDownloading ? '...' : 'PDF'}
          </button>
          <button 
            onClick={onRestart}
            className="flex-1 sm:flex-none px-4 sm:px-6 py-3 bg-sky-600 text-white rounded-xl font-black flex items-center justify-center gap-2 hover:bg-sky-500 transition-transform hover:scale-105 active:scale-95 shadow-[0_4px_12px_rgba(14,165,233,0.3)] uppercase tracking-widest text-[9px] sm:text-[10px]"
          >
            Restart <RefreshCcw size={14} />
          </button>
        </div>
      </header>

      <div className="space-y-6">
        
        <section className="flex flex-col lg:flex-row items-stretch gap-6">
          <div className="w-full lg:w-[40%] bg-white border border-slate-200 p-6 sm:p-8 rounded-[2.5rem] shadow-xl flex flex-col gap-8 justify-center relative overflow-hidden">
            <div className="absolute top-[-50%] left-[-50%] w-full h-full bg-sky-200/20 blur-[100px] rounded-full pointer-events-none" />
            
            <div className={`z-10 bg-slate-50/50 rounded-[2rem] p-4 mx-auto w-full max-w-sm flex items-center justify-center min-h-[250px]`}>
               <div className="text-center w-full">
                 <RiskGauge probability={result.riskLabel || result.probability || 0} />
                 <div className="mt-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                   {result.personal_baseline?.baseline_ready ? (
                     <>
                       <p className="text-[10px] text-slate-700 font-bold uppercase tracking-widest mb-1">Personal Z-Score</p>
                       <p className={`text-4xl font-black ${result.personal_baseline.status_colour === 'green' ? 'text-emerald-400' : result.personal_baseline.status_colour === 'amber' ? 'text-amber-400' : 'text-rose-400'}`}>
                         {result.personal_baseline.z_score >= 0 ? '+' : ''}{result.personal_baseline.z_score.toFixed(2)}
                       </p>
                     </>
                   ) : (
                     <div className="flex flex-col items-center gap-1">
                        <p className="text-[10px] text-sky-600 font-bold uppercase tracking-widest flex items-center gap-1 italic">
                          <History size={10} /> Calibration Phase
                        </p>
                        <p className="text-[11px] text-slate-700 leading-tight">
                          Need {result.personal_baseline?.sessions_needed || 3} more sessions for Z-score baseline.
                        </p>
                     </div>
                   )}
                 </div>
               </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 z-10">
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                <p className="text-[10px] text-slate-700 font-bold uppercase tracking-widest">Research Prob.</p>
                <p className="text-xl font-black text-slate-900">{((result.riskLabel || result.probability || 0) * 100).toFixed(1)}%</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                <p className="text-[10px] text-slate-700 font-bold uppercase tracking-widest">Confidence</p>
                <p className={`text-sm font-black uppercase tracking-widest ${result.confidence_band === 'High' ? 'text-emerald-600' : result.confidence_band === 'Moderate' ? 'text-sky-600' : 'text-amber-600'}`}>{result.confidence_band}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                <p className="text-[10px] text-slate-700 font-bold uppercase tracking-widest">Status</p>
                <p className={`text-sm font-black uppercase tracking-widest ${result.personal_baseline?.status_colour === 'green' ? 'text-emerald-600' : result.personal_baseline?.status_colour === 'amber' ? 'text-amber-600' : 'text-rose-600'}` || 'text-slate-700'}>
                    {result.personal_baseline?.status || 'N/A'}
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                <p className="text-[10px] text-slate-700 font-bold uppercase tracking-widest">OOD Class</p>
                <p className={`text-sm font-black uppercase tracking-widest ${result.oodGrade === 'In-Distribution' ? 'text-emerald-600' : 'text-rose-600'}`}>{result.oodGrade}</p>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-[60%] flex flex-col gap-6">
            <div className="bg-white border border-slate-200 p-10 rounded-[2.5rem] shadow-xl flex flex-col">
                <h2 className="text-2xl font-black text-slate-900 italic border-b border-slate-100 pb-4 mb-6 uppercase tracking-widest">Interpretation</h2>
                
                <div className="flex-1 space-y-6">
                    <p className="text-slate-600 text-[15px] leading-relaxed font-medium">
                        {result.verdict}
                    </p>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex items-center gap-3 text-emerald-600">
                        <ShieldCheck size={18} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Clinically Adjusted Analysis</span>
                    </div>
                    <div className="text-[10px] text-slate-600 font-mono tracking-tighter">
                        ID: {result?.sessionId?.split('-')?.[0] || result?.sessionId || 'SESS-ACT'} | Windows: {result?.n_windows || 0} | Keystrokes: {result?.n_keystrokes || 0}
                    </div>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
               <button 
                 onClick={() => setShowRules(!showRules)}
                 className="w-full p-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
               >
                 <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-sky-500/10 rounded-lg text-sky-600">
                       <HelpCircle size={16} />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">Detailed Calculation Breakdown</span>
                 </div>
                 {showRules ? <ChevronUp size={16} className="text-slate-600" /> : <ChevronDown size={16} className="text-slate-600" />}
               </button>
               <AnimatePresence>
                 {showRules && (
                    <motion.div 
                        initial={{ height: 0 }} 
                        animate={{ height: 'auto' }} 
                        exit={{ height: 0 }}
                        className="overflow-hidden border-t border-slate-100 bg-white p-6 space-y-4"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1">
                                <span className="text-[9px] font-black uppercase text-slate-600 tracking-widest">Raw Probability</span>
                                <span className="text-sm font-mono text-slate-900">{(result.raw_probability * 100).toFixed(2)}%</span>
                                <p className="text-[10px] text-slate-700 mt-2 leading-tight">Original output from the AIM-Student v1 model before clinical normalization.</p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1">
                                <span className="text-[9px] font-black uppercase text-slate-600 tracking-widest">Age Correction</span>
                                <span className="text-sm font-mono text-emerald-600">{result.age_correction?.correction > 0 ? '+' : ''}{(result.age_correction?.correction * 100).toFixed(1)}% ({result.age_correction?.age_baseline?.toFixed(3)} baseline)</span>
                                <p className="text-[10px] text-slate-700 mt-2 leading-tight">Shifts probability toward your age-matched demographic median (baseline calibration cohorts were age ~58).</p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1">
                                <span className="text-[9px] font-black uppercase text-slate-600 tracking-widest">Window Confidence</span>
                                <span className="text-sm font-mono text-sky-600">{(result.window_confidence * 100).toFixed(0)}% weight</span>
                                <p className="text-[10px] text-slate-700 mt-2 leading-tight">Shrinks results toward 0.5 when few temporal windows are available, preventing high-risk flags from single outliers.</p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1">
                                <span className="text-[9px] font-black uppercase text-slate-600 tracking-widest">OOD Deviation (MAD)</span>
                                <span className="text-sm font-mono text-amber-600">{result.ood_info?.mad?.toFixed(2)} σ</span>
                                <p className="text-[10px] text-slate-700 mt-2 leading-tight">How far this session deviates from the research population center. Higher scores indicate atypical typing conditions.</p>
                            </div>
                        </div>
                        <div className="p-4 bg-sky-50 border border-sky-100 rounded-2xl">
                            <p className="text-[11px] font-bold text-sky-600 uppercase tracking-widest mb-1">Personal Baseline Status</p>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                {result.personal_baseline?.baseline_ready 
                                    ? `Your motor timing is currently being compared to your personal mean of ${result.personal_baseline.personal_mean.toFixed(3)} (σ=${result.personal_baseline.personal_std.toFixed(3)}). Any drift greater than 2 standard deviations is flagged as a notable change.`
                                    : `Currently establishing your personal baseline. We need ${(result.personal_baseline?.sessions_needed || 3)} more sessions to create a reliable personalized threshold for you.`
                                }
                            </p>
                        </div>
                    </motion.div>
                 )}
               </AnimatePresence>
            </div>
          </div>
        </section>

        {(() => {
          const statusConfig = {
            'confirmed': {
              border: 'border-rose-500/30', bg: 'bg-rose-500/10',
              icon: <XCircle size={20} className="text-rose-400 flex-shrink-0 mt-0.5" />,
              title: 'Pattern Confirmed Across Sessions',
              titleColor: 'text-rose-400',
            },
            'borderline': {
              border: 'border-amber-500/30', bg: 'bg-amber-500/10',
              icon: <HelpCircle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />,
              title: 'Borderline — Retest Recommended',
              titleColor: 'text-amber-400',
            },
            'cleared': {
              border: 'border-emerald-500/30', bg: 'bg-emerald-500/10',
              icon: <CheckCircle2 size={20} className="text-emerald-400 flex-shrink-0 mt-0.5" />,
              title: 'Signal Not Confirmed Across Sessions',
              titleColor: 'text-emerald-400',
            },
            'insufficient': {
              border: 'border-sky-500/30', bg: 'bg-sky-500/10',
              icon: <History size={20} className="text-sky-400 flex-shrink-0 mt-0.5" />,
              title: 'Multi-Session Baseline Building',
              titleColor: 'text-sky-400',
            },
          };
          const cfg = statusConfig[multiVerdict.confirmationStatus] || statusConfig['insufficient'];
          return (
            <section className={`rounded-2xl border p-5 flex items-start gap-4 ${cfg.border} ${cfg.bg}`}>
              {cfg.icon}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-black text-xs uppercase tracking-widest ${cfg.titleColor}`}>{cfg.title}</span>
                  <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                    {multiVerdict.sessionsAbove}/{multiVerdict.totalSessions} sessions elevated
                  </span>
                </div>
                <p className="text-slate-700 text-[13px] leading-relaxed">{multiVerdict.message}</p>
                {/* Session history visualizer */}
                {multiVerdict.totalSessions > 0 && (
                  <div className="mt-4 border-t border-slate-200 pt-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mr-1">Recent:</span>
                      {sessionHistory.slice(-3).map((s, i) => {
                        const prob = typeof s.probability === 'number' ? s.probability : (parseFloat(s.probability) || 0);
                        const elevated = prob >= (result.threshold_used || 0.65);
                        return (
                          <div key={i} title={`Session ${i+1}: ${(prob*100).toFixed(1)}%`}
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black border ${elevated ? 'bg-rose-500/10 border-rose-500/40 text-rose-600' : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600'}`}>
                            {(prob*100).toFixed(0)}
                          </div>
                        );
                      })}
                    </div>
                    {sessionHistory.length >= 2 && (
                      <div className="h-16 w-full opacity-70 hover:opacity-100 transition-opacity">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={sessionHistory.slice(-10).map((s, idx) => ({ 
                             name: `S${idx+1}`, 
                             prob: (typeof s.probability === 'number' ? s.probability : (parseFloat(s.probability) || 0)) * 100 
                          }))}>
                            <defs>
                              <linearGradient id="colorProb" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={cfg.titleColor.includes('rose') ? '#f43f5e' : cfg.titleColor.includes('amber') ? '#fbbf24' : '#0ea5e9'} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={cfg.titleColor.includes('rose') ? '#f43f5e' : cfg.titleColor.includes('amber') ? '#fbbf24' : '#0ea5e9'} stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <RechartsTooltip 
                               contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}
                               itemStyle={{ color: '#0f172a' }}
                               formatter={(val) => [`${val.toFixed(1)}%`, 'Signal']}
                               labelStyle={{ display: 'none' }}
                               cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }}
                            />
                            <Area type="monotone" dataKey="prob" stroke={cfg.titleColor.includes('rose') ? '#f43f5e' : cfg.titleColor.includes('amber') ? '#fbbf24' : '#0ea5e9'} strokeWidth={2} fillOpacity={1} fill="url(#colorProb)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          );
        })()}

        {result.keyboard_info && (() => {
          const ki = result.keyboard_info;
          const hz = ki.polling_hz || 125;
          const indicatorPct = Math.min(((hz - 125) / (2000 - 125)) * 100, 100);
          const zoneColor = hz >= 1000 ? '#22c55e' : hz >= 500 ? '#2dd4bf' : hz >= 250 ? '#60a5fa' : '#94a3b8';
          const zoneLabel = hz >= 1000 ? 'Pro' : hz >= 500 ? 'Gaming' : hz >= 250 ? 'Enhanced' : 'Standard';

          return (
            <section className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-600">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M6 16h.01M10 16h.01M14 16h.01M18 16h.01"/></svg>
                </div>
                <h2 className="text-lg font-black text-slate-900 italic uppercase tracking-widest">Capture Hardware</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-3 text-[13px] font-mono">
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-600 uppercase tracking-widest text-[10px] font-bold">Keyboard</span>
                    <span className="text-slate-800 font-bold">{ki.keyboard_name || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-600 uppercase tracking-widest text-[10px] font-bold">Polling Rate</span>
                    <span className="font-black" style={{ color: zoneColor }}>{hz} Hz</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-600 uppercase tracking-widest text-[10px] font-bold">Timing Resolution</span>
                    <span className="text-slate-800">&plusmn;{ki.min_measurable_ht_ms?.toFixed(1)} ms</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-600 uppercase tracking-widest text-[10px] font-bold">Detection</span>
                    <span className="text-slate-700">{ki.detection_method} ({ki.detection_confidence} confidence)</span>
                  </div>
                  {ki.quantisation_warning && (
                    <div className="mt-4 p-3 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400 text-[12px] leading-relaxed">
                      ⚠ {hz}Hz polling limits timing resolution to &plusmn;{ki.min_measurable_ht_ms?.toFixed(0)}ms.
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-3">Polling Rate Scale</p>
                  <svg width="100%" height="60" viewBox="0 0 300 60">
                    <rect x="0"   y="20" width="62"  height="12" rx="2" fill="#94a3b8" opacity="0.3"/>
                    <rect x="65"  y="20" width="70"  height="12" rx="2" fill="#60a5fa" opacity="0.3"/>
                    <rect x="138" y="20" width="70"  height="12" rx="2" fill="#2dd4bf" opacity="0.3"/>
                    <rect x="211" y="20" width="89"  height="12" rx="2" fill="#22c55e" opacity="0.3"/>
                    <text x="31"  y="50" textAnchor="middle" fill="#94a3b8" fontSize="8" fontWeight="600">125</text>
                    <text x="100" y="50" textAnchor="middle" fill="#60a5fa" fontSize="8" fontWeight="600">250</text>
                    <text x="173" y="50" textAnchor="middle" fill="#2dd4bf" fontSize="8" fontWeight="600">500</text>
                    <text x="255" y="50" textAnchor="middle" fill="#22c55e" fontSize="8" fontWeight="600">1000+</text>
                    <circle cx={Math.max(4, Math.min(296, indicatorPct * 2.96))} cy="26" r="8" fill={zoneColor} opacity="0.9"/>
                  </svg>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: zoneColor }}/>
                    <span className="text-xs font-black uppercase tracking-widest" style={{ color: zoneColor }}>{zoneLabel} — {hz}Hz</span>
                  </div>
                  {result.reliability_note && (
                    <p className="mt-4 text-[12px] text-slate-600 leading-relaxed">{result.reliability_note}</p>
                  )}
                </div>
              </div>
            </section>
          );
        })()}

        <section className="bg-white border border-slate-200 p-10 rounded-[2.5rem] shadow-xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-sky-50 rounded-xl text-sky-600">
              <Microscope size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 italic uppercase tracking-widest">Diagnostic Signatures</h2>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 mt-1">Top 5 factors ranked by model importance</p>
            </div>
          </div>

          <div className="w-full h-80 mb-10 overflow-hidden bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-center p-4">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart 
                cx="50%" cy="50%" outerRadius="75%" 
                data={result.top5_features?.map(feat => {
                  const rawLabel = getLayman(feat.name).label;
                  const label = rawLabel.includes('(') ? rawLabel.split(' (')[0].trim() : rawLabel;
                  return {
                    subject: label.substring(0, 16),
                    importance: feat.pct,
                    fullMark: Math.max(...(result.top5_features.map(f => f.pct))) * 1.1
                  };
                }) || []}
              >
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: '900', letterSpacing: '0.05em' }} />
                <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '12px', fontSize: '11px', textTransform: 'uppercase', fontWeight: '900', letterSpacing: '0.1em' }}
                  itemStyle={{ color: '#0ea5e9' }}
                  formatter={(value) => [`${value.toFixed(1)}%`, 'Weight']}
                />
                <Radar name="Model Focus" dataKey="importance" stroke="#0ea5e9" strokeWidth={2} fill="#0ea5e9" fillOpacity={0.2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            {result.top5_features?.map((feat) => {
              const displayName = formatName(feat.name);
              const isUp = feat.direction === 'UP';
              const directionColor = isUp ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : 'text-teal-400 bg-teal-500/10 border-teal-500/20';
              const barColor = isUp ? 'bg-rose-500' : 'bg-teal-500';
              const maxPct = result.top5_features[0]?.pct || 1;
              const fillRatio = (feat.pct / maxPct) * 100;

              return (
                <div key={feat.raw_name} className="flex flex-col gap-3 group">
                  <div className="flex flex-col bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-sky-100 transition-colors">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-black text-slate-900 uppercase tracking-wider truncate mr-4">
                        {displayName}
                      </span>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className={`px-2 py-1 rounded text-[10px] font-black italic tracking-widest uppercase border ${directionColor}`}>
                          {feat.direction}
                        </div>
                        <span className="text-sm font-black text-slate-900 tabular-nums w-12 text-right">{feat.pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium leading-tight">
                      {getLayman(feat.name).meaning}
                    </p>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }} 
                      animate={{ width: `${fillRatio}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full opacity-80 group-hover:opacity-100 transition-all ${barColor}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden">
          <button 
            onClick={() => setShowFeatures(!showFeatures)}
            className="w-full p-8 flex items-center justify-between hover:bg-slate-50 transition-colors focus:outline-none"
          >
            <div className="flex items-center gap-4">
              <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg text-slate-400">
                <Dna size={20} />
              </div>
              <h2 className="text-lg font-black text-slate-900 italic uppercase tracking-widest">
                All Features ({result.all_features ? result.all_features.filter(f => f.pct > 0.1).length : 0})
              </h2>
            </div>
            {showFeatures ? <ChevronUp className="text-sky-600" /> : <ChevronDown className="text-slate-400" />}
          </button>
          <AnimatePresence>
            {showFeatures && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-slate-100 bg-white"
              >
                 <div className="p-8 overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <th className="pb-4 pl-4 font-black">Rank</th>
                        <th className="pb-4 font-black">Feature Name</th>
                        <th className="pb-4 font-black text-right pr-6">Importance</th>
                        <th className="pb-4 font-black text-right pr-6">Value</th>
                        <th className="pb-4 font-black text-center">Dir</th>
                        <th className="pb-4 font-black w-32">Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.all_features?.filter(f => f.pct > 0.1).map((feat, idx) => {
                        const isUp = feat.direction === 'UP';
                        const badgeColor = isUp ? 'text-rose-600 bg-rose-50 border-rose-100' : 'text-teal-600 bg-teal-50 border-teal-100';
                        return (
                          <tr key={feat.raw_name} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group/row">
                            <td className="py-4 pl-4 text-xs font-bold text-slate-400">#{idx + 1}</td>
                            <td className="py-4">
                               <div className="flex flex-col">
                                  <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{formatName(feat.name)}</span>
                                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight group-hover/row:text-slate-500 transition-colors">
                                     {getLayman(feat.name).meaning}
                                  </span>
                               </div>
                            </td>
                            <td className="py-4 text-xs font-mono text-slate-600 text-right pr-6 tabular-nums">{feat.pct.toFixed(2)}%</td>
                            <td className="py-4 text-xs font-mono text-slate-500 text-right pr-6 tabular-nums">{feat.value.toFixed(4)}</td>
                            <td className="py-4 text-center">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${badgeColor}`}>
                                {feat.direction}
                              </span>
                            </td>
                            <td className="py-4 align-middle">
                              <div className="h-1 w-full bg-slate-100 rounded overflow-hidden">
                                <div className={`h-full ${isUp ? 'bg-rose-500' : 'bg-teal-500'} opacity-70`} style={{ width: `${Math.min(feat.pct * 2, 100)}%` }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <section className="bg-white border border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden">
          <button 
            onClick={() => setShowExplanation(!showExplanation)}
            className="w-full p-8 flex items-center justify-between hover:bg-slate-50 transition-colors focus:outline-none"
          >
            <div className="flex flex-col items-start gap-1">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg text-slate-400">
                  <Target size={20} />
                </div>
                <h2 className="text-lg font-black text-slate-900 italic uppercase tracking-widest">Model Explanation</h2>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-14">Feature contributions ranked by importance</p>
            </div>
            {showExplanation ? <ChevronUp className="text-sky-600" /> : <ChevronDown className="text-slate-400" />}
          </button>

          <AnimatePresence>
            {showExplanation && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-slate-100 bg-white"
              >
                <div className="p-8 space-y-3">
                  {(() => {
                    const barData = result.all_features?.filter(f => f.pct > 0.5).slice(0, 12).map(feat => {
                      const info = getLayman(feat.name);
                      return {
                        name: info.label,
                        importance: feat.pct,
                        direction: feat.direction,
                      };
                    }) || [];
                    
                    return barData.length > 0 ? (
                      <div className="h-[400px] w-full mt-4 pr-6">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                            <XAxis type="number" stroke="#94a3b8" tickFormatter={(v) => `${v}%`} />
                            <YAxis dataKey="name" type="category" stroke="#64748b" width={150} tick={{fontSize: 9, fontWeight: 'bold'}} />
                            <RechartsTooltip 
                              cursor={{fill: '#f8fafc'}}
                              contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '12px', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                              itemStyle={{ color: '#0ea5e9' }}
                              formatter={(val) => [`${val.toFixed(2)}%`, 'Impact']}
                            />
                            <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                              {barData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.direction === 'UP' ? '#f43f5e' : '#14b8a6'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="flex items-center gap-6 justify-center mt-6 border-t border-slate-100 pt-4">
                           <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-rose-500 block"></span><span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Increased Risk</span></div>
                           <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-teal-500 block"></span><span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Decreased Risk</span></div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm text-center py-6">No feature explanation data available for this session.</p>
                    );
                  })()}
                  <div className="mt-8 pt-4 text-right font-mono text-[10px] uppercase tracking-widest font-black text-slate-400">
                    <p>Decision threshold: {result.threshold_used?.toFixed(2) || '0.65'} probability</p>
                    <p>Session score: {((typeof result.probability === 'number' ? result.probability : parseFloat(result.probability) || 0) * 100).toFixed(1)}%</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <section className="bg-amber-50 border border-amber-100 p-6 rounded-3xl flex items-start gap-4">
          <AlertTriangle className="text-amber-500 flex-shrink-0 mt-1" size={24} />
          <p className="text-slate-600 text-sm leading-relaxed font-medium">
            This result is a statistical screening signal only. It is not a clinical diagnosis. The model was trained on a research dataset and has not been clinically validated. Please consult a neurologist for any medical evaluation.
          </p>
        </section>

      </div>
    </div>
  );
}
