import { useEffect, useState } from 'react';
import { IconMap } from '../components/Icons';
import { EmptyState, ErrorState, Skeleton, StatusBadge } from '../components/ui';
import { getRides, type ApiRide } from '../services/api';

const STATUS_FILTERS = ['All', 'Completed', 'Cancelled'];
const MUNI_FILTERS = ['All', 'Carrascal', 'Cantilan', 'Madrid', 'Carmen', 'Lanuza'];
const RIDE_TYPE_LABELS: Record<string, string> = {
  regular: 'Regular', pakyaw: 'Private Hire', padala: 'Parcel Delivery', scheduled: 'Scheduled', group: 'Group',
};

export default function Bookings() {
  const [statusFilter, setStatusFilter] = useState('All');
  const [muniFilter, setMuniFilter] = useState('All');
  const [selectedRide, setSelectedRide] = useState<number | null>(null);
  const [rides, setRides] = useState<ApiRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getRides()
      .then(setRides)
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load ride history.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rides.filter(ride => {
    if (statusFilter !== 'All' && ride.status !== statusFilter.toLowerCase()) return false;
    if (muniFilter !== 'All' && ride.municipality !== muniFilter) return false;
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto bg-warm">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-xl font-semibold text-ink mb-1">Bookings</h1>
        <p className="text-sm text-ink-soft">{filtered.length} rides</p>
      </div>
      <div className="px-4 py-3 space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_FILTERS.map(filter => (
            <button key={filter} onClick={() => setStatusFilter(filter)} className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium border-2 transition-all ${statusFilter === filter ? 'border-orange bg-orange text-white' : 'border-border bg-surface text-ink-soft'}`}>
              {filter}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {MUNI_FILTERS.map(filter => (
            <button key={filter} onClick={() => setMuniFilter(filter)} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${muniFilter === filter ? 'border-orange bg-orange-light text-orange' : 'border-border bg-surface text-ink-soft'}`}>
              {filter}
            </button>
          ))}
        </div>
      </div>
      {error && <ErrorState className="mx-4 mb-3" message={error}/>}
      <div className="px-4 pb-6 space-y-3">
        {loading ? (
          <div className="space-y-3" aria-label="Loading ride history">
            <Skeleton className="h-24 w-full rounded-2xl"/><Skeleton className="h-24 w-full rounded-2xl"/>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No rides found"
            description="Try changing your filters to see more rides."
            icon={<IconMap size={24}/>}
            action={<button className="btn-secondary" onClick={() => { setStatusFilter('All'); setMuniFilter('All'); }}>Reset filters</button>}
          />
        ) : filtered.map(ride => {
          const selected = selectedRide === ride.id;
          const rideType = RIDE_TYPE_LABELS[ride.ride_type] || ride.ride_type;
          return (
            <article key={ride.id} className={`ride-history-card bg-surface rounded-2xl border p-4 ${selected ? 'ride-history-card--selected' : 'border-border'}`}>
              <button type="button" onClick={() => setSelectedRide(selected ? null : ride.id)} aria-expanded={selected} className="w-full text-left">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="text-xs text-ink-soft mb-1">{new Date(ride.requested_at).toLocaleString()}</p>
                    <p className="font-medium text-sm text-ink">{ride.municipality}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <StatusBadge status={ride.status}/>
                    <span className="text-xs text-ink-soft bg-warm px-2 py-0.5 rounded-full border border-border">{rideType}</span>
                  </div>
                </div>
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-1" aria-hidden="true">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange"/><span className="w-px h-5 bg-border"/><span className="w-2.5 h-2.5 rounded bg-ink"/>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <p className="text-sm text-ink leading-tight">{ride.pickup_label}</p>
                    <p className="text-sm text-ink leading-tight">{ride.destination_label}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-xs text-ink-soft">
                    <span className="font-semibold text-orange text-base">{ride.fare ? `₱${ride.fare}` : 'Fare pending'}</span>
                    {ride.distance_km && <><span>·</span><span>{ride.distance_km} km</span></>}
                  </div>
                  <span className="text-xs text-orange font-medium">{selected ? 'Hide details' : 'Details'}</span>
                </div>
              </button>
              {selected && (
                <div className="mt-4 pt-4 border-t border-border animate-fade-in">
                  <div className="flex items-center justify-between text-sm"><span className="text-ink-soft">Driver</span><span className="font-medium text-ink">{ride.driver_name || 'Not assigned'}</span></div>
                  <div className="mt-2 flex items-center justify-between text-sm"><span className="text-ink-soft">Payment</span><span className="font-medium text-ink">Cash</span></div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
