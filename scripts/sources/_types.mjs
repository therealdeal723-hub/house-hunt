import { normalizeAddressKey } from '../lib/address.mjs';

/**
 * Canonical Listing shape used across sources.
 */
export function makeListing(partial = {}) {
  const {
    sourceId = null,
    sourceName = 'unknown',
    url = '',
    street = '',
    city = '',
    state = '',
    zip = '',
    price = null,
    beds = null,
    baths = null,
    sqft = null,
    lotSize = null,
    propertyType = null,
    hoaFee = null,
    yearBuilt = null,
    garageSpaces = null,
    photos = [],
    schools = [],
    description = '',
    status = 'active',
    firstSeen = new Date().toISOString()
  } = partial;

  const addressKey = normalizeAddressKey(street, zip);
  const address = [street, city, state, zip].filter(Boolean).join(', ');

  return {
    addressKey,
    sourceId: sourceId != null ? String(sourceId) : null,
    sourceName,
    url,
    address,
    street,
    city,
    state,
    zip: zip ? String(zip).slice(0, 5) : '',
    price: num(price),
    beds: num(beds),
    baths: num(baths),
    sqft: num(sqft),
    lotSize: num(lotSize),
    propertyType,
    hoaFee: num(hoaFee),
    yearBuilt: num(yearBuilt),
    garageSpaces: num(garageSpaces),
    photos: Array.isArray(photos) ? photos.filter(Boolean) : [],
    schools: Array.isArray(schools) ? schools : [],
    description: description || '',
    status,
    firstSeen
  };
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}
