import { inAllowlist } from './lib/geo.mjs';

const CRITERIA = {
  minPrice: 800000,
  maxPrice: 1000000,
  minBeds: 3,
  minBaths: 2,
  minSqft: 1500,
  minLot: 3000,
  maxHoa: 100,
  minSchoolRating: 7
};

const ATTACHED_TERMS = [
  'townhouse', 'townhome', 'town home', 'town house',
  'condo', 'condominium',
  'attached', 'shared wall', 'common wall',
  'pud', 'planned unit',
  'zero lot', 'zero-lot',
  'row home', 'rowhome', 'row house',
  'duplex', 'triplex', 'fourplex'
];

const DETACHED_TERMS = [
  'single-family detached', 'single family detached',
  'detached single', 'fully detached',
  'single family residence', 'sfr ', 'sfr,'
];

function classifyDetached(listing) {
  const pt = (listing.propertyType || '').toString().toLowerCase();
  const desc = (listing.description || '').toLowerCase();
  const text = `${pt} ${desc}`;

  if (DETACHED_TERMS.some((t) => text.includes(t))) return 'detached';

  for (const t of ATTACHED_TERMS) {
    if (text.includes(t)) return 'attached';
  }

  // heuristic: small lot + new build = likely PUD / attached-adjacent
  if (
    listing.lotSize != null && listing.lotSize < 4000 &&
    listing.yearBuilt != null && listing.yearBuilt > 2000
  ) {
    return 'borderline';
  }

  if (listing.hoaFee != null && listing.hoaFee > CRITERIA.maxHoa) {
    return 'borderline';
  }

  // default: if property type explicitly says single-family, call it detached
  if (pt.includes('single') || pt.includes('house') || pt === 'residential') {
    return 'detached';
  }

  return 'borderline';
}

function maxSchoolRating(listing) {
  if (!Array.isArray(listing.schools) || listing.schools.length === 0) return null;
  let max = null;
  for (const s of listing.schools) {
    const r = typeof s === 'number' ? s : (s?.rating ?? s?.greatSchoolsRating);
    const n = Number(r);
    if (Number.isFinite(n)) {
      if (max == null || n > max) max = n;
    }
  }
  return max;
}

export function applyFilter(listings) {
  const passed = [];
  const rejected = [];
  const flagged = [];

  for (const l of listings) {
    const reasons = [];
    const flags = [];

    if (!inAllowlist(l.zip)) reasons.push(`zip ${l.zip} not in allowlist`);

    if (l.price == null) reasons.push('missing price');
    else if (l.price < CRITERIA.minPrice) reasons.push(`price ${l.price} < ${CRITERIA.minPrice}`);
    else if (l.price > CRITERIA.maxPrice) reasons.push(`price ${l.price} > ${CRITERIA.maxPrice}`);

    if (l.beds != null && l.beds < CRITERIA.minBeds) reasons.push(`beds ${l.beds} < ${CRITERIA.minBeds}`);
    if (l.baths != null && l.baths < CRITERIA.minBaths) reasons.push(`baths ${l.baths} < ${CRITERIA.minBaths}`);

    if (l.sqft != null && l.sqft < CRITERIA.minSqft) reasons.push(`sqft ${l.sqft} < ${CRITERIA.minSqft}`);
    if (l.lotSize != null && l.lotSize < CRITERIA.minLot) reasons.push(`lot ${l.lotSize} < ${CRITERIA.minLot}`);

    if (l.hoaFee != null && l.hoaFee > CRITERIA.maxHoa) reasons.push(`hoa ${l.hoaFee} > ${CRITERIA.maxHoa}`);

    if (l.garageSpaces != null && l.garageSpaces < 1) reasons.push('no garage');

    const detached = classifyDetached(l);
    if (detached === 'attached') reasons.push('looks attached / townhouse-like');
    if (detached === 'borderline') flags.push('detached: borderline');

    const schoolMax = maxSchoolRating(l);
    if (schoolMax != null && schoolMax < CRITERIA.minSchoolRating) {
      reasons.push(`schools max rating ${schoolMax} < ${CRITERIA.minSchoolRating}`);
    } else if (schoolMax == null) {
      flags.push('schools: unknown rating');
    }

    if (reasons.length > 0) {
      rejected.push({ ...l, rejectedReasons: reasons });
      continue;
    }

    if (flags.length > 0) {
      flagged.push({ ...l, flags });
      passed.push({ ...l, flags });
    } else {
      passed.push(l);
    }
  }

  return { passed, rejected, flagged };
}

export { CRITERIA, classifyDetached };
