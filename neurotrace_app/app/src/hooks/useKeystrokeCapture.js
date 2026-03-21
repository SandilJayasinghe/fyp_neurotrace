import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const API = 'http://127.0.0.1:8421';

export function useKeystrokeCapture() {
  const [state, setState] = useState('IDLE'); // IDLE|WARMUP|ACTIVE|PROCESSING|RESULTS
  const [count, setCount] = useState(0);
  const [result, setResult] = useState(null);
  const [liveMetrics, setLiveMetrics] = useState({ meanHT: 0, meanIKI: 0, wpm: 0 });
  const htWindow = useRef([]);
  const ikWindow = useRef([]);
  const startTime = useRef(null);
  const charCount  = useRef(0);

  useEffect(() => {
    if (!window.electron) { 
        console.warn("Electron IPC NOT DEFINED. Make sure you are running in Electron.");
        return; 
    }
    const unsub = window.electron.ipcRenderer.on('keystroke-count', (payload) => {
      const { count: n, last } = payload;
      
      // Rolling 20-stroke window for live metrics
      htWindow.current.push(last.hold_time);
      if (last.latency) ikWindow.current.push(last.latency);
      if (htWindow.current.length > 20) htWindow.current.shift();
      if (ikWindow.current.length > 20) ikWindow.current.shift();

      const meanHT  = htWindow.current.reduce((a, b) => a + b, 0) / Math.max(htWindow.current.length, 1);
      const meanIKI = ikWindow.current.length > 0
        ? ikWindow.current.reduce((a, b) => a + b, 0) / ikWindow.current.length : 0;
      
      charCount.current += 1;
      const elapsed = (Date.now() - startTime.current) / 60000; // minutes
      const wpm = elapsed > 0 ? (charCount.current / 5) / elapsed : 0;

      setCount(n);
      setLiveMetrics({ meanHT, meanIKI, wpm });

      if (n >= 10 && state === 'WARMUP') setState('ACTIVE');
    });
    return unsub;
  }, [state]);

  const startCapture = useCallback(() => {
    setState('WARMUP');
    startTime.current = Date.now();
    charCount.current = 0;
    setCount(0);
    window.electron?.ipcRenderer.invoke('capture:start');
  }, []);

  const analyse = useCallback(async () => {
    setState('PROCESSING');
    window.electron?.ipcRenderer.invoke('capture:stop');
    const buffer = await window.electron?.ipcRenderer.invoke('capture:getBuffer');
    try {
      const { data } = await axios.post(`${API}/predict`, { keystrokes: buffer });
      setResult(data);
      setState('RESULTS');
    } catch (err) {
      console.error(err);
      setState('IDLE');
      alert(`Backend Analysis Error: ${err.message}. Make sure backend is running.`);
    }
  }, []);

  const reset = useCallback(() => {
    setState('IDLE');
    setCount(0);
    setResult(null);
    htWindow.current = [];
    ikWindow.current = [];
    window.electron?.ipcRenderer.invoke('capture:clear');
  }, []);

  return { state, count, liveMetrics, result, startCapture, analyse, reset };
}
