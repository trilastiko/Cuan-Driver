import { describe, it, expect } from 'vitest';
import { mockScan } from '../shared/mockscan';

describe('mockScan (mode demo tanpa API key)', () => {
  const imgA = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const imgB = new Uint8Array([9, 9, 9, 9]);

  it('deterministik: gambar sama -> hasil sama', () => {
    expect(mockScan(imgA)).toEqual(mockScan(imgA));
  });

  it('gambar beda -> hasil (hampir pasti) beda', () => {
    const a = mockScan(imgA);
    const b = mockScan(imgB);
    expect(a.gross_amount !== b.gross_amount || a.order_count !== b.order_count).toBe(true);
  });

  it('angka dalam rentang masuk akal', () => {
    for (const img of [imgA, imgB, 'c3RyaW5nIGJhc2U2NA==']) {
      const r = mockScan(img as never);
      expect(r.gross_amount).toBeGreaterThanOrEqual(80000);
      expect(r.gross_amount).toBeLessThanOrEqual(275000);
      expect(r.order_count).toBeGreaterThanOrEqual(6);
      expect(r.order_count).toBeLessThanOrEqual(24);
      expect(r.mock).toBe(true);
      expect(r.confidence).toBe('demo');
    }
  });

  it('menghormati platform hint', () => {
    expect(mockScan(imgA, 'grab').platform).toBe('grab');
  });
});
