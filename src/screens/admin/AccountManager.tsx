import { useEffect, useMemo, useState } from 'react';
import { IconSearch, IconX } from '../../components/Icons';
import { AppButton, AppTextarea, DataTable, ErrorState, FormField, StatusBadge } from '../../components/ui';
import { getAdminAccounts, reactivateAccount, suspendAccount, type AdminAccount } from '../../services/api';
import { formatWhen, parseApiTime } from '../../services/time';

const ACCOUNTS_PER_PAGE = 10;
type RoleFilter = 'all' | 'passenger' | 'driver';
type StatusFilter = 'all' | 'active' | 'suspended';

// Asks for the reason before suspending; the user sees it when they try to sign in.
function SuspendDialog({ account, busy, error, onCancel, onConfirm }: {
  account: AdminAccount;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [fieldError, setFieldError] = useState('');

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [busy, onCancel]);

  const submit = () => {
    if (reason.trim().length < 5) { setFieldError('Give a reason of at least 5 characters.'); return; }
    onConfirm(reason.trim());
  };

  return (
    <div className="dialog-backdrop fixed inset-0 z-50 flex items-end justify-center px-4 md:items-center" onClick={event => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <section className="dialog-card dialog-sheet w-full" role="dialog" aria-modal="true" aria-labelledby="suspend-title">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 id="suspend-title" className="min-w-0">Suspend {account.name}?</h3>
          <button type="button" onClick={onCancel} disabled={busy} className="btn-icon" aria-label="Close"><IconX size={18}/></button>
        </div>
        <p className="mb-4 text-sm text-ink-soft">
          They’ll be signed out and can’t sign in, {account.role === 'driver' ? 'go online or accept rides' : 'or book rides'} until you reactivate the account. They’ll see your reason when they try to sign in.
        </p>
        <FormField id="suspend-reason" label="Reason" error={fieldError || undefined}>
          <AppTextarea id="suspend-reason" rows={3} maxLength={255} value={reason} disabled={busy} autoFocus
            onChange={event => { setReason(event.target.value); setFieldError(''); }}
            placeholder="e.g. Repeated passenger complaints; please visit the TODA office"/>
        </FormField>
        {error && <ErrorState className="mt-3" message={error}/>}
        <div className="mt-4 flex gap-2">
          <AppButton type="button" variant="secondary" className="flex-1" disabled={busy} onClick={onCancel}>Cancel</AppButton>
          <AppButton type="button" variant="danger" className="flex-1" disabled={busy} onClick={submit}>{busy ? 'Suspending…' : 'Suspend account'}</AppButton>
        </div>
      </section>
    </div>
  );
}

// Admin Accounts tab: every passenger and driver, with suspend and reactivate (requirement FR6).
export default function AccountManager() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [suspending, setSuspending] = useState<AdminAccount | null>(null);
  const [suspendError, setSuspendError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    getAdminAccounts()
      .then(rows => { if (mounted) { setAccounts(rows); setError(''); } })
      .catch(loadError => { if (mounted) setError(loadError instanceof Error ? loadError.message : 'Could not load accounts.'); })
      .finally(() => { if (mounted) setLoaded(true); });
    return () => { mounted = false; };
  }, []);

  // Search matches name, phone, email or town.
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return accounts.filter(account =>
      (role === 'all' || account.role === role)
      && (status === 'all' || account.status === status)
      && (!text || [account.name, account.phone, account.email, account.municipality].some(value => String(value ?? '').toLowerCase().includes(text))));
  }, [accounts, query, role, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / ACCOUNTS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * ACCOUNTS_PER_PAGE, currentPage * ACCOUNTS_PER_PAGE);
  const suspendedCount = accounts.filter(account => account.status === 'suspended').length;

  const replace = (updated: AdminAccount) => setAccounts(rows => rows.map(row => row.id === updated.id ? updated : row));

  const confirmSuspend = async (reason: string) => {
    if (!suspending) return;
    setBusyId(suspending.id);
    setSuspendError('');
    try {
      const updated = await suspendAccount(suspending.id, reason);
      replace(updated);
      setNotice(`${updated.name} is suspended and has been signed out.`);
      setSuspending(null);
    } catch (suspendFailure) {
      setSuspendError(suspendFailure instanceof Error ? suspendFailure.message : 'Could not suspend the account.');
    } finally {
      setBusyId(null);
    }
  };

  const reactivate = async (account: AdminAccount) => {
    setBusyId(account.id);
    setError('');
    try {
      const updated = await reactivateAccount(account.id);
      replace(updated);
      setNotice(`${updated.name} is active again and can sign in.`);
    } catch (reactivateError) {
      setError(reactivateError instanceof Error ? reactivateError.message : 'Could not reactivate the account.');
    } finally {
      setBusyId(null);
    }
  };

  const columns = [
    { key: 'account', label: 'Account', render: (account: AdminAccount) => <><p className="text-sm font-medium">{account.name}</p><p className="text-xs text-ink-soft">{account.phone}{account.email ? ` · ${account.email}` : ''}</p></> },
    { key: 'role', label: 'Role', render: (account: AdminAccount) => <>{account.role === 'driver' ? 'Driver' : 'Passenger'}{account.role === 'driver' && account.driver_status && <p className="text-xs capitalize text-ink-soft">{account.driver_status === 'verified' ? 'Approved' : account.driver_status}</p>}</> },
    { key: 'town', label: 'Town', render: (account: AdminAccount) => account.municipality || '—' },
    { key: 'rides', label: 'Completed rides', render: (account: AdminAccount) => account.completed_rides },
    { key: 'joined', label: 'Joined', render: (account: AdminAccount) => parseApiTime(account.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) },
    { key: 'status', label: 'Status', render: (account: AdminAccount) => <>
      <StatusBadge status={account.status}/>
      {account.status === 'suspended' && <p className="account-manager__reason">{account.suspension_reason}{account.suspended_at ? ` · ${formatWhen(account.suspended_at)}` : ''}</p>}
    </> },
    { key: 'actions', label: 'Actions', render: (account: AdminAccount) => account.status === 'active'
      ? <button type="button" disabled={busyId === account.id} onClick={() => { setSuspendError(''); setSuspending(account); }} className="text-link text-xs text-danger">Suspend</button>
      : <button type="button" disabled={busyId === account.id} onClick={() => void reactivate(account)} className="text-link text-xs">{busyId === account.id ? 'Reactivating…' : 'Reactivate'}</button> },
  ];

  return (
    <div className="app-card p-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4">
        <div>
          <h3 className="section-title m-0">Accounts</h3>
          <p className="text-xs text-ink-soft">{accounts.length} passengers and drivers · {suspendedCount} suspended</p>
        </div>
        <div className="account-manager__filters">
          <label className="relative min-w-0 flex-1 basis-48">
            <span className="sr-only">Search accounts</span>
            <IconSearch size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"/>
            <input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Search name, phone or town" className="app-input pl-8"/>
          </label>
          <label>
            <span className="sr-only">Role</span>
            <select value={role} onChange={event => { setRole(event.target.value as RoleFilter); setPage(1); }} className="app-select">
              <option value="all">All roles</option>
              <option value="passenger">Passengers</option>
              <option value="driver">Drivers</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Status</span>
            <select value={status} onChange={event => { setStatus(event.target.value as StatusFilter); setPage(1); }} className="app-select">
              <option value="all">Any status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
        </div>
      </div>
      {error && <ErrorState className="mx-4 my-3" message={error}/>}
      {notice && <p role="status" className="notice notice--success mx-4 my-3">{notice}</p>}
      <DataTable columns={columns} rows={pageRows} getRowKey={account => account.id}/>
      {loaded && filtered.length === 0 && <p className="p-4 text-center text-sm text-ink-soft">{accounts.length === 0 ? 'No passenger or driver accounts yet.' : 'No accounts match these filters.'}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-ink-soft">
        <span aria-live="polite">{filtered.length === 0 ? `${accounts.length} accounts` : `Showing ${(currentPage - 1) * ACCOUNTS_PER_PAGE + 1}–${Math.min(currentPage * ACCOUNTS_PER_PAGE, filtered.length)} of ${filtered.length}`}</span>
        {pageCount > 1 && <nav className="flex gap-2" aria-label="Account pages">
          <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="btn-quiet btn-small">Prev</button>
          <span className="self-center">Page {currentPage} of {pageCount}</span>
          <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="btn-quiet btn-small">Next</button>
        </nav>}
      </div>
      {suspending && (
        <SuspendDialog
          account={suspending}
          busy={busyId === suspending.id}
          error={suspendError}
          onCancel={() => setSuspending(null)}
          onConfirm={reason => void confirmSuspend(reason)}
        />
      )}
    </div>
  );
}
