import { useEffect, useState } from 'react';
import Map from '../components/Map';
import { IconBookings, IconChart, IconCheck, IconStar, IconTODA, IconWallet, IconDriver } from '../components/Icons';
import { StatCard as SharedStatCard } from '../components/ui';
import { declineRide, getDriverProfile, getRides, rideFare, type ApiRide } from '../services/api';
import { useDriverLocation } from '../hooks/useDriverLocation';

interface DriverDashboardProps {
  onAcceptRide: (rideId: number) => Promise<void>;
  onResumeRide?: (rideId: number) => void;
}

function RideRequestCard({ ride, onAccept, onDecline }: { ride: ApiRide; onAccept: () => void; onDecline: () => void }) {
  const fare = rideFare(ride);
  const distance = ride.fare_distance_km ?? ride.distance_km ?? null;
  return (
    <div data-testid="ride-request-card" data-ride-id={ride.id} className="ride-request-card animate-fade-in">
      {/* Passenger header */}
      <div className="mb-4 flex items-center gap-3">
        <span className="avatar avatar--small">{(ride.passenger_name || 'P').slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{ride.passenger_name || 'Passenger'}</p>
          <p className="text-xs text-ink-soft">New request · {ride.municipality}</p>
        </div>
        <div className="text-right">
          <p className="fare-amount">{fare !== null ? `₱${fare}` : 'Fare pending'}</p>
          {distance !== null && <p className="text-xs text-ink-soft">{distance} km · Cash</p>}
        </div>
      </div>

      {/* Route */}
      <div className="route-line mb-4">
        <div className="route-line__rail" aria-hidden="true"><span className="route-dot route-dot--pickup"/><span className="mt-auto route-dot route-dot--destination"/></div>
        <div className="route-line__stops">
          <div>
            <p className="route-line__label">Pickup</p>
            <p data-testid="ride-request-pickup" className="route-line__place">{ride.pickup_label}</p>
          </div>
          <div>
            <p className="route-line__label">Destination</p>
            <p className="route-line__place">{ride.destination_label}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <span className="meta-pill capitalize">{ride.ride_type.replace('_', ' ')}</span>
        <span className="meta-pill">Cash payment</span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button type="button" onClick={onDecline} className="btn-quiet flex-1">Decline</button>
        <button type="button" onClick={onAccept} className="btn-primary flex-1">Accept</button>
      </div>
    </div>
  );
}

export default function DriverDashboard({ onAcceptRide, onResumeRide }: DriverDashboardProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [rides, setRides] = useState<ApiRide[]>([]);
  const [requestError, setRequestError] = useState('');
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getDriverProfile>> | null>(null);
  const location = useDriverLocation(isOnline && profile?.verification_status === 'verified');

  useEffect(() => {
    let current = true;
    getDriverProfile().then(result => { if (current) setProfile(result); }).catch(error => {
      if (current) setRequestError(error instanceof Error ? error.message : 'Could not load driver profile.');
    });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    let current = true;
    if (!isOnline) { setLoadingRequests(false); return () => { current = false; }; }
    setLoadingRequests(true);
    const refresh = () => getRides().then(next => {
      if (current) { setRides(next); setRequestError(''); }
    }).catch(error => {
      if (current) setRequestError(error instanceof Error ? error.message : 'Could not load requests.');
    }).finally(() => { if (current) setLoadingRequests(false); });
    void refresh();
    const interval = window.setInterval(refresh, 8000);
    return () => { current = false; window.clearInterval(interval); };
  }, [isOnline]);

  const requests = rides.filter(ride => ride.status === 'finding');
  const completedRides = rides.filter(ride => ride.status === 'completed');
  const activeRide = rides.find(ride => ['accepted', 'arriving', 'in_progress'].includes(ride.status));

  const handleDecline = async (id: number) => {
    try {
      await declineRide(id);
      setRides(prev => prev.filter(ride => ride.id !== id));
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Could not decline this request.');
    }
  };

  const handleAccept = async (id: number) => {
    try {
      await onAcceptRide(id);
      setRides(prev => prev.filter(ride => ride.id !== id));
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'This ride is no longer available.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-warm">
      <div className="space-y-4 px-4 pt-5">
        {/* Online status */}
        <section className={`driver-status-card ${isOnline ? 'driver-status-card--online' : ''}`}>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold opacity-90">{profile ? `Hi, ${profile.full_name.split(' ')[0]}` : 'Driver dashboard'}</p>
            <h1 className="driver-status-card__title">{isOnline ? 'You’re online' : 'You’re offline'}</h1>
            <p className="driver-status-card__text">{isOnline ? 'Ride requests near you will appear below.' : 'Go online to start receiving ride requests.'}</p>
          </div>
          <button
            type="button"
            onClick={() => setIsOnline(!isOnline)}
            aria-label={isOnline ? 'Go offline' : 'Go online'}
            disabled={profile?.verification_status !== 'verified'}
            aria-pressed={isOnline}
            className={`system-toggle ${isOnline ? 'system-toggle--on' : ''}`}
          >
            <span/>
          </button>
        </section>

        {/* TODA badge */}
        <div className={`verified-strip ${profile?.verification_status === 'verified' ? '' : 'verified-strip--pending'}`}>
          <IconTODA size={18}/>
          <strong>{profile?.verification_status === 'verified' ? 'TODA verified' : 'Verification pending'}</strong>
          <span className="min-w-0 truncate opacity-90">{profile ? `${profile.toda_name} · ${profile.plate_number} · ${profile.body_number}` : 'Driver details unavailable'}</span>
        </div>

        {location.error && <div role="alert" className="notice notice--danger flex-col"><p>{location.error}</p><button type="button" onClick={location.retry} className="text-link">Retry location access</button></div>}

        {/* Active ride banner */}
        {activeRide && onResumeRide && (
          <div className="app-card">
            <p className="eyebrow mb-2 text-orange-dark">Active ride</p>
            <p className="truncate text-sm font-bold text-ink">{activeRide.pickup_label}</p>
            <p className="truncate text-sm text-ink-soft">to {activeRide.destination_label}</p>
            <button type="button" onClick={() => onResumeRide(activeRide.id)} className="btn-primary mt-3 w-full">Resume ride</button>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3">
          <SharedStatCard icon={<IconWallet size={20}/>} label="Today’s earnings" value={profile?.earnings_today ?? 0} unit="₱"/>
          <SharedStatCard icon={<IconDriver size={20}/>} label="Rides today" value={profile?.rides_today ?? 0}/>
          <SharedStatCard icon={<IconStar size={20} filled/>} label="Rating" value={Number(profile?.rating ?? 0).toFixed(1)}/>
          <SharedStatCard icon={<IconChart size={20}/>} label="Total rides" value={profile?.total_rides ?? 0}/>
        </div>

        {/* Map */}
        <div className="overflow-hidden rounded-2xl border border-border">
          <Map activeMunicipality="carrascal" className="h-40" compact currentPosition={location.point}/>
        </div>
      </div>

      {/* Ride requests */}
      <div className="px-4 pt-6 pb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title m-0">Ride requests</h2>
          {requests.length > 0 && (
            <span className="rounded-full bg-orange-action px-2 py-0.5 text-xs font-bold text-white">{requests.length}</span>
          )}
        </div>

        {requestError && <p role="alert" className="notice notice--danger mb-3">{requestError}</p>}

        {!isOnline ? (
          <div className="empty-state-card empty-state">
            <div className="empty-state-card__icon"><IconBookings size={24}/></div>
            <h2>You’re offline</h2>
            <p>Go online to receive ride requests.</p>
            <button
              type="button"
              onClick={() => setIsOnline(true)}
              disabled={profile?.verification_status !== 'verified'}
              className="btn-primary btn-large px-6"
            >
              Go online
            </button>
          </div>
        ) : loadingRequests ? (
          <div className="app-card space-y-2" aria-label="Loading ride requests">
            <div className="skeleton-block h-3 w-1/3"/>
            <div className="skeleton-block h-3 w-full"/>
            <div className="skeleton-block h-3 w-2/3"/>
          </div>
        ) : requests.length === 0 ? (
          <div className="empty-state-card empty-state">
            <div className="empty-state-card__icon"><IconDriver size={24}/></div>
            <h2>Waiting for requests…</h2>
            <p>You’ll see new bookings here as soon as passengers book.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map(ride => (
              <RideRequestCard
                key={ride.id}
                ride={ride}
                onAccept={() => void handleAccept(ride.id)}
                onDecline={() => void handleDecline(ride.id)}
              />
            ))}
          </div>
        )}

        {/* Today's completed rides */}
        {completedRides.length > 0 && <div className="mt-8">
          <h2 className="section-title">Completed rides</h2>
          <div className="app-card p-0 divide-y divide-border overflow-hidden">
            {completedRides.slice(0, 3).map(ride => {
              const fare = rideFare(ride);
              return (
                <div key={ride.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="grid h-9 w-9 flex-none place-items-center rounded-full bg-success-bg text-success"><IconCheck size={16}/></div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{ride.pickup_label} to {ride.destination_label}</p>
                    <p className="text-xs text-ink-soft">{new Date(ride.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <span className="text-sm font-extrabold text-ink">{fare !== null ? `₱${fare}` : 'Fare pending'}</span>
                </div>
              );
            })}
          </div>
        </div>}
      </div>
    </div>
  );
}
