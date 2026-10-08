import { useRef, useState } from 'react';
import Map, { type MapPoint } from '../components/Map';
import { IconCheck, IconChevronDown, IconLocation, IconDestination, IconMap } from '../components/Icons';
import { MUNICIPALITIES, RIDE_TYPES, type RideType } from '../data';
import type { RideRequest } from '../services/api';

interface PassengerHomeProps {
  onBookingStart: (ride: RideRequest) => Promise<void>;
}

const DISCOUNTS = [
  { id: 'none', label: 'None' },
  { id: 'student', label: 'Student 20%' },
  { id: 'senior', label: 'Senior 20%' },
  { id: 'pwd', label: 'PWD 20%' },
];

function MunicipalitySwitcher({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const activeM = MUNICIPALITIES.find(m => m.id === active)!;

  const all = [
    ...MUNICIPALITIES.map(m => ({ id: m.id, label: m.name, isInterTown: false })),
    { id: 'intertown', label: 'Inter-town Ride', isInterTown: true },
  ];

  return (
    <div className="relative z-20">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full border-2 border-orange bg-white shadow-sm"
      >
        <span className="w-2 h-2 rounded-full bg-orange flex-shrink-0"/>
        <span className="font-semibold text-sm text-ink">{activeM.name}</span>
        <IconChevronDown size={16} className="text-orange-dark"/>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 bg-white rounded-2xl shadow-float border border-border overflow-hidden w-52 animate-fade-in">
          {all.map(m => (
            <button
              key={m.id}
              onClick={() => { onChange(m.isInterTown ? 'cantilan' : m.id); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-orange-light transition-colors ${
                m.id === active && !m.isInterTown ? 'bg-orange-light' : ''
              }`}
            >
              {m.isInterTown
                ? <span className="w-5 h-5 rounded-full bg-sunset/20 flex items-center justify-center"><IconMap size={16} className="text-orange"/></span>
                : <span className="w-5 h-5 rounded-full bg-orange/20 flex-shrink-0"/>}
              <div>
                <p className="text-sm font-medium text-ink">{m.label}</p>
                {m.isInterTown && <p className="text-xs text-orange">e.g. Cantilan → Carmen</p>}
              </div>
              {m.id === active && !m.isInterTown && (
                <IconCheck size={16} className="ml-auto text-orange"/>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FarePreview({ rideType, discount }: { rideType: RideType; discount: string }) {
  const base = 20;
  const typeExtra = rideType === 'pakyaw' ? 10 : rideType === 'group' ? 15 : rideType === 'padala' ? 5 : 0;
  const subtotal = base + typeExtra + 8;
  const discountAmt = discount !== 'none' ? subtotal * 0.2 : 0;
  const total = subtotal - discountAmt;

  return (
    <div className="bg-orange-light rounded-2xl p-4 mt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-orange uppercase tracking-wide">Fare Breakdown</span>
        <span className="text-xs text-ink-soft">Cash only</span>
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between text-ink-soft">
          <span>Base Fare (Zone A)</span><span className="font-medium text-ink">₱{base}</span>
        </div>
        <div className="flex justify-between text-ink-soft">
          <span>Distance (1.2 km)</span><span className="font-medium text-ink">₱8</span>
        </div>
        {typeExtra > 0 && (
          <div className="flex justify-between text-ink-soft">
            <span>{rideType === 'pakyaw' ? 'Private hire (whole trip)' : rideType === 'group' ? 'Group rate' : 'Parcel delivery fee'}</span>
            <span className="font-medium text-ink">+₱{typeExtra}</span>
          </div>
        )}
        {discountAmt > 0 && (
          <div className="flex justify-between text-success">
            <span className="font-medium">{discount === 'student' ? 'Student' : discount === 'senior' ? 'Senior' : 'PWD'} Discount (20%)</span>
            <span className="font-semibold">-₱{discountAmt.toFixed(0)}</span>
          </div>
        )}
        <div className="border-t border-orange/20 pt-2 flex justify-between font-semibold text-base">
          <span className="text-ink">Total</span>
          <span className="text-orange">₱{total.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
}

export default function PassengerHome({ onBookingStart }: PassengerHomeProps) {
  const [activeMuni, setActiveMuni] = useState('carrascal');
  const [rideType, setRideType] = useState<RideType>('regular');
  const [discount, setDiscount] = useState('none');
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [pickupPosition, setPickupPosition] = useState<MapPoint | null>(null);
  const [destinationPosition, setDestinationPosition] = useState<MapPoint | null>(null);
  const [currentPosition, setCurrentPosition] = useState<MapPoint | null>(null);
  const [activePickField, setActivePickField] = useState<'pickup' | 'destination' | null>(null);
  const [notes, setNotes] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const dragStartY = useRef<number | null>(null);
  const didSwipe = useRef(false);

  const muni = MUNICIPALITIES.find(m => m.id === activeMuni)!;

  const submitRide = async () => {
    setBookingError('');
    if (!pickup.trim() || !destination.trim()) {
      setBookingError('Enter both a pickup and destination to request a ride.');
      return;
    }
    try {
      await onBookingStart({
        pickup: pickup.trim(),
        destination: destination.trim(),
        pickupPosition,
        destinationPosition,
        municipality: muni.name,
        rideType,
        discount,
        note: notes,
      });
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'Could not create your ride request.');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* Map */}
      <div className={`passenger-map-layer absolute inset-0 transition-all duration-500 ${sheetExpanded ? 'passenger-map-layer--expanded' : 'passenger-map-layer--collapsed'}`}>
        <Map
          activeMunicipality={activeMuni}
          className="h-full"
          pickupPosition={pickupPosition}
          destinationPosition={destinationPosition}
          currentPosition={currentPosition}
          activePickField={activePickField}
          onMapPick={point => {
            if (activePickField === 'pickup') {
              setPickupPosition(point);
              setCurrentPosition(null);
              setPickup(`Map pin (${point.lat.toFixed(5)}, ${point.lng.toFixed(5)})`);
            } else if (activePickField === 'destination') {
              setDestinationPosition(point);
              setDestination(`Map pin (${point.lat.toFixed(5)}, ${point.lng.toFixed(5)})`);
            }
          }}
          onLocationFound={point => {
            setPickupPosition(point);
            setCurrentPosition(point);
            setPickup('Current location');
          }}
        />
        {/* Municipality switcher overlay */}
        <div className="absolute top-4 left-0 right-0 flex justify-center px-4">
          <MunicipalitySwitcher active={activeMuni} onChange={setActiveMuni}/>
        </div>
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
                <IconLocation size={18} className="text-orange flex-shrink-0"/>
                <input
                  value={pickup}
                  onFocus={() => setActivePickField('pickup')}
                  onChange={e => { setPickup(e.target.value); setPickupPosition(null); setCurrentPosition(null); }}
                  placeholder={`Pickup: Landmark or Barangay in ${muni.name}`}
                  className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none"
                />
              </div>
              <div className="h-px bg-orange/20"/>
              <div className="flex items-center gap-3">
                <IconDestination size={18} className="text-ink-soft flex-shrink-0"/>
                <input
                  value={destination}
                  onFocus={() => setActivePickField('destination')}
                  onChange={e => { setDestination(e.target.value); setDestinationPosition(null); }}
                  placeholder="Destination: Where to go?"
                  className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 pb-6 space-y-4">
            {/* Title */}
            <h2 className="font-semibold text-lg text-ink">Where to?</h2>

            {/* Pickup & Destination */}
            <div className="bg-orange-light rounded-2xl p-3 space-y-2">
              <div className="flex items-center gap-3">
                <IconLocation size={18} className="text-orange flex-shrink-0"/>
                <input
                  value={pickup}
                  onFocus={() => setActivePickField('pickup')}
                  onChange={e => { setPickup(e.target.value); setPickupPosition(null); setCurrentPosition(null); }}
                  placeholder={`Pickup: Landmark or Barangay in ${muni.name}`}
                  className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none"
                />
              </div>
              <div className="h-px bg-orange/20"/>
              <div className="flex items-center gap-3">
                <IconDestination size={18} className="text-ink-soft flex-shrink-0"/>
                <input
                  value={destination}
                  onFocus={() => setActivePickField('destination')}
                  onChange={e => { setDestination(e.target.value); setDestinationPosition(null); }}
                  placeholder="Destination: Where to go?"
                  className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none"
                />
              </div>
            </div>

            {/* Quick landmarks */}
            <div>
              <p className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-2">Quick Pickup in {muni.name}</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {muni.landmarks.map(lm => (
                  <button
                    key={lm.id}
                    onClick={() => { setPickup(lm.name); setPickupPosition(null); setCurrentPosition(null); setActivePickField(null); }}
                    className="flex-shrink-0 text-xs bg-surface border border-border rounded-full px-3 py-1.5 text-ink-soft hover:border-orange hover:text-orange transition-colors"
                  >
                    {lm.name.replace(muni.name + ' ', '')}
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
                        ? 'border-orange bg-orange text-white'
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
              className="w-full px-4 py-3 rounded-xl border-2 border-border bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:border-orange text-sm"
            />

            {/* Fare preview */}
            <FarePreview rideType={rideType} discount={discount}/>

            {/* Find button */}
            {bookingError && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">{bookingError}</p>}
            <button
              onClick={() => void submitRide()}
              className="btn-primary btn-large w-full"
            >
              Find a Tricycle
            </button>


          </div>
        )}
      </div>
    </div>
  );
}
