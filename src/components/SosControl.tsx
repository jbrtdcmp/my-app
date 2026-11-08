import { useState } from 'react';
import { createSos, getEmergencyContacts, resolveSos, createTripShare, type EmergencyContact } from '../services/api';
import { getDeviceLocation, publicTripUrl, shareText } from '../services/platform';
import { IconShield, IconX } from './Icons';

interface SosControlProps { rideId?: number | null; municipality: string; className?: string; }

export default function SosControl({ rideId = null, municipality, className = '' }: SosControlProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(false);
  const [eventId, setEventId] = useState<number | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [locationNotice, setLocationNotice] = useState('');
  const [contactsError, setContactsError] = useState('');
  const [town, setTown] = useState(municipality);

  const confirmSos = async () => {
    setBusy(true); setMessage(''); setLocationNotice(''); setContactsError('');
    let point = null;
    try { point = await getDeviceLocation(); } catch (error) { setLocationNotice(error instanceof Error ? error.message : 'Location unavailable; continuing without it.'); }
    try {
      const result = await createSos({ rideId, lat: point?.lat, lng: point?.lng });
      setEventId(result.event.id);
      setTown(result.ride?.municipality || municipality);
      setActive(true);
      setOpen(true);
      try { setContacts(await getEmergencyContacts(result.ride?.municipality || municipality)); }
      catch (error) { setContactsError(error instanceof Error ? error.message : 'Emergency contacts could not be loaded.'); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not send the SOS alert. Call emergency services directly.'); }
    finally { setBusy(false); }
  };

  const shareTrip = async () => {
    if (!rideId) return;
    setBusy(true);
    try {
      const token = await createTripShare(rideId);
      const url = publicTripUrl(token);
      await shareText('PASAKJA live trip', `Follow my PASAKJA trip in ${town}.`, url);
      setMessage('Live trip link shared.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not share the trip.'); }
    finally { setBusy(false); }
  };

  const markSafe = async () => {
    if (!eventId) return;
    setBusy(true);
    try { await resolveSos(eventId); setActive(false); setMessage('SOS resolved. Stay safe.'); setOpen(false); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not resolve the alert.'); }
    finally { setBusy(false); }
  };

  return <>
    <button type="button" onClick={() => { setMessage(''); setOpen(true); }} aria-label={active ? 'SOS active, view emergency help' : undefined} className={`sos-trigger ${className}${active ? ' sos-trigger--active' : ''}`}><IconShield size={18}/>{active ? 'SOS active' : 'Emergency SOS'}</button>
    {message && !open && <p role="status" className="mt-2 text-xs text-danger">{message}</p>}
    {open && <div className="dialog-backdrop fixed inset-0 z-[1000] flex items-end justify-center px-4 md:items-center">
      <section className="dialog-card w-full max-w-md rounded-t-2xl p-5 md:rounded-2xl" role="dialog" aria-modal="true" aria-labelledby="sos-title">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="dialog-icon dialog-icon--danger m-0"><IconShield size={24}/></span>
            <h2 id="sos-title" className="text-lg font-semibold text-ink">{active ? 'Emergency help' : 'Send an SOS alert?'}</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="btn-icon"><IconX size={18}/></button>
        </div>
        {!active ? <>
          <p className="mb-4 text-sm text-ink-soft">This sends your current location and an alert to PASAKJA admins. If you need immediate help, call local emergency services.</p>
          {locationNotice && <p role="status" className="mb-3 text-xs text-warning">{locationNotice}</p>}
          {message && <p role="status" className="mb-3 text-xs text-danger">{message}</p>}
          <p className="mb-4 rounded-lg bg-danger/5 px-3 py-2 text-xs text-danger">PASAKJA does not replace calling emergency services.</p>
          <div className="flex gap-3"><button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1">Cancel</button><button type="button" disabled={busy} onClick={() => void confirmSos()} className="btn-danger flex-1">{busy ? 'Sending…' : 'Confirm SOS'}</button></div>
        </> : <>
          <p className="mb-3 text-sm text-ink-soft">Your SOS alert has been sent to PASAKJA admins for {town}.</p>
          <p className="mb-2 text-xs font-semibold uppercase text-ink-soft">Emergency contacts</p>
          {contactsError && <p role="status" className="mb-3 text-xs text-danger">Emergency contacts could not be loaded. Call local emergency services directly.</p>}
          <div className="mb-4 space-y-2">{contacts.map(contact => <div key={contact.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"><span className="text-sm text-ink">{contact.label}{Boolean(contact.is_placeholder) && <span className="ml-1 text-xs text-warning">Number not configured</span>}</span>{contact.phone ? <a href={`tel:${contact.phone}`} className="font-semibold text-orange-dark">Call</a> : <span className="text-xs text-ink-soft">Contact admin to add number</span>}</div>)}</div>
          <button type="button" disabled={!rideId || busy} onClick={() => void shareTrip()} className="btn-secondary mb-2 w-full disabled:opacity-50">Share my live trip</button>
          <button type="button" disabled={busy} onClick={() => void markSafe()} className="btn-primary w-full">{busy ? 'Please wait…' : "I'm safe"}</button>
          <p className="mt-3 text-center text-xs text-danger">PASAKJA does not replace calling emergency services.</p>
          {locationNotice && <p role="status" className="mt-2 text-center text-xs text-warning">{locationNotice}</p>}
          {message && <p role="status" className="mt-2 text-center text-xs text-success">{message}</p>}
        </>}
      </section>
    </div>}
  </>;
}
