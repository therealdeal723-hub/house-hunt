import { fetchWithRetry } from './lib/http.mjs';

function extractPrice(html) {
  // Try JSON-LD first
  const ldMatches = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  for (const m of ldMatches) {
    try {
      const json = JSON.parse(m[1]);
      const candidates = Array.isArray(json) ? json : [json];
      for (const c of candidates) {
        const offers = c?.offers || c?.offer;
        const price = offers?.price ?? c?.price;
        const n = Number(price);
        if (Number.isFinite(n) && n > 1000) return n;
      }
    } catch { /* ignore */ }
  }
  // Fallback: common price tags
  const patterns = [
    /"price"\s*:\s*"?(\d{6,7})"?/,
    /data-price="(\d{6,7})"/,
    /\$([\d,]{6,9})/
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      const n = Number(String(m[1]).replace(/,/g, ''));
      if (Number.isFinite(n) && n > 100000) return n;
    }
  }
  return null;
}

function extractStatus(html) {
  const patterns = [
    /"mlsStatus"\s*:\s*"([^"]+)"/i,
    /"homeStatus"\s*:\s*"([^"]+)"/i,
    /"standardStatus"\s*:\s*"([^"]+)"/i,
    /"status"\s*:\s*"(Active|Pending|Contingent|Sold|Closed|Off Market)"/i
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

export async function recheckWatched(listings, priceHistory) {
  const updates = []; // notifications to emit
  const nextHistory = { ...priceHistory };

  for (const l of listings) {
    if (!l.url) continue;
    try {
      const res = await fetchWithRetry(l.url, {}, { retries: 2 });
      if (!res.ok) continue;
      const html = await res.text();
      const price = extractPrice(html);
      const status = extractStatus(html);
      const history = nextHistory[l.addressKey] || [];
      const last = history[history.length - 1] || {};

      const now = new Date().toISOString();
      const entry = { ts: now, price, status };

      if (price != null && last.price != null && price !== last.price) {
        updates.push({
          type: 'price-change',
          addressKey: l.addressKey,
          address: l.address,
          url: l.url,
          oldPrice: last.price,
          newPrice: price,
          direction: price < last.price ? 'drop' : 'raise'
        });
      }
      if (status && last.status && status.toLowerCase() !== String(last.status).toLowerCase()) {
        updates.push({
          type: 'status-change',
          addressKey: l.addressKey,
          address: l.address,
          url: l.url,
          oldStatus: last.status,
          newStatus: status
        });
      }

      if (price != null || status != null) {
        history.push(entry);
        nextHistory[l.addressKey] = history.slice(-200);
      }
    } catch (err) {
      console.error(`[track-watched] ${l.addressKey} failed:`, err.message);
    }
  }

  return { updates, priceHistory: nextHistory };
}
