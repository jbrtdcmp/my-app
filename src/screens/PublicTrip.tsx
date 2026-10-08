import { useEffect, useState } from 'react';
import Map from '../components/Map';
import { getPublicTrip } from '../services/api';

type PublicTripData = Awaited<ReturnType<typeof getPublicTrip>>;

export default function PublicTrip({ token }: { token: string }) {
  const [trip, setTrip] = useState<PublicTripData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    let timer = 0;
    const refresh = async () => {
      try {
        const result = await getPublicTrip(token);
        if (!live) return;
        setTrip(result);
        setError('');
        if (result.status !== 'completed' && result.status !== 'cancelled') timer = window.setTimeout(refresh, 4000);
      } catch (reason) {
        if (live) setError(reason instanceof Error ? reason.message : 'This shared trip is unavailable.');
      }
    };
    void refresh();
    return () => { live = false; window.clearTimeout(timer); };
  }, [token]);

  const position = trip?.position && !trip.stale ? trip.position : null;
  return <main className="min-h-screen bg-warm p-4 md:flex md:items-center md:justify-center">
    <section className="public-trip-shell mx-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface">
      <header className="border-b border-border px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange">PASAKJA · Shared trip</p>
        <h1 className="mt-1 text-xl font-semibold text-ink">{error ? 'Trip link unavailable' : trip?.status === 'completed' ? 'Trip completed' : 'Live trip'}</h1>
      </header>
      {error ? <p role="alert" className="m-6 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">{error}</p> : <>
        <div className="public-trip-map relative flex-1">
          <Map activeMunicipality="carrascal" showRoute className="absolute inset-0" driverPosition={position} driverHeading={position?.heading}/>
          {trip?.stale && trip.position && <p role="status" className="absolute left-3 right-3 top-3 rounded-lg bg-white/95 px-3 py-2 text-center text-sm text-ink">Last location is delayed. Waiting for a fresh update.</p>}
          {!trip?.position && <p role="status" className="absolute left-3 right-3 top-3 rounded-lg bg-white/95 px-3 py-2 text-center text-sm text-ink">Driver location has not been shared yet.</p>}
        </div>
        <div className="space-y-3 p-5 text-sm">
          <p><span className="text-ink-soft">Status: </span><span className="font-semibold capitalize text-ink">{trip?.status?.replace(/_/g, ' ') || 'Loading'}</span></p>
          <p><span className="text-ink-soft">From: </span><span className="text-ink">{trip?.pickup || '—'}</span></p>
          <p><span className="text-ink-soft">To: </span><span className="text-ink">{trip?.destination || '—'}</span></p>
          {trip?.driver && <p><span className="text-ink-soft">Driver: </span><span className="text-ink">{trip.driver.name}{trip.driver.plate_number ? ` · ${trip.driver.plate_number}` : ''}</span></p>}
        </div>
      </>}
      <p className="border-t border-border px-5 py-3 text-xs text-ink-soft">Read-only link. Personal contact details are hidden.</p>
    </section>
  </main>;
}
