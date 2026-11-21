import { useEffect, useState } from 'react';
import { IconX } from '../../components/Icons';
import { ErrorState, Skeleton, StatusBadge } from '../../components/ui';
import { getDriverIdPhoto, type AdminDriver } from '../../services/api';
import { formatWhen } from '../../services/time';

// Shows a driver's license/ID photo beside the details they signed up with,
// so the admin can compare them before approving.
export default function DriverIdDialog({ driver, busy, onClose, onDecision }: {
  driver: AdminDriver;
  busy: boolean;
  onClose: () => void;
  onDecision: (status: 'verified' | 'rejected') => void;
}) {
  const [photo, setPhoto] = useState<{ photo: string; uploaded_at: string | null } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!driver.has_id_photo) return;
    getDriverIdPhoto(driver.id)
      .then(result => { if (active) setPhoto(result); })
      .catch(loadError => { if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load the ID photo.'); });
    return () => { active = false; };
  }, [driver.id, driver.has_id_photo]);

  const details: [string, string | null][] = [
    ['Phone', driver.phone],
    ['License no.', driver.license_number],
    ['Plate', driver.plate_number],
    ['Body no.', driver.body_number],
    ['TODA', driver.toda_name],
    ['Vehicle', driver.vehicle_type ? driver.vehicle_type.charAt(0).toUpperCase() + driver.vehicle_type.slice(1) : null],
  ];

  return (
    <div className="dialog-backdrop fixed inset-0 z-50 flex items-end justify-center px-4 md:items-center" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="dialog-card dialog-sheet driver-id-dialog w-full" role="dialog" aria-modal="true" aria-labelledby="driver-id-title">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="driver-id-title" className="truncate">{driver.full_name}</h3>
            <StatusBadge status={driver.verification_status}/>
          </div>
          <button type="button" onClick={onClose} className="btn-icon" aria-label="Close"><IconX size={18}/></button>
        </div>

        {!driver.has_id_photo && <p className="notice notice--info">This driver hasn’t uploaded a license or ID photo yet. They can add one in Profile.</p>}
        {error && <ErrorState message={error}/>}
        {driver.has_id_photo && !photo && !error && <Skeleton className="driver-id-dialog__loading"/>}
        {photo && (
          <figure className="driver-id-dialog__photo">
            <img src={photo.photo} alt={`Driver’s license or ID of ${driver.full_name}`}/>
            {photo.uploaded_at && <figcaption>Uploaded {formatWhen(photo.uploaded_at)}</figcaption>}
          </figure>
        )}

        <dl className="driver-id-dialog__details">
          {details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}
        </dl>
        <p className="mb-4 text-xs text-ink-soft">Check that the name and license number on the photo match these details.</p>

        <div className="flex gap-2">
          {driver.verification_status !== 'rejected' && <button type="button" disabled={busy} onClick={() => onDecision('rejected')} className="btn-secondary flex-1 text-danger">Reject</button>}
          {driver.verification_status !== 'verified' && <button type="button" disabled={busy || !driver.has_id_photo} onClick={() => onDecision('verified')} className="btn-primary flex-1">{busy ? 'Saving…' : 'Approve'}</button>}
        </div>
      </section>
    </div>
  );
}
