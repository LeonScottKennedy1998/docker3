export function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const t = value.trim().replace(',', '.');
    if (t === '') return fallback;
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function formatRub(value: unknown, fractionDigits = 2): string {
  return `${toFiniteNumber(value).toFixed(fractionDigits)} ₽`;
}
