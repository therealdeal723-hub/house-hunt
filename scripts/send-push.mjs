import webpush from 'web-push';

export function setupVapid() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
  if (!pub || !priv) throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set');
  webpush.setVapidDetails(subject, pub, priv);
}

export async function sendNotifications(subscriptions, payloads) {
  const kept = [];
  const results = [];
  for (const sub of subscriptions) {
    let alive = true;
    for (const payload of payloads) {
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
        results.push({ endpoint: sub.endpoint, ok: true });
      } catch (err) {
        const code = err?.statusCode;
        results.push({ endpoint: sub.endpoint, ok: false, code, message: err?.body || err?.message });
        if (code === 404 || code === 410) {
          alive = false;
          break;
        }
      }
    }
    if (alive) kept.push(sub);
  }
  return { kept, results };
}
