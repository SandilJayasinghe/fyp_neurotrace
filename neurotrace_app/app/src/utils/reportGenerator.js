/**
 * generateReportHTML — Tremora Professional Clinical Report
 * All SVG gauges use correct trigonometric arc math.
 */
export function generateReportHTML(result) {
  const timestamp = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  const dateOnly = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const prob      = Math.min(Math.max(result.probability ?? 0, 0), 0.9999);
  const probPct   = (prob * 100).toFixed(1);
  const threshold = result.threshold_used ?? 0.65;
  const isElevated = prob >= threshold;

  const riskColor  = isElevated ? '#dc2626' : '#16a34a';
  const riskBg     = isElevated ? '#fef2f2' : '#f0fdf4';
  const riskBorder = isElevated ? '#fca5a5' : '#86efac';
  const riskLabel  = isElevated ? 'Elevated Motor Signal' : 'Within Normal Range';

  // ═══════════════════════════════════════════════════════════
  //  SVG GAUGE HELPERS — proper semicircle trigonometry
  //  The gauge is a TOP semicircle:
  //    0%   → left  point (cx-R, cy)
  //    100% → right point (cx+R, cy)
  //  Angle formula: θ = (1 - p) × π  (p in 0..1)
  //  x = cx + R·cos(θ),  y = cy - R·sin(θ)   (SVG y-down, so minus for up)
  // ═══════════════════════════════════════════════════════════
  function gaugePoint(cx, cy, R, p) {
    const theta = (1 - Math.min(Math.max(p, 0), 0.9999)) * Math.PI;
    return {
      x: (cx + R * Math.cos(theta)).toFixed(2),
      y: (cy - R * Math.sin(theta)).toFixed(2),
    };
  }

  // ─── Main Risk Gauge ──────────────────────────────────────
  const GCX = 180, GCY = 160, GR = 130;
  const gStart   = { x: GCX - GR, y: GCY };   // 0%
  const gEnd     = { x: GCX + GR, y: GCY };   // 100%
  const gNeedle  = gaugePoint(GCX, GCY, GR, prob);

  // Gradient arc fills from start to needle (always short arc, sweep 0 = CCW = through top)
  const gLargeArc = prob > 0.5 ? 0 : 0; // always 0 — arc never exceeds 180°

  const ticks = [0, 25, 50, 75, 100].map(pct => {
    const p     = pct / 100;
    const inner = gaugePoint(GCX, GCY, GR - 14, p);
    const outer = gaugePoint(GCX, GCY, GR + 14, p);
    const label = gaugePoint(GCX, GCY, GR + 30, p);
    return { pct, inner, outer, label };
  });

  const gaugeSVG = `
<svg viewBox="30 20 310 200" xmlns="http://www.w3.org/2000/svg" width="340" height="190">
  <defs>
    <linearGradient id="riskGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#16a34a"/>
      <stop offset="40%"  stop-color="#d97706"/>
      <stop offset="70%"  stop-color="#ea580c"/>
      <stop offset="100%" stop-color="#dc2626"/>
    </linearGradient>
  </defs>
  <!-- Background track -->
  <path d="M ${gStart.x} ${gStart.y} A ${GR} ${GR} 0 0 0 ${gEnd.x} ${gEnd.y}"
        fill="none" stroke="#e5e7eb" stroke-width="22" stroke-linecap="round"/>
  <!-- Risk fill arc (0% → needle) -->
  <path d="M ${gStart.x} ${gStart.y} A ${GR} ${GR} 0 ${prob > 0.5 ? 1 : 0} 0 ${gNeedle.x} ${gNeedle.y}"
        fill="none" stroke="url(#riskGrad)" stroke-width="22" stroke-linecap="round"/>
  <!-- Scale ticks and labels -->
  ${ticks.map(t => `
    <line x1="${t.inner.x}" y1="${t.inner.y}" x2="${t.outer.x}" y2="${t.outer.y}"
          stroke="#9ca3af" stroke-width="1.5"/>
    <text x="${t.label.x}" y="${parseFloat(t.label.y)+4}" text-anchor="middle"
          font-size="11" fill="#6b7280" font-family="sans-serif">${t.pct}%</text>
  `).join('')}
  <!-- Needle shadow -->
  <line x1="${GCX}" y1="${GCY}" x2="${gNeedle.x}" y2="${gNeedle.y}"
        stroke="#00000022" stroke-width="5" stroke-linecap="round"/>
  <!-- Needle -->
  <line x1="${GCX}" y1="${GCY}" x2="${gNeedle.x}" y2="${gNeedle.y}"
        stroke="${riskColor}" stroke-width="3.5" stroke-linecap="round"/>
  <!-- Centre hub -->
  <circle cx="${GCX}" cy="${GCY}" r="9" fill="${riskColor}"/>
  <circle cx="${GCX}" cy="${GCY}" r="4" fill="white"/>
  <!-- Score text -->
  <text x="${GCX}" y="${GCY + 40}" text-anchor="middle" font-size="36"
        font-weight="800" fill="${riskColor}" font-family="sans-serif">${probPct}%</text>
  <text x="${GCX}" y="${GCY + 60}" text-anchor="middle" font-size="11"
        font-weight="600" fill="${riskColor}" font-family="sans-serif"
        letter-spacing="0.5">${riskLabel.toUpperCase()}</text>
</svg>`;

  // ─── Session Quality Mini Dial ────────────────────────────
  const sqScore  = Math.min(Math.max((result.session_quality?.score ?? 0) / 100, 0), 0.9999);
  const QCX = 100, QCY = 80, QR = 60;
  const sq       = result.session_quality || {};
  const sqColor  = sq.grade === 'Good' ? '#16a34a' : sq.grade === 'Fair' ? '#d97706' : '#dc2626';
  const qStart   = { x: QCX - QR, y: QCY };
  const qEnd     = { x: QCX + QR, y: QCY };
  const qNeedle  = gaugePoint(QCX, QCY, QR, sqScore);

  const qualityDial = `
<svg viewBox="25 10 155 110" xmlns="http://www.w3.org/2000/svg" width="200" height="130">
  <defs>
    <linearGradient id="qGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#dc2626"/>
      <stop offset="50%"  stop-color="#d97706"/>
      <stop offset="100%" stop-color="#16a34a"/>
    </linearGradient>
  </defs>
  <!-- Track -->
  <path d="M ${qStart.x} ${qStart.y} A ${QR} ${QR} 0 0 0 ${qEnd.x} ${qEnd.y}"
        fill="none" stroke="#e5e7eb" stroke-width="14" stroke-linecap="round"/>
  <!-- Fill -->
  <path d="M ${qStart.x} ${qStart.y} A ${QR} ${QR} 0 ${sqScore > 0.5 ? 1 : 0} 0 ${qNeedle.x} ${qNeedle.y}"
        fill="none" stroke="url(#qGrad)" stroke-width="14" stroke-linecap="round"/>
  <!-- Needle -->
  <line x1="${QCX}" y1="${QCY}" x2="${qNeedle.x}" y2="${qNeedle.y}"
        stroke="${sqColor}" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="${QCX}" cy="${QCY}" r="6" fill="${sqColor}"/>
  <circle cx="${QCX}" cy="${QCY}" r="3" fill="white"/>
  <!-- Labels -->
  <text x="${QCX}" y="${QCY + 28}" text-anchor="middle" font-size="22"
        font-weight="800" fill="${sqColor}" font-family="sans-serif">${sq.score ?? 0}%</text>
  <text x="${QCX}" y="${QCY + 46}" text-anchor="middle" font-size="11"
        font-weight="700" fill="${sqColor}" font-family="sans-serif">${sq.grade ?? 'N/A'}</text>
</svg>`;

  // ─── Feature Importance Bar Chart ────────────────────────
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
    const name  = f.name.length > 30 ? f.name.slice(0, 28) + '…' : f.name;
    return `
    <!-- Row ${i} -->
    <text x="0" y="${y + 14}" font-size="10.5" fill="#1f2937"
          font-family="monospace" font-weight="500">${name}</text>
    <!-- Track -->
    <rect x="0" y="${y + 20}" width="${BAR_W}" height="10" rx="4" fill="#f3f4f6"/>
    <!-- Bar -->
    <rect x="0" y="${y + 20}" width="${w.toFixed(1)}" height="10" rx="4"
          fill="${fill}" opacity="0.75"/>
    <!-- Percent label -->
    <text x="${w + 8}" y="${y + 30}" font-size="10" fill="${fill}"
          font-family="sans-serif" font-weight="700">${f.pct.toFixed(1)}%</text>
    <!-- Direction badge -->
    <rect x="${BAR_W + 80}" y="${y + 18}" width="60" height="16" rx="4"
          fill="${lightFill}" stroke="${border}" stroke-width="1"/>
    <text x="${BAR_W + 110}" y="${y + 30}" text-anchor="middle" font-size="9"
          fill="${fill}" font-family="sans-serif" font-weight="800">
      ${isUp ? '↑ HIGHER' : '↓ LOWER'}
    </text>`;
  }).join('')}
</svg>`;

  // ─── Full feature table rows ──────────────────────────────
  const allFeatRows = (result.all_features || [])
    .filter(f => f.pct > 0.3)
    .slice(0, 25)
    .map((f, i) => {
      const isUp = f.direction === 'UP';
      const c    = isUp ? '#dc2626' : '#16a34a';
      const bg   = i % 2 === 0 ? '#ffffff' : '#f9fafb';
      return `<tr style="background:${bg};">
        <td style="padding:5px 8px;font-size:10px;color:#9ca3af;border-bottom:1px solid #f3f4f6;">#${i+1}</td>
        <td style="padding:5px 8px;font-size:10px;color:#111827;font-family:monospace;border-bottom:1px solid #f3f4f6;">${f.name}</td>
        <td style="padding:5px 8px;text-align:center;border-bottom:1px solid #f3f4f6;">
          <span style="font-size:9px;font-weight:700;color:${c};background:${isUp?'#fef2f2':'#f0fdf4'};padding:2px 6px;border-radius:3px;border:1px solid ${c};">${isUp?'↑ Higher':'↓ Lower'}</span>
        </td>
        <td style="padding:5px 8px;font-size:10px;color:#374151;text-align:right;font-family:monospace;border-bottom:1px solid #f3f4f6;">${f.pct.toFixed(2)}%</td>
        <td style="padding:5px 8px;font-size:10px;color:#6b7280;text-align:right;font-family:monospace;border-bottom:1px solid #f3f4f6;">${f.value.toFixed(4)}</td>
      </tr>`;
    }).join('');

  const ki = result.keyboard_info || {};

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Tremora Analysis Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body {
      width: 210mm;
      background: #ffffff;
      font-family: 'Inter', -apple-system, sans-serif;
      color: #111827;
      font-size: 12px;
    }
    body { padding: 13mm 15mm; }
    .page-break { page-break-before: always; padding-top: 13mm; }

    .report-header {
      display:flex; justify-content:space-between; align-items:flex-start;
      border-bottom: 3px solid #0ea5e9; padding-bottom: 14px; margin-bottom: 18px;
    }
    .logo-area { display:flex; align-items:center; gap:12px; }
    .logo-circle {
      width:44px; height:44px; border-radius:12px;
      background:linear-gradient(135deg,#0ea5e9,#6366f1);
      display:flex; align-items:center; justify-content:center;
      font-size:16px; font-weight:900; color:white;
    }
    .section-heading {
      font-size:9px; font-weight:700; letter-spacing:2px;
      text-transform:uppercase; color:#6b7280;
      border-bottom:1px solid #e5e7eb; padding-bottom:6px; margin-bottom:12px;
    }
    .card { border:1px solid #e5e7eb; border-radius:10px; padding:14px; margin-bottom:12px; }
    .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; }
    .grid-4 { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:10px; margin-bottom:12px; }
    .metric-box {
      background:#f8fafc; border:1px solid #e5e7eb; border-radius:8px;
      padding:10px 12px; text-align:center;
    }
    .metric-label { font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#9ca3af; margin-bottom:4px; }
    .metric-value { font-size:20px; font-weight:800; }
    .metric-sub   { font-size:9px; color:#9ca3af; margin-top:2px; }
    table { width:100%; border-collapse:collapse; }
    thead th {
      background:#f1f5f9; font-size:8.5px; font-weight:700; text-transform:uppercase;
      letter-spacing:1px; color:#6b7280; padding:8px; text-align:left;
    }
    .disclaimer {
      background:#fffbeb; border:1px solid #fde68a; border-radius:8px;
      padding:12px; font-size:10px; color:#92400e; line-height:1.6; margin-top:12px;
    }
    * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  </style>
</head>
<body>

<!-- ═══════════════════ PAGE 1 ═══════════════════ -->

<div class="report-header">
  <div class="logo-area">
    <div class="logo-circle">NT</div>
    <div>
      <div style="font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">Tremora</div>
      <div style="font-size:10px;color:#64748b;font-weight:500;">Motor Assessment System — Keystroke Biometric Analysis</div>
    </div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:13px;font-weight:700;color:#0f172a;">Analysis Report</div>
    <div style="font-size:10px;color:#64748b;margin-top:3px;">${dateOnly}</div>
    <div style="font-size:9px;color:#9ca3af;margin-top:2px;font-family:monospace;">Session: ${result.session_id ?? 'N/A'}</div>
    <div style="margin-top:6px;">
      <span style="font-size:9px;font-weight:700;padding:3px 9px;border-radius:4px;
                   background:${riskBg};border:1px solid ${riskBorder};color:${riskColor};">
        ${riskLabel.toUpperCase()}
      </span>
    </div>
  </div>
</div>

<!-- RESULT BANNER -->
<div style="border-radius:10px;padding:12px 18px;border:1.5px solid ${riskBorder};
            background:${riskBg};display:flex;align-items:center;gap:14px;margin-bottom:14px;">
  <div style="font-size:26px;">${isElevated ? '⚠' : '✓'}</div>
  <div>
    <div style="font-size:13px;font-weight:800;color:${riskColor};">${riskLabel}</div>
    <div style="font-size:10px;color:${isElevated?'#b91c1c':'#15803d'};margin-top:3px;">
      Probability Score: <strong>${probPct}%</strong> &nbsp;|&nbsp;
      Decision Threshold: ${(threshold*100).toFixed(0)}% &nbsp;|&nbsp;
      Confidence: <strong>${result.confidence_band ?? 'N/A'}</strong>
    </div>
  </div>
</div>

<!-- METRICS -->
<div class="grid-4">
  <div class="metric-box">
    <div class="metric-label">Risk Score</div>
    <div class="metric-value" style="color:${riskColor};">${probPct}%</div>
    <div class="metric-sub">Thresh: ${(threshold*100).toFixed(0)}%</div>
  </div>
  <div class="metric-box">
    <div class="metric-label">Keystrokes</div>
    <div class="metric-value" style="color:#0f172a;">${result.n_keystrokes ?? '—'}</div>
    <div class="metric-sub">${result.n_windows ?? 0} windows</div>
  </div>
  <div class="metric-box">
    <div class="metric-label">L/R Ratio</div>
    <div class="metric-value" style="color:#0f172a;">${result.lr_ratio?.toFixed(2) ?? '—'}</div>
    <div class="metric-sub">${result.left_count ?? 0}L / ${result.right_count ?? 0}R</div>
  </div>
  <div class="metric-box">
    <div class="metric-label">Quality</div>
    <div class="metric-value" style="font-size:18px;color:${sq.grade==='Good'?'#16a34a':sq.grade==='Fair'?'#d97706':'#dc2626'};">${sq.grade ?? '—'}</div>
    <div class="metric-sub">${sq.score ?? 0}%</div>
  </div>
</div>

<!-- GAUGE + VERDICT -->
<div class="grid-2">
  <div class="card" style="display:flex;flex-direction:column;align-items:center;background:#f8fafc;">
    <div class="section-heading" style="width:100%;text-align:center;border:none;">Risk Probability Gauge</div>
    ${gaugeSVG}
    <div style="display:flex;gap:14px;margin-top:4px;">
      ${[['#16a34a','Low Risk'],['#d97706','Moderate'],['#dc2626','Elevated']].map(([c,l]) =>
        `<span style="display:flex;align-items:center;gap:4px;font-size:9px;color:#6b7280;">
          <span style="display:inline-block;width:14px;height:4px;background:${c};border-radius:2px;"></span>${l}
        </span>`).join('')}
    </div>
  </div>

  <div class="card" style="background:#f8fafc;">
    <div class="section-heading">Clinical Interpretation</div>
    <p style="font-size:11px;line-height:1.8;color:#374151;margin-bottom:14px;">${result.verdict ?? '—'}</p>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:7px;padding:10px;font-size:10px;color:#1e40af;">
      <strong>Model Performance</strong><br/>
      AUC: ${result.aim_auc?.toFixed(3) ?? '—'} &nbsp;|&nbsp;
      Sensitivity: ${((result.aim_sensitivity??0)*100).toFixed(1)}% &nbsp;|&nbsp;
      Specificity: ${((result.aim_specificity??0)*100).toFixed(1)}%
    </div>
  </div>
</div>

<!-- TOP 5 FEATURE CHART -->
<div class="card">
  <div class="section-heading">Diagnostic Signatures — Top 5 Contributing Features</div>
  <p style="font-size:10px;color:#6b7280;margin-bottom:12px;">
    Ranked by model importance contribution.
    <span style="color:#dc2626;font-weight:600;">↑ Higher</span> = above training cohort median;
    <span style="color:#16a34a;font-weight:600;">↓ Lower</span> = below median.
  </p>
  ${featureChart}
</div>

<!-- KEYBOARD + QUALITY -->
<div class="grid-2">
  <div class="card">
    <div class="section-heading">Capture Hardware</div>
    <table>
      <tr><td style="padding:5px 0;font-size:10px;color:#6b7280;width:48%;">Keyboard</td>
          <td style="padding:5px 0;font-size:10px;font-weight:600;color:#0f172a;">${ki.keyboard_name ?? 'Unknown'}</td></tr>
      <tr><td style="padding:5px 0;font-size:10px;color:#6b7280;">Polling Rate</td>
          <td style="padding:5px 0;font-size:11px;font-weight:800;color:#0ea5e9;">${ki.polling_hz ?? 125} Hz</td></tr>
      <tr><td style="padding:5px 0;font-size:10px;color:#6b7280;">Timing Resolution</td>
          <td style="padding:5px 0;font-size:10px;">±${ki.min_measurable_ht_ms?.toFixed(1) ?? '?'} ms</td></tr>
      <tr><td style="padding:5px 0;font-size:10px;color:#6b7280;">Detection</td>
          <td style="padding:5px 0;font-size:10px;color:#374151;">${ki.detection_method ?? '—'} (${ki.detection_confidence ?? '—'})</td></tr>
    </table>
  </div>
  <div class="card" style="display:flex;flex-direction:column;align-items:center;background:#f8fafc;">
    <div class="section-heading" style="width:100%;text-align:center;border:none;">Session Quality</div>
    ${qualityDial}
    <table style="width:100%;margin-top:4px;">
      <tr><td style="font-size:10px;color:#6b7280;">Spike Rate</td>
          <td style="font-size:10px;font-weight:600;text-align:right;">${sq.spike_ratio ?? 0}%</td></tr>
      <tr><td style="font-size:10px;color:#6b7280;">Windows</td>
          <td style="font-size:10px;font-weight:600;text-align:right;">${result.n_windows ?? 0}</td></tr>
    </table>
  </div>
</div>

<div class="disclaimer">
  <strong>⚠ Medical Disclaimer:</strong> This report is a statistical screening signal generated by the
  Tremora research prototype. It does <strong>not</strong> constitute a clinical diagnosis.
  The model was trained on the Tappy Keystroke Dataset (Adams, 2017 — PLOS ONE) and has not been
  clinically validated. Consult a qualified neurologist for any medical evaluation.
</div>

<!-- ═══════════════════ PAGE 2 ═══════════════════ -->
<div class="page-break">
  <div style="display:flex;justify-content:space-between;align-items:center;
              border-bottom:2px solid #0ea5e9;padding-bottom:10px;margin-bottom:16px;">
    <div style="font-size:14px;font-weight:800;color:#0f172a;">Full Feature Breakdown</div>
    <div style="font-size:10px;color:#9ca3af;">Session: ${result.session_id ?? 'N/A'} &nbsp;|&nbsp; ${dateOnly}</div>
  </div>

  <p style="font-size:10px;color:#6b7280;margin-bottom:12px;">
    Features ranked by importance (≥0.3% contribution). Scaled Value = z-score relative to training population.
  </p>

  <table>
    <thead>
      <tr>
        <th style="width:5%;">#</th>
        <th style="width:42%;">Feature</th>
        <th style="width:14%;text-align:center;">Direction</th>
        <th style="width:14%;text-align:right;">Importance</th>
        <th style="width:15%;text-align:right;">Scaled Value</th>
      </tr>
    </thead>
    <tbody>${allFeatRows}</tbody>
  </table>

  <div class="grid-2" style="margin-top:16px;">
    <div class="card">
      <div class="section-heading">Reliability Notes</div>
      <p style="font-size:10px;color:#374151;line-height:1.7;">
        ${result.reliability_note || 'No reliability concerns flagged for this session.'}
      </p>
      ${(result.unreliable_features || []).length > 0 ? `
        <p style="font-size:10px;color:#d97706;margin-top:8px;font-weight:600;">Downweighted features:</p>
        <ul style="margin-left:14px;margin-top:4px;">
          ${result.unreliable_features.map(f => `<li style="font-size:9px;color:#92400e;font-family:monospace;">${f}</li>`).join('')}
        </ul>` : ''}
    </div>
    <div class="card">
      <div class="section-heading">Study Reference</div>
      <p style="font-size:11px;color:#374151;line-height:1.75;">
        The predictive model was trained on the Tappy Keystroke Dataset:
      </p>
      <p style="font-size:11px;font-style:italic;color:#0f172a;margin-top:8px;line-height:1.6;">
        "High-accuracy detection of early Parkinson's Disease using multiple characteristics
        of finger movement while typing"
      </p>
      <p style="font-size:10px;color:#6b7280;margin-top:4px;">Warwick R. Adams — PLOS ONE, 2017</p>
      <p style="font-size:9px;color:#0ea5e9;margin-top:3px;">doi:10.1371/journal.pone.0188226</p>
    </div>
  </div>

  <div style="margin-top:16px;padding-top:10px;border-top:1px solid #e5e7eb;
              display:flex;justify-content:space-between;font-size:9px;color:#9ca3af;">
    <span>Tremora Motor Assessment System &nbsp;|&nbsp; Confidential Research Report</span>
    <span>Generated: ${timestamp}</span>
  </div>
</div>

</body>
</html>`;
}
