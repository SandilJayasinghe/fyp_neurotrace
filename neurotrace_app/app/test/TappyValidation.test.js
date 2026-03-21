import { describe, it, expect, vi } from 'vitest';
import { classifyKey } from '../src/main/handMap';
import { UiohookKey } from 'uiohook-napi';

describe('Tappy Motor Classification Protocol', () => {
  
  it('L key classified correctly via handMap', () => {
    // UiohookKey.A is left hand
    expect(classifyKey(UiohookKey.A)).toBe('L');
    expect(classifyKey(UiohookKey.Q)).toBe('L');
    expect(classifyKey(UiohookKey.Z)).toBe('L');
  });

  it('R key classified correctly via handMap', () => {
    // UiohookKey.L is right hand
    expect(classifyKey(UiohookKey.L)).toBe('R');
    expect(classifyKey(UiohookKey.P)).toBe('R');
    expect(classifyKey(UiohookKey.M)).toBe('R');
  });

  it('Space classified as R', () => {
    expect(classifyKey(UiohookKey.Space)).toBe('R');
  });

  it('Arrow key produces null (ignore entirely)', () => {
    expect(classifyKey(UiohookKey.ArrowLeft)).toBe(null);
    expect(classifyKey(UiohookKey.ArrowRight)).toBe(null);
  });

  it('F-key produces null (ignore entirely)', () => {
    expect(classifyKey(UiohookKey.F1)).toBe(null);
    expect(classifyKey(UiohookKey.F5)).toBe(null);
    expect(classifyKey(UiohookKey.F12)).toBe(null);
  });

  it('Numeric keys classified correctly (1-5: L, 6-0: R)', () => {
    expect(classifyKey(UiohookKey['1'])).toBe('L');
    expect(classifyKey(UiohookKey['5'])).toBe('L');
    expect(classifyKey(UiohookKey['6'])).toBe('R');
    expect(classifyKey(UiohookKey['0'])).toBe('R');
  });

  it('Special symbols classified correctly (Backspace/Enter: R)', () => {
    expect(classifyKey(UiohookKey.Backspace)).toBe('R');
    expect(classifyKey(UiohookKey.Enter)).toBe('R');
    expect(classifyKey(UiohookKey.Semicolon)).toBe('R');
  });

});
