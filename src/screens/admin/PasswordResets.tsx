import { useCallback, useEffect, useState } from 'react';
import { IconKey, IconX } from '../../components/Icons';
import { ErrorState } from '../../components/ui';
import { answerPasswordReset, getPasswordResets, type PasswordResetRequest } from '../../services/api';
import { formatWhen } from '../../services/time';

// "Forgot password?" requests. PASAKJA has no email or SMS service, so the admin
// issues a temporary password here and passes it on by call or text.
export default function PasswordResets() {
  const [requests, setRequests] = useState<PasswordResetRequest[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [issued, setIssued] = useState<{ name: string; phone: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try { setRequests(await getPasswordResets()); setError(''); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not load password reset requests.'); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const answer = async (request: PasswordResetRequest, action: 'resolve' | 'dismiss') => {
    setBusyId(request.id);
    try {
      const result = await answerPasswordReset(request.id, action);
      setRequests(rows => rows.filter(row => row.user_id !== request.user_id));
      if (result.temporary_password) { setIssued({ name: result.user.name, phone: result.user.phone, password: result.temporary_password }); setCopied(false); }
    } catch (answerError) {
      setError(answerError instanceof Error ? answerError.message : 'Could not update the request.');
      void load();
    } finally {
      setBusyId(null);
    }
  };

  const copy = async () => {
    if (!issued) return;
    try { await navigator.clipboard.writeText(issued.password); setCopied(true); } catch { setCopied(false); }
  };

  if (!requests.length && !error && !issued) return null;

  return (
    <section className="app-card space-y-3" aria-labelledby="password-resets-title">
      <div className="flex items-center gap-2">
        <span className="reset-request__icon"><IconKey size={18}/></span>
        <h3 id="password-resets-title" className="section-title m-0">Password reset requests</h3>
      </div>
      {error && <ErrorState message={error}/>}
      {requests.map(request => (
        <div key={request.id} className="reset-request">
          <div className="min-w-0">
            <p className="reset-request__name">{request.full_name} <span className="reset-request__role">{request.role}</span></p>
            <p className="reset-request__meta">{request.phone}{request.email ? ` · ${request.email}` : ''} · {formatWhen(request.requested_at)}</p>
          </div>
          <div className="reset-request__actions">
            <button type="button" disabled={busyId === request.id} onClick={() => void answer(request, 'resolve')} className="btn-primary btn-small">{busyId === request.id ? 'Working…' : 'Issue temporary password'}</button>
            <button type="button" disabled={busyId === request.id} onClick={() => void answer(request, 'dismiss')} className="btn-quiet btn-small">Dismiss</button>
          </div>
        </div>
      ))}

      {issued && (
        <div className="dialog-backdrop fixed inset-0 z-50 flex items-end justify-center px-4 md:items-center">
          <section className="dialog-card dialog-sheet w-full max-w-md" role="dialog" aria-modal="true" aria-labelledby="temp-password-title">
            <div className="mb-2 flex items-start justify-between gap-3">
              <h3 id="temp-password-title">Temporary password for {issued.name}</h3>
              <button type="button" onClick={() => setIssued(null)} className="btn-icon" aria-label="Close"><IconX size={18}/></button>
            </div>
            <p className="text-sm text-ink-soft">Call or text {issued.phone} and give them this password. It is shown only once. Their old password and sessions no longer work.</p>
            <p className="temp-password" aria-label="Temporary password">{issued.password}</p>
            <p className="mb-4 text-sm text-ink-soft">Ask them to sign in and change it in Profile → Change password.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => void copy()} className="btn-secondary flex-1">{copied ? 'Copied' : 'Copy password'}</button>
              <button type="button" onClick={() => setIssued(null)} className="btn-primary flex-1">Done</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
