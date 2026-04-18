// ZIP allowlist: roughly 30-45 min drive from Edmonds, WA (98020).
// Covers Edmonds, Lynnwood, Mountlake Terrace, Mill Creek, Bothell,
// Kenmore, Shoreline, Lake Forest Park, Mukilteo, Everett (S/W),
// Woodinville, Brier, Kirkland (N), and nearby.
export const ZIP_ALLOWLIST = [
  '98020', // Edmonds
  '98026', // Edmonds (north/Perrinville)
  '98036', // Lynnwood (south)
  '98037', // Lynnwood (north)
  '98043', // Mountlake Terrace
  '98087', // Lynnwood (east/Paine Field)
  '98155', // Lake Forest Park / Shoreline
  '98177', // Richmond Beach / Shoreline
  '98133', // Shoreline (north Seattle)
  '98028', // Kenmore
  '98011', // Bothell
  '98012', // Mill Creek / Bothell
  '98021', // Bothell (east)
  '98275', // Mukilteo
  '98208', // Everett (south)
  '98296', // Mill Creek (east)
  '98201', // Everett
  '98203', // Everett (west)
  '98204', // Everett (southwest)
  '98072', // Woodinville
  '98077', // Woodinville (east)
  '98034'  // Kirkland (north)
];

export function inAllowlist(zip) {
  if (!zip) return false;
  return ZIP_ALLOWLIST.includes(String(zip).slice(0, 5));
}
