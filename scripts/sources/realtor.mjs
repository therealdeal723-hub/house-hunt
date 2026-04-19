import { fetchWithRetry, sleep } from '../lib/http.mjs';
import { makeListing } from './_types.mjs';

const BASE = 'https://www.realtor.com';

function buildUrl(zip, filters) {
  const { minPrice, maxPrice, minBeds, minBaths } = filters;
  return `${BASE}/realestateandhomes-search/${zip}/type-single-family-home/price-${minPrice}-${maxPrice}/beds-${minBeds}/baths-${minBaths}`;
}

function extractNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function findResults(node, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (Array.isArray(node)) {
    for (const item of node) findResults(item, found);
    return found;
  }
  if (Array.isArray(node.results) && node.results.length && typeof node.results[0] === 'object') {
    // heuristic: looks like a listings array if entries have property_id or listing_id
    const sample = node.results[0];
    if (sample && (sample.property_id || sample.listing_id || sample.listing?.listing_id)) {
      found.push(...node.results);
    }
  }
  for (const k of Object.keys(node)) {
    findResults(node[k], found);
  }
  return found;
}

function mapResult(r) {
  const listing = r.listing || r;
  const loc = listing.location || r.location || {};
  const addr = loc.address || r.address || {};
  const description = listing.description || r.description || {};
  const photos = (listing.photos || r.photos || []).map((p) => p.href || p.url).filter(Boolean);
  const primary = listing.primary_photo?.href || r.primary_photo?.href;
  if (primary) photos.unshift(primary);
  const hoa = listing.hoa?.fee || r.hoa?.fee || null;
  return makeListing({
    sourceId: listing.listing_id || r.property_id || r.listing_id,
    sourceName: 'realtor',
    url: (listing.href || r.href || (r.permalink ? `${BASE}/realestateandhomes-detail/${r.permalink}` : '')) || '',
    street: addr.line || addr.street_address || '',
    city: addr.city || '',
    state: addr.state_code || addr.state || '',
    zip: addr.postal_code || '',
    price: listing.list_price || r.list_price || r.price,
    beds: description.beds || r.beds,
    baths: description.baths || description.baths_consolidated || r.baths,
    sqft: description.sqft || r.sqft,
    lotSize: description.lot_sqft || r.lot_sqft,
    propertyType: description.type || r.prop_type || '',
    hoaFee: hoa,
    yearBuilt: description.year_built || r.year_built,
    garageSpaces: description.garage || r.garage,
    photos,
    description: listing.description?.text || r.description?.text || ''
  });
}

export async function fetch_realtor(filters, { zips = [] } = {}) {
  const out = [];
  for (const zip of zips) {
    try {
      const url = buildUrl(zip, filters);
      const res = await fetchWithRetry(url);
      if (!res.ok) {
        console.error(`[realtor] zip=${zip} status=${res.status}`);
        await sleep(300); continue;
      }
      const html = await res.text();
      const nd = extractNextData(html);
      if (!nd) {
        console.error(`[realtor] zip=${zip} no-next-data bytes=${html.length} head=${html.slice(0, 120).replace(/\s+/g, ' ')}`);
        continue;
      }
      const results = findResults(nd);
      const seen = new Set();
      for (const r of results) {
        const l = mapResult(r);
        if (!l.addressKey || seen.has(l.addressKey)) continue;
        seen.add(l.addressKey);
        out.push(l);
      }
      console.error(`[realtor] zip=${zip} results=${results.length} kept=${seen.size}`);
      await sleep(400 + Math.random() * 400);
    } catch (err) {
      console.error(`[realtor] zip ${zip} failed:`, err.message);
    }
  }
  return out;
}
