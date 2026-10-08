import { useEffect, useState } from 'react';
import { IconAdmin, IconAlerts, IconBookings, IconChart, IconCheckCircle, IconDriver, IconFile, IconHome, IconLocation, IconMap, IconMegaphone, IconPackage, IconProfile, IconStar, IconWeather } from '../components/Icons';
import { DataTable, ErrorState, StatCard as SharedStatCard, StatusBadge } from '../components/ui';
import { getAdminDrivers, getAdminSos, getAdminSummary, getEmergencyContacts, resolveSos, updateEmergencyContact, verifyDriver, type AdminSummary, type EmergencyContact, type SosEvent } from '../services/api';

export type AdminTab = 'overview' | 'drivers' | 'fares' | 'alerts' | 'analytics' | 'sos';

const TAB_LABELS: { id: AdminTab; label: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: 'overview', label: 'Overview', Icon: IconAdmin },
  { id: 'analytics', label: 'Analytics', Icon: IconChart },
  { id: 'drivers', label: 'Drivers', Icon: IconDriver },
  { id: 'fares', label: 'Fare Zones', Icon: IconMap },
  { id: 'alerts', label: 'Alerts', Icon: IconAlerts },
  { id: 'sos', label: 'SOS', Icon: IconAlerts },
];

const ALERT_TYPE_CHOICES: { id: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: 'community', Icon: IconHome },
  { id: 'weather', Icon: IconWeather },
  { id: 'market', Icon: IconPackage },
  { id: 'fiesta', Icon: IconStar },
  { id: 'port', Icon: IconLocation },
];

function BarChart({ data }: { data: { name: string; rides: number; drivers: number }[] }) {
  const max = Math.max(...data.map(d => d.rides));
  return (
    <div className="space-y-3">
      {data.map(d => (
        <div key={d.name}>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-medium text-ink">{d.name}</span>
            <span className="text-ink-soft">{d.rides} rides</span>
          </div>
          <div className="flex gap-1 h-6 items-center">
            <div
              className="h-full rounded-full bg-orange transition-all duration-700"
              style={{ width: `${(d.rides / max) * 100}%`, minWidth: 24 }}
            />
            <span className="text-xs text-orange font-semibold ml-1">{d.drivers}D</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function FareZoneEditor() {
  const [fares, setFares] = useState([
    { muni: 'Carrascal', zone: 'Poblacion', base: 15, edit: false },
    { muni: 'Carrascal', zone: 'Zone A', base: 25, edit: false },
    { muni: 'Cantilan', zone: 'Poblacion', base: 15, edit: false },
    { muni: 'Cantilan', zone: 'Zone A', base: 25, edit: false },
    { muni: 'Madrid', zone: 'Poblacion', base: 15, edit: false },
    { muni: 'Carmen', zone: 'Poblacion', base: 15, edit: false },
    { muni: 'Lanuza', zone: 'Poblacion', base: 15, edit: false },
    { muni: 'Lanuza', zone: 'Mountain Zone', base: 50, edit: false },
  ]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft mb-4">Edit base fares per municipality zone. Changes apply immediately to all new bookings.</p>
      {fares.map((f, i) => (
        <div key={i} className="flex items-center gap-3 bg-surface rounded-xl p-3 border border-border">
          <div className="flex-1">
            <p className="text-sm font-medium text-ink">{f.muni} · {f.zone}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-soft">₱</span>
            <input
              type="number"
              value={f.base}
              onChange={e => setFares(prev => prev.map((x, j) => j === i ? { ...x, base: +e.target.value } : x))}
              className="w-16 px-2 py-1.5 rounded-lg border-2 border-border text-sm text-ink font-semibold text-center focus:outline-none focus:border-orange"
            />
            <button className="text-xs text-orange font-semibold border border-orange rounded-lg px-2.5 py-1.5 hover:bg-orange-light transition-colors">
              Save
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AlertComposer() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [muni, setMuni] = useState('all');
  const [type, setType] = useState('community');

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">Compose and publish community alerts visible to all PASAKJA users in the selected area.</p>
      <div>
        <label className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-1 block">Target Area</label>
        <select value={muni} onChange={e => setMuni(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-2 border-border bg-surface text-sm focus:outline-none focus:border-orange">
          <option value="all">All Municipalities</option>
          <option>Carrascal</option><option>Cantilan</option>
          <option>Madrid</option><option>Carmen</option><option>Lanuza</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-1 block">Alert Type</label>
        <div className="flex gap-2 flex-wrap">
          {ALERT_TYPE_CHOICES.map(({ id, Icon }) => (
            <button key={id} onClick={() => setType(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all capitalize ${
                type === id ? 'border-orange bg-orange text-white' : 'border-border text-ink-soft'
              }`}>
              <Icon size={16}/>{id}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-1 block">Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Alert title..."
          className="w-full px-4 py-3 rounded-xl border-2 border-border bg-surface text-sm focus:outline-none focus:border-orange"/>
      </div>
      <div>
        <label className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-1 block">Message</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="Alert message..."
          className="w-full px-4 py-3 rounded-xl border-2 border-border bg-surface text-sm focus:outline-none focus:border-orange resize-none"/>
      </div>
      <button
        className="btn-primary btn-large w-full"
      >
        <IconMegaphone size={16} className="inline-block mr-2"/>Publish Alert
      </button>
    </div>
  );
}

export default function AdminDashboard({ initialTab = 'overview', onTabChange }: { initialTab?: AdminTab; onTabChange: (tab: AdminTab) => void }) {
  const [tab, setTab] = useState<AdminTab>(initialTab);

  useEffect(() => setTab(initialTab), [initialTab]);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [summaryError, setSummaryError] = useState('');
  const [drivers, setDrivers] = useState<Awaited<ReturnType<typeof getAdminDrivers>>>([]);
  const [driversError, setDriversError] = useState('');
  const [updatingDriver, setUpdatingDriver] = useState<number | null>(null);
  useEffect(() => {
    if (tab !== 'overview' && tab !== 'analytics') return;
    let mounted = true;
    getAdminSummary().then(data => { if (mounted) { setSummary(data); setSummaryError(''); } }).catch(error => { if (mounted) setSummaryError(error instanceof Error ? error.message : 'Could not load dashboard metrics.'); });
    return () => { mounted = false; };
  }, [tab]);
  const [sosEvents, setSosEvents] = useState<SosEvent[]>([]);
  const [sosError, setSosError] = useState('');
  const [resolvingSos, setResolvingSos] = useState<number | null>(null);
  const [contactTown, setContactTown] = useState('Carrascal');
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [contactPhones, setContactPhones] = useState<Record<number, string>>({});
  const [contactMessage, setContactMessage] = useState('');
  useEffect(() => {
    if (tab !== 'sos') return;
    let mounted = true;
    const load = async () => { try { const events = await getAdminSos(); if (mounted) { setSosEvents(events); setSosError(''); } } catch (error) { if (mounted) setSosError(error instanceof Error ? error.message : 'Could not load SOS alerts.'); } };
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [tab]);
  useEffect(() => {
    if (tab !== 'sos') return;
    let mounted = true;
    getEmergencyContacts(contactTown).then(rows => { if (mounted) { setContacts(rows); setContactPhones(Object.fromEntries(rows.map(row => [row.id, row.phone || '']))); } }).catch(error => { if (mounted) setContactMessage(error instanceof Error ? error.message : 'Could not load emergency contacts.'); });
    return () => { mounted = false; };
  }, [tab, contactTown]);
  const saveContact = async (contact: EmergencyContact) => {
    try { await updateEmergencyContact(contact.id, contactPhones[contact.id] || ''); setContactMessage(`${contact.label} saved.`); setContacts(rows => rows.map(row => row.id === contact.id ? { ...row, phone: contactPhones[contact.id] || null, is_placeholder: contactPhones[contact.id] ? 0 : 1 } : row)); }
    catch (error) { setContactMessage(error instanceof Error ? error.message : 'Could not save emergency contact.'); }
  };
  useEffect(() => {
    if (tab !== 'drivers') return;
    let mounted = true;
    getAdminDrivers().then(rows => { if (mounted) { setDrivers(rows); setDriversError(''); } }).catch(error => { if (mounted) setDriversError(error instanceof Error ? error.message : 'Could not load drivers.'); });
    return () => { mounted = false; };
  }, [tab]);
  const setDriverStatus = async (id: number, status: 'verified' | 'rejected') => {
    setUpdatingDriver(id);
    try { await verifyDriver(id, status); setDrivers(rows => rows.map(row => row.id === id ? { ...row, verification_status: status } : row)); }
    catch (error) { setDriversError(error instanceof Error ? error.message : 'Could not update driver status.'); }
    finally { setUpdatingDriver(null); }
  };
  const resolveAlert = async (id: number) => {
    setResolvingSos(id);
    try { await resolveSos(id); setSosEvents(items => items.map(item => item.id === id ? { ...item, status: 'resolved' } : item)); }
    catch (error) { setSosError(error instanceof Error ? error.message : 'Could not resolve SOS alert.'); }
    finally { setResolvingSos(null); }
  };
  const driverColumns = [
    { key: 'driver', label: 'Driver', render: (driver: typeof drivers[number]) => <><p className="text-sm font-medium">{driver.full_name}</p><p className="text-xs text-ink-soft">{driver.phone}</p></> },
    { key: 'plate', label: 'Plate', render: (driver: typeof drivers[number]) => driver.plate_number },
    { key: 'body', label: 'Body No.', render: (driver: typeof drivers[number]) => driver.body_number },
    { key: 'toda', label: 'TODA', render: (driver: typeof drivers[number]) => driver.toda_name },
    { key: 'location', label: 'Last location', render: (driver: typeof drivers[number]) => driver.last_seen_at ? new Date(driver.last_seen_at).toLocaleString() : 'Never shared location' },
    { key: 'status', label: 'Status', render: (driver: typeof drivers[number]) => <StatusBadge status={driver.verification_status}/> },
    { key: 'actions', label: 'Actions', render: (driver: typeof drivers[number]) => <div className="flex gap-2">{driver.verification_status !== 'verified' && <button disabled={updatingDriver === driver.id} onClick={() => void setDriverStatus(driver.id, 'verified')} className="text-xs font-semibold text-success">Approve</button>}{driver.verification_status !== 'rejected' && <button disabled={updatingDriver === driver.id} onClick={() => void setDriverStatus(driver.id, 'rejected')} className="text-xs font-semibold text-danger">Reject</button>}</div> },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-warm">
      {/* Header */}
      <div className="admin-dashboard-header bg-orange wave-bg"
        style={{ background: 'linear-gradient(135deg, #26211E 0%, #D86F2F 100%)' }}>
        <div className="admin-dashboard-header__content">
          <div className="admin-dashboard-header__copy">
            <h1 className="text-xl font-semibold text-white">Admin Dashboard</h1>
            <p className="text-white/60 text-sm mt-0.5">CarCanMadCarLan · PASAKJA</p>
          </div>
          <div className="admin-dashboard-header__actions">
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 text-white text-xs font-medium hover:bg-white/25 transition-colors">
              <IconFile size={16}/>PDF
            </button>
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 text-white text-xs font-medium hover:bg-white/25 transition-colors">
              <IconChart size={16}/>Excel
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto bg-surface border-b border-border px-4 py-0">
        {TAB_LABELS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); onTabChange(t.id); }}
            className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
              tab === t.id ? 'border-orange text-orange' : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            <t.Icon size={16}/>
            {t.label}
          </button>
        ))}
      </div>

      <div className="admin-page-content">

        {tab === 'overview' && (
          <>
            {summaryError && <ErrorState message={summaryError}/>}
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SharedStatCard icon={<IconDriver className="text-orange"/>} label="Total Drivers" value={summary?.total_drivers ?? '—'}/>
              <SharedStatCard icon={<IconProfile className="text-orange"/>} label="Total Passengers" value={summary?.total_passengers ?? '—'}/>
              <SharedStatCard icon={<IconBookings className="text-warning"/>} label="Active Bookings" value={summary?.active_rides ?? '—'} color="text-warning"/>
              <SharedStatCard icon={<IconCheckCircle className="text-success"/>} label="Completed Today" value={summary?.completed_today ?? '—'} color="text-success"/>
            </div>

            {/* Municipality comparison */}
            <div className="bg-surface rounded-2xl border border-border p-5">
              <h3 className="font-semibold text-base text-ink mb-4">Municipality Overview</h3>
              <BarChart data={summary?.by_municipality ?? []}/>
            </div>

            {/* Booking status donut-like */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface rounded-2xl border border-border p-5">
                <h3 className="font-semibold text-base text-ink mb-4">Booking Status Today</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Completed', value: summary?.status_today.completed ?? 0, color: 'bg-success' },
                    { label: 'Cancelled', value: summary?.status_today.cancelled ?? 0, color: 'bg-danger' },
                    { label: 'In Progress', value: summary?.status_today.in_progress ?? 0, color: 'bg-warning' },
                  ].map(s => (
                    <div key={s.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-ink-soft">{s.label}</span>
                        <span className="font-semibold text-ink">{s.value}</span>
                      </div>
                      <div className="h-2.5 bg-warm rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${s.color} transition-all duration-700`} style={{ width: `${Math.min(100, s.value / Math.max(1, summary?.active_rides ?? 1) * 100)}%` }}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface rounded-2xl border border-border p-5">
                <h3 className="font-semibold text-base text-ink mb-4">Drivers on rides, by municipality (7 days)</h3>
                <div className="space-y-3">
                  {(summary?.by_municipality ?? []).map(m => (
                    <div key={m.name} className="flex items-center gap-3">
                      <span className="text-sm text-ink w-20 flex-shrink-0">{m.name}</span>
                      <div className="flex-1 h-2.5 bg-warm rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-orange" style={{ width: `${Math.min(100, m.drivers / Math.max(1, summary?.total_drivers ?? 1) * 100)}%` }}/>
                      </div>
                      <span className="text-xs font-semibold text-orange w-8 text-right">{m.drivers}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-surface rounded-2xl border border-border p-5">
              <h3 className="font-semibold text-base text-ink mb-1">Rides This Week</h3>
              <p className="text-xs text-ink-soft mb-4">Ride requests in the last seven days, grouped by municipality</p>
              {summary?.by_municipality.length ? <BarChart data={summary.by_municipality}/> : <p className="text-sm text-ink-soft">No ride activity for this period.</p>}
            </div>
          </div>
        )}

        {tab === 'drivers' && (
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-base text-ink">Driver Management</h3>
              <input placeholder="Search drivers..." className="px-3 py-1.5 rounded-xl border border-border text-sm focus:outline-none focus:border-orange w-40"/>
            </div>
            {driversError && <ErrorState className="mx-5 my-3" message={driversError}/>}
            <DataTable columns={driverColumns} rows={drivers} getRowKey={driver => driver.id}/>
            {drivers.length === 0 && <p className="p-4 text-center text-sm text-ink-soft">No driver accounts found.</p>}
            <div className="px-5 py-3 border-t border-border flex items-center justify-between text-sm text-ink-soft">
              <span>{drivers.length} registered drivers</span>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded-lg border border-border hover:bg-warm transition-colors">‹ Prev</button>
                <button className="px-3 py-1.5 rounded-lg border border-orange bg-orange-light text-orange font-medium">1</button>
                <button className="px-3 py-1.5 rounded-lg border border-border hover:bg-warm transition-colors">2</button>
                <button className="px-3 py-1.5 rounded-lg border border-border hover:bg-warm transition-colors">Next ›</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'fares' && (
          <div className="bg-surface rounded-2xl border border-border p-5">
            <h3 className="font-semibold text-base text-ink mb-1">Fare Zone Editor</h3>
            <FareZoneEditor/>
          </div>
        )}

        {tab === 'alerts' && (
          <div className="bg-surface rounded-2xl border border-border p-5">
            <h3 className="font-semibold text-base text-ink mb-4">Community Alert Composer</h3>
            <AlertComposer/>
          </div>
        )}

        {tab === 'sos' && (
          <section className="space-y-3" aria-label="SOS alerts">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-ink">Emergency alerts</h2><span className="text-xs text-ink-soft">Refreshes every 5 seconds</span></div>
            {sosError && <ErrorState message={sosError}/>}
            {sosEvents.length === 0 && !sosError && <p className="rounded-xl border border-border bg-surface p-4 text-sm text-ink-soft">No SOS alerts have been sent.</p>}
            {sosEvents.map(event => <article key={event.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-ink">{event.full_name || 'PASAKJA user'} <span className="font-normal capitalize text-ink-soft">· {event.role}</span></p><p className="mt-1 text-xs text-ink-soft">{event.municipality || 'Location not provided'} · {new Date(event.created_at).toLocaleString()}</p></div><StatusBadge status={event.status === 'active' ? 'sos-active' : event.status} label={event.status}/></div>
              {(event.latitude !== null && event.longitude !== null) && <a className="mt-2 inline-block text-sm text-orange underline" href={`https://www.openstreetmap.org/?mlat=${event.latitude}&mlon=${event.longitude}#map=16/${event.latitude}/${event.longitude}`} target="_blank" rel="noreferrer">Open reported location</a>}
              {(event.driver_name || event.plate_number) && <p className="mt-2 text-sm text-ink-soft">Driver: {event.driver_name || '—'}{event.plate_number ? ` · ${event.plate_number}` : ''}</p>}
              {event.status === 'active' && <button type="button" disabled={resolvingSos === event.id} onClick={() => void resolveAlert(event.id)} className="btn-secondary mt-3 px-4 py-2">{resolvingSos === event.id ? 'Updating…' : 'Mark resolved'}</button>}
            </article>)}
            <section className="mt-6 rounded-xl border border-border bg-surface p-4" aria-label="Emergency contact settings">
              <h3 className="font-semibold text-ink">Emergency contacts</h3>
              <p className="mb-3 mt-1 text-xs text-ink-soft">Only save verified local contact numbers. Blank numbers stay unconfigured.</p>
              <label className="mb-3 block text-xs font-semibold text-ink-soft">Municipality
                <select value={contactTown} onChange={event => { setContactTown(event.target.value); setContactMessage(''); }} className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink">
                  {['Carrascal', 'Cantilan', 'Madrid', 'Carmen', 'Lanuza'].map(town => <option key={town}>{town}</option>)}
                </select>
              </label>
              {contacts.map(contact => <div key={contact.id} className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
                <label className="min-w-36 flex-1 text-sm text-ink">{contact.label}<input type="tel" value={contactPhones[contact.id] ?? ''} onChange={event => setContactPhones(value => ({ ...value, [contact.id]: event.target.value }))} placeholder="Unconfigured" className="mt-1 block w-full rounded-md border border-border px-2 py-1.5 text-sm" /></label>
                <button type="button" onClick={() => void saveContact(contact)} className="btn-secondary px-3 py-2 text-xs">Save</button>
              </div>)}
              {contactMessage && <p role="status" className="mt-2 text-xs text-ink-soft">{contactMessage}</p>}
            </section>
          </section>
        )}
      </div>
    </div>
  );
}
