import { useEffect, useState } from 'react';
import { IconBookings, IconChevronDown } from '../components/Icons';
import { EmptyState, ErrorState, Skeleton, StatusBadge } from '../components/ui';
import { getRides, rideFare, type ApiRide } from '../services/api';

const STATUS_FILTERS = ['All', 'Completed', 'Cancelled'];
const MUNI_FILTERS = ['All', 'Carrascal', 'Cantilan', 'Madrid', 'Carmen', 'Lanuza'];
const RIDE_TYPE_LABELS: Record<string, string> = {
  regular: 'Regular', pakyaw: 'Private Hire', padala: 'Parcel Delivery', scheduled: 'Scheduled', group: 'Group',
};
const ACTIVE_STATUSES = ['finding', 'accepted', 'arriving', 'in_progress'];

export default function Bookings({ onResumeRide, canResume = false }: { onResumeRide?: (rideId: number) => void; canResume?: boolean }) {
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
      <div className="page-width px-4 pt-4 pb-4 space-y-3">
        <p className="text-sm font-semibold text-ink-soft" aria-live="polite">{filtered.length} {filtered.length === 1 ? 'ride' : 'rides'}</p>
        <div className="chip-row" aria-label="Filter by status">
          {STATUS_FILTERS.map(filter => (
            <button key={filter} type="button" onClick={() => setStatusFilter(filter)} aria-pressed={statusFilter === filter} className="app-chip">
              {filter}
            </button>
          ))}
        </div>
        <div className="chip-row" aria-label="Filter by town">
          {MUNI_FILTERS.map(filter => (
            <button key={filter} type="button" onClick={() => setMuniFilter(filter)} aria-pressed={muniFilter === filter} className="app-chip app-chip--soft">
              {filter === 'All' ? 'All towns' : filter}
            </button>
          ))}
        </div>
      </div>
      {error && <ErrorState className="mx-4 mb-3" message={error}/>}
      <div className="page-width px-4 pb-6 space-y-3">
        {loading ? (
          <div className="space-y-3" aria-label="Loading ride history">
            <Skeleton className="h-24 w-full rounded-2xl"/><Skeleton className="h-24 w-full rounded-2xl"/>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No rides found"
            description="Try changing your filters to see more rides."
            icon={<IconBookings size={24}/>}
            action={<button type="button" className="btn-secondary" onClick={() => { setStatusFilter('All'); setMuniFilter('All'); }}>Reset filters</button>}
          />
        ) : filtered.map(ride => {
          const selected = selectedRide === ride.id;
          const rideType = RIDE_TYPE_LABELS[ride.ride_type] || ride.ride_type;
          const isActive = ACTIVE_STATUSES.includes(ride.status);
          const canTrack = canResume && isActive && onResumeRide;
          const fare = rideFare(ride);
          const distance = ride.fare_distance_km ?? ride.distance_km ?? null;
          return (
            <article key={ride.id} className={`ride-history-card ${selected ? 'ride-history-card--selected' : ''}`}>
              <button type="button" onClick={() => setSelectedRide(selected ? null : ride.id)} aria-expanded={selected} className="ride-history-card__toggle block w-full text-left">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">{rideType} · {ride.municipality}</p>
                    <p className="text-xs text-ink-soft">{new Date(ride.requested_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                  <StatusBadge status={ride.status}/>
                </div>
                <div className="route-line mb-4">
                  <div className="route-line__rail" aria-hidden="true"><span className="route-dot route-dot--pickup"/><span className="mt-auto route-dot route-dot--destination"/></div>
                  <div className="route-line__stops">
                    <p className="route-line__place">{ride.pickup_label}</p>
                    <p className="route-line__place">{ride.destination_label}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                  <div className="flex items-center gap-2">
                    <span className="fare-amount">{fare !== null ? `₱${fare}` : 'Fare pending'}</span>
                    {distance !== null && <span className="meta-pill">{distance} km</span>}
                  </div>
                  <span className="flex items-center gap-1 text-sm font-bold text-orange-dark">{selected ? 'Hide' : 'Details'}<IconChevronDown size={16} className={selected ? 'rotate-180' : ''}/></span>
                </div>
              </button>
              {canTrack && (
                <button type="button" onClick={() => onResumeRide(ride.id)} className="btn-primary w-full mt-3">
                  {ride.status === 'finding' ? 'View search' : 'Track ride'}
                </button>
              )}
              {selected && (
                <div className="mt-3 space-y-2 rounded-xl bg-warm p-3 animate-fade-in">
                  <div className="flex items-center justify-between text-sm"><span className="text-ink-soft">Driver</span><span className="font-bold text-ink">{ride.driver_name || 'Not assigned'}</span></div>
                  {ride.plate_number && <div className="flex items-center justify-between text-sm"><span className="text-ink-soft">Plate</span><span className="font-bold text-ink">{ride.plate_number}</span></div>}
                  <div className="flex items-center justify-between text-sm"><span className="text-ink-soft">Payment</span><span className="font-bold text-ink">Cash</span></div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
