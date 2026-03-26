import { uIOhook, UiohookKey } from 'uiohook-napi';

/**
 * Keystroke capture service for PD motor screening.
 * REFACTORED: Integrated mapping locally to avoid module-load issues.
 */
export class KeystrokeCaptureService {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.isCapturing = false;
    this.buffer = [];
    this.MAX_BUFFER = 5000;
    this.lastKeyup = null; 
    this.lastKeydown_t = null; 
    this.pendingKeydowns = {}; 
    this.activeModifiers = { shift: false, ctrl: false, alt: false, meta: false };
    this.pressedKeyCodes = new Set();
    this.tappyMode = false;
    this.session_id = `session_${Date.now()}_${Math.floor(Math.random()*1e6)}`;
    this.lastEventTime = 0;
    
    // 1. Initialize Local Mapping (Clinical Grade)
    this.initializeMap();
    this.setupListeners();
  }

  initializeMap() {
    this.MAP = {
      // --- Left Hand keys ('L') ---
      [UiohookKey.Backquote || 41]: { hand: 'L', char: '`' },
      [UiohookKey['1'] || 2]: { hand: 'L', char: '1' },
      [UiohookKey['2'] || 3]: { hand: 'L', char: '2' },
      [UiohookKey['3'] || 4]: { hand: 'L', char: '3' },
      [UiohookKey['4'] || 5]: { hand: 'L', char: '4' },
      [UiohookKey['5'] || 6]: { hand: 'L', char: '5' },
      [UiohookKey.Q || 16]: { hand: 'L', char: 'q' },
      [UiohookKey.W || 17]: { hand: 'L', char: 'w' },
      [UiohookKey.E || 18]: { hand: 'L', char: 'e' },
      [UiohookKey.R || 19]: { hand: 'L', char: 'r' },
      [UiohookKey.T || 20]: { hand: 'L', char: 't' },
      [UiohookKey.A || 30]: { hand: 'L', char: 'a' },
      [UiohookKey.S || 31]: { hand: 'L', char: 's' },
      [UiohookKey.D || 32]: { hand: 'L', char: 'd' },
      [UiohookKey.F || 33]: { hand: 'L', char: 'f' },
      [UiohookKey.G || 34]: { hand: 'L', char: 'g' },
      [UiohookKey.Z || 44]: { hand: 'L', char: 'z' },
      [UiohookKey.X || 45]: { hand: 'L', char: 'x' },
      [UiohookKey.C || 46]: { hand: 'L', char: 'c' },
      [UiohookKey.V || 47]: { hand: 'L', char: 'v' },
      [UiohookKey.B || 48]: { hand: 'L', char: 'b' },

      // --- Right Hand keys ('R') ---
      [UiohookKey['6'] || 7]: { hand: 'R', char: '6' },
      [UiohookKey['7'] || 8]: { hand: 'R', char: '7' },
      [UiohookKey['8'] || 9]: { hand: 'R', char: '8' },
      [UiohookKey['9'] || 10]: { hand: 'R', char: '9' },
      [UiohookKey['0'] || 11]: { hand: 'R', char: '0' },
      [UiohookKey.Minus || 12]: { hand: 'R', char: '-' },
      [UiohookKey.Equal || 13]: { hand: 'R', char: '=' },
      [UiohookKey.Backspace || 14]: { hand: 'R', char: 'Backspace' },
      [UiohookKey.Y || 21]: { hand: 'R', char: 'y' },
      [UiohookKey.U || 22]: { hand: 'R', char: 'u' },
      [UiohookKey.I || 23]: { hand: 'R', char: 'i' },
      [UiohookKey.O || 24]: { hand: 'R', char: 'o' },
      [UiohookKey.P || 25]: { hand: 'R', char: 'p' },
      [UiohookKey.BracketLeft || 26]: { hand: 'R', char: '[' },
      [UiohookKey.BracketRight || 27]: { hand: 'R', char: ']' },
      [UiohookKey.Backslash || 43]: { hand: 'R', char: '\\' },
      [UiohookKey.H || 35]: { hand: 'R', char: 'h' },
      [UiohookKey.J || 36]: { hand: 'R', char: 'j' },
      [UiohookKey.K || 37]: { hand: 'R', char: 'k' },
      [UiohookKey.L || 38]: { hand: 'R', char: 'l' },
      [UiohookKey.Semicolon || 39]: { hand: 'R', char: ';' },
      [UiohookKey.Quote || 40]: { hand: 'R', char: "'" },
      [UiohookKey.Enter || 28]: { hand: 'R', char: 'Enter' },
      [UiohookKey.N || 49]: { hand: 'R', char: 'n' },
      [UiohookKey.M || 50]: { hand: 'R', char: 'm' },
      [UiohookKey.Comma || 51]: { hand: 'R', char: ',' },
      [UiohookKey.Period || 52]: { hand: 'R', char: '.' },
      [UiohookKey.Slash || 53]: { hand: 'R', char: '/' },
      [UiohookKey.Space || 57]: { hand: 'R', char: ' ' },
    };
  }

  classifyKey(keycode) {
    return this.MAP[keycode] || null;
  }

  setupListeners() {
    uIOhook.on('keydown', (event) => {
      this.lastEventTime = Date.now();
      const isMod = this.updateModifiers(event, true);
      if (isMod) return; 

      if (!this.isCapturing) return;

      // 2. OS-level Repeat Filtering
      if (this.pressedKeyCodes.has(event.keycode)) return;

      const t_now = Date.now();
      const overlapSnapshot = Array.from(this.pressedKeyCodes);
      this.pressedKeyCodes.add(event.keycode);

      const isNewSession = this.lastKeydown_t !== null && (t_now - this.lastKeydown_t > 10000);
      const latency = (!isNewSession && this.lastKeydown_t !== null) ? (t_now - this.lastKeydown_t) : null;
      const flight = (!isNewSession && this.lastKeyup !== null) ? (t_now - this.lastKeyup.t_up) : null;

      const mapping = this.classifyKey(event.keycode);
      let mappedChar = mapping ? mapping.char : null;
      let hand = mapping ? mapping.hand : null;

      let finalChar = mappedChar;
      if (!finalChar && event.keychar > 0) {
          finalChar = String.fromCharCode(event.keychar);
      }

      this.pendingKeydowns[event.keycode] = {
        t_down: t_now, latency, flight, hand, char: finalChar,
        overlap: overlapSnapshot.length > 0,
        modifiers: { ...this.activeModifiers }
      };
      this.lastKeydown_t = t_now;

      if (this.activeModifiers.shift && finalChar && finalChar.length === 1) {
          finalChar = finalChar.toUpperCase();
      }

      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('keystroke-keydown', { 
            char: finalChar,
            hand: hand || 'Unknown',
            overlap: overlapSnapshot.length > 0,
            modifiers: this.activeModifiers
          });
      }
    });

    uIOhook.on('keyup', (event) => {
      this.lastEventTime = Date.now();
      const isMod = this.updateModifiers(event, false);
      if (isMod) return;

      this.pressedKeyCodes.delete(event.keycode);
      let pending = this.pendingKeydowns[event.keycode];
      if (!pending) return;

      const t_up = Date.now();
      const hold_time = t_up - pending.t_down;

      if (this.isCapturing && hold_time >= 0 && hold_time <= 10000) {
        let finalChar = pending.char;
        if (this.activeModifiers.shift && finalChar && finalChar.length === 1) {
            finalChar = finalChar.toUpperCase();
        }
        
        const payload = {
          key: this.tappyMode ? pending.hand : finalChar,
          char: finalChar,
          hand: pending.hand,
          hold_time,
          flight_time: pending.flight,
          latency: pending.latency,
          keydown_ts: pending.t_down,
          keyup_ts: t_up,
          overlap: pending.overlap,
          modifiers: pending.modifiers,
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

  updateModifiers(event, state) {
    let isMod = true;
    switch (event.keycode) {
        case UiohookKey.Shift:
        case UiohookKey.ShiftRight: this.activeModifiers.shift = state; break;
        case UiohookKey.Ctrl:
        case UiohookKey.CtrlRight: this.activeModifiers.ctrl = state; break;
        case UiohookKey.Alt:
        case UiohookKey.AltRight: this.activeModifiers.alt = state; break;
        case UiohookKey.Meta:
        case UiohookKey.MetaRight: this.activeModifiers.meta = state; break;
        default: isMod = false;
    }
    return isMod;
  }

  setTappyMode(enabled) {
    this.tappyMode = !!enabled;
  }

  async start() {
    if (this.isCapturing) return { success: true };
    try {
        this.lastKeyup = null;
        this.lastKeydown_t = null;
        this.pressedKeyCodes.clear();
        this.pendingKeydowns = {};
        this.activeModifiers = { shift: false, ctrl: false, alt: false, meta: false };
        try { uIOhook.stop(); } catch(e) {}
        uIOhook.start();
        this.isCapturing = true;
        console.log('[Capture] Hardware listener ACTIVE.');
        return { success: true };
    } catch (e) {
        this.isCapturing = false;
        return { success: false, error: e.message };
    }
  }

  stop() {
    if (!this.isCapturing) return;
    this.isCapturing = false;
    this.pressedKeyCodes.clear();
    this.pendingKeydowns = {};
    try {
        uIOhook.stop();
        console.log('[Capture] Hardware listener STOPPED.');
    } catch (e) {}
  }

  getStatus() {
    return {
      isCapturing: this.isCapturing,
      lastEvent: this.lastEventTime,
      healthy: (Date.now() - this.lastEventTime < 30000) || !this.isCapturing
    };
  }
}



