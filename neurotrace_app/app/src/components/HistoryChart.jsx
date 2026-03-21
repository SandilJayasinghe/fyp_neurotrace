import React, { useEffect, useRef } from 'react';

/**
 * Historical probability chart using native Canvas 2D.
 * points: [{ timestamp, probability }]
 */
export function HistoryChart({ points = [] }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const padding = 40;
        
        ctx.clearRect(0, 0, w, h);

        if (points.length === 0) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No analyses yet — collect 500+ keystrokes', w/2, h/2);
            return;
        }

        const usableW = w - padding * 2;
        const usableH = h - padding * 2;

        // Draw Threshold line (0.5 or model threshold)
        ctx.strokeStyle = '#fca5a5';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        const ty = padding + usableH - (0.5 * usableH); // assuming 0.5 threshold
        ctx.moveTo(padding, ty);
        ctx.lineTo(w - padding, ty);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label threshold
        ctx.fillStyle = '#ef4444';
        ctx.font = 'black 9px sans-serif';
        ctx.fillText('THRESHOLD', padding + 5, ty - 5);

        // Map points
        const xStep = points.length > 1 ? usableW / (points.length - 1) : 0;
        const mappedPoints = points.map((p, i) => ({
            x: padding + (i * xStep),
            y: padding + usableH - (p.probability * usableH)
        }));

        // Draw Path
        ctx.strokeStyle = '#4f6ef7';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(mappedPoints[0].x, mappedPoints[0].y);
        mappedPoints.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();

        // Draw Area
        const gradient = ctx.createLinearGradient(0, padding, 0, h - padding);
        gradient.addColorStop(0, 'rgba(79, 110, 247, 0.2)');
        gradient.addColorStop(1, 'rgba(79, 110, 247, 0)');
        ctx.fillStyle = gradient;
        ctx.lineTo(mappedPoints[mappedPoints.length - 1].x, h - padding);
        ctx.lineTo(padding, h - padding);
        ctx.closePath();
        ctx.fill();

        // Points
        mappedPoints.forEach((p, i) => {
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#4f6ef7';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });

    }, [points]);

    return (
        <canvas 
            ref={canvasRef} 
            width={800} 
            height={300} 
            className="w-full h-[200px] rounded-3xl" 
        />
    );
}
