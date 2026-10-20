import { describe, expect, it } from 'vitest';
import { cloneArrayBufferLike } from './dashboardWorkspace.serialization';

describe('cloneArrayBufferLike', () => {
  it('clones a real ArrayBuffer', () => {
    const source = new Uint8Array([1, 2, 3]).buffer;
    const cloned = cloneArrayBufferLike(source);
    expect(cloned).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(cloned!)).toEqual(new Uint8Array([1, 2, 3]));
    expect(cloned).not.toBe(source);
  });

  it('normalizes ArrayBufferView (Tauri typed arrays)', () => {
    const view = new Uint8Array([9, 8, 7]);
    const cloned = cloneArrayBufferLike(view);
    expect(new Uint8Array(cloned!)).toEqual(new Uint8Array([9, 8, 7]));
  });

  it('normalizes number[] (Tauri Vec<u8> JSON IPC)', () => {
    const cloned = cloneArrayBufferLike([10, 20, 30]);
    expect(cloned).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(cloned!)).toEqual(new Uint8Array([10, 20, 30]));
  });

  it('normalizes { data: number[] } shaped payloads', () => {
    const cloned = cloneArrayBufferLike({ data: [4, 5, 6] });
    expect(new Uint8Array(cloned!)).toEqual(new Uint8Array([4, 5, 6]));
  });

  it('returns null for non-binary values', () => {
    expect(cloneArrayBufferLike(null)).toBeNull();
    expect(cloneArrayBufferLike('nope')).toBeNull();
    expect(cloneArrayBufferLike({ data: 'x' })).toBeNull();
  });
});
