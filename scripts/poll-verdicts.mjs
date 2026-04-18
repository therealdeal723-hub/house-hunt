import { readJSON, writeJSON } from './lib/store.mjs';

function parseFencedJson(body) {
  const out = [];
  if (!body) return out;
  const re = /```(?:json)?\s*([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(body))) {
    try {
      out.push(JSON.parse(m[1].trim()));
    } catch {
      /* ignore malformed blocks */
    }
  }
  return out;
}

async function fetchIssueComments(repo, issueNumber, token, since) {
  const params = new URLSearchParams({ per_page: '100' });
  if (since) params.set('since', since);
  const out = [];
  let page = 1;
  while (true) {
    params.set('page', String(page));
    const url = `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'house-hunt-cron'
      }
    });
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    }
    const batch = await res.json();
    out.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return out;
}

function applyVerdictComment(verdicts, entry) {
  // Expected shape: { addressKey, verdict: 'up' | 'down', note?, ts? }
  if (!entry?.addressKey || !entry?.verdict) return;
  verdicts[entry.addressKey] = {
    verdict: entry.verdict,
    note: entry.note || null,
    ts: entry.ts || new Date().toISOString()
  };
}

function applySubscriptionComment(subs, entry) {
  if (!entry?.endpoint || !entry?.keys) return;
  const exists = subs.find((s) => s.endpoint === entry.endpoint);
  if (exists) {
    exists.keys = entry.keys;
    exists.updatedAt = new Date().toISOString();
  } else {
    subs.push({
      endpoint: entry.endpoint,
      keys: entry.keys,
      addedAt: new Date().toISOString()
    });
  }
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const verdictsIssue = process.env.VERDICTS_ISSUE_NUMBER;
  const subsIssue = process.env.SUBSCRIPTIONS_ISSUE_NUMBER;

  if (!token || !repo) {
    console.error('GITHUB_TOKEN / GITHUB_REPOSITORY not set; skipping verdict poll');
    return;
  }
  if (!verdictsIssue && !subsIssue) {
    console.error('VERDICTS_ISSUE_NUMBER / SUBSCRIPTIONS_ISSUE_NUMBER not set; skipping');
    return;
  }

  const lastRun = await readJSON('lastRun', {});
  const since = lastRun.verdictsSince || lastRun.timestamp || null;

  const verdicts = await readJSON('verdicts', {});
  const subs = await readJSON('subscriptions', []);

  if (verdictsIssue) {
    const comments = await fetchIssueComments(repo, verdictsIssue, token, since);
    let applied = 0;
    for (const c of comments) {
      for (const entry of parseFencedJson(c.body)) {
        applyVerdictComment(verdicts, entry);
        applied++;
      }
    }
    console.error(`verdicts: ${applied} entries from ${comments.length} comments`);
  }

  if (subsIssue) {
    const comments = await fetchIssueComments(repo, subsIssue, token, since);
    let applied = 0;
    for (const c of comments) {
      for (const entry of parseFencedJson(c.body)) {
        applySubscriptionComment(subs, entry);
        applied++;
      }
    }
    console.error(`subscriptions: ${applied} entries from ${comments.length} comments`);
  }

  await writeJSON('verdicts', verdicts);
  await writeJSON('subscriptions', subs);

  const nowIso = new Date().toISOString();
  await writeJSON('lastRun', {
    ...lastRun,
    verdictsSince: nowIso,
    subscriptionsSince: nowIso
  });
}

main().catch((err) => {
  console.error('poll-verdicts fatal:', err);
  process.exit(1);
});
