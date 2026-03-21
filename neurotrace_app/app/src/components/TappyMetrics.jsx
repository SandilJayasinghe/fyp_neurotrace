import React from 'react';
import { Database, MousePointer2, Clock, Activity, Zap, Layers } from 'lucide-react';

export function TappyMetrics({ 
    keystrokeCount, 
    leftCount, 
    rightCount, 
    liveMetrics 
}) {
    const { meanHT, meanIKI, meanFT, rhythm } = liveMetrics;

    const cards = [
        { label: 'Valid Keys', value: keystrokeCount, sub: `of 300 target`, icon: Database, color: 'text-brand-600' },
        { label: 'Left (A)', value: leftCount, sub: 'keystrokes', icon: MousePointer2, color: 'text-indigo-600' },
        { label: 'Right (L)', value: rightCount, sub: 'keystrokes', icon: Zap, color: 'text-rose-600' },
        { label: 'Mean Hold', value: `${meanHT} ms`, sub: 'hold time', icon: Clock, color: 'text-slate-600' },
        { label: 'Mean IKI', value: `${meanIKI} ms`, sub: 'inter-key interval', icon: Activity, color: 'text-slate-600' },
        { label: 'Rhythm CoV', value: rhythm, sub: 'timing variability', icon: Layers, color: 'text-brand-600' }
    ];

    return (
        <div className="grid grid-cols-6 gap-4 w-full max-w-6xl mx-auto my-10">
            {cards.map((c, i) => (
                <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-lg shadow-slate-200/50 flex flex-col items-center">
                    <div className={`p-2 rounded-xl bg-slate-50 mb-4 ${c.color}`}>
                        <c.icon size={20} />
                    </div>
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1 leading-none">{c.label}</p>
                    <p className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">{c.value}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">{c.sub}</p>
                </div>
            ))}
        </div>
    );
}
