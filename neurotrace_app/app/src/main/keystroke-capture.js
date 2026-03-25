import { uIOhook, UiohookKey } from 'uiohook-napi';
import { classifyKey } from './handMap.js';

/**
 * Keystroke capture service for PD motor screening.
 * REFACTORED FOR MAXIMUM ROBUSTNESS (Step 12).
 */
export class KeystrokeCaptureService {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.isCapturing = false;
    this.buffer = [];
    this.MAX_BUFFER = 2000;
    this.lastKeyup = null; 
    this.lastKeydown_t = null; 
    this.pendingKeydowns = {}; 
    this.isShiftPressed = false;
    this.tappyMode = false;
    this.session_id = `session_${Date.now()}_${Math.floor(Math.random()*1e6)}`;
    this.lastEventTime = 0; // For health check

    console.log('[Session] Keystroke listener initialized.');
    this.setupListeners();
  }

  getBuffer() { return this.buffer; }
  getCount() { return this.buffer.length; }
  clearBuffer() { this.buffer = []; this.lastKeydown_t = null; this.lastKeyup = null; }
  
  setupListeners() {
    uIOhook.on('keydown', (event) => {
      this.lastEventTime = Date.now();
      console.log(`[uIOhook-Raw] keycode: ${event.keycode} | capturing: ${this.isCapturing}`);
      
      if (event.keycode === UiohookKey.Shift || event.keycode === UiohookKey.ShiftRight) {
          this.isShiftPressed = true;
          return;
      }

      if (!this.isCapturing) return;

      const t_now = Date.now();
      const isNewSession = this.lastKeydown_t !== null && (t_now - this.lastKeydown_t > 10000);
      const latency = (!isNewSession && this.lastKeydown_t !== null) ? (t_now - this.lastKeydown_t) : null;
      const flight = (!isNewSession && this.lastKeyup !== null) ? (t_now - this.lastKeyup.t_up) : null;

      let keyChar = event.keychar || event.rawcode || event.keycode;
      const mapping = classifyKey(event.keycode);
      let mappedChar = mapping ? mapping.char : null;
      let hand = mapping ? mapping.hand : null;

      this.pendingKeydowns[event.keycode] = {
        t_down: t_now,
        latency,
        flight,
        hand,
        char: mappedChar,
        key: keyChar
      };
      this.lastKeydown_t = t_now;

      // Determine the character for UI feedback
      let finalChar = mappedChar;
      if (!finalChar) {
          if (typeof keyChar === 'string') {
              finalChar = keyChar;
          } else if (typeof keyChar === 'number' && keyChar > 0) {
              // Convert uiohook keychar integer to actual character
              finalChar = String.fromCharCode(keyChar);
          }
      }

      if (this.isShiftPressed && finalChar && typeof finalChar === 'string' && finalChar.length === 1) {
          finalChar = finalChar.toUpperCase();
      }

      // IMMEDIATE UI FEEDBACK
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('keystroke-keydown', { 
            char: finalChar,
            hand: hand || 'Unknown'
          });
      }
    });

    uIOhook.on('keyup', (event) => {
      this.lastEventTime = Date.now();
      let pending = this.pendingKeydowns[event.keycode];
      if (event.keycode === UiohookKey.Shift || event.keycode === UiohookKey.ShiftRight) {
        this.isShiftPressed = false;
        return;
      }
      if (!pending) return;

      const t_up = Date.now();
      const hold_time = t_up - pending.t_down;

      if (this.isCapturing && hold_time >= 0 && hold_time <= 10000) {
        let finalChar = pending.char || (typeof pending.key === 'string' ? pending.key : (typeof pending.key === 'number' && pending.key > 0 ? String.fromCharCode(pending.key) : null));
        if (this.isShiftPressed && finalChar && typeof finalChar === 'string' && finalChar.length === 1) {
            finalChar = finalChar.toUpperCase();
        }

        const payload = {
          key: this.tappyMode ? pending.hand : finalChar,
          char: finalChar,
          hand: pending.hand,
          hold_time,
          flight_time: pending.flight,
          latency: pending.latency,
          session_id: this.session_id,
          datetime: new Date(pending.t_down).toISOString(),
        };

        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('keystroke-event', payload);
        }

        this.buffer.push({ ...payload, timestamp: pending.t_down });
        if (this.buffer.length > this.MAX_BUFFER) this.buffer.shift();
        this.lastKeyup = { keycode: event.keycode, t_up };
      }

      delete this.pendingKeydowns[event.keycode];
    });
  }

  setTappyMode(enabled) {
    this.tappyMode = !!enabled;
    console.log(`[Capture] Tappy mode is now ${this.tappyMode ? 'ON' : 'OFF'}`);
  }

  async start() {
    if (this.isCapturing) return { success: true };
    try {
        console.log('[Session] Starting hardware listener...');
        this.lastKeyup = null;
        this.lastKeydown_t = null;
        
        // Ensure clean state
        try { uIOhook.stop(); } catch(e) {}
        
        uIOhook.start();
        this.isCapturing = true;
        console.log('[Session] Hardware listener ACTIVE.');
        return { success: true };
    } catch (e) {
        console.error('[Session Error] Failed to start uIOhook:', e);
        this.isCapturing = false;
        return { success: false, error: e.message };
    }
  }

  stop() {
    if (!this.isCapturing) return;
    this.isCapturing = false;
    try {
        uIOhook.stop();
        console.log('[Session] Hardware listener STOPPED.');
    } catch (e) {
        console.error('[Session Error] Failed to stop uIOhook:', e);
    }
  }

  getStatus() {
    return {
      isCapturing: this.isCapturing,
      lastEvent: this.lastEventTime,
      healthy: (Date.now() - this.lastEventTime < 30000) || !this.isCapturing
    };
  }
}
