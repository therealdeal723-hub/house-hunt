import { fetchWithRetry, sleep } from '../lib/http.mjs';
import { makeListing } from './_types.mjs';

const BASE = 'https://www.homes.com';

function buildUrl(zip, filters) {
  const { minPrice, maxPrice, minBeds, minBaths } = filters;
  const params = new URLSearchParams({
    property_type: '1', // houses
    min_price: String(minPrice),
    max_price: String(maxPrice),
    min_beds: String(minBeds),
    min_baths: String(minBaths)
  });
  return `${BASE}/${zip}/houses-for-sale/?${params.toString()}`;
}

function extractInitialState(html) {
  const m = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*;\s*<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function findListings(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const v of node) findListings(v, out);
    return out;
  }
  for (const key of ['listings', 'placards', 'results']) {
    if (Array.isArray(node[key]) && node[key].length && typeof node[key][0] === 'object') {
      const s = node[key][0];
      if (s && (s.propertyId || s.listingKey || s.address || s.url)) {
        out.push(...node[key]);
      }
    }
  }
  for (const k of Object.keys(node)) findListings(node[k], out);
  return out;
}

function mapItem(item) {
  const addr = item.address || {};
  const street = addr.streetAddress || item.streetAddress || '';
  const city = addr.city || item.city || '';
  const state = addr.state || addr.stateOrProvince || item.state || '';
  const zip = addr.postalCode || item.postalCode || '';
  const url = item.url
    ? (item.url.startsWith('http') ? item.url : BASE + item.url)
    : '';
  const photos = (item.photos || item.images || []).map((p) => typeof p === 'string' ? p : p?.url || p?.href).filter(Boolean);
  if (item.primaryPhoto) photos.unshift(item.primaryPhoto);
  return makeListing({
    sourceId: item.propertyId || item.listingKey || item.id,
    sourceName: 'homes',
    url,
    street,
    city,
    state,
    zip,
    price: item.listPrice || item.price,
    beds: item.beds || item.bedrooms,
    baths: item.baths || item.bathrooms,
    sqft: item.sqft || item.livingArea,
    lotSize: item.lotSize || item.lotSqft,
    propertyType: item.propertyType || 'house',
    hoaFee: item.hoaFee,
    yearBuilt: item.yearBuilt,
    photos,
    description: item.description || ''
  });
}

export async function fetch_homes(filters, { zips = [] } = {}) {
  const out = [];
  for (const zip of zips) {
    try {
      const res = await fetchWithRetry(buildUrl(zip, filters));
      if (!res.ok) {
        console.error(`[homes] zip=${zip} status=${res.status}`);
        await sleep(300); continue;
      }
      const html = await res.text();
      const state = extractInitialState(html);
      if (!state) {
        console.error(`[homes] zip=${zip} no-initial-state bytes=${html.length} head=${html.slice(0, 120).replace(/\s+/g, ' ')}`);
        continue;
      }
      const items = findListings(state);
      const seen = new Set();
      for (const item of items) {
        const l = mapItem(item);
        if (!l.addressKey || seen.has(l.addressKey)) continue;
        seen.add(l.addressKey);
        out.push(l);
      }
      console.error(`[homes] zip=${zip} items=${items.length} kept=${seen.size}`);
      await sleep(400 + Math.random() * 400);
    } catch (err) {
      console.error(`[homes] zip ${zip} failed:`, err.message);
    }
  }
  return out;
}
