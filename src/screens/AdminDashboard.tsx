import { useEffect, useState } from 'react';
import { IconAdmin, IconAlerts, IconBookings, IconChart, IconCheckCircle, IconDriver, IconFile, IconHome, IconLocation, IconMap, IconMegaphone, IconPackage, IconProfile, IconSearch, IconShield, IconStar, IconWeather } from '../components/Icons';
import { DataTable, ErrorState, StatCard as SharedStatCard, StatusBadge } from '../components/ui';
import { getAdminDrivers, getAdminSos, getAdminSummary, getEmergencyContacts, resolveSos, updateEmergencyContact, verifyDriver, type AdminSummary, type EmergencyContact, type SosEvent } from '../services/api';

export type AdminTab = 'overview' | 'drivers' | 'fares' | 'alerts' | 'sos';

const TAB_LABELS: { id: AdminTab; label: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: 'overview', label: 'Overview', Icon: IconAdmin },
  { id: 'drivers', label: 'Drivers', Icon: IconDriver },
  { id: 'fares', label: 'Fare Zones', Icon: IconMap },
  { id: 'alerts', label: 'Alerts', Icon: IconAlerts },
  { id: 'sos', label: 'SOS', Icon: IconShield },
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
          <div className="flex h-6 items-center">
            <div
              className="h-full rounded-full bg-orange transition-all duration-700"
              style={{ width: `${(d.rides / max) * 100}%`, minWidth: 24 }}
            />
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
        <div key={i} className="flex items-center gap-3 rounded-xl bg-warm p-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">{f.muni}</p>
            <p className="text-xs text-ink-soft">{f.zone}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-ink-soft">₱</span>
            <input
              type="number"
              value={f.base}
              aria-label={`${f.muni} ${f.zone} base fare`}
              onChange={e => setFares(prev => prev.map((x, j) => j === i ? { ...x, base: +e.target.value } : x))}
              className="w-20 text-center font-bold"
            />
            <button type="button" className="btn-secondary btn-small">Save</button>
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
      <label className="form-field">
        <span className="field-label">Target area</span>
        <select value={muni} onChange={e => setMuni(e.target.value)} className="app-select">
          <option value="all">All municipalities</option>
          <option>Carrascal</option><option>Cantilan</option>
          <option>Madrid</option><option>Carmen</option><option>Lanuza</option>
        </select>
      </label>
      <div className="form-field">
        <span className="field-label">Alert type</span>
        <div className="flex flex-wrap gap-2">
          {ALERT_TYPE_CHOICES.map(({ id, Icon }) => (
            <button key={id} type="button" onClick={() => setType(id)} aria-pressed={type === id} className="app-chip capitalize">
              <Icon size={16}/>{id}
            </button>
          ))}
        </div>
      </div>
      <label className="form-field">
        <span className="field-label">Title</span>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Alert title" className="app-input"/>
      </label>
      <label className="form-field">
        <span className="field-label">Message</span>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="Alert message" className="app-textarea resize-none"/>
      </label>
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
    if (tab !== 'overview') return;
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
    { key: 'actions', label: 'Actions', render: (driver: typeof drivers[number]) => <div className="flex flex-wrap gap-2">{driver.verification_status !== 'verified' && <button disabled={updatingDriver === driver.id} onClick={() => void setDriverStatus(driver.id, 'verified')} className="text-xs font-semibold text-success">Approve</button>}{driver.verification_status !== 'rejected' && <button disabled={updatingDriver === driver.id} onClick={() => void setDriverStatus(driver.id, 'rejected')} className="text-xs font-semibold text-danger">Reject</button>}</div> },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-warm">
      {/* Header */}
      <div className="admin-dashboard-header">
        <div className="admin-dashboard-header__content">
          <div className="admin-dashboard-header__copy">
            <h2>Today across five towns</h2>
            <p>Carrascal · Cantilan · Madrid · Carmen · Lanuza</p>
          </div>
          <div className="admin-dashboard-header__actions">
            <button type="button" className="admin-header-button">
              <IconFile size={16}/>PDF
            </button>
            <button type="button" className="admin-header-button">
              <IconChart size={16}/>Excel
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs" role="toolbar" aria-label="Dashboard sections">
        {TAB_LABELS.map(t => (
          <button
            key={t.id}
            type="button"
            data-admin-tab={t.id}
            aria-pressed={tab === t.id}
            onClick={() => { setTab(t.id); onTabChange(t.id); }}
            className="admin-tab"
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
              <SharedStatCard icon={<IconDriver size={20}/>} label="Total drivers" value={summary?.total_drivers ?? '—'}/>
              <SharedStatCard icon={<IconProfile size={20}/>} label="Total passengers" value={summary?.total_passengers ?? '—'}/>
              <SharedStatCard icon={<IconBookings size={20}/>} label="Active bookings" value={summary?.active_rides ?? '—'}/>
              <SharedStatCard icon={<IconCheckCircle size={20}/>} label="Completed today" value={summary?.completed_today ?? '—'} color="text-success"/>
            </div>

            {/* Municipality comparison */}
            <div className="app-card">
              <h3 className="section-title">Rides this week by town</h3>
              <BarChart data={summary?.by_municipality ?? []}/>
            </div>

            {/* Booking status donut-like */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="app-card">
                <h3 className="section-title">Booking Status Today</h3>
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

              <div className="app-card">
                <h3 className="section-title">Drivers on rides, by municipality (7 days)</h3>
                <div className="space-y-3">
                  {(summary?.by_municipality ?? []).map(m => (
                    <div key={m.name} className="flex items-center gap-3">
                      <span className="text-sm text-ink w-20 flex-shrink-0">{m.name}</span>
                      <div className="flex-1 h-2.5 bg-warm rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-orange" style={{ width: `${Math.min(100, m.drivers / Math.max(1, summary?.total_drivers ?? 1) * 100)}%` }}/>
                      </div>
                      <span className="text-xs font-semibold text-orange-dark w-8 text-right">{m.drivers}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'drivers' && (
          <div className="app-card p-0 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4">
              <h3 className="section-title m-0">Driver management</h3>
              <label className="relative min-w-0 flex-1 basis-48">
                <span className="sr-only">Search drivers</span>
                <IconSearch size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"/>
                <input placeholder="Search drivers" className="app-input pl-8"/>
              </label>
            </div>
            {driversError && <ErrorState className="mx-4 my-3" message={driversError}/>}
            <DataTable columns={driverColumns} rows={drivers} getRowKey={driver => driver.id}/>
            {drivers.length === 0 && <p className="p-4 text-center text-sm text-ink-soft">No driver accounts found.</p>}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-ink-soft">
              <span>{drivers.length} registered drivers</span>
              <div className="flex gap-2">
                <button type="button" className="btn-quiet btn-small">Prev</button>
                <button type="button" className="btn-secondary btn-small" aria-current="page">1</button>
                <button type="button" className="btn-quiet btn-small">2</button>
                <button type="button" className="btn-quiet btn-small">Next</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'fares' && (
          <div className="app-card">
            <h3 className="section-title mb-1">Fare Zone Editor</h3>
            <FareZoneEditor/>
          </div>
        )}

        {tab === 'alerts' && (
          <div className="app-card">
            <h3 className="section-title">Community Alert Composer</h3>
            <AlertComposer/>
          </div>
        )}

        {tab === 'sos' && (
          <section className="space-y-3" aria-label="SOS alerts">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="section-title m-0">Emergency alerts</h2><span className="text-xs text-ink-soft">Refreshes every 5 seconds</span></div>
            {sosError && <ErrorState message={sosError}/>}
            {sosEvents.length === 0 && !sosError && <p className="app-card text-sm text-ink-soft">No SOS alerts have been sent.</p>}
            {sosEvents.map(event => <article key={event.id} className={`app-card ${event.status === 'active' ? 'border-danger' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-ink">{event.full_name || 'PASAKJA user'} <span className="font-normal capitalize text-ink-soft">· {event.role}</span></p><p className="mt-1 text-xs text-ink-soft">{event.municipality || 'Location not provided'} · {new Date(event.created_at).toLocaleString()}</p></div><StatusBadge status={event.status === 'active' ? 'sos-active' : event.status} label={event.status}/></div>
              {(event.latitude !== null && event.longitude !== null) && <a className="mt-2 inline-block text-sm text-orange-dark underline" href={`https://www.openstreetmap.org/?mlat=${event.latitude}&mlon=${event.longitude}#map=16/${event.latitude}/${event.longitude}`} target="_blank" rel="noreferrer">Open reported location</a>}
              {(event.driver_name || event.plate_number) && <p className="mt-2 text-sm text-ink-soft">Driver: {event.driver_name || '—'}{event.plate_number ? ` · ${event.plate_number}` : ''}</p>}
              {event.status === 'active' && <button type="button" disabled={resolvingSos === event.id} onClick={() => void resolveAlert(event.id)} className="btn-secondary mt-3 px-4 py-2">{resolvingSos === event.id ? 'Updating…' : 'Mark resolved'}</button>}
            </article>)}
            <section className="app-card mt-6" aria-label="Emergency contact settings">
              <h3 className="section-title mb-1">Emergency contacts</h3>
              <p className="mb-4 text-xs text-ink-soft">Only save verified local contact numbers. Blank numbers stay unconfigured.</p>
              <label className="form-field mb-4">
                <span className="field-label">Municipality</span>
                <select value={contactTown} onChange={event => { setContactTown(event.target.value); setContactMessage(''); }} className="app-select">
                  {['Carrascal', 'Cantilan', 'Madrid', 'Carmen', 'Lanuza'].map(town => <option key={town}>{town}</option>)}
                </select>
              </label>
              {contacts.map(contact => <div key={contact.id} className="mb-2 flex flex-wrap items-end gap-2 rounded-xl bg-warm p-3">
                <label className="form-field min-w-0 flex-1 basis-48"><span className="field-label">{contact.label}</span><input type="tel" value={contactPhones[contact.id] ?? ''} onChange={event => setContactPhones(value => ({ ...value, [contact.id]: event.target.value }))} placeholder="Unconfigured" className="app-input" /></label>
                <button type="button" onClick={() => void saveContact(contact)} className="btn-secondary">Save</button>
              </div>)}
              {contactMessage && <p role="status" className="mt-2 text-xs text-ink-soft">{contactMessage}</p>}
            </section>
          </section>
        )}
      </div>
    </div>
  );
}
