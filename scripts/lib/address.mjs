const STREET_SUFFIXES = {
  st: 'street', str: 'street', street: 'street',
  ave: 'avenue', av: 'avenue', avenue: 'avenue',
  blvd: 'boulevard', boulevard: 'boulevard',
  rd: 'road', road: 'road',
  dr: 'drive', drive: 'drive',
  ln: 'lane', lane: 'lane',
  ct: 'court', court: 'court',
  pl: 'place', place: 'place',
  pkwy: 'parkway', parkway: 'parkway',
  ter: 'terrace', terrace: 'terrace',
  way: 'way',
  cir: 'circle', circle: 'circle',
  hwy: 'highway', highway: 'highway',
  loop: 'loop',
  trl: 'trail', trail: 'trail'
};

const DIRECTIONALS = {
  n: 'north', s: 'south', e: 'east', w: 'west',
  ne: 'northeast', nw: 'northwest', se: 'southeast', sw: 'southwest',
  north: 'north', south: 'south', east: 'east', west: 'west',
  northeast: 'northeast', northwest: 'northwest',
  southeast: 'southeast', southwest: 'southwest'
};

export function normalizeStreet(input) {
  if (!input) return '';
  let s = String(input).toLowerCase().trim();
  // strip unit/apt/suite segments
  s = s.replace(/(?:#|apt\.?|unit|suite|ste\.?|\bno\.?)\s*[\w-]+/gi, '');
  s = s.replace(/,\s*(apt|unit|suite|ste|#).*$/i, '');
  s = s.replace(/[.,]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  const parts = s.split(' ').filter(Boolean);
  const out = parts.map((p) => {
    const bare = p.replace(/[^a-z0-9]/g, '');
    if (DIRECTIONALS[bare]) return DIRECTIONALS[bare];
    if (STREET_SUFFIXES[bare]) return STREET_SUFFIXES[bare];
    return bare;
  }).filter(Boolean);
  return out.join(' ');
}

export function normalizeAddressKey(street, zip) {
  const s = normalizeStreet(street);
  const z = String(zip || '').trim().slice(0, 5);
  if (!s || !z) return '';
  return `${s}|${z}`;
}
