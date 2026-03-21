import { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';

const API = 'http://127.0.0.1:8421';
export const PROMPT_TEXT = "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump! The five boxing wizards jump quickly. Bright vixens jump; dozy fowl quack. Sphinx of black quartz, judge my vow. Jackdaws love my big sphinx of quartz.";


export function useTypingTest() {
  // Rolling windows for metrics
  const htWindow = useRef([]);
  const ikWindow = useRef([]);
  const predictionBuffer = useRef([]);
  const [state, setState] = useState('IDLE'); 
  const [cursor, setCursor] = useState(0);
  const [charStatuses, setCharStatuses] = useState(new Array(PROMPT_TEXT.length).fill('pending'));
  const [validCount, setValidCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  
  const [liveMetrics, setLiveMetrics] = useState({ 
    wpm: 0, 
    meanHT: 0, 
    meanIKI: 0,
    rhythmStability: 100,
    accuracy: 100
  });

  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const startTimeRef = useRef(null);

  // Listen for setValidCount event from upload handler
  useEffect(() => {
    const handler = (e) => {
      if (e && e.detail) setValidCount(e.detail);
    };
    window.addEventListener('setValidCount', handler);
    return () => window.removeEventListener('setValidCount', handler);
  }, []);

  useEffect(() => {
    if (!window.electron || !window.electron.ipcRenderer || state !== 'ACTIVE') return;
    const unsub = window.electron.ipcRenderer.on('keystroke-event', (event, record) => {
      // record.key must be 'L' or 'R' — if not, discard
      const hand = record?.key;
      if (hand !== 'L' && hand !== 'R') return;

      const ht  = record.hold_time;
      const ft  = record.flight_time ?? null;
      const il  = record.latency     ?? null;

      // Update rolling metric windows
      htWindow.current.push(ht);
      if (htWindow.current.length > 20) htWindow.current.shift();
      if (il !== null) {
        ikWindow.current.push(il);
        if (ikWindow.current.length > 20) ikWindow.current.shift();
      }

      const meanHT  = htWindow.current.reduce((a, b) => a + b, 0) / htWindow.current.length;
      const meanIKI = ikWindow.current.length > 0
        ? ikWindow.current.reduce((a, b) => a + b, 0) / ikWindow.current.length
        : 0;
      const elapsed = (Date.now() - startTimeRef.current) / 60000;
      const wpm = elapsed > 0
        ? (predictionBuffer.current.length / 5) / elapsed
        : 0;

      setLiveMetrics({ meanHT, meanIKI, wpm });

      // No warmup phase; process all valid keystrokes immediately

      // Active phase — add to prediction buffer
      predictionBuffer.current.push({
        key:         hand,   // 'L' or 'R'
        hold_time:   ht,
        flight_time: ft,
        latency:     il,
      });

      // Update counts (removed setLeftCount/setRightCount, not used)

      const newCount = predictionBuffer.current.length;
      console.log('[TypingTest] Keystroke event received. New validCount:', newCount);
      setValidCount(newCount);
    });
    return () => { if (unsub) unsub(); };
  }, [state]);

  const processKeystroke = (data) => {
      // Simulate left/right count logic for debug (replace with your actual logic if needed)
      // For demonstration, count 'L' and 'R' keys
      let leftCount = 0, rightCount = 0;
      if (data.key === 'L') leftCount++;
      if (data.key === 'R') rightCount++;
      console.log('received key:', data.key, 'leftCount:', leftCount, 'rightCount:', rightCount);
    let expected = PROMPT_TEXT[cursor].toLowerCase();
    let actual = data.char.toLowerCase();

    // Normalization Map: Symbols -> Primary Keys
    // This ensures that typing '!' matches '1', ':' matches ';', etc.
    const symbolMap = { 
        '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0', 
        ':': ';', '"': "'", '<': ',', '>': '.', '?': '/', '_': '-', '+': '='
    };
    
    if (symbolMap[expected]) expected = symbolMap[expected];
    // If 'actual' is from handMap, it's usually already the base key (e.g. '1'), 
    // but we normalize both to be safe.
    if (symbolMap[actual]) actual = symbolMap[actual];

    // Validation
    if (actual === expected) {
      const newStatuses = [...charStatuses];
      newStatuses[cursor] = 'correct';
      setCharStatuses(newStatuses);
      setCursor(prev => prev + 1);
      setValidCount(prev => prev + 1);
    } else {
      setErrorCount(prev => prev + 1);
      const tempStatuses = [...charStatuses];
      tempStatuses[cursor] = 'incorrect';
      setCharStatuses(tempStatuses);
      setTimeout(() => {
        setCharStatuses(prev => {
            const res = [...prev];
            if (res[cursor] === 'incorrect') res[cursor] = 'pending';
            return res;
        });
      }, 300);
      return; 
    }

    const buffer = JSON.parse(localStorage.getItem('temp_buffer') || '[]');
    buffer.push(data);
    localStorage.setItem('temp_buffer', JSON.stringify(buffer));

    // Stats
    const hts = buffer.map(k => k.hold_time);
    const avgHT = hts.reduce((acc, v) => acc + v, 0) / hts.length;
    const stdHT = Math.sqrt(hts.map(x => Math.pow(x - avgHT, 2)).reduce((a, b) => a + b, 0) / hts.length);
    const cv = (stdHT / (avgHT + 0.001));
    const stability = Math.max(0, Math.min(100, 100 - (cv * 100)));

    const validLatencies = buffer.map(k => k.latency).filter(l => l !== null);
    const avgIKI = validLatencies.length ? (validLatencies.reduce((acc, l) => acc + l, 0) / validLatencies.length) : 0;
    
    const elapsedSecs = (Date.now() - startTimeRef.current) / 1000;
    const wpm = (cursor / 5) / (elapsedSecs / 60 + 0.0001);
    const accuracy = Math.max(0, 100 - (errorCount / (validCount + errorCount + 0.001)) * 100);

    setLiveMetrics({
      wpm: Math.round(wpm),
      meanHT: Math.round(avgHT),
      meanIKI: Math.round(avgIKI),
      rhythmStability: Math.round(stability),
      accuracy: Math.round(accuracy)
    });
  };

  const startTest = async () => {
    try {
      if (!window.electron || !window.electron.ipcRenderer) {
        setError('Electron bridge not available. Please restart the app.');
        return;
      }
      await window.electron.ipcRenderer.invoke('buffer:clear');
      await window.electron.ipcRenderer.invoke('capture:start');
      localStorage.setItem('temp_buffer', '[]');
      setCursor(0);
      setValidCount(0);
      setErrorCount(0);
      setLiveMetrics({ wpm: 0, meanHT: 0, meanIKI: 0, rhythmStability: 100, accuracy: 100 });
      setCharStatuses(new Array(PROMPT_TEXT.length).fill('pending'));
      setResult(null);
      setError(null);
      startTimeRef.current = Date.now();
      setState('ACTIVE');
    } catch (err) {
      setError(err?.message || 'Failed to start test.');
    }
  };

  const analyse = async (token) => {
    if (validCount < 150) return;
    setState('PROCESSING');
    setIsLoading(true);
    await window.electron.ipcRenderer.invoke('capture:stop');
    try {
      const bufferData = await window.electron.ipcRenderer.invoke('buffer:getSnapshot');
      const keystrokesArray = bufferData.keystrokes ? bufferData.keystrokes : bufferData;
      
      const payload = {
        keystrokes: keystrokesArray.map(k => ({
            key: String(k.key),
            hold_time: k.hold_time,
            flight_time: k.flight_time,
            latency: k.latency
        })),
        keyboard_polling_hz:   bufferData.keyboard?.polling_hz ?? 125,
        keyboard_name:         bufferData.keyboard?.keyboard_name ?? 'Unknown',
        quantisation_warning:  bufferData.keyboard?.quantisation_warning ?? true,
        detection_method:      bufferData.keyboard?.detection_method ?? 'assumed',
        detection_confidence:  bufferData.keyboard?.confidence ?? 'Low',
        session_id: `Session_${Date.now()}`
      };

      const response = await axios.post(`${API}/predict`, payload, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      console.log('API response:', response.data);
      setResult(response.data);
      if (response.data.debug_logs) {
        response.data.debug_logs.forEach(log => console.log('[BACKEND DEBUG]', log));
      }
      setState('RESULTS');
      setIsLoading(false);
    } catch (err) {
      console.error('Inference Error Details:', err.response?.data);
      setError(err.response?.data?.detail || err.message || "Inference error.");
      setState('ACTIVE');
      setIsLoading(false);
    }
  };

  const reset = async () => {
    await window.electron.ipcRenderer.invoke('capture:stop');
    await window.electron.ipcRenderer.invoke('buffer:clear');
    setState('IDLE');
    setCursor(0);
  };

  useEffect(() => {
    if (cursor >= PROMPT_TEXT.length && state === 'ACTIVE') {
        analyse(localStorage.getItem('token'));
    }
  }, [cursor]);

  return {
    state, cursor, charStatuses, validCount, errorCount, liveMetrics, result, error, isLoading,
    canAnalyse: validCount >= 150,
    startTest, analyse, reset, PROMPT_TEXT
  };
}
