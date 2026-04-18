import { readJSON, writeJSON } from './lib/store.mjs';
import { ZIP_ALLOWLIST } from './lib/geo.mjs';
import { fetch_redfin } from './sources/redfin.mjs';
import { fetch_realtor } from './sources/realtor.mjs';
import { fetch_zillow } from './sources/zillow.mjs';
import { fetch_homes } from './sources/homes.mjs';
import { dedupeAcrossSources } from './dedupe.mjs';
import { applyFilter, CRITERIA } from './filter.mjs';
import { recheckWatched } from './track-watched.mjs';
import { setupVapid, sendNotifications } from './send-push.mjs';

const SOURCES = {
  redfin: fetch_redfin,
  realtor: fetch_realtor,
  zillow: fetch_zillow,
  homes: fetch_homes
};

function parseArgs(argv) {
  const out = { dryRun: false, source: null };
  for (const a of argv.slice(2)) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--source=')) out.source = a.slice('--source='.length);
  }
  return out;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function runSources(sourceName) {
  const names = sourceName ? [sourceName] : Object.keys(SOURCES);
  const filters = {
    minPrice: CRITERIA.minPrice,
    maxPrice: CRITERIA.maxPrice,
    minBeds: CRITERIA.minBeds,
    minBaths: CRITERIA.minBaths
  };
  const tasks = names.map(async (name) => {
    try {
      const fn = SOURCES[name];
      const listings = await fn(filters, { zips: ZIP_ALLOWLIST });
      return { name, listings };
    } catch (err) {
      console.error(`[${name}] failed:`, err.message);
      return { name, listings: [], error: err.message };
    }
  });
  const settled = await Promise.allSettled(tasks);
  const merged = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') {
      console.error(`[${r.value.name}] fetched ${r.value.listings.length}`);
      merged.push(...r.value.listings);
    }
  }
  return merged;
}

async function main() {
  const { dryRun, source } = parseArgs(process.argv);

  const prevListings = await readJSON('listings', []);
  const verdicts = await readJSON('verdicts', {});
  const priceHistory = await readJSON('priceHistory', {});
  const subscriptions = await readJSON('subscriptions', []);
  const notifLog = await readJSON('notifications', []);

  const prevByKey = new Map(prevListings.map((l) => [l.addressKey, l]));
  const historyKeys = new Set(Object.keys(priceHistory));
  const runDate = today();

  const raw = await runSources(source);
  const deduped = dedupeAcrossSources(raw);

  // preserve firstSeen across runs
  for (const l of deduped) {
    const prev = prevByKey.get(l.addressKey);
    if (prev?.firstSeen) l.firstSeen = prev.firstSeen;
  }

  const { passed, rejected, flagged } = applyFilter(deduped);

  // New listings = passed & not seen before (via listings or history)
  const newListings = passed.filter((l) =>
    !prevByKey.has(l.addressKey) && !historyKeys.has(l.addressKey)
  );

  // Watched: anything user thumbed up
  const likedKeys = new Set(
    Object.entries(verdicts)
      .filter(([, v]) => v?.verdict === 'up')
      .map(([k]) => k)
  );
  const watched = passed.filter((l) => likedKeys.has(l.addressKey));
  const { updates: watchedUpdates, priceHistory: nextPriceHistory } =
    await recheckWatched(watched, priceHistory);

  const payloads = [];
  if (newListings.length > 0) {
    payloads.push({
      title: `House Hunt: ${newListings.length} new listing${newListings.length === 1 ? '' : 's'}`,
      body: newListings.slice(0, 3).map((l) => `$${(l.price / 1000).toFixed(0)}k — ${l.address}`).join('\n'),
      tag: `new-${runDate}`,
      url: '/house-hunt/'
    });
  }
  for (const u of watchedUpdates) {
    if (u.type === 'price-change') {
      payloads.push({
        title: `Price ${u.direction} — ${u.address}`,
        body: `$${(u.oldPrice / 1000).toFixed(0)}k → $${(u.newPrice / 1000).toFixed(0)}k`,
        tag: `price-${u.addressKey}`,
        url: u.url
      });
    } else if (u.type === 'status-change') {
      payloads.push({
        title: `Status: ${u.newStatus} — ${u.address}`,
        body: `was ${u.oldStatus}`,
        tag: `status-${u.addressKey}`,
        url: u.url
      });
    }
  }

  const summary = {
    runDate,
    counts: {
      fetched: raw.length,
      deduped: deduped.length,
      passed: passed.length,
      rejected: rejected.length,
      flagged: flagged.length,
      new: newListings.length,
      watchedUpdates: watchedUpdates.length
    }
  };
  console.error(JSON.stringify(summary));

  if (dryRun) {
    await writeJSON('preview.json', {
      summary,
      newListings,
      passed,
      rejected: rejected.slice(0, 25),
      watchedUpdates
    });
    console.error('dry-run: wrote data/preview.json');
    return;
  }

  // Persist state
  await writeJSON('listings', passed);
  await writeJSON('priceHistory', nextPriceHistory);

  const nowIso = new Date().toISOString();
  const nextNotifLog = [
    ...notifLog,
    ...payloads.map((p) => ({ ...p, ts: nowIso }))
  ].slice(-500);
  await writeJSON('notifications', nextNotifLog);

  await writeJSON('lastRun', {
    timestamp: nowIso,
    runDate,
    summary
  });

  // Send pushes
  if (payloads.length > 0 && subscriptions.length > 0) {
    try {
      setupVapid();
      const { kept } = await sendNotifications(subscriptions, payloads);
      if (kept.length !== subscriptions.length) {
        await writeJSON('subscriptions', kept);
        console.error(`pruned ${subscriptions.length - kept.length} dead subscriptions`);
      }
    } catch (err) {
      console.error('push failed:', err.message);
    }
  } else {
    console.error(`no push: payloads=${payloads.length} subs=${subscriptions.length}`);
  }
}

main().catch((err) => {
  console.error('daily-run fatal:', err);
  process.exit(1);
});
