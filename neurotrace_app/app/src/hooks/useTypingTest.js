import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { getRandomPrompt } from '../data/typingPrompts';
import { apiUrl } from '../config/api';

export function useTypingTest() {
  // 1. All useState declarations
  const [currentPrompt, setCurrentPrompt] = useState(getRandomPrompt());
  const [state, setState] = useState('IDLE');
  const [typingStats, setTypingStats] = useState({
    cursor: 0,
    validCount: 0,
    errorCount: 0,
    charStatuses: Array(200).fill('pending')
  });
  const charStatusesRef = useRef([]); // kept for internal tracking
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hardwareStatus, setHardwareStatus] = useState({ success: true, error: null });

  // 2. All useRef declarations
  const keystrokeBuffer = useRef([]);
  const metricsWindow = useRef([]);
  const sessionId = useRef(null);
  const startTime = useRef(null);
  const cursorRef = useRef(0);       // Mirrors cursor for use inside callbacks
  const errorCountRef = useRef(0);   // Mirrors errorCount for use inside callbacks
  
  // 3. Destructured Stats — moved here to avoid TDZ (temporal dead zone)
  const { cursor, charStatuses, validCount, errorCount } = typingStats;

  // 3. Function declarations — all declared BEFORE any useEffect that references them

  const handleKeyDown = useCallback((event, packet) => {
    if (state !== 'ACTIVE') return;
    const typedChar = packet.char;
    const expectedChar = currentPrompt[cursorRef.current];
    
    console.log(`[useTypingTest] KeyDown: "${typedChar}" | Expected: "${expectedChar}"`);
    
    if (!typedChar) return;

    // Filter printable characters (length 1) - avoid meta keys triggering incorrects
    if (typedChar.length !== 1) return;

    const pos = cursorRef.current;
    
    if (typedChar === expectedChar) {
      charStatusesRef.current[pos] = 'correct';
      cursorRef.current += 1;
      
      console.log(`[useTypingTest] Correct! Cursor moving to: ${cursorRef.current}`);

      setTypingStats(prev => ({
        ...prev,
        cursor: cursorRef.current,
        validCount: prev.validCount + 1,
        charStatuses: [...charStatusesRef.current]
      }));
    } else {
      charStatusesRef.current[pos] = 'incorrect';
      // ADVANCE CURSOR even on error for better flow
      cursorRef.current += 1;
      errorCountRef.current += 1;
      
      console.log(`[useTypingTest] Mistake! Typed: "${typedChar}" | Expected: "${expectedChar}". Moving cursor to: ${cursorRef.current}`);

      setTypingStats(prev => ({
        ...prev,
        cursor: cursorRef.current,
        errorCount: errorCountRef.current,
        charStatuses: [...charStatusesRef.current]
      }));
    }
  }, [state, currentPrompt]);

  const handleKeyUp = useCallback((event, packet) => {
    if (state !== 'ACTIVE') return;

    // Update metrics window
    metricsWindow.current.push(packet);
    if (metricsWindow.current.length > 30) metricsWindow.current.shift();

    // KeyUp only populates the buffer — cursor already moved by handleKeyDown
    keystrokeBuffer.current.push({
      keyId: packet.char,
      timeStamp: packet.timestamp || Date.now(),
      type: packet.hand || 'Unknown',
      hold_time: packet.hold_time,
      flight_time: packet.flight_time ?? null,
      latency: packet.latency ?? null,
    });
  }, [state]);

  const startTest = useCallback(async () => {
    // Reset all tracking state
    cursorRef.current = 0;
    errorCountRef.current = 0;
    charStatusesRef.current = Array(currentPrompt.length).fill('pending');
    
    setTypingStats({
        cursor: 0,
        validCount: 0,
        errorCount: 0,
        charStatuses: [...charStatusesRef.current]
    });
    
    setResult(null);
    setError(null);
    keystrokeBuffer.current = [];
    metricsWindow.current = [];
    sessionId.current = `typing_${Date.now()}`;
    startTime.current = Date.now();

    if (window.electron?.ipcRenderer) {
      // Best-effort: set non-tappy mode. Failure here must not block capture:start.
      try {
        await window.electron.ipcRenderer.invoke('capture:setTappyMode', false);
      } catch (e) {
        console.warn('[useTypingTest] setTappyMode failed (non-critical):', e);
      }
      try {
        const res = await window.electron.ipcRenderer.invoke('capture:start');
        if (res && res.success === false) {
           setHardwareStatus({ success: false, error: res.error });
           setError(`Hardware listener failed to start. On some systems this requires Administrative privilege or disabling aggressive Antivirus monitors.`);
        } else {
           setHardwareStatus({ success: true, error: null });
        }
      } catch (e) {
        console.warn('[useTypingTest] capture:start failed:', e);
        setHardwareStatus({ success: false, error: e.message });
      }
    }

    setState('ACTIVE');
  }, [currentPrompt.length]);

  const analyse = useCallback(async (token) => {
    if (keystrokeBuffer.current.length < 150) return;

    setState('PROCESSING');
    setIsLoading(true);

    if (window.electron?.ipcRenderer) {
      await window.electron.ipcRenderer.invoke('capture:stop').catch(() => {});
    }

    try {
      // Collect keyboard hardware metadata if available
      let keyboardMeta = {
        keyboard_polling_hz: 125,
        keyboard_name: 'Unknown',
        quantisation_warning: true,
        detection_method: 'assumed',
        detection_confidence: 'Low',
      };
      if (window.electron?.ipcRenderer) {
        const bufferData = await window.electron.ipcRenderer.invoke('buffer:getSnapshot').catch(() => null);
        if (bufferData?.keyboard) {
          keyboardMeta = {
            keyboard_polling_hz: bufferData.keyboard.polling_hz ?? 125,
            keyboard_name: bufferData.keyboard.keyboard_name ?? 'Unknown',
            quantisation_warning: bufferData.keyboard.quantisation_warning ?? true,
            detection_method: bufferData.keyboard.detection_method ?? 'assumed',
            detection_confidence: bufferData.keyboard.confidence ?? 'Low',
          };
        }
      }

      if (!sessionId.current) sessionId.current = `upload_${Date.now()}`;
      if (!startTime.current) startTime.current = Date.now();

      const payload = {
        sessionId: sessionId.current,
        startTime: startTime.current,
        keystrokeEvents: keystrokeBuffer.current,
        ...keyboardMeta,
      };

      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.post(apiUrl('/predict'), payload, { headers });

      // Persist session data locally
      if (window.electron?.ipcRenderer) {
        const elapsed = startTime.current ? (Date.now() - startTime.current) / 60000 : 1;
        const totalStrokes = keystrokeBuffer.current.length;
        const totalAttempts = totalStrokes + errorCountRef.current;
        const sessionData = {
          session_id: sessionId.current,
          recorded_at: new Date().toISOString(),
          protocol: 'typing-v1',
          summary: {
            total_keystrokes: totalStrokes,
            accuracy: totalAttempts > 0 ? Math.round((totalStrokes / totalAttempts) * 100) : 100,
            wpm: elapsed > 0 ? Math.round((totalStrokes / 5) / elapsed) : 0,
          },
          keystrokes: keystrokeBuffer.current,
          ai_result: data,
        };
        await window.electron.ipcRenderer.invoke('session:save', sessionData).catch(() => {});
      }

      setResult(data);
      setState('RESULTS');
    } catch (err) {
      console.error('[useTypingTest] Analysis error:', err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.msg ||
        err.message ||
        'Analysis failed';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      setState('ACTIVE');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    const newPrompt = getRandomPrompt();
    setCurrentPrompt(newPrompt);
    setState('IDLE');
    cursorRef.current = 0;
    errorCountRef.current = 0;
    charStatusesRef.current = Array(newPrompt.length).fill('pending');

    setTypingStats({
        cursor: 0,
        validCount: 0,
        errorCount: 0,
        charStatuses: [...charStatusesRef.current]
    });

    setResult(null);
    setError(null);
    setIsLoading(false);
    keystrokeBuffer.current = [];
    metricsWindow.current = [];
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.invoke('capture:clear').catch(() => {});
    }
  }, []);

  // 4. useEffect hooks — declared AFTER all function declarations

  // Attach IPC keystroke listener
  useEffect(() => {
    if (!window.electron?.ipcRenderer) return;
    const cleanupDown = window.electron.ipcRenderer.on('keystroke-keydown', handleKeyDown);
    const cleanupUp = window.electron.ipcRenderer.on('keystroke-event', handleKeyUp);
    return () => { 
        if (cleanupDown) cleanupDown(); 
        if (cleanupUp) cleanupUp();
    };
  }, [handleKeyDown, handleKeyUp]);

  // Software Fallback Listener (Browser-level)
  const lastSoftDown = useRef(null);
  const lastSoftUp = useRef(null);

  useEffect(() => {
    if (hardwareStatus.success || state !== 'ACTIVE') return;

    console.warn('[useTypingTest] Software Fallback ACTIVE');
    const localPending = {};

    const onKeyDown = (e) => {
      if (localPending[e.code]) return;
      const t_now = Date.now();
      
      const latency = lastSoftDown.current ? (t_now - lastSoftDown.current) : null;
      const flight = lastSoftUp.current ? (t_now - lastSoftUp.current) : null;

      localPending[e.code] = { 
        t_down: t_now,
        latency,
        flight
      };
      lastSoftDown.current = t_now;

      handleKeyDown(null, { char: e.key });
    };

    const onKeyUp = (e) => {
      const pending = localPending[e.code];
      if (!pending) return;
      delete localPending[e.code];

      const t_up = Date.now();
      const hold_time = t_up - pending.t_down;
      lastSoftUp.current = t_up;
      
      handleKeyUp(null, {
        char: e.key,
        hand: 'Software',
        hold_time,
        flight_time: pending.flight,
        latency: pending.latency,
        timestamp: pending.t_down,
        is_software: true
      });
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [hardwareStatus.success, state, handleKeyDown, handleKeyUp]);

  // Handle 'setValidCount' custom event dispatched by the file-upload flow
  useEffect(() => {
    const handler = (e) => {
      setValidCount(e.detail);
      try {
        const buf = JSON.parse(localStorage.getItem('temp_buffer') || '[]');
        keystrokeBuffer.current = buf;
      } catch {
        // ignore parse errors
      }
    };
    window.addEventListener('setValidCount', handler);
    return () => window.removeEventListener('setValidCount', handler);
  }, []);

  // Auto-analyse once the entire prompt has been typed
  useEffect(() => {
    if (state === 'ACTIVE' && cursor >= currentPrompt.length) {
      analyse();
    }
  }, [cursor, state, analyse, currentPrompt]);

  // 5. Derived / computed values

  const computeMean = (arr, field) => {
    const vals = arr.map(x => x[field]).filter(v => v !== null && v !== undefined);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  };

  const computeRhythmStability = (arr) => {
    const latencies = arr.map(x => x.latency).filter(v => v !== null && v !== undefined);
    if (latencies.length < 2) return 100;
    const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const variance = latencies.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / latencies.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    return Math.max(0, Math.round((1 - cv) * 100));
  };

  // 6. Derived / computed values

  const liveMetrics = useMemo(() => {
    const total = validCount + errorCount;
    const elapsed = startTime.current ? (Date.now() - startTime.current) / 60000 : 0;
    
    return {
      rhythmStability: computeRhythmStability(metricsWindow.current),
      accuracy: total > 0 ? Math.round((validCount / total) * 100) : 100,
      meanHT: computeMean(metricsWindow.current, 'hold_time'),
      meanIKI: computeMean(metricsWindow.current, 'latency'),
      wpm: elapsed > 0 && validCount > 0 ? Math.round((validCount / 5) / elapsed) : 0,
    };
  }, [typingStats, metricsWindow.current.length]);

  // 6. Return
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
    handleKeyDown,
    handleKeyUp,
    PROMPT_TEXT: currentPrompt,
  };
}