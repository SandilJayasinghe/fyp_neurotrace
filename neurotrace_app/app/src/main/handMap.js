import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { UiohookKey } = require('uiohook-napi');

/**
 * Maps physical keycodes to L (Left hand) or R (Right hand)
 * and their primary character for UI validation.
 * HARDENED FOR CLINICAL RELIABILITY.
 */
console.log('[HandMap] Initializing clinical keyboard map...');

const MAP = {
  // --- Left Hand keys ('L') ---
  [UiohookKey.Backquote]: { hand: 'L', char: '`' },
  [UiohookKey['1']]: { hand: 'L', char: '1' },
  [UiohookKey['2']]: { hand: 'L', char: '2' },
  [UiohookKey['3']]: { hand: 'L', char: '3' },
  [UiohookKey['4']]: { hand: 'L', char: '4' },
  [UiohookKey['5']]: { hand: 'L', char: '5' },
  [UiohookKey.Q]: { hand: 'L', char: 'q' },
  [UiohookKey.W]: { hand: 'L', char: 'w' },
  [UiohookKey.E]: { hand: 'L', char: 'e' },
  [UiohookKey.R]: { hand: 'L', char: 'r' },
  [UiohookKey.T]: { hand: 'L', char: 't' },
  [UiohookKey.A]: { hand: 'L', char: 'a' },
  [UiohookKey.S]: { hand: 'L', char: 's' },
  [UiohookKey.D]: { hand: 'L', char: 'd' },
  [UiohookKey.F]: { hand: 'L', char: 'f' },
  [UiohookKey.G]: { hand: 'L', char: 'g' },
  [UiohookKey.Z]: { hand: 'L', char: 'z' },
  [UiohookKey.X]: { hand: 'L', char: 'x' },
  [UiohookKey.C]: { hand: 'L', char: 'c' },
  [UiohookKey.V]: { hand: 'L', char: 'v' },
  [UiohookKey.B]: { hand: 'L', char: 'b' },

  // --- Right Hand keys ('R') ---
  [UiohookKey['6']]: { hand: 'R', char: '6' },
  [UiohookKey['7']]: { hand: 'R', char: '7' },
  [UiohookKey['8']]: { hand: 'R', char: '8' },
  [UiohookKey['9']]: { hand: 'R', char: '9' },
  [UiohookKey['0']]: { hand: 'R', char: '0' },
  [UiohookKey.Minus]: { hand: 'R', char: '-' },
  [UiohookKey.Equal]: { hand: 'R', char: '=' },
  [UiohookKey.Backspace]: { hand: 'R', char: 'Backspace' },
  [UiohookKey.Y]: { hand: 'R', char: 'y' },
  [UiohookKey.U]: { hand: 'R', char: 'u' },
  [UiohookKey.I]: { hand: 'R', char: 'i' },
  [UiohookKey.O]: { hand: 'R', char: 'o' },
  [UiohookKey.P]: { hand: 'R', char: 'p' },
  [UiohookKey.BracketLeft]: { hand: 'R', char: '[' },
  [UiohookKey.BracketRight]: { hand: 'R', char: ']' },
  [UiohookKey.Backslash]: { hand: 'R', char: '\\' },
  [UiohookKey.H]: { hand: 'R', char: 'h' },
  [UiohookKey.J]: { hand: 'R', char: 'j' },
  [UiohookKey.K]: { hand: 'R', char: 'k' },
  [UiohookKey.L]: { hand: 'R', char: 'l' },
  [UiohookKey.Semicolon]: { hand: 'R', char: ';' },
  [UiohookKey.Quote]: { hand: 'R', char: "'" },
  [UiohookKey.Enter]: { hand: 'R', char: 'Enter' },
  [UiohookKey.N]: { hand: 'R', char: 'n' },
  [UiohookKey.M]: { hand: 'R', char: 'm' },
  [UiohookKey.Comma]: { hand: 'R', char: ',' },
  [UiohookKey.Period]: { hand: 'R', char: '.' },
  [UiohookKey.Slash]: { hand: 'R', char: '/' },
  [UiohookKey.Space]: { hand: 'R', char: ' ' },
};

console.log(`[HandMap] Mapping initialized. A is keycode: ${UiohookKey.A}`);

/**
 * Classifies a raw keycode into a hand/char object.
 * Returns { hand, char } or null
 */
export function classifyKey(keycode) {
  return MAP[keycode] ?? null;
}

