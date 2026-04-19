import { fetchWithRetry, sleep } from '../lib/http.mjs';
import { makeListing } from './_types.mjs';

const BASE = 'https://www.redfin.com';

function stripPrefix(text) {
  // Redfin wraps JSON responses with "{}&&" to defeat naive JSON hijacking.
  return text.startsWith('{}&&') ? text.slice(4) : text;
}

async function getRegionIdForZip(zip) {
  const url = `${BASE}/stingray/do/location-autocomplete?location=${zip}&v=2`;
  const res = await fetchWithRetry(url, {
    headers: { 'Accept': 'application/json' }
  });
  if (!res.ok) {
    console.error(`[redfin] autocomplete zip=${zip} status=${res.status}`);
    return null;
  }
  const text = await res.text();
  let json;
  try { json = JSON.parse(stripPrefix(text)); } catch {
    console.error(`[redfin] autocomplete zip=${zip} parse-fail bytes=${text.length} head=${text.slice(0, 80).replace(/\s+/g, ' ')}`);
    return null;
  }
  const sections = json?.payload?.sections || [];
  for (const sec of sections) {
    for (const row of sec.rows || []) {
      if (row.type === 2 || row.id?.startsWith?.('2_')) {
        const id = row.id?.split('_')?.[1];
        if (id) return id;
      }
    }
  }
  console.error(`[redfin] autocomplete zip=${zip} no-region-id`);
  return null;
}

async function fetchRegion(regionId, filters) {
  const { minPrice, maxPrice, minBeds, minBaths } = filters;
  const params = new URLSearchParams({
    al: '1',
    market: 'seattle',
    min_price: String(minPrice),
    max_price: String(maxPrice),
    min_num_beds: String(minBeds),
    min_num_baths: String(minBaths),
    num_homes: '350',
    ord: 'redfin-recommended-asc',
    page_number: '1',
    region_id: regionId,
    region_type: '2',
    sf: '1,2,3,5,6,7',
    status: '1',
    uipt: '1', // single-family only
    v: '8'
  });
  const url = `${BASE}/stingray/api/gis?${params.toString()}`;
  const res = await fetchWithRetry(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) {
    console.error(`[redfin] gis region=${regionId} status=${res.status}`);
    return [];
  }
  const text = await res.text();
  let json;
  try { json = JSON.parse(stripPrefix(text)); } catch {
    console.error(`[redfin] gis region=${regionId} parse-fail bytes=${text.length}`);
    return [];
  }
  const homes = json?.payload?.homes || [];
  console.error(`[redfin] gis region=${regionId} homes=${homes.length}`);
  return homes;
}

function mapHome(h) {
  const addr = h.streetLine?.value || h.streetLine || '';
  const city = h.city || '';
  const state = h.state || h.stateCode || '';
  const zip = h.postalCode?.value || h.zip || h.postalCode || '';
  const url = h.url ? (h.url.startsWith('http') ? h.url : BASE + h.url) : '';
  const photos = [];
  if (h.photos?.items) for (const p of h.photos.items) if (p.url) photos.push(p.url);
  if (h.primaryPhotoUrl) photos.push(h.primaryPhotoUrl);
  return makeListing({
    sourceId: h.mlsId?.value || h.listingId || h.propertyId,
    sourceName: 'redfin',
    url,
    street: addr,
    city,
    state,
    zip,
    price: h.price?.value ?? h.price,
    beds: h.beds,
    baths: h.baths,
    sqft: h.sqFt?.value ?? h.sqFt,
    lotSize: h.lotSize?.value ?? h.lotSize,
    propertyType: h.propertyType === 1 ? 'single-family' : String(h.propertyType ?? ''),
    hoaFee: h.hoa?.value ?? h.hoa,
    yearBuilt: h.yearBuilt?.value ?? h.yearBuilt,
    photos,
    description: h.listingRemarks || ''
  });
}

export async function fetch_redfin(filters, { zips = [] } = {}) {
  const out = [];
  for (const zip of zips) {
    try {
      const regionId = await getRegionIdForZip(zip);
      if (!regionId) continue;
      const homes = await fetchRegion(regionId, filters);
      for (const h of homes) {
        const l = mapHome(h);
        if (l.addressKey) out.push(l);
      }
      await sleep(250 + Math.random() * 250);
    } catch (err) {
      console.error(`[redfin] zip ${zip} failed:`, err.message);
    }
  }
  return out;
}
