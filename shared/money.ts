// Format Rupiah tanpa dependensi Intl (konsisten di Workers, browser, Node).

/** 1234567 -> "1.234.567" */
export function groupThousands(n: number): string {
  const v = Math.round(Math.abs(n));
  const s = String(v);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const fromEnd = s.length - i;
    out += s[i];
    if (fromEnd > 1 && (fromEnd - 1) % 3 === 0) out += '.';
  }
  return out;
}

/** 250000 -> "Rp250.000"; -5000 -> "-Rp5.000" */
export function formatRupiah(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}Rp${groupThousands(n)}`;
}

/** Seperti formatRupiah tapi selalu bertanda: +Rp / -Rp */
export function formatRupiahSigned(n: number): string {
  const sign = n < 0 ? '-' : '+';
  return `${sign}Rp${groupThousands(n)}`;
}

/** "25.000" / "Rp 25,000" / "25000" -> 25000. NaN jika tak bisa dibaca. */
export function parseRupiah(input: string): number {
  const cleaned = input.replace(/[^\d,-]/g, '').replace(/[.,]/g, '');
  if (cleaned === '' || cleaned === '-') return NaN;
  return parseInt(cleaned, 10);
}
