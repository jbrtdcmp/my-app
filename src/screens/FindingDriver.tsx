import { useEffect, useState } from 'react';
import { IconArrowDown, IconBuilding, IconCheckCircle, IconLocation, IconSignal } from '../components/Icons';
import { cancelRide, getRide, type ApiRide } from '../services/api';

interface FindingDriverProps { onFound: () => void; onCancel: () => void; rideId: number | null; }

export default function FindingDriver({ onFound, onCancel, rideId }: FindingDriverProps) {
  const [ride, setRide] = useState<ApiRide | null>(null);
  const [status, setStatus] = useState<'searching' | 'found'>('searching');
  const [dots, setDots] = useState(1);
  const [error, setError] = useState('');

  const cancelRequest = async () => {
    if (rideId) await cancelRide(rideId).catch(() => {});
    onCancel();
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

  return <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-warm px-6" style={{ background: '#FFFAF6' }}>
    <div className="absolute inset-0 overflow-hidden pointer-events-none"><div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange/5"/><div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange/8"/></div>
    <div className="relative z-10 flex max-h-full w-full flex-col items-center gap-8 overflow-y-auto py-8 text-center">
      {status === 'searching' ? <>
        <div className="relative h-36 w-36 flex-none"><div className="absolute inset-0 rounded-full bg-orange/10 animate-pulse-ring"/><div className="absolute inset-5 rounded-full bg-orange/15 animate-pulse-ring"/></div>
        <div><h2 className="mb-2 text-2xl font-semibold text-ink">Finding a tricycle{'.'.repeat(dots)}</h2><p className="text-sm text-ink-soft">Looking for available approved drivers</p></div>
        {ride && <div className="w-full max-w-xs space-y-3 rounded-2xl border border-border bg-surface p-4 text-left text-sm">
          <div className="flex items-center gap-2 text-orange"><IconLocation size={16}/><span className="font-medium">{ride.pickup_label}</span></div>
          <div className="flex items-center gap-2 pl-6 text-xs text-ink-soft"><IconArrowDown size={16}/><span>{ride.distance_km ? `${ride.distance_km} km road distance` : 'Route distance will appear when location pins are available'}</span></div>
          <div className="flex items-center gap-2"><IconBuilding size={16} className="text-ink-soft"/><span className="font-medium">{ride.destination_label}</span></div>
          {ride.fare && <p className="border-t border-border pt-2 text-sm font-semibold text-orange">Estimated fare: ₱{ride.fare}</p>}
        </div>}
        {error && <p role="status" className="max-w-xs text-sm text-ink-soft">{error}</p>}
        <button onClick={() => void cancelRequest()} className="btn-secondary px-8">Cancel booking</button>
        <p className="text-xs text-ink-soft"><IconSignal size={16} className="mr-1 inline-block"/>Your request is saved and will keep checking while this screen is open.</p>
      </> : <>
        <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-success bg-success-bg animate-fade-in"><IconCheckCircle size={24} className="text-success"/></div>
        <div><p className="mb-2 text-sm font-medium uppercase tracking-wide text-success">Driver found</p><h2 className="text-2xl font-semibold text-ink">{ride?.driver_name || 'Your driver accepted'}</h2><p className="text-sm text-ink-soft">is on the way to pickup</p></div>
        {ride?.plate_number && <div className="grid w-full max-w-xs grid-cols-2 gap-2 rounded-2xl border border-border bg-surface p-4 text-xs"><div className="rounded-xl bg-orange-light p-2"><p className="text-ink-soft">Plate</p><p className="font-semibold text-ink">{ride.plate_number}</p></div><div className="rounded-xl bg-orange-light p-2"><p className="text-ink-soft">Body No.</p><p className="font-semibold text-ink">{ride.body_number || '—'}</p></div></div>}
        <p className="text-xs text-ink-soft">Opening live tracking…</p>
      </>}
    </div>
  </div>;
}
