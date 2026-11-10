import { useEffect, useMemo, useRef, useState } from 'react';
import L, { type LatLngExpression } from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapPoint {
  lat: number;
  lng: number;
}

interface MapProps {
  activeMunicipality?: string;
  showRoute?: boolean;
  rideState?: 'idle' | 'finding' | 'arriving' | 'in-progress' | 'completed';
  className?: string;
  compact?: boolean;
  pickupPosition?: MapPoint | null;
  destinationPosition?: MapPoint | null;
  currentPosition?: MapPoint | null;
  activePickField?: 'pickup' | 'destination' | null;
  pickHint?: string;
  onMapPick?: (point: MapPoint) => void;
  onLocationFound?: (point: MapPoint) => void;
  driverPosition?: MapPoint | null;
  driverHeading?: number | null;
  routeGeometry?: { type: 'LineString'; coordinates: [number, number][] } | null;
  // True when the API could not get a street route and sent a straight line instead.
  routeApproximate?: boolean;
}

// These town centers must match PASAKJA_TOWN_CENTERS in api/fare_service.php.
export const MUNICIPALITY_CENTERS: Record<string, MapPoint> = {
  carrascal: { lat: 9.3703, lng: 125.9492 },
  cantilan: { lat: 9.3333, lng: 125.9667 },
  madrid: { lat: 9.2624, lng: 125.9635 },
  carmen: { lat: 9.2260, lng: 126.0170 },
  lanuza: { lat: 9.2350, lng: 126.0640 },
};

const markerArtwork: Record<'pickup' | 'destination' | 'user', string> = {
  pickup: '<circle cx="12" cy="10" r="6"/><circle cx="12" cy="10" r="2"/><path d="M12 22s8-7.2 8-12a8 8 0 1 0-16 0c0 4.8 8 12 8 12Z"/>',
  destination: '<path d="m21 3-7.5 18-3.2-7.3L3 10.5 21 3Z"/><path d="m10.3 13.7 4.4-4.4"/>',
  user: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2"/>',
};

const markerIcon = (kind: 'pickup' | 'destination' | 'user') => L.divIcon({
  className: 'pasakja-map-marker-wrap',
  html: `<span class="pasakja-map-marker pasakja-map-marker-${kind}"><svg viewBox="0 0 24 24" aria-hidden="true">${markerArtwork[kind]}</svg></span>`,
  iconSize: [40, 44],
  iconAnchor: [20, 40],
});

const driverIcon = (heading: number | null | undefined) => L.divIcon({
  className: 'pasakja-map-marker-wrap',
  html: `<span class="pasakja-driver-marker" style="--driver-heading:${Number(heading ?? 0)}deg"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 17 1.7-7h10.6l1.7 7H5Z"/><path d="M8 10l1.2-3h5.6l1.2 3M7 17a1.5 1.5 0 1 0 3 0m4 0a1.5 1.5 0 1 0 3 0"/><path d="M9 13h6"/></svg></span>`,
  iconSize: [44, 44], iconAnchor: [22, 22],
});

function MapBehavior({ center, activePickField, onMapPick }: {
  center: LatLngExpression;
  activePickField?: 'pickup' | 'destination' | null;
  onMapPick?: (point: MapPoint) => void;
}) {
  const map = useMap();
  useEffect(() => { map.flyTo(center, Math.max(map.getZoom(), 14), { duration: 0.6 }); }, [center, map]);
  useMapEvents({
    click(event) {
      if (activePickField) onMapPick?.({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

// Leaflet only notices window resizes. This also catches the map box changing
// size, for example when the ride panel opens or closes.
function ResizeWatcher() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

// Zooms to show the whole route when it first appears and when its end changes
// (pickup, then destination), but not on every refresh, so panning isn't undone.
function FitRoute({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  const fittedEnd = useRef('');
  useEffect(() => {
    if (positions.length < 2) return;
    const [endLat, endLng] = positions[positions.length - 1];
    const end = `${endLat.toFixed(5)},${endLng.toFixed(5)}`;
    if (fittedEnd.current === end) return;
    fittedEnd.current = end;
    map.fitBounds(L.latLngBounds(positions), { padding: [40, 40], maxZoom: 17 });
  }, [map, positions]);
  return null;
}

function LocateControl({ onLocationFound }: { onLocationFound?: (point: MapPoint) => void }) {
  const map = useMap();
  const [error, setError] = useState('');

  const locate = () => {
    if (!navigator.geolocation) {
      setError('Location is not available in this browser.');
      return;
    }
    setError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = { lat: coords.latitude, lng: coords.longitude };
        map.flyTo([point.lat, point.lng], 16, { duration: 0.7 });
        onLocationFound?.(point);
      },
      () => setError('Allow location access to use your current position.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  return <>
    <button type="button" onClick={locate} aria-label="Use my location" title="Use my location" className="pasakja-locate-control">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/></svg>
    </button>
    {error && <div className="pasakja-map-message" role="status">{error}</div>}
  </>;
}

export default function Map({ activeMunicipality, className = '', compact = false, pickupPosition, destinationPosition, currentPosition, activePickField, pickHint, onMapPick, onLocationFound, driverPosition, driverHeading, routeGeometry, routeApproximate = false }: MapProps) {
  const center = MUNICIPALITY_CENTERS[activeMunicipality ?? 'carrascal'] ?? MUNICIPALITY_CENTERS.carrascal;
  const centerExpression = useMemo<LatLngExpression>(() => [center.lat, center.lng], [center.lat, center.lng]);
  const canPick = Boolean(activePickField && onMapPick);
  const routePositions = useMemo(
    () => (routeGeometry?.coordinates ?? []).map(([lng, lat]) => [lat, lng] as [number, number]),
    [routeGeometry],
  );

  return (
    <div className={`pasakja-map relative overflow-hidden ${className} ${canPick ? 'pasakja-map-pick-mode' : ''}`} style={{ minHeight: compact ? 160 : 240 }}>
      <MapContainer center={centerExpression} zoom={14} minZoom={8} maxZoom={19} scrollWheelZoom={!compact} zoomControl={!compact} className="pasakja-leaflet-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
        />
        <MapBehavior center={centerExpression} activePickField={activePickField} onMapPick={onMapPick}/>
        {pickupPosition && (!currentPosition || pickupPosition.lat !== currentPosition.lat || pickupPosition.lng !== currentPosition.lng) && <Marker position={[pickupPosition.lat, pickupPosition.lng]} icon={markerIcon('pickup')} title="Pickup"/>}
        {destinationPosition && <Marker position={[destinationPosition.lat, destinationPosition.lng]} icon={markerIcon('destination')} title="Destination"/>}
        {currentPosition && <Marker position={[currentPosition.lat, currentPosition.lng]} icon={markerIcon('user')} title="You"/>}
        <ResizeWatcher/>
        <FitRoute positions={routePositions}/>
        {routePositions.length && !routeApproximate ? <Polyline positions={routePositions} interactive={false} pathOptions={{ color: '#FFFFFF', weight: 9, opacity: 0.9 }}/> : null}
        {routePositions.length ? <Polyline positions={routePositions} interactive={false} pathOptions={routeApproximate ? { color: '#568570', weight: 4, opacity: 0.6, dashArray: '6 10' } : { color: '#568570', weight: 5, opacity: 0.95 }}/> : null}
        {driverPosition && <Marker position={[driverPosition.lat, driverPosition.lng]} icon={driverIcon(driverHeading)} title="Driver"/>}
        <LocateControl onLocationFound={onLocationFound}/>
      </MapContainer>
      {canPick && <div className="pasakja-map-hint">{pickHint ?? `Tap the map to set ${activePickField}`}</div>}
    </div>
  );
}
