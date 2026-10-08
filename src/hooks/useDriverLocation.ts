import { useCallback, useEffect, useRef, useState } from 'react';
import { sendDriverLocation } from '../services/api';
import { watchDeviceLocation, type DevicePoint } from '../services/platform';

export function useDriverLocation(enabled: boolean) {
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [point, setPoint] = useState<DevicePoint | null>(null);
  const lastSentAt = useRef(0);
  const sending = useRef(false);
  const latestPoint = useRef<DevicePoint | null>(null);

  useEffect(() => {
    if (!enabled) { setError(''); return; }
    let mounted = true;
    const send = async (point: DevicePoint) => {
      const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
      const interval = connection?.saveData || connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g' ? 10000 : 4000;
      if (document.visibilityState !== 'visible' || sending.current || Date.now() - lastSentAt.current < interval) return;
      sending.current = true;
      try {
        await sendDriverLocation(point);
        lastSentAt.current = Date.now();
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
