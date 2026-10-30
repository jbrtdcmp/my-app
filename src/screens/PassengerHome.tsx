import { useEffect, useRef, useState } from 'react';
import Map, { type MapPoint } from '../components/Map';
import { IconCheck, IconChevronDown, IconLocation, IconDestination, IconMap } from '../components/Icons';
import { MUNICIPALITIES, RIDE_TYPES, type Landmark, type Municipality, type RideType } from '../data';
import { estimateFare, getRides, ApiError, type ApiRide, type FareEstimate, type RideRequest } from '../services/api';

interface PassengerHomeProps {
  onBookingStart: (ride: RideRequest) => Promise<void>;
  onResumeRide?: (rideId: number) => void;
}

const ACTIVE_STATUSES = ['finding', 'accepted', 'arriving', 'in_progress'];

const DISCOUNTS = [
  { id: 'none', label: 'None' },
  { id: 'student', label: 'Student 20%' },
  { id: 'senior', label: 'Senior 20%' },
  { id: 'pwd', label: 'PWD 20%' },
];

const peso = (value: number) => `₱${Number.isInteger(value) ? value : value.toFixed(2)}`;

function MunicipalitySwitcher({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const activeM = MUNICIPALITIES.find(m => m.id === active);
  const activeLabel = active === 'intertown' ? 'Inter-town Ride' : activeM?.name ?? 'Carrascal';

  const all = [
    ...MUNICIPALITIES.map(m => ({ id: m.id, label: m.name, isInterTown: false })),
    { id: 'intertown', label: 'Inter-town Ride', isInterTown: true },
  ];

  return (
    <div className="relative z-20" data-testid="municipality-switcher">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full border-2 border-orange bg-white shadow-sm"
      >
        <span className="w-2 h-2 rounded-full bg-orange flex-shrink-0"/>
        <span className="font-semibold text-sm text-ink">{activeLabel}</span>
        <IconChevronDown size={16} className="text-orange-dark"/>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 bg-white rounded-2xl shadow-float border border-border overflow-hidden w-52 animate-fade-in">
          {all.map(m => (
            <button
              key={m.id}
              onClick={() => { onChange(m.id); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-orange-light transition-colors ${
                m.id === active ? 'bg-orange-light' : ''
              }`}
            >
              {m.isInterTown
                ? <span className="w-5 h-5 rounded-full bg-sunset/20 flex items-center justify-center"><IconMap size={16} className="text-orange-dark"/></span>
                : <span className="w-5 h-5 rounded-full bg-orange/20 flex-shrink-0"/>}
              <div>
                <p className="text-sm font-medium text-ink">{m.label}</p>
                {m.isInterTown && <p className="text-xs text-orange-dark">e.g. Cantilan → Carmen</p>}
              </div>
              {m.id === active && (
                <IconCheck size={16} className="ml-auto text-orange-dark"/>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FarePreview({ estimate, loading, error, hasPins }: { estimate: FareEstimate | null; loading: boolean; error: string; hasPins: boolean }) {
  return (
    <div className="bg-orange-light rounded-2xl p-4 mt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-orange-dark uppercase tracking-wide">Fare Breakdown</span>
        <span className="text-xs text-ink-soft">Cash only</span>
      </div>
      <p className="mb-2 text-xs font-medium text-orange-dark">Fixed fare. No surge pricing.</p>
      {!hasPins ? (
        <p className="text-sm text-ink-soft">Set pickup and destination pins on the map to see the fixed fare.</p>
      ) : error ? (
        <p role="alert" className="text-sm text-danger">{error}</p>
      ) : loading || !estimate ? (
        <div className="space-y-2" aria-label="Calculating fare">
          <div className="skeleton-block h-3 w-2/3"/>
          <div className="skeleton-block h-3 w-1/2"/>
        </div>
      ) : (
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-ink-soft">
            <span>{estimate.is_intertown ? `${estimate.municipality} → ${estimate.destination_municipality}` : `Base fare (includes ${estimate.included_km} km)`}</span>
            <span className="font-medium text-ink">{peso(estimate.base_fare)}</span>
          </div>
          {!estimate.is_intertown && estimate.billable_km > 0 && (
            <div className="flex justify-between text-ink-soft">
              <span>Distance ({estimate.distance_km} km)</span><span className="font-medium text-ink">{peso(estimate.distance_fare)}</span>
            </div>
          )}
          {estimate.multiplier_amount > 0 && (
            <div className="flex justify-between text-ink-soft">
              <span>Ride type adjustment</span><span className="font-medium text-ink">+{peso(estimate.multiplier_amount)}</span>
            </div>
          )}
          {estimate.discount_amount > 0 && (
            <div className="flex justify-between text-success">
              <span className="font-medium">{estimate.discount === 'student' ? 'Student' : estimate.discount === 'senior' ? 'Senior' : 'PWD'} Discount ({estimate.discount_percent}%)</span>
              <span className="font-semibold">-{peso(estimate.discount_amount)}</span>
            </div>
          )}
          <div className="border-t border-orange/20 pt-2 flex justify-between font-semibold text-base">
            <span className="text-ink">Total</span>
            <span className="text-orange-dark">{peso(estimate.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PassengerHome({ onBookingStart, onResumeRide }: PassengerHomeProps) {
  const [activeMuni, setActiveMuni] = useState('carrascal');
  const [fromTown, setFromTown] = useState('carrascal');
  const [toTown, setToTown] = useState('cantilan');
  const [rideType, setRideType] = useState<RideType>('regular');
  const [discount, setDiscount] = useState('none');
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [pickupPosition, setPickupPosition] = useState<MapPoint | null>(null);
  const [destinationPosition, setDestinationPosition] = useState<MapPoint | null>(null);
  const [currentPosition, setCurrentPosition] = useState<MapPoint | null>(null);
  const [activePickField, setActivePickField] = useState<'pickup' | 'destination' | null>(null);
  const [pendingPin, setPendingPin] = useState<'pickup' | 'destination' | null>(null);
  const [pinHint, setPinHint] = useState('');
  const [notes, setNotes] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const [activeRide, setActiveRide] = useState<ApiRide | null>(null);
  const [estimate, setEstimate] = useState<FareEstimate | null>(null);
  const [estimateError, setEstimateError] = useState('');
  const [estimateLoading, setEstimateLoading] = useState(false);
  const estimateSequence = useRef(0);
  const dragStartY = useRef<number | null>(null);
  const didSwipe = useRef(false);

  useEffect(() => {
    if (!onResumeRide) return;
    let current = true;
    getRides()
      .then(rides => { if (current) setActiveRide(rides.find(ride => ACTIVE_STATUSES.includes(ride.status)) ?? null); })
      .catch(() => { if (current) setActiveRide(null); });
    return () => { current = false; };
  }, [onResumeRide]);

  const isIntertown = activeMuni === 'intertown';
  const pickupMuni: Municipality = MUNICIPALITIES.find(m => m.id === (isIntertown ? fromTown : activeMuni)) ?? MUNICIPALITIES[0];
  const destinationMuni: Municipality = isIntertown
    ? MUNICIPALITIES.find(m => m.id === toTown) ?? pickupMuni
    : pickupMuni;

  useEffect(() => {
    const sequence = ++estimateSequence.current;
    if (!pickupPosition || !destinationPosition) {
      setEstimate(null);
      setEstimateError('');
      setEstimateLoading(false);
      return;
    }
    setEstimateLoading(true);
    setEstimateError('');
    const timer = window.setTimeout(() => {
      estimateFare({
        pickupPosition,
        destinationPosition,
        rideType,
        discount,
        municipality: pickupMuni.name,
        destinationMunicipality: isIntertown ? destinationMuni.name : undefined,
      }).then(next => {
        if (sequence !== estimateSequence.current) return;
        setEstimate(next);
        setEstimateLoading(false);
      }).catch(error => {
        if (sequence !== estimateSequence.current) return;
        setEstimate(null);
        setEstimateError(error instanceof Error ? error.message : 'Could not estimate this fare.');
        setEstimateLoading(false);
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [pickupPosition, destinationPosition, rideType, discount, pickupMuni.name, destinationMuni.name, isIntertown]);

  const clearPins = () => {
    setPickupPosition(null);
    setDestinationPosition(null);
    setCurrentPosition(null);
    setPickup('');
    setDestination('');
    setActivePickField(null);
    setPendingPin(null);
    setPinHint('');
  };

  const promptForPin = (field: 'pickup' | 'destination') => {
    setActivePickField(field);
    setPendingPin(field);
    setPinHint(`Tap the map to confirm the ${field} point.`);
    setSheetExpanded(false);
  };

  const handleMunicipalityChange = (id: string) => {
    setActiveMuni(id);
    clearPins();
  };

  const choosePickupLandmark = (landmark: Landmark) => {
    setPickup(landmark.name);
    setCurrentPosition(null);
    if (landmark.lat !== undefined && landmark.lng !== undefined) {
      setPickupPosition({ lat: landmark.lat, lng: landmark.lng });
      setActivePickField(null);
      setPendingPin(null);
      setPinHint('');
    } else {
      setPickupPosition(null);
      promptForPin('pickup');
    }
  };

  const chooseDestinationLandmark = (landmark: Landmark) => {
    setDestination(landmark.name);
    if (landmark.lat !== undefined && landmark.lng !== undefined) {
      setDestinationPosition({ lat: landmark.lat, lng: landmark.lng });
      setActivePickField(null);
      setPendingPin(null);
      setPinHint('');
    } else {
      setDestinationPosition(null);
      promptForPin('destination');
    }
  };

  const canBook = Boolean(pickupPosition && destinationPosition && estimate && !estimateLoading);

  const submitRide = async () => {
    setBookingError('');
    if (!pickupPosition || !destinationPosition) {
      setBookingError('Set both pickup and destination pins on the map before booking.');
      return;
    }
    if (!estimate) {
      setBookingError('Wait for the fixed fare estimate before booking.');
      return;
    }
    try {
      await onBookingStart({
        pickup: pickup.trim() || 'Map pin',
        destination: destination.trim() || 'Map pin',
        pickupPosition,
        destinationPosition,
        municipality: pickupMuni.name,
        destinationMunicipality: isIntertown ? destinationMuni.name : null,
        rideType,
        discount,
        note: notes,
        quotedFare: estimate.total,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && error.estimate) {
        setEstimate(error.estimate);
        setBookingError(error.message);
        return;
      }
      setBookingError(error instanceof Error ? error.message : 'Could not create your ride request.');
    }
  };

  const bookingHint = pinHint || (!pickupPosition || !destinationPosition
    ? 'Set both pickup and destination pins on the map to book.'
    : estimateLoading
      ? 'Calculating fixed fare…'
      : estimateError
        ? 'Fare estimate unavailable. Adjust your pins and try again.'
        : !estimate
          ? 'Waiting for the fare estimate…'
          : 'Fixed fare. No surge pricing.');

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* Map */}
      <div className={`passenger-map-layer absolute inset-0 transition-all duration-500 ${sheetExpanded ? 'passenger-map-layer--expanded' : 'passenger-map-layer--collapsed'}`}>
        <Map
          activeMunicipality={pickupMuni.id}
          className="h-full"
          pickupPosition={pickupPosition}
          destinationPosition={destinationPosition}
          currentPosition={currentPosition}
          activePickField={activePickField}
          pickHint={pinHint || undefined}
          onMapPick={point => {
            if (activePickField === 'pickup') {
              setPickupPosition(point);
              setCurrentPosition(null);
              if (pendingPin !== 'pickup') setPickup(`Map pin (${point.lat.toFixed(5)}, ${point.lng.toFixed(5)})`);
            } else if (activePickField === 'destination') {
              setDestinationPosition(point);
              if (pendingPin !== 'destination') setDestination(`Map pin (${point.lat.toFixed(5)}, ${point.lng.toFixed(5)})`);
            }
            setActivePickField(null);
            setPendingPin(null);
            setPinHint('');
            setSheetExpanded(true);
          }}
          onLocationFound={point => {
            setPickupPosition(point);
            setCurrentPosition(point);
            setPickup('Current location');
            setActivePickField(null);
            setPendingPin(null);
            setPinHint('');
            setSheetExpanded(true);
          }}
        />
        {/* Municipality switcher overlay */}
        <div className="absolute top-4 left-0 right-0 flex justify-center px-4">
          <MunicipalitySwitcher active={activeMuni} onChange={handleMunicipalityChange}/>
        </div>

        {/* Active ride banner */}
        {activeRide && onResumeRide && (
          <div data-testid="active-ride-banner" className="absolute top-16 left-3 right-3 z-20 bg-surface rounded-2xl border border-orange/30 shadow-card px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-dark mb-1">Active ride</p>
            <p className="text-sm font-medium text-ink leading-tight truncate">{activeRide.pickup_label} → {activeRide.destination_label}</p>
            <p className="text-xs text-ink-soft mt-0.5 capitalize">{activeRide.status.replace('_', ' ')}</p>
            <button type="button" onClick={() => onResumeRide(activeRide.id)} className="btn-primary w-full mt-3">View active ride</button>
          </div>
        )}
      </div>

      {/* Bottom Sheet */}
      <div
        className={`app-bottom-sheet absolute left-0 right-0 bottom-0 bg-surface rounded-t-3xl shadow-float transition-all duration-500 overflow-y-auto`}
        style={{ height: sheetExpanded ? 440 : 174, maxHeight: '85vh' }}
      >
        {/* Handle */}
        <div
          onPointerDown={event => {
            dragStartY.current = event.clientY;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={event => {
            if (dragStartY.current === null) return;
            const distance = event.clientY - dragStartY.current;
            dragStartY.current = null;
            if (Math.abs(distance) > 35) {
              didSwipe.current = true;
              setSheetExpanded(distance < 0);
            }
          }}
          onPointerCancel={() => { dragStartY.current = null; }}
          onClick={() => {
            if (didSwipe.current) {
              didSwipe.current = false;
              return;
            }
            setSheetExpanded(!sheetExpanded);
          }}
          className="flex justify-center pt-3 pb-2 cursor-pointer sticky top-0 bg-surface z-10 touch-none"
        >
          <div className="w-10 h-1.5 rounded-full bg-border"/>
        </div>

        {!sheetExpanded ? (
          <div className="px-4 pb-2 pt-1 space-y-2">
            <h2 className="font-semibold text-lg text-ink">Where to?</h2>
            <div className="bg-orange-light rounded-2xl p-3 space-y-2">
              <div className="flex items-center gap-3">
                <IconLocation size={18} className="text-orange-dark flex-shrink-0"/>
                <input
                  value={pickup}
                  onFocus={() => { setActivePickField('pickup'); setPendingPin(null); setPinHint(''); }}
                  onChange={e => { setPickup(e.target.value); setPickupPosition(null); setCurrentPosition(null); setPendingPin(null); setPinHint(''); }}
                  placeholder={`Pickup: Landmark or Barangay in ${pickupMuni.name}`}
                  className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-soft/60"
                />
              </div>
              <div className="h-px bg-orange/20"/>
              <div className="flex items-center gap-3">
                <IconDestination size={18} className="text-ink-soft flex-shrink-0"/>
                <input
                  value={destination}
                  onFocus={() => { setActivePickField('destination'); setPendingPin(null); setPinHint(''); }}
                  onChange={e => { setDestination(e.target.value); setDestinationPosition(null); setPendingPin(null); setPinHint(''); }}
                  placeholder="Destination: Where to go?"
                  className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-soft/60"
                />
              </div>
            </div>
            {pinHint && <p role="status" className="text-xs font-medium text-orange-dark">{pinHint}</p>}
          </div>
        ) : (
          <div className="px-4 pb-6 space-y-4">
            {/* Title */}
            <h2 className="font-semibold text-lg text-ink">Where to?</h2>

            {isIntertown && (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold text-ink-soft uppercase tracking-wide">
                  From town
                  <select
                    value={fromTown}
                    onChange={event => { setFromTown(event.target.value); setPickupPosition(null); setPickup(''); setCurrentPosition(null); setPendingPin(null); setPinHint(''); }}
                    className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-border bg-surface text-sm text-ink focus:border-orange"
                  >
                    {MUNICIPALITIES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-ink-soft uppercase tracking-wide">
                  To town
                  <select
                    value={toTown}
                    onChange={event => { setToTown(event.target.value); setDestinationPosition(null); setDestination(''); setPendingPin(null); setPinHint(''); }}
                    className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-border bg-surface text-sm text-ink focus:border-orange"
                  >
                    {MUNICIPALITIES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </label>
              </div>
            )}

            {/* Pickup & Destination */}
            <div className="bg-orange-light rounded-2xl p-3 space-y-2">
              <div className="flex items-center gap-3">
                <IconLocation size={18} className="text-orange-dark flex-shrink-0"/>
                <input
                  value={pickup}
                  onFocus={() => { setActivePickField('pickup'); setPendingPin(null); setPinHint(''); }}
                  onChange={e => { setPickup(e.target.value); setPickupPosition(null); setCurrentPosition(null); setPendingPin(null); setPinHint(''); }}
                  placeholder={`Pickup: Landmark or Barangay in ${pickupMuni.name}`}
                  className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-soft/60"
                />
              </div>
              <div className="h-px bg-orange/20"/>
              <div className="flex items-center gap-3">
                <IconDestination size={18} className="text-ink-soft flex-shrink-0"/>
                <input
                  value={destination}
                  onFocus={() => { setActivePickField('destination'); setPendingPin(null); setPinHint(''); }}
                  onChange={e => { setDestination(e.target.value); setDestinationPosition(null); setPendingPin(null); setPinHint(''); }}
                  placeholder="Destination: Where to go?"
                  className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-soft/60"
                />
              </div>
            </div>

            {/* Quick pickup landmarks */}
            <div data-testid="quick-pickup">
              <p className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-2">Quick Pickup in {pickupMuni.name}</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {pickupMuni.landmarks.map(lm => (
                  <button
                    key={lm.id}
                    data-testid={`pickup-landmark-${lm.id}`}
                    onClick={() => choosePickupLandmark(lm)}
                    className="flex-shrink-0 text-xs bg-surface border border-border rounded-full px-3 py-1.5 text-ink-soft hover:border-orange hover:text-orange-dark transition-colors"
                  >
                    {lm.name.replace(pickupMuni.name + ' ', '')}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick destination landmarks */}
            <div data-testid="quick-destination">
              <p className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-2">Quick Destination in {destinationMuni.name}</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {destinationMuni.landmarks.map(lm => (
                  <button
                    key={lm.id}
                    data-testid={`destination-landmark-${lm.id}`}
                    onClick={() => chooseDestinationLandmark(lm)}
                    className="flex-shrink-0 text-xs bg-surface border border-border rounded-full px-3 py-1.5 text-ink-soft hover:border-orange hover:text-orange-dark transition-colors"
                  >
                    {lm.name.replace(destinationMuni.name + ' ', '')}
                  </button>
                ))}
              </div>
            </div>

            {/* Ride type chips */}
            <div>
              <p className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-2">Ride Type</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {RIDE_TYPES.map(rt => (
                  <button
                    key={rt.id}
                    onClick={() => setRideType(rt.id)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all duration-150 ${
                      rideType === rt.id
                        ? 'border-orange-dark bg-orange-dark text-white'
                        : 'border-border bg-surface text-ink-soft hover:border-orange'
                    }`}
                  >
                    <span>{rt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Discount selector */}
            <div>
              <p className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-2">Community Discount</p>
              <div className="flex gap-2">
                {DISCOUNTS.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setDiscount(d.id)}
                    className={`flex-1 py-2 rounded-xl border-2 text-xs font-medium transition-all duration-150 ${
                      discount === d.id
                        ? 'border-success bg-success-bg text-success'
                        : 'border-border bg-surface text-ink-soft'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add a note for driver (optional)..."
              className="w-full px-4 py-3 rounded-xl border-2 border-border bg-surface text-ink placeholder:text-ink-soft/60 focus:border-orange text-sm"
            />

            {/* Fare preview */}
            <FarePreview
              estimate={estimate}
              loading={estimateLoading}
              error={estimateError}
              hasPins={Boolean(pickupPosition && destinationPosition)}
            />

            {/* Find button */}
            {bookingError && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">{bookingError}</p>}
            <button
              onClick={() => void submitRide()}
              disabled={!canBook}
              className="btn-primary btn-large w-full disabled:opacity-50"
            >
              Find a Tricycle
            </button>
            <p className="text-center text-xs text-ink-soft">{bookingHint}</p>
          </div>
        )}
      </div>
    </div>
  );
}
