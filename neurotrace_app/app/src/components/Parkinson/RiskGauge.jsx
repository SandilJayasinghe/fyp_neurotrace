import React from 'react';

export function RiskGauge({ probability }) {
  const pct = Math.round((probability || 0) * 100);
  const color = pct < 30 ? '#22c55e' : pct < 60 ? '#f59e0b' : '#ef4444';
  const label = pct < 30 ? 'Low Risk Signal'
              : pct < 60 ? 'Moderate Signal'
              : 'Elevated Signal';

  // SVG arc gauge — 0° = left, 180° = right, semicircle
  const r = 80; const cx = 110; const cy = 110;
  const startAngle = Math.PI;
  const endAngle   = startAngle + (pct / 100) * Math.PI;
  const xIndicator = cx + r * Math.cos(endAngle);
  const yIndicator = cy + r * Math.sin(endAngle);

  // Helper to draw perfectly partitioned arc segments
  const renderSegment = (startPct, endPct, colorCode) => {
    const sA = Math.PI + (startPct / 100) * Math.PI;
    const eA = Math.PI + (endPct / 100) * Math.PI;
    const px1 = cx + r * Math.cos(sA);
    const py1 = cy + r * Math.sin(sA);
    const px2 = cx + r * Math.cos(eA);
    const py2 = cy + r * Math.sin(eA);
    return (
      <path 
        d={`M ${px1} ${py1} A ${r} ${r} 0 0 1 ${px2} ${py2}`}
        fill="none" 
        stroke={colorCode} 
        strokeWidth="22" 
        strokeLinecap="butt" 
        opacity="0.25"
      />
    );
  };

  return (
    <div className="flex flex-col items-center bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl max-w-sm mx-auto">
      <div className="relative mb-6">
        <svg width="220" height="135" viewBox="0 0 220 135">
            {/* Multi-colored background track */}
            {renderSegment(0, 30, '#22c55e')}
            {renderSegment(30, 60, '#f59e0b')}
            {renderSegment(60, 100, '#ef4444')}
            
            {/* Apply rounded caps to the ends of the background track */}
            <circle cx={cx - r} cy={cy} r={11} fill="#22c55e" opacity="0.25" />
            <circle cx={cx + r} cy={cy} r={11} fill="#ef4444" opacity="0.25" />

            {/* Foreground Fill: dynamic color up to current percent */}
            <path 
                d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${xIndicator} ${yIndicator}`}
                fill="none" 
                stroke={color} 
                strokeWidth="22" 
                strokeLinecap="round" 
                className="transition-all duration-1000 ease-out" 
            />
            
            <text x={cx} y={cy - 10} textAnchor="middle" className="text-4xl font-black transition-all" fill={color}>
                {pct}%
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="bold" className="uppercase tracking-[0.2em]">
                Risk Probability
            </text>
        </svg>
      </div>

      <div className="text-center px-4">
        <h3 className="text-2xl font-black leading-tight mb-3 uppercase tracking-tighter" style={{ color }}>{label}</h3>
        <p className="text-slate-500 text-[13px] font-medium leading-relaxed">
            The screening model indicates a {pct}% statistical likelihood of Parkinsonian keystroke dynamics in this session.
        </p>
      </div>
    </div>
  );
}
