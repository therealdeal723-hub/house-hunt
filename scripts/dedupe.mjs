const SOURCE_PRIORITY = ['redfin', 'realtor', 'zillow', 'homes'];

function priorityRank(name) {
  const i = SOURCE_PRIORITY.indexOf(name);
  return i === -1 ? SOURCE_PRIORITY.length : i;
}

function lowerPrice(a, b) {
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}

function unionPhotos(a = [], b = []) {
  const seen = new Set();
  const out = [];
  for (const p of [...a, ...b]) {
    if (!p || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

function merge(primary, secondary) {
  const out = { ...primary };
  for (const key of Object.keys(secondary)) {
    if (key === 'price') {
      out.price = lowerPrice(out.price, secondary.price);
    } else if (key === 'photos') {
      out.photos = unionPhotos(out.photos, secondary.photos);
    } else if (key === 'sources') {
      // handled separately
    } else if (out[key] == null || out[key] === '' || (Array.isArray(out[key]) && out[key].length === 0)) {
      out[key] = secondary[key];
    }
  }
  return out;
}

export function dedupeAcrossSources(listings) {
  const byKey = new Map();
  for (const l of listings) {
    if (!l.addressKey) continue;
    if (!byKey.has(l.addressKey)) byKey.set(l.addressKey, []);
    byKey.get(l.addressKey).push(l);
  }
  const out = [];
  for (const [, group] of byKey) {
    group.sort((a, b) => priorityRank(a.sourceName) - priorityRank(b.sourceName));
    let merged = {
      ...group[0],
      sources: [{ name: group[0].sourceName, url: group[0].url, id: group[0].sourceId }]
    };
    for (let i = 1; i < group.length; i++) {
      merged = merge(merged, group[i]);
      merged.sources = merged.sources || [];
      merged.sources.push({ name: group[i].sourceName, url: group[i].url, id: group[i].sourceId });
    }
    out.push(merged);
  }
  return out;
}

export { SOURCE_PRIORITY };
