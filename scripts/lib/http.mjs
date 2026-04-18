const UAS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
];

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function pickUserAgent() {
  return UAS[Math.floor(Math.random() * UAS.length)];
}

export async function fetchWithRetry(url, options = {}, { retries = 4, baseDelayMs = 600 } = {}) {
  const headers = {
    'User-Agent': pickUserAgent(),
    'Accept': 'text/html,application/json,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    ...(options.headers || {})
  };
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...options, headers });
      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        const retryAfter = Number(res.headers.get('retry-after')) * 1000;
        const delay = retryAfter || baseDelayMs * 2 ** attempt + Math.random() * 250;
        if (attempt < retries) {
          await sleep(delay);
          continue;
        }
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await sleep(baseDelayMs * 2 ** attempt + Math.random() * 250);
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error(`fetchWithRetry exhausted retries for ${url}`);
}
