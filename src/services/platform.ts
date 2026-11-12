export interface DevicePoint {
  lat: number;
  lng: number;
  heading: number | null;
  accuracy: number | null;
}

export class LocationPermissionError extends Error {
  constructor(message: string) { super(message); this.name = 'LocationPermissionError'; }
}

// Phones (iPhone Safari especially) only share GPS with https:// pages or localhost.
// On a plain http:// Wi-Fi address they refuse even when Location is switched on,
// so say that instead of blaming the phone's settings.
export const INSECURE_LOCATION_MESSAGE = 'Location is blocked because this link is not secure. Open PASAKJA with an https:// address to use GPS.';

export function locationUnavailableReason(): string | null {
  if (!window.isSecureContext) return INSECURE_LOCATION_MESSAGE;
  if (!('geolocation' in navigator)) return 'Location is not available on this device.';
  return null;
}

export function watchDeviceLocation(onPoint: (point: DevicePoint) => void, onError: (error: Error) => void): () => void {
  const unavailable = locationUnavailableReason();
  if (unavailable) {
    onError(new LocationPermissionError(unavailable));
    return () => {};
  }
  const watchId = navigator.geolocation.watchPosition(
    position => onPoint({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      heading: position.coords.heading,
      accuracy: position.coords.accuracy,
    }),
    error => onError(new LocationPermissionError(error.code === error.PERMISSION_DENIED
      ? 'Location is blocked for this site. Allow location for your browser in the phone settings and for this site in the browser, then retry.'
      : 'Could not get your location. Check your signal and retry.')),
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 12000 },
  );
  return () => navigator.geolocation.clearWatch(watchId);
}

export async function getDeviceLocation(): Promise<DevicePoint | null> {
  if (!window.isSecureContext) throw new LocationPermissionError(`${INSECURE_LOCATION_MESSAGE} You can still send the SOS without location.`);
  if (!('geolocation' in navigator)) return null;
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
    position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude, heading: position.coords.heading, accuracy: position.coords.accuracy }),
    error => reject(new LocationPermissionError(error.code === error.PERMISSION_DENIED
      ? 'Location is blocked for this site. You can still send the SOS without location.'
      : 'Could not get your location. You can still send the SOS without location.')),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
  ));
}

export function openDeviceNavigation(point: { lat: number; lng: number; label?: string }) {
  const destination = `${point.lat},${point.lng}`;
  const osm = `https://www.openstreetmap.org/directions?to=${encodeURIComponent(destination)}`;
  const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
  const isCapacitor = Boolean((window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
  if (isCapacitor) window.location.href = `geo:${destination}?q=${encodeURIComponent(destination)}`;
  else window.open(osm, '_blank', 'noopener,noreferrer') || window.location.assign(gmaps);
}

export async function shareText(title: string, text: string, url?: string) {
  if (navigator.share) return navigator.share({ title, text, ...(url ? { url } : {}) });
  const content = url ? `${text}\n${url}` : text;
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(content);
    return;
  }
  throw new Error('Sharing is not available on this device.');
}

export function publicTripUrl(token: string): string {
  const currentPath = window.location.pathname.replace(/\/+$/, '');
  const basePath = currentPath.replace(/\/trip\/[a-f0-9]{64}$/i, '');
  return `${window.location.origin}${basePath}/trip/${encodeURIComponent(token)}`;
}
