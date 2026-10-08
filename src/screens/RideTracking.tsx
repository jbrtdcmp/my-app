import { useCallback, useEffect, useRef, useState } from 'react';
import Map from '../components/Map';
import { IconCheckCircle, IconLocation, IconMap, IconStar, IconX } from '../components/Icons';
import { cancelRide, createTripShare, getRideTracking, rateRide, updateRideStatus, type TrackingPoint, type TrackingSnapshot } from '../services/api';
import { interpolatePoint } from '../services/tracking';
import { openDeviceNavigation, publicTripUrl, shareText } from '../services/platform';
import { useDriverLocation } from '../hooks/useDriverLocation';
import SosControl from '../components/SosControl';
import { StatusBadge } from '../components/ui';

type RideStatus = 'arriving' | 'boarded' | 'completed';
const STATUS_CONFIG: Record<RideStatus, { label: string }> = {
  arriving: { label: 'Driver arriving' },
  boarded: { label: 'Ride in progress' },
  completed: { label: 'Ride completed' },
};

function ReviewModal({ onSubmit, onClose, driver }: { onSubmit: (stars: number, comment: string) => void; onClose: () => void; driver: TrackingSnapshot['driver'] }) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  return <div className="dialog-backdrop fixed inset-0 z-50 flex items-end justify-center px-4 md:items-center">
    <div className="dialog-card dialog-sheet w-full max-w-md p-6 animate-slide-up">
      <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Rate your ride</h3><button onClick={onClose} className="btn-icon" aria-label="Close review"><IconX size={16}/></button></div>
      <p className="mb-4 text-sm text-ink-soft">{driver?.name || 'Your driver'}{driver?.plate_number ? ` · ${driver.plate_number}` : ''}</p>
      <div className="rating-feedback-card mb-4"><div className="flex justify-center gap-2">{[1,2,3,4,5].map(value => <button key={value} aria-label={`${value} stars`} onClick={() => setStars(value)} className="rating-feedback-card__star"><IconStar size={24} className={value <= stars ? 'text-warning' : 'text-border'} filled={false}/></button>)}</div></div>
      <textarea value={comment} onChange={event => setComment(event.target.value)} placeholder="Leave a comment (optional)..." className="mb-4 w-full px-4 py-3" rows={3}/>
      <button onClick={() => onSubmit(stars, comment)} className="btn-primary w-full">Submit review</button>
    </div>
  </div>;
}

export default function RideTracking({ onComplete, isDriver = false, rideId }: { onComplete: () => void; isDriver?: boolean; rideId: number | null }) {
  const [snapshot, setSnapshot] = useState<TrackingSnapshot | null>(null);
  const [displayPosition, setDisplayPosition] = useState<TrackingPoint | null>(null);
  const [serverStatus, setServerStatus] = useState('accepted');
  const [showReview, setShowReview] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [shareNotice, setShareNotice] = useState('');
  const [trackingError, setTrackingError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const dragStartY = useRef<number | null>(null);
  const didSwipe = useRef(false);
  const previousPosition = useRef<TrackingPoint | null>(null);
  const frame = useRef<number | null>(null);
  const location = useDriverLocation(isDriver && !['completed', 'cancelled'].includes(serverStatus));
  const rideStatus: RideStatus = serverStatus === 'in_progress' ? 'boarded' : serverStatus === 'completed' ? 'completed' : 'arriving';
  const config = STATUS_CONFIG[rideStatus];

  const refresh = useCallback(async () => {
    if (!rideId || document.visibilityState !== 'visible') return;
    try {
      const next = await getRideTracking(rideId);
      setSnapshot(next);
      setServerStatus(next.status);
      setTrackingError('');
      if (next.status === 'completed' && !isDriver) setShowReview(true);
      if (next.position) {
        const from = previousPosition.current || next.position;
        previousPosition.current = next.position;
        if (frame.current !== null) cancelAnimationFrame(frame.current);
        const started = performance.now();
        const duration = 2800;
        const animate = (now: number) => {
          const progress = Math.min(1, (now - started) / duration);
          setDisplayPosition(interpolatePoint(from, next.position!, progress));
          if (progress < 1) frame.current = requestAnimationFrame(animate);
          else frame.current = null;
        };
        frame.current = requestAnimationFrame(animate);
      } else {
        previousPosition.current = null;
        setDisplayPosition(null);
      }
    } catch (error) { setTrackingError(error instanceof Error ? error.message : 'Could not refresh live trip details.'); }
  }, [rideId, isDriver]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3500);
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, [refresh]);

  const advance = async () => {
    if (!rideId || busy) return;
    setBusy(true); setTrackingError('');
    try {
      const next = serverStatus === 'accepted' ? 'arriving' : serverStatus === 'arriving' ? 'in_progress' : 'completed';
      await updateRideStatus(rideId, next);
      setServerStatus(next);
      await refresh();
      if (next === 'completed') onComplete();
    } catch (error) { setTrackingError(error instanceof Error ? error.message : 'Could not update ride status.'); }
    finally { setBusy(false); }
  };

  const cancelCurrentRide = async () => {
    try { if (rideId) await cancelRide(rideId); onComplete(); }
    catch (error) { setTrackingError(error instanceof Error ? error.message : 'Could not cancel this ride.'); setShowCancel(false); }
  };

  const submitReview = async (stars: number, comment: string) => {
    try { if (rideId) await rateRide(rideId, stars, comment); setShowReview(false); onComplete(); }
    catch (error) { setTrackingError(error instanceof Error ? error.message : 'Could not save your review.'); }
  };

  const shareRide = async () => {
    if (!rideId) return;
    setBusy(true);
    try {
      const token = await createTripShare(rideId);
      await shareText('PASAKJA live trip', `Track my ride from ${snapshot?.pickup.label || 'pickup'} to ${snapshot?.destination.label || 'destination'}.`, publicTripUrl(token));
      setShareNotice('Live trip link shared.');
    } catch (error) { setShareNotice(error instanceof Error ? error.message : 'Could not share this ride.'); }
    finally { setBusy(false); }
  };

  const target = snapshot?.status === 'in_progress' ? snapshot.destination : snapshot?.pickup;
  const targetPosition = target?.lat !== null && target?.lng !== null && target ? { lat: target.lat, lng: target.lng } : null;
  const statusLabel = snapshot?.status === 'in_progress' ? 'Next target: destination' : 'Next target: pickup';
  const displayStatus = snapshot?.status === 'in_progress' ? 'in-progress' : 'arriving';

  return <div className="flex-1 flex flex-col h-full relative overflow-hidden">
    <div className={`ride-tracking-map absolute inset-0 md:bottom-0 ${sheetExpanded ? 'ride-tracking-map--expanded' : 'ride-tracking-map--collapsed'}`}>
      <Map activeMunicipality={snapshot?.municipality?.toLowerCase() || 'carrascal'} showRoute className="h-full" rideState={displayStatus} driverPosition={displayPosition} driverHeading={displayPosition?.heading} routeGeometry={snapshot?.route}/>
      <div className="absolute top-4 left-0 right-0 flex justify-center"><StatusBadge status={displayStatus} label={config.label}/></div>
      {!displayPosition && serverStatus !== 'completed' && <div className="absolute top-16 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm text-ink-soft shadow-card">Locating driver…</div>}
      {snapshot?.stale && snapshot.position && <div role="status" className="absolute left-3 right-3 top-28 rounded-xl bg-warning/10 px-3 py-2 text-center text-sm text-ink">Driver’s signal is weak. Showing last received location.</div>}
    </div>

    <div className={`ride-tracking-sheet absolute left-0 right-0 bottom-0 bg-surface rounded-t-3xl shadow-float md:absolute md:top-0 md:right-0 md:left-auto md:rounded-none md:border-l md:border-border overflow-y-auto ${sheetExpanded ? 'ride-tracking-sheet--expanded' : 'ride-tracking-sheet--collapsed'}`}>
      <div role="button" tabIndex={0} aria-label={sheetExpanded ? 'Collapse ride details' : 'Expand ride details'} aria-expanded={sheetExpanded}
        onPointerDown={event => { dragStartY.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerUp={event => { if (dragStartY.current === null) return; const distance = event.clientY - dragStartY.current; dragStartY.current = null; if (Math.abs(distance) > 35) { didSwipe.current = true; setSheetExpanded(distance < 0); } }}
        onPointerCancel={() => { dragStartY.current = null; }}
        onClick={() => { if (didSwipe.current) { didSwipe.current = false; return; } setSheetExpanded(value => !value); }}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSheetExpanded(value => !value); } }} className="ride-tracking-sheet__handle md:hidden"><span/></div>
      <div className="px-5 pb-6 space-y-4">
        {trackingError && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">{trackingError}</p>}
        {location.error && isDriver && <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger"><p>{location.error}</p><button type="button" onClick={location.retry} className="mt-2 font-semibold underline">Retry location access</button></div>}
        <div className="safety-share-card flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"><span className="flex-1"><span className="block text-sm font-semibold">Safety first</span><span className="block text-xs opacity-80">{shareNotice || 'Share your ride details with someone you trust.'}</span></span></div>

        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-base text-ink">{snapshot?.driver?.name || 'Waiting for driver details'}</span>{snapshot?.driver && <span className="rounded-full bg-orange-light px-1.5 py-0.5 text-xs font-semibold text-orange">TODA</span>}</div>
            {snapshot?.driver && <div className="mt-0.5 text-xs text-ink-soft">{snapshot.driver.toda_name}</div>}
          </div>
          {snapshot?.driver?.phone && <a href={`tel:${snapshot.driver.phone}`} aria-label="Call driver" className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-light text-orange"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 3h4l2 5-3 2a15 15 0 0 0 6 6l2-3 5 2v4c0 1-1 2-2 2C10 20 4 14 3 5c0-1 1-2 2-2Z"/></svg></a>}
        </div>

        {snapshot?.driver && <div className="grid grid-cols-3 gap-2 text-center text-xs"><div className="bg-orange-light rounded-xl p-2"><p className="text-ink-soft">Plate</p><p className="font-semibold text-ink">{snapshot.driver.plate_number}</p></div><div className="bg-orange-light rounded-xl p-2"><p className="text-ink-soft">Body No.</p><p className="font-semibold text-ink">{snapshot.driver.body_number}</p></div><div className="bg-orange-light rounded-xl p-2"><p className="text-ink-soft">TODA</p><p className="font-semibold text-ink">{snapshot.driver.toda_name}</p></div></div>}

        <div className="bg-warm rounded-2xl border border-border p-4 space-y-2">
          <div className="flex items-start gap-2 text-sm"><span className="mt-1 h-2 w-2 flex-none rounded-full bg-orange"/><span className="text-ink-soft">From</span><span className="min-w-0 font-medium text-ink">{snapshot?.pickup.label || 'Loading pickup…'}</span></div>
          <div className="ml-1 h-4 border-l border-border"/>
          <div className="flex items-start gap-2 text-sm"><span className="mt-1 h-2 w-2 flex-none rounded-full bg-ink"/><span className="text-ink-soft">To</span><span className="min-w-0 font-medium text-ink">{snapshot?.destination.label || 'Loading destination…'}</span></div>
          <div className="border-t border-border pt-2 flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-ink-soft">{targetPosition ? `${statusLabel} · ${snapshot?.eta_minutes ?? '—'} min · ${snapshot?.distance_remaining_km ?? '—'} km` : statusLabel}</span>{snapshot?.route_fallback && <span className="text-warning">Approximate route</span>}</div>
        </div>

        {targetPosition && <button type="button" onClick={() => openDeviceNavigation({ ...targetPosition, label: target?.label })} className="btn-secondary w-full">Navigate to {snapshot?.status === 'in_progress' ? 'destination' : 'pickup'}</button>}
        <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void shareRide()} className="btn-quiet flex-1"><span className="inline-flex items-center gap-2"><IconMap size={16}/>Share trip</span></button><div className="flex-1"><SosControl rideId={rideId} municipality={snapshot?.municipality || 'Carrascal'} className="w-full rounded-xl border-2 border-danger/30 bg-danger/5 py-3 text-sm font-medium text-danger"/></div></div>
        {isDriver ? serverStatus !== 'completed' && <button type="button" disabled={busy} onClick={() => void advance()} className="btn-primary btn-large w-full">{busy ? 'Updating…' : serverStatus === 'accepted' ? 'Start pickup' : serverStatus === 'arriving' ? 'Start trip' : 'Complete ride'}</button> : <>
          <p className="text-center text-xs text-ink-soft">{serverStatus === 'in_progress' ? 'Your trip is in progress.' : 'Waiting for your driver to update the trip.'}</p>
          {['accepted', 'arriving'].includes(serverStatus) && <button type="button" onClick={() => setShowCancel(true)} className="btn-quiet w-full">Cancel ride</button>}
        </>}
      </div>
    </div>

    {showReview && <ReviewModal driver={snapshot?.driver || null} onSubmit={(stars, comment) => void submitReview(stars, comment)} onClose={() => setShowReview(false)}/>}
    {showCancel && <div className="dialog-backdrop fixed inset-0 z-50 flex items-center justify-center px-6"><div className="dialog-card w-full max-w-sm p-6 text-center"><div className="dialog-icon"><IconCheckCircle/></div><h3 className="mb-2 text-lg font-semibold">Cancel this ride?</h3><p className="mb-6 text-sm text-ink-soft">Your driver may already be on the way.</p><div className="flex gap-3"><button onClick={() => setShowCancel(false)} className="btn-secondary flex-1">Keep ride</button><button onClick={() => void cancelCurrentRide()} className="btn-primary flex-1 bg-danger border-danger">Cancel ride</button></div></div></div>}
  </div>;
}
