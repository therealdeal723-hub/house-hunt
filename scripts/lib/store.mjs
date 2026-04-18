import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'data');

export const STORES = {
  listings: 'listings.json',
  verdicts: 'verdicts.json',
  priceHistory: 'price-history.json',
  notifications: 'notifications.json',
  subscriptions: 'subscriptions.json',
  lastRun: 'last-run.json'
};

export function dataPath(name) {
  const file = STORES[name] || name;
  return path.join(DATA_DIR, file);
}

export async function readJSON(name, fallback) {
  const p = dataPath(name);
  try {
    const text = await fs.readFile(p, 'utf8');
    return JSON.parse(text);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

export async function writeJSON(name, value) {
  const p = dataPath(name);
  await fs.mkdir(path.dirname(p), { recursive: true });
  const text = JSON.stringify(value, null, 2) + '\n';
  await fs.writeFile(p, text, 'utf8');
}

export { DATA_DIR, ROOT };
