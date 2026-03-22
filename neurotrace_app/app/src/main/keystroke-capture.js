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
    this.tappyMode = false; // Default to standard typing
    this.session_id = `session_${Date.now()}_${Math.floor(Math.random()*1e6)}`;

    console.log('[Session] Keystroke listener initialized.');
    try { uIOhook.stop(); } catch(e) {}
    this.setupListeners();
  }

  getBuffer() { return this.buffer; }
  getCount() { return this.buffer.length; }
  clearBuffer() { this.buffer = []; this.lastKeydown_t = null; this.lastKeyup = null; }
  
  setupListeners() {
    uIOhook.on('keydown', (event) => {
      // ALWAYS track shifts, even if not 'capturing' currently, to stay in sync
      if (event.keycode === UiohookKey.Shift || event.keycode === UiohookKey.ShiftRight) {
          this.isShiftPressed = true;
          return;
      }

      if (!this.isCapturing) return;

      // Always record all keys, not just mapped ones
      const t_now = Date.now();
      const isNewSession = this.lastKeydown_t !== null && (t_now - this.lastKeydown_t > 10000);
      const latency = (!isNewSession && this.lastKeydown_t !== null) ? (t_now - this.lastKeydown_t) : null;
      const flight = (!isNewSession && this.lastKeyup !== null) ? (t_now - this.lastKeyup.t_up) : null;

      // Try to get readable key from event
      let keyChar = event.keychar || event.rawcode || event.keycode;
      // If mapping exists, use mapped char, else fallback to keyChar
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
      // Diagnostic Log:
      // console.log(`[Session] Keydown: ${mapping.char} (${mapping.hand})`);
    });

    uIOhook.on('keyup', (event) => {
      // Debug print for hand classification
      let pending = this.pendingKeydowns[event.keycode];
      if (pending) {
        console.log('hand classified as:', pending.hand, 'for keycode:', event.keycode);
      }
      if (event.keycode === UiohookKey.Shift || event.keycode === UiohookKey.ShiftRight) {
        this.isShiftPressed = false;
        return;
      }
      // Only declare 'pending' once per handler
      // (already declared above)
      if (!pending) return;

      const t_up = Date.now();
      const hold_time = t_up - pending.t_down;

      if (this.isCapturing && hold_time >= 0 && hold_time <= 10000) {
        // Use mapped char if available, else fallback to key
        let finalChar = pending.char || pending.key;
        if (this.isShiftPressed && finalChar && typeof finalChar === 'string' && finalChar.length === 1) {
            finalChar = finalChar.toUpperCase();
        }

        // Add session_id and datetime
        const payload = {
          key: this.tappyMode ? pending.hand : finalChar, // Tappy expects 'L'/'R', Typing expects actual char
          char: finalChar,
          hand: pending.hand,
          hold_time,
          flight_time: pending.flight,
          latency: pending.latency,
          session_id: this.session_id,
          datetime: new Date(pending.t_down).toISOString(),
        };

        // Emitting events
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

  start() {
    if (this.isCapturing) return;
    try {
        console.log('[Session] Starting hardware listener...');
        // Reset timing state so first keystroke has clean flight/latency baseline
        this.lastKeyup = null;
        this.lastKeydown_t = null;
        uIOhook.start();
        this.isCapturing = true;
        console.log('[Session] Hardware listener ACTIVE.');
    } catch (e) {
        console.error('[Session Error] Failed to start uIOhook:', e);
    }
  }

  stop() {
    if (!this.isCapturing) return; // Prevent redundant stops
    this.isCapturing = false;
    try {
        uIOhook.stop();
        console.log('[Session] Hardware listener STOPPED.');
    } catch (e) {
        // console.error('[Session Error] Failed to stop uIOhook:', e); // Removed as per instruction
    }
  }
}
