import { useEffect, useRef, useState, type ReactNode } from 'react';
import Map, { type MapPoint } from '../components/Map';
import { IconCheck, IconChevronDown, IconClock, IconDestination, IconDriver, IconKey, IconLocation, IconMap, IconPackage, IconTag, IconUsers } from '../components/Icons';
import { StatusBadge } from '../components/ui';
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

// Short tile labels; the full ride type name stays in the accessible label.
const SERVICE_TILES: Record<RideType, { short: string; icon: ReactNode }> = {
  regular: { short: 'Regular', icon: <IconDriver size={24}/> },
  pakyaw: { short: 'Private', icon: <IconKey size={24}/> },
  padala: { short: 'Parcel', icon: <IconPackage size={24}/> },
  scheduled: { short: 'Schedule', icon: <IconClock size={24}/> },
  group: { short: 'Group', icon: <IconUsers size={24}/> },
};

const SHEET_EXPANDED_HEIGHT = 470;
const SHEET_COLLAPSED_HEIGHT = 196;

const peso = (value: number) => `₱${Number.isInteger(value) ? value : value.toFixed(2)}`;

function MunicipalitySwitcher({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const activeM = MUNICIPALITIES.find(m => m.id === active);
  const activeLabel = active === 'intertown' ? 'Inter-town ride' : activeM?.name ?? 'Carrascal';

  const all = [
    ...MUNICIPALITIES.map(m => ({ id: m.id, label: m.name, isInterTown: false })),
    { id: 'intertown', label: 'Inter-town ride', isInterTown: true },
  ];

  return (
    <div className="relative z-20" data-testid="municipality-switcher">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" className="town-switcher">
        <span className="town-switcher__pin"><IconLocation size={16}/></span>
        <span>{activeLabel}</span>
        <IconChevronDown size={16} className="text-ink-soft"/>
      </button>
      {open && (
        <div className="town-menu" role="menu">
          {all.map(m => (
            <button
              key={m.id}
              type="button"
              role="menuitem"
              aria-current={m.id === active ? 'true' : undefined}
              onClick={() => { onChange(m.id); setOpen(false); }}
              className="town-menu__item"
            >
              <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-orange-soft text-orange-action">
                {m.isInterTown ? <IconMap size={16}/> : <IconLocation size={16}/>}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block">{m.label}</span>
                {m.isInterTown && <span className="block text-xs font-medium text-ink-soft">e.g. Cantilan to Carmen</span>}
              </span>
              {m.id === active && <IconCheck size={16} className="text-orange-action"/>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FarePreview({ estimate, loading, error, hasPins }: { estimate: FareEstimate | null; loading: boolean; error: string; hasPins: boolean }) {
  const discountName = estimate?.discount === 'student' ? 'Student' : estimate?.discount === 'senior' ? 'Senior' : 'PWD';
  return (
    <section className="fare-card" aria-label="Fare breakdown">
      <div className="fare-card__head">
        <span className="fare-card__title"><IconTag size={18}/>Fixed fare</span>
        <span className="meta-pill">Cash</span>
      </div>
      {!hasPins ? (
        <p className="text-sm text-ink-soft">Set your pickup and destination to see the fare. No surge pricing.</p>
      ) : error ? (
        <p role="alert" className="text-sm font-medium text-danger">{error}</p>
      ) : loading || !estimate ? (
        <div className="space-y-2" aria-label="Calculating fare">
          <div className="skeleton-block h-3 w-2/3"/>
          <div className="skeleton-block h-3 w-1/2"/>
        </div>
      ) : (
        <>
          <div className="fare-card__rows">
            <div className="fare-card__row">
              <span>{estimate.is_intertown ? `${estimate.municipality} to ${estimate.destination_municipality}` : `Base fare (includes ${estimate.included_km} km)`}</span>
              <strong>{peso(estimate.base_fare)}</strong>
            </div>
            {!estimate.is_intertown && estimate.billable_km > 0 && (
              <div className="fare-card__row"><span>Next {estimate.billable_km} km</span><strong>{peso(estimate.distance_fare)}</strong></div>
            )}
            {estimate.multiplier_amount > 0 && (
              <div className="fare-card__row"><span>Ride type adjustment</span><strong>+{peso(estimate.multiplier_amount)}</strong></div>
            )}
            {estimate.discount_amount > 0 && (
              <div className="fare-card__row text-success"><span>{discountName} discount ({estimate.discount_percent}%)</span><strong className="text-success">-{peso(estimate.discount_amount)}</strong></div>
            )}
            {estimate.rounding_adjustment > 0 && (
              <div className="fare-card__row"><span>Rounded up to nearest ₱5</span><strong>+{peso(estimate.rounding_adjustment)}</strong></div>
            )}
          </div>
          <div className="fare-card__total"><span>Total</span><strong>{peso(estimate.total)}</strong></div>
        </>
      )}
    </section>
  );
}

function WhereCard({ pickup, destination, pickupPlaceholder, onPickupFocus, onPickupChange, onDestinationFocus, onDestinationChange }: {
  pickup: string;
  destination: string;
  pickupPlaceholder: string;
  onPickupFocus: () => void;
  onPickupChange: (value: string) => void;
  onDestinationFocus: () => void;
  onDestinationChange: (value: string) => void;
}) {
  return (
    <div className="where-card">
      <label className="where-row">
        <span className="route-dot route-dot--pickup" aria-hidden="true"/>
        <span className="sr-only">Pickup</span>
        <input value={pickup} onFocus={onPickupFocus} onChange={event => onPickupChange(event.target.value)} placeholder={pickupPlaceholder} className="bg-transparent"/>
      </label>
      <label className="where-row">
        <span className="route-dot route-dot--destination" aria-hidden="true"/>
        <span className="sr-only">Destination</span>
        <input value={destination} onFocus={onDestinationFocus} onChange={event => onDestinationChange(event.target.value)} placeholder="Where to?" className="bg-transparent"/>
      </label>
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

  const selectedRideType = RIDE_TYPES.find(type => type.id === rideType);
  const whereCard = (
    <WhereCard
      pickup={pickup}
      destination={destination}
      pickupPlaceholder={`Pickup in ${pickupMuni.name}`}
      onPickupFocus={() => { setActivePickField('pickup'); setPendingPin(null); setPinHint(''); }}
      onPickupChange={value => { setPickup(value); setPickupPosition(null); setCurrentPosition(null); setPendingPin(null); setPinHint(''); }}
      onDestinationFocus={() => { setActivePickField('destination'); setPendingPin(null); setPinHint(''); }}
      onDestinationChange={value => { setDestination(value); setDestinationPosition(null); setPendingPin(null); setPinHint(''); }}
    />
  );

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
          <div data-testid="active-ride-banner" className="active-ride-card absolute top-20 left-3 right-3 z-20">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="eyebrow">Your active ride</span>
              <StatusBadge status={activeRide.status}/>
            </div>
            <p className="truncate text-sm font-bold text-ink">{activeRide.pickup_label}</p>
            <p className="truncate text-sm text-ink-soft">to {activeRide.destination_label}</p>
            <button type="button" onClick={() => onResumeRide(activeRide.id)} className="btn-primary mt-3 w-full">View active ride</button>
          </div>
        )}
      </div>

      {/* Booking sheet */}
      <div className="booking-sheet" style={{ height: sheetExpanded ? SHEET_EXPANDED_HEIGHT : SHEET_COLLAPSED_HEIGHT, maxHeight: '85vh' }}>
        <div
          role="button"
          tabIndex={0}
          aria-label={sheetExpanded ? 'Collapse booking details' : 'Expand booking details'}
          aria-expanded={sheetExpanded}
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
          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSheetExpanded(value => !value); } }}
          className="booking-sheet__grip"
        >
          <span className="sheet-grip"/>
        </div>

        {!sheetExpanded ? (
          <div className="booking-sheet__body">
            <h2 className="booking-sheet__title">Where to?</h2>
            {whereCard}
            {pinHint && <p role="status" className="text-sm font-semibold text-orange-dark">{pinHint}</p>}
          </div>
        ) : (
          <div className="booking-sheet__body">
            <h2 className="booking-sheet__title">Where to?</h2>

            {isIntertown && (
              <div className="grid grid-cols-2 gap-3">
                <label className="form-field">
                  <span className="field-label">From town</span>
                  <select
                    value={fromTown}
                    onChange={event => { setFromTown(event.target.value); setPickupPosition(null); setPickup(''); setCurrentPosition(null); setPendingPin(null); setPinHint(''); }}
                    className="app-select"
                  >
                    {MUNICIPALITIES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </label>
                <label className="form-field">
                  <span className="field-label">To town</span>
                  <select
                    value={toTown}
                    onChange={event => { setToTown(event.target.value); setDestinationPosition(null); setDestination(''); setPendingPin(null); setPinHint(''); }}
                    className="app-select"
                  >
                    {MUNICIPALITIES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </label>
              </div>
            )}

            {whereCard}

            {/* Quick pickup landmarks */}
            <section className="home-section" data-testid="quick-pickup">
              <h3 className="home-section__title">Pick up from <span>{pickupMuni.name}</span></h3>
              <div className="chip-row">
                {pickupMuni.landmarks.map(lm => (
                  <button
                    key={lm.id}
                    type="button"
                    data-testid={`pickup-landmark-${lm.id}`}
                    onClick={() => choosePickupLandmark(lm)}
                    aria-pressed={pickup === lm.name}
                    className="app-chip app-chip--soft"
                  >
                    <IconLocation size={16}/>
                    {lm.name.replace(pickupMuni.name + ' ', '')}
                  </button>
                ))}
              </div>
            </section>

            {/* Quick destination landmarks */}
            <section className="home-section" data-testid="quick-destination">
              <h3 className="home-section__title">Popular destinations <span>{destinationMuni.name}</span></h3>
              <div className="chip-row">
                {destinationMuni.landmarks.map(lm => (
                  <button
                    key={lm.id}
                    type="button"
                    data-testid={`destination-landmark-${lm.id}`}
                    onClick={() => chooseDestinationLandmark(lm)}
                    aria-pressed={destination === lm.name}
                    className="app-chip app-chip--soft"
                  >
                    <IconDestination size={16}/>
                    {lm.name.replace(destinationMuni.name + ' ', '')}
                  </button>
                ))}
              </div>
            </section>

            {/* Ride types */}
            <section className="home-section">
              <h3 className="home-section__title">Choose a ride</h3>
              <div className="service-grid">
                {RIDE_TYPES.map(rt => (
                  <button
                    key={rt.id}
                    type="button"
                    onClick={() => setRideType(rt.id)}
                    aria-pressed={rideType === rt.id}
                    aria-label={`${rt.label}: ${rt.desc}`}
                    className="service-tile"
                  >
                    <span className="service-tile__icon">{SERVICE_TILES[rt.id].icon}</span>
                    <span className="service-tile__label">{SERVICE_TILES[rt.id].short}</span>
                  </button>
                ))}
              </div>
              {selectedRideType && <p className="text-sm text-ink-soft"><strong className="font-bold text-ink">{selectedRideType.label}</strong> · {selectedRideType.desc}</p>}
            </section>

            {/* Discount selector */}
            <section className="home-section">
              <h3 className="home-section__title">Community discount</h3>
              <div className="chip-row">
                {DISCOUNTS.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDiscount(d.id)}
                    aria-pressed={discount === d.id}
                    className="app-chip"
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Notes */}
            <label className="form-field">
              <span className="field-label">Note for your driver</span>
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional, e.g. wait at the gate"
                className="app-input"
              />
            </label>

            <FarePreview
              estimate={estimate}
              loading={estimateLoading}
              error={estimateError}
              hasPins={Boolean(pickupPosition && destinationPosition)}
            />

            {bookingError && <p role="alert" className="notice notice--danger">{bookingError}</p>}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void submitRide()}
                disabled={!canBook}
                className="btn-primary btn-large w-full"
              >
                Find a Tricycle
              </button>
              <p className="booking-hint">{bookingHint}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
