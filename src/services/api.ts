export type AccountRole = 'passenger' | 'driver' | 'admin';

export interface ApiUser {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  role: AccountRole;
}

export interface AuthPayload {
  mode: 'login' | 'register';
  role: 'passenger' | 'driver';
  name: string;
  phone: string;
  email: string;
  password: string;
  plateNumber: string;
  bodyNumber: string;
  licenseNumber: string;
  todaName: string;
}

export interface RideRequest {
  pickup: string;
  destination: string;
  pickupPosition?: { lat: number; lng: number } | null;
  destinationPosition?: { lat: number; lng: number } | null;
  municipality: string;
  rideType: string;
  discount: string;
  note?: string;
}

export interface ApiRide {
  id: number;
  passenger_id: number;
  driver_id: number | null;
  pickup_label: string;
  destination_label: string;
  municipality: string;
  ride_type: string;
  fare: string | null;
  distance_km: string | null;
  status: string;
  requested_at: string;
  passenger_name?: string;
  pickup?: string;
  destination?: string;
  date?: string;
  driver_name?: string | null;
  driver_phone?: string | null;
  plate_number?: string | null;
  body_number?: string | null;
}

export interface TrackingPoint { lat: number; lng: number; heading: number | null; accuracy?: number | null; last_seen_at?: string; stale?: boolean }
export interface TrackingSnapshot {
  id: number;
  status: string;
  municipality: string;
  pickup: { label: string; lat: number | null; lng: number | null };
  destination: { label: string; lat: number | null; lng: number | null };
  driver: { id: number; name: string; phone: string; plate_number: string; body_number: string; toda_name: string } | null;
  position: TrackingPoint | null;
  stale: boolean;
  eta_minutes: number | null;
  distance_remaining_km: number | null;
  route: { type: 'LineString'; coordinates: [number, number][] } | null;
  route_fallback: boolean | null;
}

export interface SosEvent { id: number; ride_id: number | null; user_id: number; role: string; latitude: number | null; longitude: number | null; status: 'active' | 'resolved'; note: string | null; created_at: string; resolved_at: string | null; full_name?: string; phone?: string; municipality?: string; pickup_label?: string; destination_label?: string; driver_name?: string; plate_number?: string }
export interface EmergencyContact { id: number; municipality: string; service: string; label: string; phone: string | null; is_placeholder: number }

export class ApiError extends Error {
  status: number;
  details: Record<string, string>;

  constructor(message: string, status: number, details: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost/PASAKJA-main/api').replace(/\/$/, '');
const TOKEN_KEY = 'pasakja_auth_token';
let authToken = typeof localStorage === 'undefined' ? '' : localStorage.getItem(TOKEN_KEY) || '';

function storeAuthToken(token: string) {
  authToken = token;
  if (typeof localStorage !== 'undefined') {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/${path.replace(/^\//, '')}`, {
      ...init,
      headers,
      credentials: 'omit',
    });
  } catch {
    throw new ApiError('Could not connect to PASAKJA. Start Apache and MySQL in XAMPP, then try again.', 0);
  }

  const result = await response.json().catch(() => ({})) as {
    error?: string;
    details?: Record<string, string>;
  } & T;
  if (response.status === 401 && authToken && !path.startsWith('auth/login') && !path.startsWith('auth/register')) {
    storeAuthToken('');
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('pasakja:auth-expired'));
  }
  if (!response.ok) throw new ApiError(result.error || 'The request failed.', response.status, result.details || {});
  return result;
}

export async function authenticate(payload: AuthPayload): Promise<ApiUser> {
  const result = await request<{ user: ApiUser; token: string }>(`auth/${payload.mode}`, {
    method: 'POST',
    body: JSON.stringify(payload.mode === 'login'
      ? { identifier: payload.phone, password: payload.password }
      : payload),
  });
  storeAuthToken(result.token);
  return result.user;
}

export async function getCurrentUser(): Promise<ApiUser | null> {
  if (!authToken) return null;
  const result = await request<{ user: ApiUser | null }>('auth/me');
  return result.user;
}

export async function signOut(): Promise<void> {
  try {
    if (authToken) await request<{ ok: true }>('auth/logout', { method: 'POST', body: '{}' });
  } finally {
    storeAuthToken('');
  }
}

export async function createRide(ride: RideRequest): Promise<{ id: number; status: string }> {
  const result = await request<{ ride: { id: number; status: string } }>('rides', {
    method: 'POST',
    body: JSON.stringify(ride),
  });
  return result.ride;
}

export async function getRides(): Promise<ApiRide[]> {
  const result = await request<{ rides: ApiRide[] }>('rides');
  return result.rides.map(ride => ({
    ...ride,
    pickup: ride.pickup_label,
    destination: ride.destination_label,
    date: ride.requested_at,
  }));
}

export async function getRide(rideId: number): Promise<ApiRide> {
  const result = await request<{ ride: ApiRide }>(`rides/${rideId}`);
  return result.ride;
}

export async function acceptRide(rideId: number): Promise<void> {
  await request(`rides/${rideId}/accept`, { method: 'POST', body: '{}' });
}

export async function declineRide(rideId: number): Promise<void> {
  await request(`rides/${rideId}/decline`, { method: 'POST', body: '{}' });
}

export async function updateRideStatus(rideId: number, status: 'arriving' | 'in_progress' | 'completed'): Promise<void> {
  await request(`rides/${rideId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export async function cancelRide(rideId: number): Promise<void> {
  await request(`rides/${rideId}/cancel`, { method: 'POST', body: '{}' });
}

export async function rateRide(rideId: number, stars: number, comment: string): Promise<void> {
  await request(`rides/${rideId}/rating`, { method: 'POST', body: JSON.stringify({ stars, comment }) });
}

export async function sendDriverLocation(point: { lat: number; lng: number; heading?: number | null; accuracy?: number | null }): Promise<void> {
  await request('driver/location', { method: 'POST', body: JSON.stringify(point) });
}

export async function getDriverProfile(): Promise<{ id: number; full_name: string; plate_number: string; body_number: string; toda_name: string; verification_status: string; total_rides: number; rides_today: number; earnings_today: number; rating: number }> {
  const result = await request<{ profile: { id: number; full_name: string; plate_number: string; body_number: string; toda_name: string; verification_status: string; total_rides: number; rides_today: number; earnings_today: number; rating: number } }>('driver/profile');
  return result.profile;
}

export async function getRideTracking(rideId: number): Promise<TrackingSnapshot> {
  const result = await request<{ ride: TrackingSnapshot }>(`rides/${rideId}/tracking`);
  return result.ride;
}

export async function getRoute(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<{ route: TrackingSnapshot['route']; distance_km: number; eta_minutes: number; fallback: boolean; distance_method: string }> {
  const query = new URLSearchParams({ from: `${from.lat},${from.lng}`, to: `${to.lat},${to.lng}` });
  return request(`routes?${query.toString()}`);
}

export async function createSos(payload: { rideId?: number | null; lat?: number | null; lng?: number | null }): Promise<{ event: { id: number; status: string; ride_id: number | null }; ride: { municipality: string; status: string; driver: { full_name: string; plate_number: string; body_number: string } | null } | null }> {
  return request('sos', { method: 'POST', body: JSON.stringify({ ride_id: payload.rideId, lat: payload.lat, lng: payload.lng }) });
}

export async function resolveSos(sosId: number): Promise<void> {
  await request(`sos/${sosId}/resolve`, { method: 'POST', body: '{}' });
}

export async function getEmergencyContacts(municipality: string): Promise<EmergencyContact[]> {
  const result = await request<{ contacts: EmergencyContact[] }>(`emergency-contacts?municipality=${encodeURIComponent(municipality)}`);
  return result.contacts;
}

export async function createTripShare(rideId: number): Promise<string> {
  const result = await request<{ token: string }>(`rides/${rideId}/share`, { method: 'POST', body: '{}' });
  return result.token;
}

export async function revokeTripShare(rideId: number): Promise<void> {
  await request(`rides/${rideId}/share/revoke`, { method: 'POST', body: '{}' });
}

export async function getPublicTrip(token: string): Promise<{ status: string; pickup: string; destination: string; driver: { name: string; plate_number: string } | null; position: { lat: number; lng: number; heading: number | null } | null; stale: boolean }> {
  const result = await request<{ trip: { status: string; pickup: string; destination: string; driver: { name: string; plate_number: string } | null; position: { lat: number; lng: number; heading: number | null } | null; stale: boolean } }>(`trip/${encodeURIComponent(token)}`);
  return result.trip;
}

export async function getAdminSos(): Promise<SosEvent[]> {
  const result = await request<{ events: SosEvent[] }>('admin/sos');
  return result.events;
}

export interface AdminSummary { total_drivers: number; total_passengers: number; active_rides: number; completed_today: number; status_today: { completed: number; cancelled: number; in_progress: number }; by_municipality: { name: string; rides: number; drivers: number }[] }
export async function getAdminSummary(): Promise<AdminSummary> {
  const result = await request<{ summary: AdminSummary }>('admin/summary');
  return result.summary;
}

export async function updateEmergencyContact(contactId: number, phone: string): Promise<void> {
  await request(`admin/emergency-contacts/${contactId}`, { method: 'PATCH', body: JSON.stringify({ phone }) });
}

export async function getAdminDrivers(): Promise<Array<{ id: number; full_name: string; phone: string; plate_number: string; body_number: string; toda_name: string; verification_status: string; last_seen_at: string | null }>> {
  const result = await request<{ drivers: Array<{ id: number; full_name: string; phone: string; plate_number: string; body_number: string; toda_name: string; verification_status: string; last_seen_at: string | null }> }>('admin/drivers');
  return result.drivers;
}

export async function verifyDriver(driverId: number, verification_status: 'verified' | 'rejected' | 'pending'): Promise<void> {
  await request(`admin/drivers/${driverId}`, { method: 'PATCH', body: JSON.stringify({ verification_status }) });
}
