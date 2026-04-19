import { fetchWithRetry, sleep } from '../lib/http.mjs';
import { makeListing } from './_types.mjs';

const BASE = 'https://www.zillow.com';

function buildSearchUrl(zip, filters) {
  const { minPrice, maxPrice, minBeds, minBaths } = filters;
  const state = {
    pagination: {},
    usersSearchTerm: zip,
    filterState: {
      price: { min: minPrice, max: maxPrice },
      beds: { min: minBeds },
      baths: { min: minBaths },
      ah: { value: true },
      con: { value: false },
      tow: { value: false },
      apa: { value: false },
      manu: { value: false },
      apco: { value: false }
    },
    isListVisible: true
  };
  const qs = encodeURIComponent(JSON.stringify(state));
  return `${BASE}/homes/${zip}_rb/?searchQueryState=${qs}`;
}

function isCaptcha(html) {
  if (!html) return false;
  const lower = html.toLowerCase();
  return lower.includes('px-captcha')
    || lower.includes('press &amp; hold')
    || lower.includes('press and hold')
    || lower.includes('perimeterx');
}

function extractNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (m) {
    try { return JSON.parse(m[1]); } catch { /* fall through */ }
  }
  return null;
}

function findListResults(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const v of node) findListResults(v, out);
    return out;
  }
  if (Array.isArray(node.listResults) && node.listResults.length) {
    out.push(...node.listResults);
  }
  if (Array.isArray(node.mapResults) && node.mapResults.length && out.length === 0) {
    out.push(...node.mapResults);
  }
  for (const k of Object.keys(node)) findListResults(node[k], out);
  return out;
}

function mapResult(r) {
  const addr = r.address || '';
  let street = addr, city = '', state = '', zip = '';
  const m = String(addr).match(/^(.*?),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})/);
  if (m) { street = m[1]; city = m[2]; state = m[3]; zip = m[4]; }
  const photos = [];
  if (r.imgSrc) photos.push(r.imgSrc);
  if (Array.isArray(r.carouselPhotos)) for (const p of r.carouselPhotos) if (p.url) photos.push(p.url);
  const url = r.detailUrl ? (r.detailUrl.startsWith('http') ? r.detailUrl : BASE + r.detailUrl) : '';
  const hdp = r.hdpData?.homeInfo || {};
  return makeListing({
    sourceId: r.zpid || hdp.zpid,
    sourceName: 'zillow',
    url,
    street,
    city,
    state,
    zip,
    price: r.price || hdp.price || r.unformattedPrice,
    beds: r.beds || hdp.bedrooms,
    baths: r.baths || hdp.bathrooms,
    sqft: r.area || hdp.livingArea,
    lotSize: hdp.lotAreaValue,
    propertyType: hdp.homeType || '',
    photos
  });
}

export async function fetch_zillow(filters, { zips = [] } = {}) {
  const out = [];
  for (const zip of zips) {
    try {
      const url = buildSearchUrl(zip, filters);
      const res = await fetchWithRetry(url, {
        headers: { 'Referer': BASE + '/' }
      }, { retries: 2 });
      if (!res.ok) {
        console.error(`[zillow] zip=${zip} status=${res.status}`);
        await sleep(500); continue;
      }
      const html = await res.text();
      if (isCaptcha(html)) {
        console.error(`[zillow] zip=${zip} captcha-wall bytes=${html.length}`);
        await sleep(1000);
        continue;
      }
      const nd = extractNextData(html);
      if (!nd) {
        console.error(`[zillow] zip=${zip} no-next-data bytes=${html.length} head=${html.slice(0, 120).replace(/\s+/g, ' ')}`);
        continue;
      }
      const results = findListResults(nd);
      const seen = new Set();
      for (const r of results) {
        const l = mapResult(r);
        if (!l.addressKey || seen.has(l.addressKey)) continue;
        seen.add(l.addressKey);
        out.push(l);
      }
      console.error(`[zillow] zip=${zip} results=${results.length} kept=${seen.size}`);
      await sleep(800 + Math.random() * 600);
    } catch (err) {
      console.error(`[zillow] zip ${zip} failed:`, err.message);
    }
  }
  return out;
}
