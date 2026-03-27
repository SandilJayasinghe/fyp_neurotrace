import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { getRandomPrompt } from '../data/typingPrompts';
import { apiUrl } from '../config/api';

export function useTypingTest() {
  const [currentPrompt, setCurrentPrompt] = useState(getRandomPrompt());
  const [state, setState] = useState('IDLE');
  const [typingStats, setTypingStats] = useState({
    cursor: 0,
    validCount: 0,
    errorCount: 0,
    charStatuses: [],
  });

  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hardwareStatus, setHardwareStatus] = useState({ success: true, error: null });

  const keystrokeBuffer = useRef([]);
  const metricsWindow = useRef([]);
  const sessionId = useRef(null);
  const startTime = useRef(null);
  const cursorRef = useRef(0);
  const validCountRef = useRef(0);
  const errorCountRef = useRef(0);
  const charStatusesRef = useRef([]);

  const { cursor, charStatuses, validCount, errorCount } = typingStats;

  const handleKeyDown = useCallback((event, packet) => {
    if (state !== 'ACTIVE') return;
    
    const typedChar = packet.char;
    if (!typedChar) return;

    // Filter to length 1 to avoid meta keys advancing cursor
    if (typedChar.length !== 1) return;

    const expectedChar = currentPrompt[cursorRef.current];
    const pos = cursorRef.current;

    if (typedChar === expectedChar) {
      charStatusesRef.current[pos] = 'correct';
      validCountRef.current += 1;
    } else {
      charStatusesRef.current[pos] = 'incorrect';
      errorCountRef.current += 1;
    }
    
    cursorRef.current += 1;
    setTypingStats(prev => ({
      ...prev,
      cursor: cursorRef.current,
      validCount: validCountRef.current,
      errorCount: errorCountRef.current,
      charStatuses: [...charStatusesRef.current]
    }));
  }, [state, currentPrompt]);

  const handleKeyUp = useCallback((event, packet) => {
    if (state !== 'ACTIVE') return;

    metricsWindow.current.push(packet);
    if (metricsWindow.current.length > 50) metricsWindow.current.shift();

    keystrokeBuffer.current.push({
      keyId: packet.char,
      timeStamp: packet.keydown_ts || packet.timestamp || Date.now(),
      type: packet.hand || 'Unknown',
      hold_time: packet.hold_time,
      flight_time: packet.flight_time ?? null,
      latency: packet.latency ?? null,
      overlap: packet.overlap || false,
      modifiers: packet.modifiers || {}
    });
  }, [state]);

  const startTest = useCallback(async () => {
    const prompt = getRandomPrompt();
    setCurrentPrompt(prompt);
    setState('IDLE');
    setResult(null);
    setError(null);
    setIsLoading(false);
    keystrokeBuffer.current = [];
    metricsWindow.current = [];
    sessionId.current = `typing_${Date.now()}`;
    startTime.current = Date.now();
    
    cursorRef.current = 0;
    validCountRef.current = 0;
    errorCountRef.current = 0;
    charStatusesRef.current = Array(prompt.length).fill('pending');
    setTypingStats({ cursor: 0, validCount: 0, errorCount: 0, charStatuses: charStatusesRef.current });

    if (window.electron?.ipcRenderer) {
      try {
        await window.electron.ipcRenderer.invoke('capture:setTappyMode', false);
        const res = await window.electron.ipcRenderer.invoke('capture:start');
        if (res?.success === false) {
          setHardwareStatus({ success: false, error: res.error });
        } else {
          setHardwareStatus({ success: true, error: null, keyboard_name: res.keyboard_name, polling_hz: res.polling_hz });
        }
      } catch (e) {
        setHardwareStatus({ success: false, error: e.message });
      }
    }
    setState('ACTIVE');
  }, []);

  const analyse = useCallback(async () => {
    if (keystrokeBuffer.current.length < 150) {
        setError(`Keep typing! You need at least 150 keystrokes for analysis. (Current: ${keystrokeBuffer.current.length})`);
        return;
    }

    setState('PROCESSING');
    setIsLoading(true);

    if (window.electron?.ipcRenderer) {
      await window.electron.ipcRenderer.invoke('capture:stop').catch(() => {});
    }

    try {
      const payload = {
        sessionId: sessionId.current,
        startTime: startTime.current,
        keystrokeEvents: [...keystrokeBuffer.current],
        keyboard_name: hardwareStatus.keyboard_name || "Standard HID",
        keyboard_polling_hz: hardwareStatus.polling_hz || 125
      };

      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.post(apiUrl('/predict'), payload, { headers });

      if (window.electron?.ipcRenderer) {
        const wpmVal = data.all_features?.find(f => f.name.toLowerCase() === 'wpm')?.raw_value || 0;
        const sessionData = {
          session_id: sessionId.current,
          recorded_at: new Date().toISOString(),
          summary: {
            total_keystrokes: keystrokeBuffer.current.length,
            accuracy: Math.round((validCountRef.current / (validCountRef.current + errorCountRef.current || 1)) * 100),
            keyboard: payload.keyboard_name,
            wpm: Math.round(wpmVal)
          },
          keystrokes: keystrokeBuffer.current,
          ai_result: data,
        };
        await window.electron.ipcRenderer.invoke('session:save', sessionData).catch(() => {});
      }

      setResult(data);
      setState('RESULTS');
    } catch (err) {
      console.error('[useTypingTest] Analysis failed:', err);
      const detail = err.response?.data?.detail;
      let msg = 'Analysis failed';
      if (typeof detail === 'string') msg = detail;
      else if (Array.isArray(detail)) msg = detail.map(d => d.msg || JSON.stringify(d)).join(', ');
      else if (detail) msg = JSON.stringify(detail);
      else msg = err.message || 'Unknown error';
      
      setError(msg);
      setState('ACTIVE');
    } finally {
      setIsLoading(false);
    }
  }, [currentPrompt.length]);

  const reset = useCallback(() => {
    setState('IDLE');
    setResult(null);
    setError(null);
    setCurrentPrompt(getRandomPrompt());
    cursorRef.current = 0;
    validCountRef.current = 0;
    errorCountRef.current = 0;
    charStatusesRef.current = [];
    setTypingStats({ cursor: 0, validCount: 0, errorCount: 0, charStatuses: [] });
    keystrokeBuffer.current = [];
    metricsWindow.current = [];
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.invoke('capture:stop').catch(() => {});
      window.electron.ipcRenderer.invoke('capture:clear').catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!window.electron?.ipcRenderer) return;
    const cleanupDown = window.electron.ipcRenderer.on('keystroke-keydown', handleKeyDown);
    const cleanupUp = window.electron.ipcRenderer.on('keystroke-event', handleKeyUp);
    return () => { 
        if (typeof cleanupDown === 'function') cleanupDown(); 
        if (typeof cleanupUp === 'function') cleanupUp();
    };
  }, [handleKeyDown, handleKeyUp]);

  useEffect(() => {
    if (state === 'ACTIVE' && cursor >= currentPrompt.length) {
      analyse();
    }
  }, [cursor, state, analyse, currentPrompt]);

  const liveMetrics = useMemo(() => {
    const total = validCount + errorCount;
    return {
      accuracy: total > 0 ? Math.round((validCount / total) * 100) : 0,
      validCount,
      errorCount,
      meanHT: metricsWindow.current.length ? Math.round(metricsWindow.current.reduce((a, b) => a + (b.hold_time||0), 0) / metricsWindow.current.length) : 0,
      rhythmStability: (() => {
        if (metricsWindow.current.length < 5) return 0; // Return 0 until data exists
        const hts = metricsWindow.current.map(m => m.hold_time || 0);
        const mean = hts.reduce((a, b) => a + b, 0) / hts.length;
        const variance = hts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / hts.length;
        const std = Math.sqrt(variance);
        const cv = std / (mean || 1);
        return Math.min(Math.max(Math.round(100 - (cv * 100)), 40), 99);
      })(),
      wpm: (() => {
        if (validCount === 0) return 0;
        let durationMs = startTime.current ? (Date.now() - startTime.current) : 0;
        // If duration is too small or missing (e.g. upload), try buffer timestamps
        if (durationMs < 1000 && keystrokeBuffer.current.length > 10) {
          const first = keystrokeBuffer.current[0].timeStamp || 0;
          const last = keystrokeBuffer.current[keystrokeBuffer.current.length - 1].timeStamp || 0;
          durationMs = last - first;
        }
        if (durationMs < 1000) return 0;
        const wpm = (validCount / 5) / (durationMs / 60000);
        return Math.min(Math.round(wpm), 200); // Caps at 200 to avoid outliers
      })()
    };
  }, [typingStats]);

  const loadExternalData = useCallback((data) => {
    if (!Array.isArray(data)) return;
    
    // 1. Map to internal schema
    const mapped = data.map(k => ({
      keyId: String(k.keyId || k.key || k.char || ''),
      type: k.type || k.hand || 'Unknown',
      hold_time: parseFloat(k.hold_time) || 0,
      flight_time: k.flight_time !== undefined && k.flight_time !== null ? parseFloat(k.flight_time) : null,
      latency: k.latency !== undefined && k.latency !== null ? parseFloat(k.latency) : null,
      timeStamp: Number(k.timeStamp || k.keydown_ts || k.timestamp || Date.now()),
      overlap: !!k.overlap,
      modifiers: k.modifiers || {}
    }));

    // 2. Clear and update buffer
    keystrokeBuffer.current = mapped;
    validCountRef.current = mapped.length;
    errorCountRef.current = data.filter(k => k.status === 'incorrect').length;
    
    // 3. Update stats state
    setTypingStats(prev => ({
      ...prev,
      validCount: validCountRef.current,
      errorCount: errorCountRef.current,
      cursor: 0,
      charStatuses: []
    }));

    // 4. Populate metrics window for visualization
    metricsWindow.current = mapped.slice(-50);
    
    // 5. Set session metadata if missing
    if (!sessionId.current) sessionId.current = `upload_${Date.now()}`;
    if (!startTime.current && mapped.length > 0) {
      startTime.current = mapped[0].timeStamp;
    }

    setState('IDLE');
    setResult(null);
    setError(null);
  }, []);

  return {
    state,
    cursor,
    charStatuses,
    validCount,
    errorCount,
    liveMetrics,
    result,
    error,
    isLoading,
    hardwareStatus,
    canAnalyse: validCount >= 150,
    startTest,
    analyse,
    reset,
    loadExternalData,
    keystrokes: keystrokeBuffer.current,
    PROMPT_TEXT: currentPrompt,
  };
}


