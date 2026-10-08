import type { TrackingPoint } from './api';

export function interpolatePoint(from: TrackingPoint, to: TrackingPoint, progress: number): TrackingPoint {
  const t = Math.max(0, Math.min(1, progress));
  const fromHeading = from.heading ?? 0;
  const toHeading = to.heading ?? fromHeading;
  const deltaHeading = ((toHeading - fromHeading + 540) % 360) - 180;
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t,
    heading: (fromHeading + deltaHeading * t + 360) % 360,
    accuracy: to.accuracy ?? null,
    stale: to.stale,
    last_seen_at: to.last_seen_at,
  };
}

export function isLocationStale(lastSeenAt: string | null | undefined, now = Date.now(), thresholdMs = 30000): boolean {
  if (!lastSeenAt) return true;
  const lastSeen = Date.parse(lastSeenAt);
  return !Number.isFinite(lastSeen) || now - lastSeen > thresholdMs;
}

export function shouldRecalculateRoute(from: TrackingPoint, next: TrackingPoint, targetChanged: boolean): boolean {
  if (targetChanged) return true;
  const radians = Math.PI / 180;
  const lat1 = from.lat * radians;
  const lat2 = next.lat * radians;
  const dLat = lat2 - lat1;
  const dLng = (next.lng - from.lng) * radians;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) >= 50;
}
