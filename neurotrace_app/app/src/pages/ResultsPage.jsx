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
  HelpCircle
} from 'lucide-react';
import { RiskGauge } from '../components/Parkinson/RiskGauge';
import { addSessionResult, getSessionHistory, getMultiSessionVerdict } from '../hooks/useSessionHistory';

export default function ResultsPage({ result, onRestart }) {
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
  const [showRules, setShowRules] = useState(false);
  const [sessionHistory, setSessionHistory] = useState([]);

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
  const formatName = (name) => {
    if (!name) return "";
    return name.length > 30 ? name.slice(0, 27) + '...' : name;
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-6 animate-in fade-in duration-1000 selection:bg-sky-500/20 text-slate-200">
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
      
      {/* SECTION 1 — Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 bg-slate-900/40 p-6 rounded-3xl border border-slate-800">
        <div>
          <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">Analysis Report</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">{timestamp}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-bold text-slate-400 mr-2 px-4 py-2 bg-slate-950 rounded-xl border border-slate-800 hidden sm:block">user@neurotrace.dev</span>
          <button 
            type="button"
            className="px-6 py-3 bg-slate-800 border-slate-700 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors uppercase tracking-widest text-[10px]"
          >
            <FileText size={14} /> Download Report
          </button>
          <button 
            onClick={onRestart}
            className="px-6 py-3 bg-sky-500 text-slate-950 rounded-xl font-black flex items-center gap-2 hover:bg-sky-400 transition-transform hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(14,165,233,0.3)] uppercase tracking-widest text-[10px]"
          >
            Test Again <RefreshCcw size={14} />
          </button>
        </div>
      </header>

      <div className="space-y-6">
        
        {/* SECTION 2 — Score + Verdict */}
        <section className="flex flex-col lg:flex-row items-stretch gap-6">
          {/* Left Column (40%) */}
          <div className="w-full lg:w-[40%] bg-[#0a0f1d] border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl flex flex-col gap-8 justify-center relative overflow-hidden">
            <div className="absolute top-[-50%] left-[-50%] w-full h-full bg-sky-500/10 blur-[100px] rounded-full pointer-events-none" />
            
            <div className="z-10 bg-white/5 rounded-[2rem] p-4 mx-auto w-full max-w-sm">
                <RiskGauge probability={result.probability} />
            </div>
            
            <div className="grid grid-cols-2 gap-4 z-10">
              <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Score</p>
                <p className="text-xl font-black text-white">{(result.probability * 100).toFixed(1)}%</p>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Confidence</p>
                <p className={`text-xl font-black ${result.confidence_band === 'High' ? 'text-emerald-400' : result.confidence_band === 'Moderate' ? 'text-sky-400' : 'text-amber-400'}`}>{result.confidence_band}</p>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Keystrokes</p>
                <p className="text-xl font-black text-white">{result.n_keystrokes}</p>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">L/R Ratio</p>
                <p className="text-xl font-black text-rose-300">{result.lr_ratio?.toFixed(2) || "N/A"}</p>
              </div>
            </div>
          </div>

          {/* Right Column (60%) */}
          <div className="w-full lg:w-[60%] bg-[#0a0f1d] border border-slate-800 p-10 rounded-[2.5rem] shadow-2xl flex flex-col">
            
            {result.session_quality && (() => {
              const qualityColour = {
                'Good': 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
                'Fair': 'border-amber-500/30 bg-amber-500/10 text-amber-400',
                'Poor': 'border-rose-500/30 bg-rose-500/10 text-rose-400',
              }[result.session_quality.grade] || 'border-slate-500/30 bg-slate-500/10 text-slate-400';

              return (
                <div className={`rounded-2xl border p-5 mb-6 ${qualityColour}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs uppercase tracking-widest">
                      Session Quality: {result.session_quality.grade} ({result.session_quality.score}%)
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                      Spike rate: {result.session_quality.spike_ratio}%
                    </span>
                  </div>
                  {result.session_quality.grade !== 'Good' && (
                    <p className="mt-3 text-[13px] font-medium leading-relaxed opacity-90 text-slate-300">
                      {result.session_quality.reason}. Try typing more slowly and naturally for a cleaner result.
                    </p>
                  )}
                </div>
              );
            })()}

            <h2 className="text-2xl font-black text-white italic border-b border-slate-800 pb-4 mb-6 uppercase tracking-widest">Interpretation</h2>
            
            <div className="flex-1">
              <p className="text-slate-300 text-[15px] leading-relaxed font-medium opacity-90">
                {result.verdict}
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800/50 bg-slate-900/30 p-4 rounded-2xl">
              <div className="flex items-center gap-3 text-emerald-400 mb-2">
                <ShieldCheck size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">Model Validation Metrics</span>
              </div>
              <p className="text-xs font-mono text-slate-400">
                Model trained AUC: {result.aim_auc?.toFixed(3)} | 
                Sensitivity: {(result.aim_sensitivity * 100).toFixed(1)}% | 
                Specificity: {(result.aim_specificity * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </section>

        {/* MULTI-SESSION CONFIRMATION BANNER */}
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
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    {multiVerdict.sessionsAbove}/{multiVerdict.totalSessions} sessions elevated
                  </span>
                </div>
                <p className="text-slate-300 text-[13px] leading-relaxed">{multiVerdict.message}</p>
                {/* Session history dots */}
                {multiVerdict.totalSessions > 0 && (
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mr-1">History:</span>
                    {sessionHistory.slice(-3).map((s, i) => {
                      const elevated = s.probability >= (result.threshold_used || 0.65);
                      return (
                        <div key={i} title={`Session ${i+1}: ${(s.probability*100).toFixed(1)}%`}
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black border ${elevated ? 'bg-rose-500/20 border-rose-500/40 text-rose-400' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'}`}>
                          {(s.probability*100).toFixed(0)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          );
        })()}

        {/* SECTION 2.5 — Capture Hardware */}
        {result.keyboard_info && (() => {
          const ki = result.keyboard_info;
          const hz = ki.polling_hz || 125;
          const zones = [
            { label: 'Standard', min: 125, max: 250, color: '#94a3b8' },
            { label: 'Enhanced', min: 250, max: 500, color: '#60a5fa' },
            { label: 'Gaming',   min: 500, max: 1000, color: '#2dd4bf' },
            { label: 'Pro',      min: 1000, max: 2000, color: '#22c55e' },
          ];
          const indicatorPct = Math.min(((hz - 125) / (2000 - 125)) * 100, 100);
          const zoneColor = hz >= 1000 ? '#22c55e' : hz >= 500 ? '#2dd4bf' : hz >= 250 ? '#60a5fa' : '#94a3b8';
          const zoneLabel = hz >= 1000 ? 'Pro' : hz >= 500 ? 'Gaming' : hz >= 250 ? 'Enhanced' : 'Standard';

          return (
            <section className="bg-[#0a0f1d] border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-slate-800 rounded-xl text-slate-400">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M6 16h.01M10 16h.01M14 16h.01M18 16h.01"/></svg>
                </div>
                <h2 className="text-lg font-black text-white italic uppercase tracking-widest">Capture Hardware</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left: device info */}
                <div className="space-y-3 text-[13px] font-mono">
                  <div className="flex justify-between border-b border-slate-800/50 pb-2">
                    <span className="text-slate-500 uppercase tracking-widest text-[10px] font-bold">Keyboard</span>
                    <span className="text-slate-200 font-bold">{ki.keyboard_name || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/50 pb-2">
                    <span className="text-slate-500 uppercase tracking-widest text-[10px] font-bold">Polling Rate</span>
                    <span className="font-black" style={{ color: zoneColor }}>{hz} Hz</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/50 pb-2">
                    <span className="text-slate-500 uppercase tracking-widest text-[10px] font-bold">Timing Resolution</span>
                    <span className="text-slate-200">&plusmn;{ki.min_measurable_ht_ms?.toFixed(1)} ms</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/50 pb-2">
                    <span className="text-slate-500 uppercase tracking-widest text-[10px] font-bold">Detection</span>
                    <span className="text-slate-400">{ki.detection_method} ({ki.detection_confidence} confidence)</span>
                  </div>
                  {ki.quantisation_warning && (
                    <div className="mt-4 p-3 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400 text-[12px] leading-relaxed">
                      ⚠ {hz}Hz polling limits timing resolution to &plusmn;{ki.min_measurable_ht_ms?.toFixed(0)}ms.
                      Timing-sensitive features (DFA, entropy, tremor) have been automatically downweighted.
                    </div>
                  )}
                </div>

                {/* Right: polling rate scale SVG */}
                <div className="flex flex-col justify-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Polling Rate Scale</p>
                  <svg width="100%" height="60" viewBox="0 0 300 60">
                    {/* Zone segments */}
                    <rect x="0"   y="20" width="62"  height="12" rx="2" fill="#94a3b8" opacity="0.3"/>
                    <rect x="65"  y="20" width="70"  height="12" rx="2" fill="#60a5fa" opacity="0.3"/>
                    <rect x="138" y="20" width="70"  height="12" rx="2" fill="#2dd4bf" opacity="0.3"/>
                    <rect x="211" y="20" width="89"  height="12" rx="2" fill="#22c55e" opacity="0.3"/>
                    {/* Zone labels */}
                    <text x="31"  y="50" textAnchor="middle" fill="#94a3b8" fontSize="8" fontWeight="600">125</text>
                    <text x="100" y="50" textAnchor="middle" fill="#60a5fa" fontSize="8" fontWeight="600">250</text>
                    <text x="173" y="50" textAnchor="middle" fill="#2dd4bf" fontSize="8" fontWeight="600">500</text>
                    <text x="255" y="50" textAnchor="middle" fill="#22c55e" fontSize="8" fontWeight="600">1000+</text>
                    {/* Indicator */}
                    <circle cx={Math.max(4, Math.min(296, indicatorPct * 2.96))} cy="26" r="8" fill={zoneColor} opacity="0.9"/>
                  </svg>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: zoneColor }}/>
                    <span className="text-xs font-black uppercase tracking-widest" style={{ color: zoneColor }}>{zoneLabel} — {hz}Hz</span>
                  </div>

                  {result.reliability_note && (
                    <p className="mt-4 text-[12px] text-slate-400 leading-relaxed">{result.reliability_note}</p>
                  )}
                </div>
              </div>
            </section>
          );
        })()}

        {/* SECTION 3 — Diagnostic Signatures (Top 5) */}
        <section className="bg-[#0a0f1d] border border-slate-800 p-10 rounded-[2.5rem] shadow-2xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-sky-500/10 rounded-xl text-sky-400">
              <Microscope size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white italic uppercase tracking-widest">Diagnostic Signatures</h2>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-1">Top 5 factors ranked by model importance</p>
            </div>
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
                  <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider truncate mr-4">
                      {displayName}
                    </span>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className={`px-2 py-1 rounded text-[10px] font-black italic tracking-widest uppercase border ${directionColor}`}>
                        {feat.direction}
                      </div>
                      <span className="text-sm font-black text-white tabular-nums w-12 text-right">{feat.pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800/50">
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

        {/* SECTION 4 — Full Feature Breakdown */}
        <section className="bg-[#0a0f1d] border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden">
          <button 
            onClick={() => setShowFeatures(!showFeatures)}
            className="w-full p-8 flex items-center justify-between hover:bg-slate-900/50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500/20"
          >
            <div className="flex items-center gap-4">
              <div className="p-2 bg-slate-800 rounded-lg text-slate-400">
                <Dna size={20} />
              </div>
              <h2 className="text-lg font-black text-white italic uppercase tracking-widest">
                All Features ({result.all_features ? result.all_features.filter(f => f.pct > 0.1).length : 0})
              </h2>
            </div>
            {showFeatures ? <ChevronUp className="text-sky-400" /> : <ChevronDown className="text-slate-500" />}
          </button>

          <AnimatePresence>
            {showFeatures && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-slate-800"
              >
                <div className="p-8 overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500">
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
                        const badgeColor = isUp ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : 'text-teal-400 bg-teal-500/10 border-teal-500/20';
                        return (
                          <tr key={feat.raw_name} className="border-b border-slate-800/50 hover:bg-slate-900/30 transition-colors">
                            <td className="py-4 pl-4 text-xs font-bold text-slate-500">#{idx + 1}</td>
                            <td className="py-4 text-xs font-bold text-slate-300 uppercase tracking-widest">{formatName(feat.name)}</td>
                            <td className="py-4 text-xs font-mono text-slate-300 text-right pr-6 tabular-nums">{feat.pct.toFixed(2)}%</td>
                            <td className="py-4 text-xs font-mono text-slate-400 text-right pr-6 tabular-nums">{feat.value.toFixed(4)}</td>
                            <td className="py-4 text-center">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${badgeColor}`}>
                                {feat.direction}
                              </span>
                            </td>
                            <td className="py-4 align-middle">
                              <div className="h-1 w-full bg-slate-900 rounded overflow-hidden">
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

        {/* SECTION 5 — Model Explanation */}
        <section className="bg-[#0a0f1d] border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden">
          <button 
            onClick={() => setShowRules(!showRules)}
            className="w-full p-8 flex items-center justify-between hover:bg-slate-900/50 transition-colors focus:outline-none"
          >
            <div className="flex flex-col items-start gap-1">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-slate-800 rounded-lg text-slate-400">
                  <Target size={20} />
                </div>
                <h2 className="text-lg font-black text-white italic uppercase tracking-widest">Model Explanation</h2>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 pl-14">Feature contributions ranked by importance</p>
            </div>
            {showRules ? <ChevronUp className="text-sky-400" /> : <ChevronDown className="text-slate-500" />}
          </button>

          <AnimatePresence>
            {showRules && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-slate-800"
              >
                <div className="p-8 space-y-3">
                  {result.all_features?.filter(f => f.pct > 0.5).slice(0, 12).map((feat, idx) => {
                    const isUp = feat.direction === 'UP';
                    const maxPct = result.all_features.find(f => f.pct > 0.5)?.pct || 1;
                    const barPct = Math.min((feat.pct / maxPct) * 100, 100);
                    return (
                      <div key={`feat-${idx}`} className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl font-mono text-xs">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-slate-300 font-bold uppercase tracking-widest truncate mr-4">
                            #{idx + 1} {formatName(feat.name)}
                          </span>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${isUp ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : 'text-teal-400 bg-teal-500/10 border-teal-500/20'}`}>
                              {isUp ? '\u2191 higher' : '\u2193 lower'}
                            </span>
                            <span className="text-slate-400 tabular-nums">{feat.pct.toFixed(2)}%</span>
                          </div>
                        </div>
                        <div className="h-1 w-full bg-slate-900 rounded overflow-hidden">
                          <div className={`h-full ${isUp ? 'bg-rose-500' : 'bg-teal-500'} opacity-70`} style={{ width: `${barPct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {(!result.all_features || result.all_features.filter(f => f.pct > 0.5).length === 0) && (
                    <p className="text-slate-500 text-sm text-center py-6">No feature explanation data available for this session.</p>
                  )}
                  <div className="mt-6 pt-4 border-t border-slate-800 text-right font-mono text-[10px] uppercase tracking-widest font-black text-slate-500">
                    <p>Decision threshold: {result.threshold_used?.toFixed(2) || '0.65'} probability</p>
                    <p>Session score: {(result.probability * 100).toFixed(1)}%</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

                {/* SECTION 6 — Disclaimer */}
        <section className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-2xl flex items-start gap-4">
          <AlertTriangle className="text-amber-500 flex-shrink-0 mt-1" size={24} />
          <p className="text-amber-500 text-sm leading-relaxed font-medium">
            This result is a statistical screening signal only. It is not a clinical diagnosis. The model was trained on a research dataset and has not been clinically validated. Please consult a neurologist for any medical evaluation.
          </p>
        </section>

      </div>
    </div>
  );
}
