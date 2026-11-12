import { useEffect, useState } from 'react';
import { IconMegaphone } from '../../components/Icons';
import { ConfirmDialog, ErrorState } from '../../components/ui';
import { ALERT_TYPE_CHOICES, alertPresentation } from '../../components/alertPresentation';
import { getAdminAlerts, publishAlert, removeAlert, type AlertType, type CommunityAlert } from '../../services/api';
import { formatWhen } from '../../services/time';

const TOWNS = ['Carrascal', 'Cantilan', 'Madrid', 'Carmen', 'Lanuza'];
const TITLE_MAX = 120;
const MESSAGE_MAX = 500;

export default function AlertComposer() {
  const [area, setArea] = useState('all');
  const [type, setType] = useState<AlertType>('community');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [published, setPublished] = useState<CommunityAlert[] | null>(null);
  const [listError, setListError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<CommunityAlert | null>(null);

  useEffect(() => {
    let active = true;
    getAdminAlerts()
      .then(rows => { if (active) setPublished(rows); })
      .catch(loadError => { if (active) setListError(loadError instanceof Error ? loadError.message : 'Could not load published alerts.'); });
    return () => { active = false; };
  }, []);

  const submit = async () => {
    if (busy) return;
    const errors: Record<string, string> = {};
    if (title.trim().length < 3) errors.title = 'Write a title of at least 3 characters.';
    if (message.trim().length < 3) errors.message = 'Write a message of at least 3 characters.';
    setFieldErrors(errors);
    setNotice('');
    setError('');
    if (Object.keys(errors).length) return;
    setBusy(true);
    try {
      const alert = await publishAlert({ municipality: area, type, title: title.trim(), message: message.trim() });
      setPublished(rows => [alert, ...(rows ?? [])]);
      setNotice(`Published to ${area === 'all' ? 'every town' : area}. It now shows in their Alerts.`);
      setTitle('');
      setMessage('');
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Could not publish the alert.');
      if (publishError && typeof publishError === 'object' && 'details' in publishError && publishError.details && typeof publishError.details === 'object') {
        setFieldErrors(publishError.details as Record<string, string>);
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (alert: CommunityAlert) => {
    setConfirmRemove(null);
    try {
      await removeAlert(alert.id);
      setPublished(rows => (rows ?? []).filter(row => row.id !== alert.id));
      setNotice(`Removed “${alert.title}”.`);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove the alert.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">Publish a notice to everyone in one town or in every town. It appears in their Alerts screen.</p>
        <label className="form-field">
          <span className="field-label">Target area</span>
          <select value={area} onChange={event => setArea(event.target.value)} className="app-select">
            <option value="all">All municipalities</option>
            {TOWNS.map(town => <option key={town} value={town}>{town}</option>)}
          </select>
        </label>
        <div className="form-field">
          <span className="field-label">Alert type</span>
          <div className="flex flex-wrap gap-2">
            {ALERT_TYPE_CHOICES.map(choice => (
              <button key={choice.id} type="button" onClick={() => setType(choice.id)} aria-pressed={type === choice.id} className="app-chip">
                {choice.icon}{choice.label}
              </button>
            ))}
          </div>
        </div>
        <label className="form-field">
          <span className="field-label">Title</span>
          <input value={title} maxLength={TITLE_MAX} onChange={event => setTitle(event.target.value)} placeholder="e.g. Road repair on Rizal Street" className="app-input" aria-invalid={Boolean(fieldErrors.title)}/>
          {fieldErrors.title && <span className="field-error">{fieldErrors.title}</span>}
        </label>
        <label className="form-field">
          <span className="field-label">Message</span>
          <textarea value={message} maxLength={MESSAGE_MAX} onChange={event => setMessage(event.target.value)} rows={4} placeholder="What should riders and drivers know?" className="app-textarea resize-none" aria-invalid={Boolean(fieldErrors.message)}/>
          <span className="field-helper">{message.length}/{MESSAGE_MAX}</span>
          {fieldErrors.message && <span className="field-error">{fieldErrors.message}</span>}
        </label>
        {error && <ErrorState message={error}/>}
        {notice && <p role="status" className="notice notice--success">{notice}</p>}
        <button type="button" disabled={busy} onClick={() => void submit()} className="btn-primary btn-large w-full">
          <IconMegaphone size={16}/>{busy ? 'Publishing…' : 'Publish alert'}
        </button>
      </div>

      <section className="space-y-3" aria-label="Published alerts">
        <h4 className="field-label">Published alerts</h4>
        {listError && <ErrorState message={listError}/>}
        {published?.length === 0 && <p className="text-sm text-ink-soft">Nothing published yet.</p>}
        {published?.map(alert => {
          const { icon, tone } = alertPresentation(alert.type);
          return (
            <article key={alert.id} className="alert-item">
              <span className={`alert-item__icon alert-item__icon--${tone}`}>{icon}</span>
              <div className="min-w-0 flex-1">
                <div className="alert-item__head">
                  <h5 className="alert-item__title">{alert.title}</h5>
                  <time className="alert-item__time" dateTime={alert.created_at}>{formatWhen(alert.created_at)}</time>
                </div>
                <p className="alert-item__message">{alert.message}</p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="alert-item__town">{alert.municipality ?? 'All towns'}{alert.author ? ` · by ${alert.author}` : ''}</span>
                  <button type="button" onClick={() => setConfirmRemove(alert)} className="text-link text-sm">Remove</button>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {confirmRemove && (
        <ConfirmDialog title="Remove this alert?" confirmLabel="Remove" onCancel={() => setConfirmRemove(null)} onConfirm={() => void remove(confirmRemove)}>
          “{confirmRemove.title}” will disappear from everyone’s Alerts.
        </ConfirmDialog>
      )}
    </div>
  );
}
