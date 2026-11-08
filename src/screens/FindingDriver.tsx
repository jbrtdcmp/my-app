import { useEffect, useState } from 'react';
import { IconCheckCircle, IconDriver, IconSignal } from '../components/Icons';
import { cancelRide, getRide, rideFare, type ApiRide } from '../services/api';

interface FindingDriverProps { onFound: () => void; onCancel: () => void; rideId: number | null; }

export default function FindingDriver({ onFound, onCancel, rideId }: FindingDriverProps) {
  const [ride, setRide] = useState<ApiRide | null>(null);
  const [status, setStatus] = useState<'searching' | 'found'>('searching');
  const [dots, setDots] = useState(1);
  const [error, setError] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const cancelRequest = async () => {
    if (cancelling) return;
    if (!rideId) { onCancel(); return; }
    setCancelling(true);
    setCancelError('');
    try {
      await cancelRide(rideId);
      onCancel();
    } catch (failure) {
      setCancelError(failure instanceof Error ? failure.message : 'Could not cancel this booking. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => {
    const dotTimer = window.setInterval(() => setDots(value => value % 3 + 1), 500);
    if (!rideId) { setError('Ride request is unavailable. Please try booking again.'); return () => window.clearInterval(dotTimer); }
    let cancelled = false;
    let pollTimer: number | undefined;
    const poll = async () => {
      if (document.visibilityState !== 'visible') { pollTimer = window.setTimeout(poll, 1500); return; }
      try {
        const next = await getRide(rideId);
        if (cancelled) return;
        setRide(next);
        setError('');
        if (['accepted', 'arriving', 'in_progress'].includes(next.status)) setStatus('found');
        else if (next.status === 'cancelled') setError('This ride was cancelled.');
        else pollTimer = window.setTimeout(poll, 2500);
      } catch (failure) {
        if (!cancelled) { setError(failure instanceof Error ? failure.message : 'Could not check your ride request.'); pollTimer = window.setTimeout(poll, 5000); }
      }
    };
    void poll();
    return () => { cancelled = true; window.clearInterval(dotTimer); if (pollTimer) window.clearTimeout(pollTimer); };
  }, [rideId]);

  useEffect(() => {
    if (status !== 'found') return;
    const timer = window.setTimeout(onFound, 1200);
    return () => window.clearTimeout(timer);
  }, [status, onFound]);

  const fare = ride ? rideFare(ride) : null;
  const distance = ride?.fare_distance_km ?? ride?.distance_km ?? null;

  return <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-surface px-6">
    <div className="relative z-10 flex max-h-full w-full max-w-sm flex-col items-center gap-6 overflow-y-auto py-8 text-center">
      {status === 'searching' ? <>
        <div className="finding-radar" aria-hidden="true">
          <span className="finding-radar__ring animate-pulse-ring"/>
          <span className="finding-radar__ring finding-radar__ring--late animate-pulse-ring"/>
          <span className="finding-radar__core"><IconDriver size={24}/></span>
        </div>
        <div><h2 className="mb-2 text-2xl font-extrabold text-ink">Finding a tricycle{'.'.repeat(dots)}</h2><p className="text-sm text-ink-soft">Looking for available TODA-verified drivers nearby</p></div>
        {ride && <div className="app-card w-full text-left">
          <div className="route-line">
            <div className="route-line__rail" aria-hidden="true"><span className="route-dot route-dot--pickup"/><span className="mt-auto route-dot route-dot--destination"/></div>
            <div className="route-line__stops">
              <div><p className="route-line__label">Pickup</p><p className="route-line__place">{ride.pickup_label}</p></div>
              <div><p className="route-line__label">Destination</p><p className="route-line__place">{ride.destination_label}</p></div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-dashed border-border-strong pt-3">
            <span className="text-sm text-ink-soft">{distance !== null ? `${distance} km · Cash` : 'Cash'}</span>
            <span className="fare-amount">{fare !== null ? `₱${fare}` : 'Fare pending'}</span>
          </div>
        </div>}
        {error && <p role="status" className="text-sm text-ink-soft">{error}</p>}
        {cancelError && <p role="alert" className="notice notice--danger w-full">{cancelError}</p>}
        <button type="button" disabled={cancelling} onClick={() => void cancelRequest()} className="btn-quiet btn-large w-full">{cancelling ? 'Cancelling…' : 'Cancel booking'}</button>
        <p className="flex items-center justify-center gap-2 text-xs text-ink-soft"><IconSignal size={16}/>Your request is saved and keeps checking while this screen is open.</p>
      </> : <>
        <div className="grid h-24 w-24 place-items-center rounded-full bg-success-bg text-success animate-fade-in"><IconCheckCircle size={24} className="h-12 w-12"/></div>
        <div><p className="eyebrow mb-2 text-success">Driver found</p><h2 className="text-2xl font-extrabold text-ink">{ride?.driver_name || 'Your driver accepted'}</h2><p className="text-sm text-ink-soft">is on the way to your pickup</p></div>
        {ride?.plate_number && <dl className="plate-grid w-full grid-cols-2"><div><dt>Plate</dt><dd>{ride.plate_number}</dd></div><div><dt>Body no.</dt><dd>{ride.body_number || '—'}</dd></div></dl>}
        <p className="text-xs text-ink-soft">Opening live tracking…</p>
      </>}
    </div>
  </div>;
}
