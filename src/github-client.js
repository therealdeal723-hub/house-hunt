const PAT_KEY = 'hh:pat';
const REPO = import.meta.env.VITE_REPO || 'therealdeal723-hub/house-hunt';
const VERDICTS_ISSUE = import.meta.env.VITE_VERDICTS_ISSUE;
const SUBSCRIPTIONS_ISSUE = import.meta.env.VITE_SUBSCRIPTIONS_ISSUE;

export function getPat() {
  try { return localStorage.getItem(PAT_KEY) || ''; } catch { return ''; }
}
export function setPat(token) {
  try {
    if (token) localStorage.setItem(PAT_KEY, token);
    else localStorage.removeItem(PAT_KEY);
  } catch { /* ignore */ }
}

async function postComment(issueNumber, body) {
  if (!issueNumber) throw new Error('Issue number not configured at build time');
  const pat = getPat();
  if (!pat) throw new Error('No PAT configured');
  const res = await fetch(`https://api.github.com/repos/${REPO}/issues/${issueNumber}/comments`, {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${pat}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: JSON.stringify({ body })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${res.status}: ${text}`);
  }
  return res.json();
}

function fenced(obj) {
  return '```json\n' + JSON.stringify(obj, null, 2) + '\n```';
}

export async function postVerdict(entry) {
  return postComment(VERDICTS_ISSUE, fenced(entry));
}

export async function postSubscription(sub) {
  return postComment(SUBSCRIPTIONS_ISSUE, fenced(sub));
}
