import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { TAPPY_PROTOCOL } from '../constants/tappyProtocol';

const API = 'http://127.0.0.1:8421';

export function useTappyTest() {
  const [state, setState] = useState('IDLE'); // IDLE | WARMUP | ACTIVE | COMPLETE | PROCESSING | RESULTS
  const [keystrokeCount, setKeystrokeCount] = useState(0); // Valid post-warmup 
  const [warmupCount, setWarmupCount] = useState(0);
  const [leftCount, setLeftCount] = useState(0);
  const [rightCount, setRightCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [backendStatus, setBackendStatus] = useState('OFFLINE');
  const [modelInfo, setModelInfo] = useState(null);
  const [result, setResult] = useState(null);
  const [lastKey, setLastKey] = useState(null); // 'L' | 'R'

  // Ref buffers for performance
  const predictionBuffer = useRef([]); // Only valid samples during ACTIVE state
  const metricsRollingWindow = useRef([]); // Last 30 valid samples for live display
  const sessionId = useRef(null);
  const startTime = useRef(null);
  const timerInterval = useRef(null);

  // Poll backend health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const { data } = await axios.get(`${API}/health`);
        if (data.status === 'ok') {
          setBackendStatus('ONLINE');
          setModelInfo(data);
        } else {
          setBackendStatus('ERROR');
        }
      } catch (e) {
        setBackendStatus('OFFLINE');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const reset = useCallback(() => {
    setState('IDLE');
    setKeystrokeCount(0);
    setWarmupCount(0);
    setLeftCount(0);
    setRightCount(0);
    setErrorCount(0);
    setElapsedSeconds(0);
    setResult(null);
    setLastKey(null);
    predictionBuffer.current = [];
    metricsRollingWindow.current = [];
    sessionId.current = null;
    if (timerInterval.current) clearInterval(timerInterval.current);
  }, []);

  const startTest = useCallback(async () => {
    reset();
    sessionId.current = `tap_${Date.now()}`;
    setState('WARMUP');
    startTime.current = Date.now();
    
    // Set Tappy mode in main process (Force lowercase)
    await window.electron.ipcRenderer.invoke('capture:setTappyMode', true);
    await window.electron.ipcRenderer.invoke('capture:start');

    timerInterval.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
  }, [reset]);

  const analyse = useCallback(async () => {
    if (keystrokeCount < TAPPY_PROTOCOL.MIN_KEYSTROKES) return;
    
    setState('PROCESSING');
    await window.electron.ipcRenderer.invoke('capture:stop');
    if (timerInterval.current) clearInterval(timerInterval.current);

    try {
      const bufferData = await window.electron.ipcRenderer.invoke('buffer:getSnapshot');
      const keystrokesArray = bufferData.keystrokes ? bufferData.keystrokes : [];
      // Merge with predictionBuffer (which has semantic L/R keys)
      const payload = {
        session_id: sessionId.current,
        keystrokes: predictionBuffer.current,
        keyboard_polling_hz:  bufferData.keyboard?.polling_hz ?? 125,
        keyboard_name:        bufferData.keyboard?.keyboard_name ?? 'Unknown',
        quantisation_warning: bufferData.keyboard?.quantisation_warning ?? true,
        detection_method:     bufferData.keyboard?.detection_method ?? 'assumed',
        detection_confidence: bufferData.keyboard?.confidence ?? 'Low',
      };
      const { data } = await axios.post(`${API}/predict`, payload);
      
      // Save result to local session store (renderer side for sync)
      const sessionData = {
        session_id: sessionId.current,
        recorded_at: new Date().toISOString(),
        protocol: 'tappy-v1',
        left_key:  TAPPY_PROTOCOL.LEFT_KEY,
        right_key: TAPPY_PROTOCOL.RIGHT_KEY,
        summary: {
           total_keystrokes: keystrokeCount,
           latency: computeMean(metricsRollingWindow.current, 'latency'),
           accuracy: 100, // Conceptually 100% since we filter errors
           wpm: 0 // Irrelevant for tappy
        },
        keystrokes: predictionBuffer.current,
        ai_result: data
      };
      
      await window.electron.ipcRenderer.invoke('session:save', sessionData);
      
      setResult(data);
      setState('RESULTS');
    } catch (err) {
      console.error(err);
      setState('COMPLETE');
    }
  }, [keystrokeCount]);

  // Handle Keystroke Events
  useEffect(() => {
    const handleKeystroke = (event, packet) => {
      // packet: { char, hold_time, flight_time, latency }
      console.log('[Tappy Hook] Received Key:', packet.char, packet.key);
      if (state === 'IDLE' || state === 'RESULTS' || state === 'PROCESSING') return;

      const char = (packet.char || '').toLowerCase();
      
      // 1. Validation Logic
      if (char !== TAPPY_PROTOCOL.LEFT_KEY && char !== TAPPY_PROTOCOL.RIGHT_KEY) {
        setErrorCount(prev => prev + 1);
        return; 
      }

      const semanticKey = char === TAPPY_PROTOCOL.LEFT_KEY ? 'L' : 'R';
      setLastKey(semanticKey);

      // 2. Metrics Rolling Window (Always keep last 30 for live display)
      metricsRollingWindow.current.push(packet);
      if (metricsRollingWindow.current.length > 30) metricsRollingWindow.current.shift();

      // 3. Phase handling
      if (state === 'WARMUP') {
        setWarmupCount(prev => {
          const next = prev + 1;
          if (next >= TAPPY_PROTOCOL.WARMUP_KEYSTROKES) {
            setState('ACTIVE');
          }
          return next;
        });
      } else if (state === 'ACTIVE') {
        // Record for prediction
        predictionBuffer.current.push({
          key: semanticKey,
          hold_time: packet.hold_time,
          flight_time: packet.flight_time ?? null,
          latency: packet.latency ?? null
        });

        if (semanticKey === 'L') setLeftCount(prev => prev + 1);
        else setRightCount(prev => prev + 1);
        
        setKeystrokeCount(prev => {
            const next = prev + 1;
            if (next >= TAPPY_PROTOCOL.TARGET_KEYSTROKES) {
                // Keep going, but mark as ready
            }
            return next;
        });
      }
    };

    const cleanup = window.electron.ipcRenderer.on('keystroke-event', handleKeystroke);
    return () => {
      if (cleanup) cleanup();
    };
  }, [state]);

  // Handle auto-analysis on time limit
  useEffect(() => {
     if (state === 'ACTIVE' && elapsedSeconds >= TAPPY_PROTOCOL.SESSION_TIME_LIMIT) {
         analyse();
     }
  }, [elapsedSeconds, state, analyse]);

  // Metrics Helper Utils
  const computeMean = (arr, field) => {
    const vals = arr.map(x => x[field]).filter(v => v !== null && v !== undefined);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  };

  const computeRhythm = (arr) => {
    const latencies = arr.map(x => x.latency).filter(v => v !== null && v !== undefined);
    if (latencies.length < 2) return 0;
    const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const std = Math.sqrt(latencies.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / latencies.length);
    return (std / mean).toFixed(3);
  };

  const liveMetrics = {
    meanHT:  computeMean(metricsRollingWindow.current, 'hold_time'),
    meanIKI: computeMean(metricsRollingWindow.current, 'latency'),
    meanFT:  computeMean(metricsRollingWindow.current, 'flight_time'),
    rhythm:  computeRhythm(metricsRollingWindow.current)
  };

  return {
    state,
    keystrokeCount,
    warmupCount,
    leftCount,
    rightCount,
    errorCount,
    liveMetrics,
    result,
    elapsedSeconds,
    canAnalyse: keystrokeCount >= TAPPY_PROTOCOL.MIN_KEYSTROKES,
    backendStatus,
    modelInfo,
    lastKey,
    startTest,
    analyse,
    reset
  };
}
