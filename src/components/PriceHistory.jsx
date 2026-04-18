import React from 'react';

export default function PriceHistory({ history }) {
  const prices = history
    .map((h) => h.price)
    .filter((p) => typeof p === 'number' && Number.isFinite(p));
  if (prices.length < 2) return null;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = Math.max(1, max - min);
  const w = 100;
  const h = 30;

  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w;
    const y = h - ((p - min) / span) * h;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');

  const last = prices[prices.length - 1];
  const first = prices[0];
  const stroke = last < first ? '#22c55e' : last > first ? '#ef4444' : '#94a3b8';

  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline fill="none" stroke={stroke} strokeWidth="1.5" points={pts} />
    </svg>
  );
}
