import { useEffect, useState } from 'react';
import Map from '../components/Map';
import { IconBookings, IconChart, IconCheck, IconStar, IconTODA, IconWallet, IconDriver } from '../components/Icons';
import { StatCard as SharedStatCard } from '../components/ui';
import { declineRide, getDriverProfile, getRides, type ApiRide } from '../services/api';
import { useDriverLocation } from '../hooks/useDriverLocation';

interface DriverDashboardProps {
  onAcceptRide: (rideId: number) => Promise<void>;
}

function RideRequestCard({ ride, onAccept, onDecline }: { ride: ApiRide; onAccept: () => void; onDecline: () => void }) {
  return (
    <div className="ride-request-card bg-surface rounded-2xl border border-border p-4 animate-fade-in">
      {/* Passenger header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-orange">New request</p>
          <p className="font-semibold text-sm text-ink">{ride.municipality} ride request</p>
          <p className="text-xs text-ink-soft">{ride.passenger_name || 'Passenger'}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-orange">{ride.fare ? `₱${ride.fare}` : 'Fare pending'}</p>
          {ride.distance_km && <p className="text-xs text-ink-soft">{ride.distance_km} km</p>}
        </div>
      </div>

      {/* Route */}
      <div className="flex items-start gap-3 mb-3 rounded-xl p-3">
        <div className="flex flex-col items-center gap-1 mt-1 flex-shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-orange"/>
          <div className="w-px h-6 bg-border"/>
          <div className="w-2.5 h-2.5 rounded bg-ink"/>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-ink-soft">Pickup</p>
            <p className="text-sm font-medium text-ink leading-tight">{ride.pickup_label}</p>
          </div>
          <div>
            <p className="text-xs text-ink-soft">Destination</p>
            <p className="text-sm font-medium text-ink leading-tight">{ride.destination_label}</p>
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 text-xs text-ink-soft mb-3">
        <span className="bg-orange-light text-orange px-2 py-0.5 rounded-full font-medium capitalize">{ride.ride_type.replace('_', ' ')}</span>
        <span>·</span>
        <span>Cash</span>
        <span>·</span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={onDecline}
          className="btn-secondary flex-1 py-3"
        >
          Decline
        </button>
        <button onClick={onAccept} className="btn-primary flex-1">Accept</button>
      </div>
    </div>
  );
}

export default function DriverDashboard({ onAcceptRide }: DriverDashboardProps) {
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
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Driver Dashboard</h1>
          <p className="text-sm text-ink-soft">{profile ? `${profile.full_name} · ${profile.body_number}` : 'Loading driver profile…'}</p>
        </div>
        {/* Online toggle */}
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${isOnline ? 'text-success' : 'text-ink-soft'}`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
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
        </div>
      </div>

      {/* TODA badge */}
      <div className="mx-4 mb-4 flex items-center gap-2 bg-orange-light rounded-xl px-4 py-2.5 border border-orange/20">
        <IconTODA className="w-5 h-5"/>
        <span className="text-sm font-semibold text-orange">{profile?.verification_status === 'verified' ? 'TODA Verified' : 'Verification pending'}</span>
        <span className="text-ink-soft text-xs mx-1">·</span>
        <span className="text-xs text-ink-soft">{profile ? `${profile.toda_name} · ${profile.plate_number}` : 'Driver details unavailable'}</span>
      </div>

      {location.error && <div role="alert" className="mx-4 mb-4 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger"><p>{location.error}</p><button type="button" onClick={location.retry} className="mt-2 font-semibold underline">Retry location access</button></div>}

      {/* Stat cards */}
      <div className="px-4 mb-6 grid grid-cols-2 gap-3">
        <SharedStatCard icon={<IconWallet size={20}/>} label="Today's Earnings" value={profile?.earnings_today ?? 0} unit="₱"/>
        <SharedStatCard icon={<IconDriver size={20}/>} label="Rides Today" value={profile?.rides_today ?? 0}/>
        <SharedStatCard icon={<IconStar className="text-warning" filled={false}/>} label="Rating" value={Number(profile?.rating ?? 0).toFixed(1)}/>
        <SharedStatCard icon={<IconChart className="text-orange"/>} label="Total Rides" value={profile?.total_rides ?? 0}/>
      </div>

      {/* Map */}
      <div className="px-4 mb-6">
        <Map activeMunicipality="carrascal" className="h-40" compact currentPosition={location.point}/>
      </div>

      {/* Ride requests */}
      <div className="px-4 pb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-base text-ink">Ride Requests</h2>
          {requests.length > 0 && (
            <span className="bg-orange text-white text-xs font-bold px-2 py-0.5 rounded-full">{requests.length}</span>
          )}
        </div>

        {requestError && <p role="alert" className="mb-3 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">{requestError}</p>}

        {!isOnline ? (
          <div className="text-center py-8 bg-surface rounded-2xl border border-border">
            <IconBookings size={24} className="mx-auto mb-3 text-ink-soft"/>
            <p className="font-semibold text-ink mb-1">You're Offline</p>
            <p className="text-sm text-ink-soft mb-4">Go online to receive ride requests</p>
            <button
              onClick={() => setIsOnline(true)}
              className="btn-primary btn-large px-6"
            >
              Go Online
            </button>
          </div>
        ) : loadingRequests ? (
          <div className="space-y-2 rounded-2xl border border-border bg-surface p-4" aria-label="Loading ride requests">
            <div className="skeleton-block h-3 w-1/3"/>
            <div className="skeleton-block h-3 w-full"/>
            <div className="skeleton-block h-3 w-2/3"/>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-8 bg-surface rounded-2xl border border-border">
            <p className="font-semibold text-ink mb-1">Waiting for Requests...</p>
            <p className="text-sm text-ink-soft">You'll be notified when a passenger books</p>
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
        <div className="mt-6">
          <h2 className="font-semibold text-base text-ink mb-3">Today's Rides</h2>
          <div className="space-y-2">
            {completedRides.slice(0, 3).map(ride => (
              <div key={ride.id} className="bg-surface rounded-xl p-3 border border-border flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-success-bg flex items-center justify-center"><IconCheck size={16} className="text-success"/></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink font-medium truncate">{ride.pickup} → {ride.destination}</p>
                  <p className="text-xs text-ink-soft">{new Date(ride.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <span className="text-sm font-bold text-orange">₱{ride.fare}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
