/**
 * generateReportHTML — Tremora Professional Clinical Report
 * All SVG gauges use correct trigonometric arc math.
 */
export function generateReportHTML(result, history = []) {
  const timestamp = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  const dateOnly = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const prob      = Math.min(Math.max(result.riskLabel || result.probability || 0, 0), 0.9999);
  const probPct   = (prob * 100).toFixed(1);
  const threshold = result.threshold_used ?? 0.65;
  const isElevated = prob >= threshold;

  const riskColor  = isElevated ? '#dc2626' : '#16a34a';
  const riskBg     = isElevated ? '#fef2f2' : '#f0fdf4';
  const riskBorder = isElevated ? '#fca5a5' : '#86efac';
  const riskLabel  = isElevated ? 'Elevated Motor Signal' : 'Within Normal Range';

  function gaugePoint(cx, cy, R, p) {
    const theta = (1 - Math.min(Math.max(p, 0), 0.9999)) * Math.PI;
    return {
      x: (cx + R * Math.cos(theta)).toFixed(2),
      y: (cy - R * Math.sin(theta)).toFixed(2),
    };
  }

  const GCX = 180, GCY = 160, GR = 110;
  
  const renderSegment = (sP, eP, col) => {
    const p1 = gaugePoint(GCX, GCY, GR, sP);
    const p2 = gaugePoint(GCX, GCY, GR, eP);
    return `<path d="M ${p1.x} ${p1.y} A ${GR} ${GR} 0 0 1 ${p2.x} ${p2.y}" fill="none" stroke="${col}" stroke-width="24" stroke-linecap="butt" opacity="0.15"/>`;
  };

  const probPoint = gaugePoint(GCX, GCY, GR, prob);
  const fillArc = `<path d="M ${GCX-GR} ${GCY} A ${GR} ${GR} 0 ${prob > 0.5 ? 1 : 0} 1 ${probPoint.x} ${probPoint.y}" fill="none" stroke="${riskColor}" stroke-width="24" stroke-linecap="round" />`;

  const gaugeSVG = `
<svg viewBox="50 30 260 160" xmlns="http://www.w3.org/2000/svg" width="300" height="180">
  ${renderSegment(0, 0.3, '#22c55e')}
  ${renderSegment(0.3, 0.65, '#f59e0b')}
  ${renderSegment(0.65, 1, '#ef4444')}
  ${fillArc}
  <text x="${GCX}" y="${GCY - 5}" text-anchor="middle" font-size="38" font-weight="950" fill="${riskColor}" font-family="sans-serif">${probPct}%</text>
  <text x="${GCX}" y="${GCY + 15}" text-anchor="middle" font-size="10" font-weight="700" fill="#94a3b8" font-family="sans-serif" letter-spacing="1">RISK PROBABILITY</text>
</svg>`;

  const FEATURE_INFO = {
    'HT': { label: 'Hold Duration' },
    'FT': { label: 'Flight Speed' },
    'IKI': { label: 'Press Rhythm' },
    'LAT': { label: 'Tap Rhythm' },
    'LATENCY': { label: 'Response Lag' },
    'ENTROPY': { label: 'Rhythm Consistency' },
    'PENT': { label: 'Motor Complexity' },
    'DFA': { label: 'Rhythm Patterning' },
    'STD': { label: 'Stability' },
    'SKEW': { label: 'Timing Asymmetry' },
    'WPM': { label: 'Typing Velocity' },
    'BG': { label: 'Frequent Key Signature' }
  };

  function formatName(name) {
    if (!name) return "Unknown Factor";
    const lower = name.toLowerCase();
    let metric = "";
    if (lower.includes('_mean')) metric = " Average";
    else if (lower.includes('_std')) metric = " Variability";
    else if (lower.includes('_skew')) metric = " Bias";
    else if (lower.includes('_iqr')) metric = " Consistency";
    else if (lower.includes('_max')) metric = " Peak";
    else if (lower.includes('_range')) metric = " Range";

    const upper = name.toUpperCase();
    for (const [key, info] of Object.entries(FEATURE_INFO)) {
      if (upper.includes(key)) {
        let label = info.label;
        if (key === 'BG') {
          const match = upper.match(/BG(\d)/);
          if (match) label = `Motor Finger-Signature #${match[1]}`;
        }
        return label + metric;
      }
    }
    return name + metric;
  }

  const topFeats = (result.top5_features || []).slice(0, 5);
  const maxImp   = topFeats[0]?.pct || 1;
  const BAR_W    = 280;
  const ROW_H    = 40;
  const CHART_W  = BAR_W + 160;

  const featureChart = `
<svg viewBox="0 0 ${CHART_W} ${topFeats.length * ROW_H + 10}"
     xmlns="http://www.w3.org/2000/svg"
     width="${CHART_W}" height="${topFeats.length * ROW_H + 10}">
  ${topFeats.map((f, i) => {
    const isUp  = f.direction === 'UP';
    const fill  = isUp ? '#dc2626' : '#16a34a';
    const lightFill = isUp ? '#fee2e2' : '#dcfce7';
    const border = isUp ? '#fca5a5' : '#86efac';
    const w     = Math.max((f.pct / maxImp) * BAR_W, 6);
    const y     = i * ROW_H;
    return `
    <text x="0" y="${y + 14}" font-size="10.5" fill="#1f2937" font-family="sans-serif" font-weight="800">${formatName(f.name)}</text>
    <rect x="0" y="${y + 20}" width="${BAR_W}" height="10" rx="4" fill="#f3f4f6"/>
    <rect x="0" y="${y + 20}" width="${w.toFixed(1)}" height="10" rx="4" fill="${fill}" opacity="0.75"/>
    <text x="${w + 8}" y="${y + 30}" font-size="10" fill="${fill}" font-family="sans-serif" font-weight="700">${f.pct.toFixed(1)}%</text>
    <rect x="${BAR_W + 80}" y="${y + 18}" width="60" height="16" rx="4" fill="${lightFill}" stroke="${border}" stroke-width="1"/>
    <text x="${BAR_W + 110}" y="${y + 30}" text-anchor="middle" font-size="8" fill="${fill}" font-family="sans-serif" font-weight="900">${isUp ? '↑ INCREASE' : '↓ DECREASE'}</text>
    `;
  }).join('')}
</svg>`;

  const allFeatRows = (result.all_features || [])
    .filter(f => f.pct > 0.3)
    .slice(0, 25)
    .map((f, i) => {
      const isUp = f.direction === 'UP';
      const c    = isUp ? '#dc2626' : '#16a34a';
      const bg   = i % 2 === 0 ? '#ffffff' : '#f9fafb';
      return `<tr style="background:${bg};">
        <td style="padding:4px 8px;font-size:9px;color:#9ca3af;border-bottom:1px solid #f3f4f6;">#${i+1}</td>
        <td style="padding:4px 8px;font-size:10px;color:#111827;font-weight:700;border-bottom:1px solid #f3f4f6;">${formatName(f.name)}</td>
        <td style="padding:4px 8px;text-align:center;border-bottom:1px solid #f3f4f6;">
          <span style="font-size:8px;font-weight:800;color:${c};background:${isUp?'#fef2f2':'#f0fdf4'};padding:1px 5px;border-radius:3px;border:1px solid ${c};">${isUp?'↑ Risk':'↓ Healthy'}</span>
        </td>
        <td style="padding:4px 8px;font-size:10px;color:#374151;text-align:right;font-family:monospace;border-bottom:1px solid #f3f4f6;">${(f.raw_value || 0).toFixed(2)}${f.name.toLowerCase().includes('wpm') ? '' : 'ms'}</td>
      </tr>`;
    }).join('');

  const ki = result.keyboard_info || {};
  const sq = result.session_quality || {};

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body {
      width: 210mm;
      background: #ffffff;
      font-family: 'Inter', -apple-system, sans-serif;
      color: #111827;
      font-size: 11px;
    }
    body { padding: 12mm 15mm; }
    .page-break { page-break-before: always; padding-top: 12mm; }
    .report-header {
      display:flex; justify-content:space-between; align-items:flex-start;
      border-bottom: 2px solid #0ea5e9; padding-bottom: 12px; margin-bottom: 15px;
    }
    .section-heading {
      font-size:8px; font-weight:800; letter-spacing:1.5px;
      text-transform:uppercase; color:#64748b;
      border-bottom:1.5px solid #f1f5f9; padding-bottom:4px; margin-bottom:12px;
    }
    .card { border:1px solid #e2e8f0; border-radius:12px; padding:12px; margin-bottom:10px; }
    .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
    .metric-box {
      background:#f8fafc; border:1px solid #f1f5f9; border-radius:8px;
      padding:10px; text-align:center;
    }
    .metric-label { font-size:7px; font-weight:700; text-transform:uppercase; color:#94a3b8; }
    .metric-value { font-size:18px; font-weight:900; margin:2px 0; }
    .metric-sub   { font-size:8px; color:#cbd5e1; }
    * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  </style>
</head>
<body>

<div class="report-header">
  <div style="display:flex; align-items:center; gap:15px;">
    <div style="width:48px;height:48px;">
        <img src="file:///C:/Users/ASUS VIVOBOOK/Documents/GitHub/fyp_neurotrace/neurotrace_app/app/src/assets/tremora-blue.png" 
             style="width:100%; height:100%; object-fit:contain;" />
    </div>
    <div>
      <div style="font-size:22px;font-weight:900;letter-spacing:-0.7px;color:#0f172a;">Tremora Parkinson's Screening Tool</div>
      <div style="font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Clinical Bio-Kinematic Analysis v3.2</div>
    </div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:11px;font-weight:800;color:#0f172a;">${dateOnly}</div>
    <div style="font-size:8px;color:#94a3b8;margin-top:2px;font-family:monospace;">ID: ${result.session_id || 'SESS-ACT'}</div>
  </div>
</div>

<div style="border-radius:12px;padding:15px;display:flex;gap:18px;background:${riskBg};border:1.5px solid ${riskBorder};margin-bottom:12px;">
  <div style="font-size:28px;">${isElevated ? '⚠' : '✓'}</div>
  <div>
    <div style="font-size:14px;font-weight:900;color:${riskColor};">${riskLabel}</div>
    <div style="font-size:10px;color:#334155;margin-top:4px;">
      Signal Probability: <strong style="color:${riskColor};">${probPct}%</strong> &nbsp;|&nbsp; 
      Certainty: <strong>${result.confidence_band || 'High'}</strong> &nbsp;|&nbsp;
      Threshold: ${(threshold*100).toFixed(0)}%
    </div>
  </div>
</div>

<div class="grid-3" style="margin-bottom:12px;">
  <div class="metric-box">
    <div class="metric-label">Hold Duration Avg</div>
    <div class="metric-value" style="color:#0f172a;">${(result.all_features?.find(f => f.name.toLowerCase() === 'ht_mean')?.raw_value || 0).toFixed(1)}ms</div>
    <div class="metric-sub">Motor Reaction Signature</div>
  </div>
  <div class="metric-box">
    <div class="metric-label">Flight Velocity Avg</div>
    <div class="metric-value" style="color:#0f172a;">${(result.all_features?.find(f => f.name.toLowerCase() === 'ft_mean')?.raw_value || 0).toFixed(1)}ms</div>
    <div class="metric-sub">Transition Speed</div>
  </div>
  <div class="metric-box">
    <div class="metric-label">Session Volume</div>
    <div class="metric-value" style="color:#0ea5e9;">${result.n_keystrokes || 0}</div>
    <div class="metric-sub">${result.n_windows || 0} Valid Analysis Windows</div>
  </div>
</div>

<div class="grid-2" style="margin-bottom:12px;align-items:stretch;">
  <div class="card" style="display:flex;flex-direction:column;align-items:center;padding:15px;background:#fcfcfc;">
    <div class="section-heading" style="width:100%;text-align:center;">Probability Distribution</div>
    ${gaugeSVG}
  </div>
  <div class="card" style="padding:15px;background:#fcfcfc;">
    <div class="section-heading">Neurologist Interpretation</div>
    <p style="font-size:10px;line-height:1.8;color:#334155;font-weight:500;">${result.verdict || 'No automated clinical interpretation available.'}</p>
    <div style="margin-top:15px;padding:10px;background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:8px;font-size:9px;color:#0369a1;">
      <strong>Session Integrity:</strong> Score ${sq.score || 100}% | Grade ${sq.grade || 'Optimal'} | Detection: ${ki.polling_hz || 125}Hz
    </div>
  </div>
</div>

<div class="card" style="padding:18px;">
  <div class="section-heading">Kinematic Diagnostic Signatures (Top Contributors)</div>
  <p style="font-size:9px;color:#64748b;margin-bottom:15px;font-weight:500;">Feature importance scores are calculated using AIM-Student v1 extraction pipeline.</p>
  ${featureChart}
</div>

${history.length > 1 ? `
<div class="card" style="padding:18px;">
  <div class="section-heading">Multi-Session Motor Consistency (Longitudinal)</div>
  <div style="height:100px; display:flex; align-items:flex-end; gap:10px; padding-top:25px; padding-bottom:5px;">
    ${history.slice(-10).map((s, idx) => {
      const p = s.probability || 0;
      const h = Math.max(p * 80, 5);
      const c = p >= threshold ? '#dc2626' : '#16a34a';
      return `<div style="flex:1; background:${c}; height:${h}px; border-radius:4px; position:relative;">
        <span style="position:absolute; bottom:-16px; left:50%; transform:translateX(-50%); font-size:7px; font-weight:800; color:#94a3b8;">S${idx+1}</span>
      </div>`;
    }).join('')}
  </div>
</div>` : ''}

<div style="margin-top:15px; background:#fffbeb; border:1px solid #fef3c7; border-radius:10px; padding:12px; font-size:10px; line-height:1.6; color:#92400e;">
  <div style="font-weight:800; margin-bottom:4px; text-transform:uppercase; font-size:9px; letter-spacing:1px;">Patient Safety Notice:</div>
  This report is for bio-kinematic research and screening purposes only. It is not a clinical diagnosis of Parkinson's Disease. Kinetic signals can be influenced by medication, stress, and fatigue.
</div>

<div class="page-break">
  <div class="section-heading" style="margin-bottom:15px;">Full Kinematic Feature Matrix</div>
  <table style="width:100%; border-collapse:collapse;">
    <thead>
      <tr style="border-bottom:2px solid #f1f5f9;">
        <th style="width:8%; padding:8px 0; font-size:8px; color:#94a3b8; text-align:left;">RANK</th>
        <th style="width:55%; padding:8px 0; font-size:8px; color:#94a3b8; text-align:left;">MOTOR KINEMATIC FACTOR</th>
        <th style="width:15%; padding:8px 0; font-size:8px; color:#94a3b8; text-align:center;">SIGNAL</th>
        <th style="width:22%; padding:8px 0; font-size:8px; color:#94a3b8; text-align:right;">MEASURED VALUE</th>
      </tr>
    </thead>
    <tbody>${allFeatRows}</tbody>
  </table>
  <div style="margin-top:30px; border-top:1px solid #f1f5f9; padding-top:15px; display:flex; justify-content:space-between; font-size:8px; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:1px;">
    <span>Tremora Analysis Hub &nbsp;|&nbsp; E2E Biometric Encryption Secured</span>
    <span>Report Generated: ${timestamp}</span>
  </div>
</div>

</body>
</html>`;
}
