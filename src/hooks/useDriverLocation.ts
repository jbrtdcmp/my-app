import { useCallback, useEffect, useRef, useState } from 'react';
import { sendDriverLocation } from '../services/api';
import { watchDeviceLocation, type DevicePoint } from '../services/platform';

const PARKED_METERS = 15;
const PARKED_RESEND_MS = 25000;

function metersBetween(a: DevicePoint, b: DevicePoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export function useDriverLocation(enabled: boolean) {
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [point, setPoint] = useState<DevicePoint | null>(null);
  const lastSentAt = useRef(0);
  const lastSentPoint = useRef<DevicePoint | null>(null);
  const sending = useRef(false);
  const latestPoint = useRef<DevicePoint | null>(null);

  useEffect(() => {
    if (!enabled) { setError(''); return; }
    let mounted = true;
    const send = async (point: DevicePoint) => {
      const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
      const interval = connection?.saveData || connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g' ? 10000 : 4000;
      if (document.visibilityState !== 'visible' || sending.current || Date.now() - lastSentAt.current < interval) return;
      // A parked driver stays "online" (seen within a minute) with a send every 25 seconds.
      if (lastSentPoint.current && metersBetween(lastSentPoint.current, point) < PARKED_METERS && Date.now() - lastSentAt.current < PARKED_RESEND_MS) return;
      sending.current = true;
      try {
        await sendDriverLocation(point);
        lastSentAt.current = Date.now();
        lastSentPoint.current = point;
        if (mounted) setError('');
      } catch (failure) {
        if (mounted) setError(failure instanceof Error ? failure.message : 'Could not send your location. Check your connection.');
      } finally { sending.current = false; }
    };
    const stop = watchDeviceLocation(point => {
      if (mounted) setPoint(point);
      latestPoint.current = point;
      void send(point);
    }, failure => { if (mounted) setError(failure.message); });
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && latestPoint.current) void send(latestPoint.current);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { mounted = false; stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [enabled, attempt]);

  const retry = useCallback(() => { setError(''); setAttempt(value => value + 1); }, []);
  return { error, retry, point };
}
