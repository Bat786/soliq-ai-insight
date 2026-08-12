// Shared, client-safe number formatting for SOLIQ.

export const fmtUsd = (n: number) => {
  const v = Number.isFinite(n) ? n : 0;
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a >= 1e12) return `${sign}$${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}K`;
  if (a >= 1) return `${sign}$${a.toFixed(2)}`;
  if (a === 0) return "$0.00";
  return `${sign}$${a.toPrecision(3)}`;
};

export const fmtPct = (n: number) => `${n > 0 ? "+" : ""}${(Number.isFinite(n) ? n : 0).toFixed(2)}%`;

export const fmtNum = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};
