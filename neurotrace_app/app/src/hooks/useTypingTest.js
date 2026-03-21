import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const API = 'http://127.0.0.1:8421';

export const PROMPT_TEXT =
  "The surgeon carefully examined the patient's trembling hands before beginning the delicate procedure. " +
  "Regular physical therapy sessions improve coordination and reduce the severity of motor symptoms over time. " +
  "She typed slowly but deliberately, pressing each key with measured force as the clock ticked quietly on the wall.";

export function useTypingTest() {
  // 1. All useState declarations
  const [state, setState] = useState('IDLE'); // IDLE | ACTIVE | PROCESSING | RESULTS
  const [cursor, setCursor] = useState(0);
  const [charStatuses, setCharStatuses] = useState(() => Array(PROMPT_TEXT.length).fill('pending'));
  const [validCount, setValidCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // 2. All useRef declarations
  const keystrokeBuffer = useRef([]);
  const metricsWindow = useRef([]);
  const sessionId = useRef(null);
  const startTime = useRef(null);
  const cursorRef = useRef(0);       // Mirrors cursor for use inside callbacks
  const errorCountRef = useRef(0);   // Mirrors errorCount for use inside callbacks

  // 3. Function declarations — all declared BEFORE any useEffect that references them

  const processKeystroke = useCallback((event, packet) => {
    if (state !== 'ACTIVE') return;

    const typedChar = packet.char;
    const expectedChar = PROMPT_TEXT[cursorRef.current];

    // Update rolling metrics window (last 30 keystrokes)
    metricsWindow.current.push(packet);
    if (metricsWindow.current.length > 30) metricsWindow.current.shift();

    if (typedChar === expectedChar) {
      // Correct keystroke
      const pos = cursorRef.current;
      setCharStatuses(prev => {
        const next = [...prev];
        next[pos] = 'correct';
        return next;
      });
      cursorRef.current += 1;
      setCursor(cursorRef.current);
      setValidCount(prev => prev + 1);
      keystrokeBuffer.current.push({
        key: typedChar,
        hold_time: packet.hold_time,
        flight_time: packet.flight_time ?? null,
        latency: packet.latency ?? null,
      });
    } else {
      // Incorrect keystroke — mark current position but do not advance cursor
      const pos = cursorRef.current;
      setCharStatuses(prev => {
        const next = [...prev];
        next[pos] = 'incorrect';
        return next;
      });
      errorCountRef.current += 1;
      setErrorCount(errorCountRef.current);
    }
  }, [state]);

  const startTest = useCallback(async () => {
    // Reset all tracking state
    cursorRef.current = 0;
    errorCountRef.current = 0;
    setCursor(0);
    setCharStatuses(Array(PROMPT_TEXT.length).fill('pending'));
    setValidCount(0);
    setErrorCount(0);
    setResult(null);
    setError(null);
    keystrokeBuffer.current = [];
    metricsWindow.current = [];
    sessionId.current = `typing_${Date.now()}`;
    startTime.current = Date.now();

    if (window.electron?.ipcRenderer) {
      try {
        await window.electron.ipcRenderer.invoke('capture:setTappyMode', false);
        await window.electron.ipcRenderer.invoke('capture:start');
      } catch (e) {
        console.warn('[useTypingTest] Electron capture start failed:', e);
      }
    }

    setState('ACTIVE');
  }, []);

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

      const payload = {
        session_id: sessionId.current,
        keystrokes: keystrokeBuffer.current,
        ...keyboardMeta,
      };

      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.post(`${API}/predict`, payload, { headers });

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
    setState('IDLE');
    cursorRef.current = 0;
    errorCountRef.current = 0;
    setCursor(0);
    setCharStatuses(Array(PROMPT_TEXT.length).fill('pending'));
    setValidCount(0);
    setErrorCount(0);
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
    const cleanup = window.electron.ipcRenderer.on('keystroke-event', processKeystroke);
    return () => { if (cleanup) cleanup(); };
  }, [processKeystroke]);

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
    if (state === 'ACTIVE' && cursor >= PROMPT_TEXT.length) {
      analyse();
    }
  }, [cursor, state, analyse]);

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

  const total = validCount + errorCount;
  const elapsed = startTime.current ? (Date.now() - startTime.current) / 60000 : 0;

  const liveMetrics = {
    rhythmStability: computeRhythmStability(metricsWindow.current),
    accuracy: total > 0 ? Math.round((validCount / total) * 100) : 100,
    meanHT: computeMean(metricsWindow.current, 'hold_time'),
    meanIKI: computeMean(metricsWindow.current, 'latency'),
    wpm: elapsed > 0 && validCount > 0 ? Math.round((validCount / 5) / elapsed) : 0,
  };

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
    canAnalyse: validCount >= 150,
    startTest,
    analyse,
    reset,
    PROMPT_TEXT,
  };
}