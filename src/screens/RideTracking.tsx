import { useCallback, useEffect, useRef, useState } from 'react';
import Map from '../components/Map';
import { IconAlertCircle, IconDriver, IconNavigation, IconPhone, IconShare, IconStar, IconTODA, IconX } from '../components/Icons';
import { cancelRide, createTripShare, getRideTracking, rateRide, rideFare, updateRideStatus, type TrackingPoint, type TrackingSnapshot } from '../services/api';
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

function ReviewModal({ onSubmit, onClose, driver, error, busy }: { onSubmit: (stars: number, comment: string) => void; onClose: () => void; driver: TrackingSnapshot['driver']; error: string; busy: boolean }) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  return <div className="dialog-backdrop fixed inset-0 z-50 flex items-end justify-center px-4 md:items-center">
    <div className="dialog-card dialog-sheet w-full max-w-md animate-slide-up">
      <div className="mb-4 flex justify-end"><button type="button" onClick={onClose} className="btn-icon" aria-label="Close review"><IconX size={18}/></button></div>
      <div className="mb-4 flex flex-col items-center text-center">
        <span className="avatar mb-3">{driver?.name?.slice(0, 1).toUpperCase() ?? 'D'}</span>
        <h3>How was your ride?</h3>
        <p className="text-sm text-ink-soft">{driver?.name || 'Your driver'}{driver?.plate_number ? ` · ${driver.plate_number}` : ''}</p>
      </div>
      <div className="rating-feedback-card mb-4"><div className="flex justify-center gap-1" role="radiogroup" aria-label="Rating">{[1,2,3,4,5].map(value => <button key={value} type="button" role="radio" aria-checked={value === stars} aria-label={`${value} star${value === 1 ? '' : 's'}`} onClick={() => setStars(value)} className="rating-feedback-card__star"><IconStar size={24} className={value <= stars ? 'text-sunset' : 'text-border-strong'} filled={value <= stars}/></button>)}</div></div>
      <textarea value={comment} onChange={event => setComment(event.target.value)} placeholder="Tell us more (optional)" className="app-textarea mb-4" rows={3}/>
      {error && <p role="alert" className="notice notice--danger mb-3">{error}</p>}
      <button type="button" disabled={busy} onClick={() => onSubmit(stars, comment)} className="btn-primary btn-large w-full">{busy ? 'Submitting…' : 'Submit review'}</button>
    </div>
  </div>;
}

export default function RideTracking({ onComplete, isDriver = false, rideId }: { onComplete: () => void; isDriver?: boolean; rideId: number | null }) {
  const [snapshot, setSnapshot] = useState<TrackingSnapshot | null>(null);
  const [displayPosition, setDisplayPosition] = useState<TrackingPoint | null>(null);
  const [serverStatus, setServerStatus] = useState('accepted');
  const [showReview, setShowReview] = useState(false);
  const [reviewDismissed, setReviewDismissed] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [shareNotice, setShareNotice] = useState('');
  const [trackingError, setTrackingError] = useState('');
  const [statusError, setStatusError] = useState('');
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
      if (next.status === 'completed' && !isDriver && !reviewDismissed) setShowReview(true);
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
  }, [rideId, isDriver, reviewDismissed]);

  useEffect(() => {
    if (!rideId || ['completed', 'cancelled'].includes(serverStatus)) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3500);
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh, rideId, serverStatus]);

  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);

  const advance = async () => {
    if (!rideId || busy) return;
    setBusy(true); setStatusError('');
    try {
      const next = serverStatus === 'accepted' ? 'arriving' : serverStatus === 'arriving' ? 'in_progress' : 'completed';
      await updateRideStatus(rideId, next);
      setServerStatus(next);
      await refresh();
      if (next === 'completed') onComplete();
    } catch (error) { setStatusError(error instanceof Error ? error.message : 'Could not update ride status.'); }
    finally { setBusy(false); }
  };

  const cancelCurrentRide = async () => {
    try { if (rideId) await cancelRide(rideId); onComplete(); }
    catch (error) { setTrackingError(error instanceof Error ? error.message : 'Could not cancel this ride.'); setShowCancel(false); }
  };

  const submitReview = async (stars: number, comment: string) => {
    if (reviewBusy) return;
    setReviewBusy(true);
    setReviewError('');
    try {
      if (rideId) await rateRide(rideId, stars, comment);
      setShowReview(false);
      onComplete();
    } catch (error) { setReviewError(error instanceof Error ? error.message : 'Could not save your review.'); }
    finally { setReviewBusy(false); }
  };

  const dismissReview = () => {
    setShowReview(false);
    setReviewDismissed(true);
    setReviewError('');
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
  const fare = snapshot ? rideFare(snapshot) : null;
  const statusLabel = snapshot?.status === 'in_progress' ? 'Next target: destination' : 'Next target: pickup';
  const displayStatus = snapshot?.status === 'in_progress' ? 'in-progress' : 'arriving';

  return <div className="flex-1 flex flex-col h-full relative overflow-hidden">
    <div className={`ride-tracking-map absolute inset-x-0 top-0 lg:bottom-0 ${sheetExpanded ? 'ride-tracking-map--expanded' : 'ride-tracking-map--collapsed'}`}>
      <Map activeMunicipality={snapshot?.municipality?.toLowerCase() || 'carrascal'} showRoute className="h-full" rideState={displayStatus} driverPosition={displayPosition} driverHeading={displayPosition?.heading} routeGeometry={snapshot?.route} routeApproximate={Boolean(snapshot?.route_fallback)}
        pickupPosition={snapshot?.status !== 'in_progress' ? targetPosition : null}
        destinationPosition={snapshot?.status === 'in_progress' ? targetPosition : null}/>
      <div className="absolute top-4 left-0 right-0 flex justify-center"><StatusBadge status={displayStatus} label={config.label}/></div>
      {!displayPosition && serverStatus !== 'completed' && <div className="absolute top-16 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm text-ink-soft shadow-card">Locating driver…</div>}
      {snapshot?.stale && snapshot.position && <div role="status" className="absolute left-3 right-3 top-28 rounded-xl bg-warning/10 px-3 py-2 text-center text-sm text-ink">Driver’s signal is weak. Showing last received location.</div>}
    </div>

    <div className={`ride-tracking-sheet absolute left-0 right-0 bottom-0 bg-surface rounded-t-3xl shadow-float lg:absolute lg:top-0 lg:right-0 lg:left-auto lg:rounded-none lg:border-l lg:border-border overflow-y-auto ${sheetExpanded ? 'ride-tracking-sheet--expanded' : 'ride-tracking-sheet--collapsed'}`}>
      <div role="button" tabIndex={0} aria-label={sheetExpanded ? 'Collapse ride details' : 'Expand ride details'} aria-expanded={sheetExpanded}
        onPointerDown={event => { dragStartY.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerUp={event => { if (dragStartY.current === null) return; const distance = event.clientY - dragStartY.current; dragStartY.current = null; if (Math.abs(distance) > 35) { didSwipe.current = true; setSheetExpanded(distance < 0); } }}
        onPointerCancel={() => { dragStartY.current = null; }}
        onClick={() => { if (didSwipe.current) { didSwipe.current = false; return; } setSheetExpanded(value => !value); }}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSheetExpanded(value => !value); } }} className="ride-tracking-sheet__handle lg:hidden"><span/></div>
      <div className="px-5 pb-6 space-y-4">
        {trackingError && <p role="alert" className="notice notice--danger">{trackingError}</p>}
        {location.error && isDriver && <div role="alert" className="notice notice--danger flex-col"><p>{location.error}</p><button type="button" onClick={location.retry} className="text-link">Retry location access</button></div>}

        {targetPosition && snapshot && <div>
          <p className="text-xl font-extrabold text-ink">{snapshot.status === 'in_progress' ? 'Heading to your destination' : 'Driver on the way'}</p>
          <p className="text-sm text-ink-soft">{`${snapshot.eta_minutes ?? '—'} min · ${snapshot.distance_remaining_km ?? '—'} km to ${snapshot.status === 'in_progress' ? 'destination' : 'pickup'}`}{snapshot.route_fallback ? ' · approximate route' : ''}</p>
        </div>}

        <div className="driver-card">
          <span className="avatar">{snapshot?.driver?.name?.slice(0, 1).toUpperCase() ?? <IconDriver size={20}/>}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-ink">{snapshot?.driver?.name || 'Waiting for driver details'}</p>
            {snapshot?.driver && <p className="flex items-center gap-1 text-xs font-semibold text-success"><IconTODA size={14}/>TODA verified · {snapshot.driver.toda_name}</p>}
          </div>
          {snapshot?.driver?.phone && <a href={`tel:${snapshot.driver.phone}`} aria-label="Call driver" className="btn-icon text-success"><IconPhone size={18}/></a>}
        </div>

        {snapshot?.driver && <dl className="plate-grid"><div><dt>Plate</dt><dd>{snapshot.driver.plate_number}</dd></div><div><dt>Body no.</dt><dd>{snapshot.driver.body_number}</dd></div><div><dt>TODA</dt><dd>{snapshot.driver.toda_name}</dd></div></dl>}

        <div className="rounded-2xl border border-border p-4">
          <div className="route-line">
            <div className="route-line__rail" aria-hidden="true"><span className="route-dot route-dot--pickup"/><span className="mt-auto route-dot route-dot--destination"/></div>
            <div className="route-line__stops">
              <div><p className="route-line__label">Pickup</p><p className="route-line__place">{snapshot?.pickup.label || 'Loading pickup…'}</p></div>
              <div><p className="route-line__label">Destination</p><p className="route-line__place">{snapshot?.destination.label || 'Loading destination…'}</p></div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-dashed border-border-strong pt-3">
            <span className="text-sm text-ink-soft">{serverStatus === 'completed' ? 'Final fare' : 'Fixed fare'} · Cash</span>
            <span className="fare-amount">{fare !== null ? `₱${fare}` : 'Fare pending'}</span>
          </div>
        </div>

        <button type="button" disabled={busy} onClick={() => void shareRide()} className="safety-share-card flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"><IconShare size={20}/><span className="flex-1"><span className="block text-sm font-bold">Share your trip</span><span className="block text-xs opacity-80">{shareNotice || 'Send a live trip link to someone you trust.'}</span></span></button>

        {targetPosition && <button type="button" onClick={() => openDeviceNavigation({ ...targetPosition, label: target?.label })} className="btn-secondary w-full"><IconNavigation size={18}/>Navigate to {snapshot?.status === 'in_progress' ? 'destination' : 'pickup'}</button>}
        <SosControl rideId={rideId} municipality={snapshot?.municipality || 'Carrascal'}/>
        {isDriver && statusError && <p role="alert" className="notice notice--danger">{statusError}</p>}
        {isDriver ? serverStatus !== 'completed' && <button type="button" disabled={busy} onClick={() => void advance()} className="btn-primary btn-large w-full">{busy ? 'Updating…' : serverStatus === 'accepted' ? 'Start pickup' : serverStatus === 'arriving' ? 'Start trip' : 'Complete ride'}</button> : <>
          <p className="text-center text-xs text-ink-soft">{serverStatus === 'in_progress' ? 'Your trip is in progress.' : 'Waiting for your driver to update the trip.'}</p>
          {['accepted', 'arriving'].includes(serverStatus) && <button type="button" onClick={() => setShowCancel(true)} className="btn-quiet w-full">Cancel ride</button>}
        </>}
      </div>
    </div>

    {showReview && <ReviewModal driver={snapshot?.driver || null} onSubmit={(stars, comment) => void submitReview(stars, comment)} onClose={dismissReview} error={reviewError} busy={reviewBusy}/>}
    {showCancel && <div className="dialog-backdrop fixed inset-0 z-50 flex items-center justify-center px-6"><div className="dialog-card w-full max-w-sm text-center" role="dialog" aria-modal="true" aria-labelledby="cancel-ride-title"><div className="dialog-icon dialog-icon--danger"><IconAlertCircle size={24}/></div><h3 id="cancel-ride-title">Cancel this ride?</h3><p className="mb-6 text-sm text-ink-soft">Your driver may already be on the way.</p><div className="flex gap-3"><button type="button" onClick={() => setShowCancel(false)} className="btn-quiet flex-1">Keep ride</button><button type="button" onClick={() => void cancelCurrentRide()} className="btn-danger flex-1">Cancel ride</button></div></div></div>}
  </div>;
}
