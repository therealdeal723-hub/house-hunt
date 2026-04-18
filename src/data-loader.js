const REPO = import.meta.env.VITE_REPO || 'therealdeal723-hub/house-hunt';
const BRANCH = import.meta.env.VITE_BRANCH || 'main';

const FILES = {
  listings: 'data/listings.json',
  verdicts: 'data/verdicts.json',
  priceHistory: 'data/price-history.json',
  notifications: 'data/notifications.json'
};

async function loadFile(path, token) {
  const url = `https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`;
  const headers = {
    'Accept': 'application/vnd.github.raw'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`${path}: ${res.status}`);
  }
  const text = await res.text();
  try { return JSON.parse(text); } catch { return null; }
}

export async function loadAllData(token) {
  const entries = await Promise.all(
    Object.entries(FILES).map(async ([key, path]) => [key, await loadFile(path, token)])
  );
  const out = Object.fromEntries(entries);
  return {
    listings: out.listings || [],
    verdicts: out.verdicts || {},
    priceHistory: out.priceHistory || {},
    notifications: out.notifications || []
  };
}
