// Phone notifications (Web Push) for the Profile screen.
// The service worker in public/sw.js shows the notifications.
import { deletePushSubscription, getPushConfig, savePushSubscription } from './api';

export type PushStatus = 'unsupported' | 'needs-install' | 'not-configured' | 'blocked' | 'off' | 'on';

/** The browser can't reach its own push service (e.g. "Registration failed - push service error"). */
export class PushUnavailableError extends Error {}

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isInstalled = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function sameKey(current: ArrayBuffer | null | undefined, base64url: string): boolean {
  if (!current) return false;
  const a = new Uint8Array(current);
  const b = keyBytes(base64url);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** The service worker registration, or null if it isn't running within a few seconds. */
async function serviceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  const timeout = new Promise<null>(resolve => window.setTimeout(() => resolve(null), 6000));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

const supported = () => window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function pushStatus(): Promise<PushStatus> {
  if (!supported()) return isIos() && !isInstalled() ? 'needs-install' : 'unsupported';
  const config = await getPushConfig();
  if (!config.enabled) return 'not-configured';
  if (Notification.permission === 'denied') return 'blocked';
  const registration = await serviceWorker();
  if (!registration) return 'unsupported';
  const subscription = await registration.pushManager.getSubscription();
  return subscription && Notification.permission === 'granted' ? 'on' : 'off';
}

/** Asks for permission, subscribes this browser, and saves it for the signed-in account. */
export async function enablePush(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'Notifications are blocked for PASAKJA. Allow them in your browser’s site settings, then try again.'
      : 'Notifications weren’t allowed. Tap Turn on again and choose Allow.');
  }
  const config = await getPushConfig();
  if (!config.enabled || !config.public_key) throw new Error('Notifications aren’t set up on this server yet.');
  const registration = await serviceWorker();
  if (!registration) throw new Error('This browser couldn’t start notifications. Reload the page and try again.');
  let subscription = await registration.pushManager.getSubscription();
  // A subscription made with an older server key has to be replaced.
  if (subscription && !sameKey(subscription.options.applicationServerKey, config.public_key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  try {
    subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.public_key) });
  } catch (subscribeError) {
    // e.g. "Registration failed - push service error": the browser can't reach its own push service.
    if (subscribeError instanceof DOMException && subscribeError.name === 'NotAllowedError') {
      throw new Error('Notifications are blocked for PASAKJA in this browser. Allow them in the site settings, then try again.');
    }
    throw new PushUnavailableError('This browser can’t receive notifications. Use Chrome on Android, or Safari on iPhone from the Home Screen.');
  }
  await savePushSubscription(subscription.toJSON());
}

/** Stops notifications on this browser (also used when signing out, so the next person doesn't get them). */
export async function disablePush(): Promise<void> {
  if (!supported()) return;
  const registration = await serviceWorker();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  try { await deletePushSubscription(subscription.endpoint); } finally { await subscription.unsubscribe(); }
}

/** After signing in, re-link this browser's existing subscription to the account. Never throws. */
export async function syncPush(): Promise<void> {
  try {
    if (!supported() || Notification.permission !== 'granted') return;
    const registration = await serviceWorker();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) await savePushSubscription(subscription.toJSON());
  } catch { /* the Profile screen shows the real status */ }
}
