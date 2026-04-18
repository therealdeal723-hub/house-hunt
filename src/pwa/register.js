import { postSubscription } from '../github-client.js';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

export function isIos() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const url = `${import.meta.env.BASE_URL}service-worker.js`;
    return await navigator.serviceWorker.register(url, { scope: import.meta.env.BASE_URL });
  } catch (err) {
    console.error('sw registration failed', err);
    return null;
  }
}

function urlBase64ToUint8Array(b64) {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function enablePushNotifications() {
  if (!('Notification' in window)) throw new Error('Notifications not supported on this device');
  if (!('serviceWorker' in navigator)) throw new Error('Service workers not supported');
  if (!VAPID_PUBLIC_KEY) throw new Error('VAPID public key not configured at build time');

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(`Permission ${perm}`);

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub = existing || await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  });

  const payload = sub.toJSON ? sub.toJSON() : JSON.parse(JSON.stringify(sub));
  await postSubscription({
    endpoint: payload.endpoint,
    keys: payload.keys,
    userAgent: navigator.userAgent
  });
  return sub;
}
