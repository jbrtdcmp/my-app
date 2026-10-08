export interface DevicePoint {
  lat: number;
  lng: number;
  heading: number | null;
  accuracy: number | null;
}

export class LocationPermissionError extends Error {
  constructor(message: string) { super(message); this.name = 'LocationPermissionError'; }
}

export function watchDeviceLocation(onPoint: (point: DevicePoint) => void, onError: (error: Error) => void): () => void {
  if (!('geolocation' in navigator)) {
    onError(new LocationPermissionError('Location is not available on this device.'));
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
      ? 'Location permission is off. Enable it in your device settings and retry.'
      : 'Could not get your location. Check your signal and retry.')),
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 12000 },
  );
  return () => navigator.geolocation.clearWatch(watchId);
}

export async function getDeviceLocation(): Promise<DevicePoint | null> {
  if (!('geolocation' in navigator)) return null;
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
    position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude, heading: position.coords.heading, accuracy: position.coords.accuracy }),
    error => reject(new LocationPermissionError(error.code === error.PERMISSION_DENIED
      ? 'Location permission is off. You can still send the SOS without location.'
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
