import { useEffect, useRef, useState } from 'react';
import { IconAlerts, IconCamera, IconChevronRight, IconFile, IconKey, IconLogout, IconProfile, IconShield, IconTrash } from '../components/Icons';
import { LegalSheet, type LegalDocument } from './Legal';
import { AppBadge, AppButton, AppCard, AppInput, AppSelect, FormField, ListRow } from '../components/ui';
import SosControl from '../components/SosControl';
import { LANGUAGES } from '../data';
import { ApiError, changePassword, deleteAccount, getDriverProfile, sendTestPush, removeAvatar, saveAvatar, updateProfile, uploadDriverIdPhoto, type ApiUser } from '../services/api';
import { AVATAR_SIZE, ID_PHOTO_SIZE, resizeImageFile } from '../services/images';
import { disablePush, enablePush, pushStatus, PushUnavailableError, type PushStatus } from '../services/push';
import { formatWhen } from '../services/time';
import type { AppRole } from '../navigation/roleRoutes';

interface ProfileProps {
  role: AppRole;
  user: ApiUser | null;
  onLogout: () => void;
  onUserChange: (user: ApiUser) => void;
  // Called after the user deletes their own account (they are already signed out).
  onAccountDeleted?: () => void;
}


function ChangePasswordCard() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const submit = async () => {
    if (busy) return;
    setError('');
    setDone('');
    if (next.length < 8) { setError('Your new password must be at least 8 characters.'); return; }
    if (next !== confirm) { setError('The new passwords do not match.'); return; }
    setBusy(true);
    try {
      await changePassword(current, next);
      setDone('Password changed. Other devices were signed out.');
      setCurrent(''); setNext(''); setConfirm('');
      setOpen(false);
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : 'Could not change your password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="profile-layout__section">
      <h2>Security</h2>
      <AppCard className="profile-layout__card">
        {!open ? (
          <SettingsRow icon={<IconKey size={18}/>} label="Password" hint="Change the password you sign in with" onClick={() => { setOpen(true); setDone(''); }}/>
        ) : (
          <div className="profile-password-form">
            <label className="form-field"><span className="field-label">Current password</span><input type="password" autoComplete="current-password" value={current} onChange={event => setCurrent(event.target.value)} className="app-input"/></label>
            <label className="form-field"><span className="field-label">New password</span><input type="password" autoComplete="new-password" value={next} onChange={event => setNext(event.target.value)} placeholder="At least 8 characters" className="app-input"/></label>
            <label className="form-field"><span className="field-label">Confirm new password</span><input type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} className="app-input"/></label>
            {error && <p className="profile-layout__error" role="alert">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setOpen(false); setError(''); }} className="btn-quiet flex-1">Cancel</button>
              <button type="button" disabled={busy} onClick={() => void submit()} className="btn-primary flex-1">{busy ? 'Saving…' : 'Save password'}</button>
            </div>
          </div>
        )}
      </AppCard>
      {done && <p role="status" className="notice notice--success mt-2">{done}</p>}
    </section>
  );
}

const TOWNS = ['Carrascal', 'Cantilan', 'Madrid', 'Carmen', 'Lanuza'];
const LANGUAGE_LABEL = LANGUAGES.find(language => language.id === 'en')?.label ?? 'English';

// Reads 0917…, 917…, 63917… and +63917… as the same number (as the API does), so the
// password box only appears when the number itself changes.
function normalizePhone(value: string): string {
  const digits = value.replace(/[^0-9+]/g, '');
  const match = digits.match(/^(?:\+?63|0)?(9\d{9})$/);
  return match ? `+63${match[1]}` : digits;
}

type EditField = 'name' | 'phone' | 'email' | 'municipality' | 'currentPassword';

// Name, phone, email and home town, with an Edit button. Changing the phone or email
// (what the user signs in with) asks for the current password.
function PersonalInfoCard({ role, user, onUserChange }: { role: AppRole; user: ApiUser | null; onUserChange: (user: ApiUser) => void }) {
  const hasTown = role !== 'admin';
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', municipality: '' });
  const [currentPassword, setCurrentPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<EditField, string>>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  const phoneChanged = !!user && normalizePhone(form.phone) !== normalizePhone(user.phone);
  const emailChanged = !!user && form.email.trim().toLowerCase() !== (user.email ?? '').toLowerCase();
  const needsPassword = editing && (phoneChanged || emailChanged);

  const startEditing = () => {
    if (!user) return;
    setForm({ name: user.name, phone: user.phone, email: user.email ?? '', municipality: user.municipality ?? '' });
    setCurrentPassword('');
    setErrors({});
    setError('');
    setDone('');
    setEditing(true);
  };

  const change = (field: keyof typeof form, value: string) => {
    setForm(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: undefined }));
  };

  const validate = (): Partial<Record<EditField, string>> => {
    const found: Partial<Record<EditField, string>> = {};
    if (form.name.trim().length < 2) found.name = 'Enter your full name';
    if (!/^\+?[0-9]{7,18}$/.test(form.phone.replace(/[^0-9+]/g, ''))) found.phone = 'Enter a valid phone number';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) found.email = 'Enter a valid email';
    if (needsPassword && !currentPassword) found.currentPassword = 'Enter your current password';
    return found;
  };

  const save = async () => {
    if (busy || !user) return;
    setError('');
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const { user: updated, reviewRequired } = await updateProfile({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        ...(hasTown ? { municipality: form.municipality } : {}),
        currentPassword: needsPassword ? currentPassword : '',
      });
      onUserChange({ ...user, ...updated });
      setEditing(false);
      setCurrentPassword('');
      setDone([
        phoneChanged ? `Profile saved. Sign in with ${updated.phone} from now on.` : 'Profile saved.',
        reviewRequired ? 'Because your name changed, an admin will check it against your license before you can go online again.' : '',
      ].filter(Boolean).join(' '));
    } catch (saveError) {
      const details = saveError instanceof ApiError ? saveError.details : {};
      const fieldErrors = { name: details.name, phone: details.phone, email: details.email, municipality: details.municipality, currentPassword: details.current_password };
      setErrors(fieldErrors);
      // A message under the field is enough; the box is for errors no field explains.
      setError(Object.values(fieldErrors).some(Boolean) ? '' : saveError instanceof Error ? saveError.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  };

  const rows = [
    { label: 'Full name', value: user?.name ?? '' },
    { label: 'Phone number', value: user?.phone ?? '' },
    { label: 'Email', value: user?.email ?? '' },
    ...(hasTown ? [{ label: 'Home town', value: user?.municipality ?? '' }] : [{ label: 'Role and permissions', value: user?.role ?? '' }]),
    { label: 'Language', value: LANGUAGE_LABEL },
  ];

  return (
    <section className="profile-layout__section">
      <div className="profile-layout__section-head">
        <h2>{role === 'admin' ? 'Admin account' : 'Personal information'}</h2>
        {!editing && user && <button type="button" onClick={startEditing} className="text-link text-sm">Edit</button>}
      </div>
      <AppCard className="profile-layout__card">
        {!editing ? rows.map((row, index) => (
          <ListRow key={row.label} className={index < rows.length - 1 ? 'profile-layout__row--divided' : ''}>
            <span className="profile-layout__row-label">{row.label}</span>
            <span className="profile-layout__row-value">{row.value || 'Not available'}</span>
          </ListRow>
        )) : (
          <form className="profile-edit-form" noValidate onSubmit={event => { event.preventDefault(); void save(); }}>
            <FormField id="profile-name" label="Full name" helper={role === 'driver' ? 'Must match your license. An approved driver who changes it goes back to admin review.' : undefined} error={errors.name}>
              <AppInput id="profile-name" autoComplete="name" value={form.name} onChange={event => change('name', event.target.value)} disabled={busy} aria-invalid={!!errors.name}/>
            </FormField>
            <FormField id="profile-phone" label="Phone number" helper="You sign in with this number." error={errors.phone}>
              <AppInput id="profile-phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={event => change('phone', event.target.value)} disabled={busy} placeholder="09XX XXX XXXX" aria-invalid={!!errors.phone}/>
            </FormField>
            <FormField id="profile-email" label="Email (optional)" error={errors.email}>
              <AppInput id="profile-email" type="email" autoComplete="email" value={form.email} onChange={event => change('email', event.target.value)} disabled={busy} placeholder="juan@email.com" aria-invalid={!!errors.email}/>
            </FormField>
            {hasTown && (
              <FormField id="profile-town" label="Home town" error={errors.municipality}>
                <AppSelect id="profile-town" value={form.municipality} onChange={event => change('municipality', event.target.value)} disabled={busy}>
                  <option value="">Not set</option>
                  {TOWNS.map(town => <option key={town} value={town}>{town}</option>)}
                </AppSelect>
              </FormField>
            )}
            {needsPassword && (
              <FormField id="profile-current-password" label="Current password" helper="Needed to change your phone number or email." error={errors.currentPassword}>
                <AppInput id="profile-current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={event => { setCurrentPassword(event.target.value); setErrors(previous => ({ ...previous, currentPassword: undefined })); }} disabled={busy} aria-invalid={!!errors.currentPassword}/>
              </FormField>
            )}
            {error && <p className="profile-layout__error" role="alert">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setEditing(false); setError(''); }} disabled={busy} className="btn-quiet flex-1">Cancel</button>
              <button type="submit" disabled={busy} className="btn-primary flex-1">{busy ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
        )}
      </AppCard>
      {done && <p role="status" className="notice notice--success mt-2">{done}</p>}
    </section>
  );
}

interface ProfileSection {
  title: string;
  rows: { label: string; value: string }[];
}

// Profile → Notifications: phone notifications for this device, as an on/off switch.
function NotificationsCard({ role }: { role: AppRole }) {
  const [status, setStatus] = useState<PushStatus | 'loading'>('loading');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    pushStatus().then(next => { if (live) setStatus(next); }).catch(() => { if (live) setStatus('unsupported'); });
    return () => { live = false; };
  }, []);

  if (status === 'loading' || status === 'not-configured') return null;

  const hint = {
    on: role === 'driver' ? 'New ride requests, even when PASAKJA is closed' : role === 'admin' ? 'SOS alerts and requests, even when PASAKJA is closed' : 'Ride updates, even when PASAKJA is closed',
    off: role === 'driver' ? 'Hear about ride requests when PASAKJA is closed' : role === 'admin' ? 'Hear about SOS alerts when PASAKJA is closed' : 'Get ride updates when PASAKJA is closed',
    blocked: 'Blocked — allow notifications in your browser’s site settings',
    'needs-install': 'On iPhone: Share → Add to Home Screen, then open PASAKJA from there',
    unsupported: 'Not available in this browser',
  }[status];
  const canToggle = status === 'on' || status === 'off';

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try { await action(); } catch (actionError) {
      if (actionError instanceof PushUnavailableError) setStatus('unsupported');
      setMessage({ tone: 'error', text: actionError instanceof Error ? actionError.message : 'Something went wrong. Try again.' });
    } finally { setBusy(false); }
  };
  const toggle = () => run(async () => {
    if (status === 'on') { await disablePush(); setStatus('off'); }
    else { await enablePush(); setStatus('on'); }
  });
  const test = () => run(async () => {
    const result = await sendTestPush();
    setMessage(result.sent > 0
      ? { tone: 'info', text: 'Test sent. It should appear in a few seconds.' }
      : { tone: 'error', text: 'The test couldn’t be delivered. Turn notifications off and on again.' });
  });

  return (
    <section className="profile-layout__section">
      <h2>Notifications</h2>
      <AppCard className="profile-layout__card">
        <ListRow className={`settings-row settings-row--static${status === 'on' ? ' profile-layout__row--divided' : ''}`}>
          <span className="settings-row__icon"><IconAlerts size={18}/></span>
          <span className="settings-row__text">
            <span className="settings-row__label">Phone notifications</span>
            <span className="settings-row__hint">{hint}</span>
          </span>
          {canToggle && (
            <button
              type="button"
              role="switch"
              aria-checked={status === 'on'}
              aria-label="Phone notifications"
              disabled={busy}
              onClick={() => void toggle()}
              className={`system-toggle ${status === 'on' ? 'system-toggle--on' : ''}`}
            ><span/></button>
          )}
        </ListRow>
        {status === 'on' && (
          <ListRow>
            <span className="profile-layout__row-label">Test notification</span>
            <button type="button" disabled={busy} onClick={() => void test()} className="text-link text-sm">Send test</button>
          </ListRow>
        )}
      </AppCard>
      {message && <p role={message.tone === 'error' ? 'alert' : 'status'} className={`profile-notify__message profile-notify__message--${message.tone}`}>{message.text}</p>}
    </section>
  );
}

// Profile → Privacy and account: the two documents, and deleting the account
// (passengers and drivers; admin accounts are managed separately).
function DeleteAccountDialog({ role, onCancel, onDeleted }: { role: AppRole; onCancel: () => void; onDeleted: () => void }) {
  const [password, setPassword] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [busy, onCancel]);

  const submit = async () => {
    if (busy) return;
    if (!password) { setError('Enter your password.'); return; }
    if (!understood) { setError('Tick the box to confirm.'); return; }
    setBusy(true);
    setError('');
    try {
      await deleteAccount(password);
      onDeleted();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete your account.');
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop fixed inset-0 z-50 flex items-end justify-center px-4 md:items-center" onClick={event => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <section className="dialog-card dialog-sheet w-full" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
        <h3 id="delete-account-title">Delete your account?</h3>
        <p className="mb-4 text-sm text-ink-soft">
          This erases your name, phone number, email and photos{role === 'driver' ? ', and your license photo,' : ''} and signs you out on every device. Your past rides stay in the records without your name. This can’t be undone.
        </p>
        <FormField id="delete-password" label="Your password">
          <AppInput id="delete-password" type="password" autoComplete="current-password" value={password} disabled={busy} autoFocus onChange={event => { setPassword(event.target.value); setError(''); }}/>
        </FormField>
        <label className="profile-delete__confirm">
          <input type="checkbox" checked={understood} disabled={busy} onChange={event => { setUnderstood(event.target.checked); setError(''); }}/>
          <span>I understand that my account will be deleted permanently.</span>
        </label>
        {error && <p className="profile-layout__error" role="alert">{error}</p>}
        <div className="mt-4 flex gap-2">
          <AppButton type="button" variant="secondary" className="flex-1" disabled={busy} onClick={onCancel}>Cancel</AppButton>
          <AppButton type="button" variant="danger" className="flex-1" disabled={busy} onClick={() => void submit()}>{busy ? 'Deleting…' : 'Delete account'}</AppButton>
        </div>
      </section>
    </div>
  );
}

// A tappable settings row: icon, label with a short hint, and an arrow.
function SettingsRow({ icon, label, hint, onClick, danger = false, divided = false }: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
  danger?: boolean;
  divided?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className={`settings-row${danger ? ' settings-row--danger' : ''}${divided ? ' profile-layout__row--divided' : ''}`}>
      <span className="settings-row__icon">{icon}</span>
      <span className="settings-row__text">
        <span className="settings-row__label">{label}</span>
        <span className="settings-row__hint">{hint}</span>
      </span>
      <IconChevronRight size={18} className="settings-row__chevron"/>
    </button>
  );
}

function PrivacyAccountCard({ role, onAccountDeleted }: { role: AppRole; onAccountDeleted?: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [reading, setReading] = useState<LegalDocument | null>(null);
  const canDelete = role !== 'admin' && Boolean(onAccountDeleted);
  return (
    <section className="profile-layout__section">
      <h2>Privacy and account</h2>
      <AppCard className="profile-layout__card">
        <SettingsRow icon={<IconShield size={18}/>} label="Privacy Notice" hint="What PASAKJA collects and who can see it" onClick={() => setReading('privacy')} divided/>
        <SettingsRow icon={<IconFile size={18}/>} label="Terms of Use" hint="Rules for passengers and drivers" onClick={() => setReading('terms')} divided={canDelete}/>
        {canDelete && <SettingsRow icon={<IconTrash size={18}/>} label="Delete account" hint="Erase your details from PASAKJA" onClick={() => setDeleting(true)} danger/>}
      </AppCard>
      {reading && <LegalSheet doc={reading} onClose={() => setReading(null)}/>}
      {deleting && onAccountDeleted && <DeleteAccountDialog role={role} onCancel={() => setDeleting(false)} onDeleted={onAccountDeleted}/>}
    </section>
  );
}

function ProfileLayout({ role, user, sections, onLogout, onUserChange, onAccountDeleted, children }: {
  role: AppRole;
  user: ApiUser | null;
  sections: ProfileSection[];
  onLogout: () => void;
  onUserChange: (user: ApiUser) => void;
  onAccountDeleted?: () => void;
  children?: React.ReactNode;
}) {
  const [avatarError, setAvatarError] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const roleLabel = role === 'admin' ? 'Admin' : role === 'driver' ? 'Driver' : 'Passenger';

  const chooseAvatar = async (file?: File) => {
    setAvatarError('');
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError('Choose an image file.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setAvatarError('That photo is larger than 15 MB. Choose a smaller one.');
      return;
    }
    setAvatarBusy(true);
    try {
      const avatar = await saveAvatar(await resizeImageFile(file, AVATAR_SIZE));
      onUserChange({ ...user, avatar });
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Could not save your photo.');
    } finally {
      setAvatarBusy(false);
      if (avatarInput.current) avatarInput.current.value = '';
    }
  };

  const deleteAvatar = async () => {
    if (!user) return;
    setAvatarBusy(true);
    setAvatarError('');
    try { await removeAvatar(); onUserChange({ ...user, avatar: null }); }
    catch (error) { setAvatarError(error instanceof Error ? error.message : 'Could not remove your photo.'); }
    finally { setAvatarBusy(false); }
  };

  return (
    <div className="profile-layout flex-1 overflow-y-auto bg-warm">
      <header className="profile-layout__header">
        <button type="button" className="profile-layout__avatar" disabled={avatarBusy} onClick={() => avatarInput.current?.click()} aria-label={user?.avatar ? 'Change profile photo' : 'Add profile photo'}>
          {user?.avatar ? <img src={user.avatar} alt=""/> : user?.name?.slice(0, 1).toUpperCase() ?? <IconProfile size={24}/>}
          <span className="profile-layout__avatar-badge" aria-hidden="true"><IconCamera size={14}/></span>
        </button>
        <input ref={avatarInput} className="auth-file-input" type="file" accept="image/*" onChange={event => void chooseAvatar(event.target.files?.[0])}/>
        <div className="min-w-0">
          <h1 className="truncate">{user?.name || 'Account'}</h1>
          <AppBadge className="profile-layout__role">{roleLabel}</AppBadge>
          <p className="truncate">{user?.email || user?.phone || 'Profile details'}</p>
          {avatarBusy ? <p className="profile-layout__photo-note">Saving photo…</p>
            : user?.avatar ? <button type="button" onClick={() => void deleteAvatar()} className="text-link text-sm">Remove photo</button>
            : <button type="button" onClick={() => avatarInput.current?.click()} className="text-link text-sm">Add a photo</button>}
        </div>
      </header>
      {avatarError && <p className="profile-layout__error" role="alert">{avatarError}</p>}

      <div className="profile-layout__content">
        {children}
        <PersonalInfoCard role={role} user={user} onUserChange={onUserChange}/>
        {sections.filter(section => section.rows.length > 0).map(section => (
          <section key={section.title} className="profile-layout__section">
            <h2>{section.title}</h2>
            <AppCard className="profile-layout__card">
              {section.rows.map((row, index) => (
                <ListRow key={row.label} className={index < section.rows.length - 1 ? 'profile-layout__row--divided' : ''}>
                  <span className="profile-layout__row-label">{row.label}</span>
                  <span className="profile-layout__row-value">{row.value || 'Not available'}</span>
                </ListRow>
              ))}
            </AppCard>
          </section>
        ))}
        <NotificationsCard role={role}/>
        <ChangePasswordCard/>
        <PrivacyAccountCard role={role} onAccountDeleted={onAccountDeleted}/>
        <button type="button" onClick={onLogout} className="profile-layout__logout">
          <IconLogout size={18}/> Log out
        </button>
      </div>
    </div>
  );
}

function PassengerProfile({ user, onLogout, onUserChange, onAccountDeleted }: Omit<ProfileProps, 'role'>) {
  return (
    <ProfileLayout
      role="passenger"
      user={user}
      onLogout={onLogout}
      onUserChange={onUserChange}
      onAccountDeleted={onAccountDeleted}
      sections={[]}
    >
      <SosControl municipality={user?.municipality || 'Carrascal'}/>
    </ProfileLayout>
  );
}

// Drivers who aren't approved yet can add or replace the photo of their license or ID.
function DriverIdUpload({ profile, onUploaded }: { profile: DriverProfileData; onUploaded: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  if (profile.verification_status === 'verified') return null;

  const upload = async (file?: File) => {
    if (!file) return;
    setError('');
    setDone('');
    if (!file.type.startsWith('image/')) { setError('Choose an image file.'); return; }
    setBusy(true);
    try {
      await uploadDriverIdPhoto(await resizeImageFile(file, ID_PHOTO_SIZE));
      setDone('Uploaded. An admin will review it and you’ll get a notice in Alerts.');
      onUploaded();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload the photo.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const message = profile.verification_status === 'rejected'
    ? 'Your application wasn’t approved. Upload a clearer photo of your license or ID to be reviewed again.'
    : profile.has_id_photo
      ? 'Your license photo is waiting for an admin to review it.'
      : 'Upload a photo of your driver’s license or ID so an admin can approve you.';

  return (
    <section className={`driver-id-card${profile.verification_status === 'rejected' ? ' driver-id-card--rejected' : ''}`} aria-label="License or ID photo">
      <p>{message}</p>
      <input ref={input} type="file" accept="image/*" className="auth-file-input" onChange={event => void upload(event.target.files?.[0])}/>
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className="btn-secondary btn-small">
        <IconCamera size={16}/>{busy ? 'Uploading…' : profile.has_id_photo ? 'Replace photo' : 'Upload license photo'}
      </button>
      {error && <p className="profile-layout__error" role="alert">{error}</p>}
      {done && <p role="status" className="notice notice--success">{done}</p>}
    </section>
  );
}

type DriverProfileData = Awaited<ReturnType<typeof getDriverProfile>>;

// "₱1,250 · 12 rides" or "₱80.50 · 2 rides" (fares of completed rides).
function earningsLine(amount: number, rides: number): string {
  const value = Number(amount);
  const decimals = Number.isInteger(value) ? 0 : 2;
  const pesos = value.toLocaleString('en-PH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `₱${pesos} · ${rides} ${rides === 1 ? 'ride' : 'rides'}`;
}

function DriverProfile({ user, onLogout, onUserChange, onAccountDeleted }: Omit<ProfileProps, 'role'>) {
  const [profile, setProfile] = useState<DriverProfileData | null>(null);
  const [loadError, setLoadError] = useState('');

  const load = () => getDriverProfile().then(setProfile).catch(error => setLoadError(error instanceof Error ? error.message : 'Could not load driver profile.'));
  useEffect(() => {
    let active = true;
    getDriverProfile().then(result => {
      if (active) setProfile(result);
    }).catch(error => {
      if (active) setLoadError(error instanceof Error ? error.message : 'Could not load driver profile.');
    });
    return () => { active = false; };
  }, []);

  return (
    <ProfileLayout
      role="driver"
      user={user}
      onLogout={onLogout}
      onUserChange={onUserChange}
      onAccountDeleted={onAccountDeleted}
      sections={[
        { title: 'Vehicle and verification', rows: [
          { label: 'Plate number', value: profile?.plate_number ?? '' },
          { label: 'Body number', value: profile?.body_number ?? '' },
          { label: 'TODA', value: profile?.toda_name ?? '' },
          { label: 'Vehicle type', value: profile?.vehicle_type ? profile.vehicle_type.charAt(0).toUpperCase() + profile.vehicle_type.slice(1) : '' },
          { label: 'License number', value: profile?.license_number ?? '' },
          { label: 'License / ID photo', value: profile ? (profile.has_id_photo ? `Uploaded${profile.id_photo_uploaded_at ? ` ${formatWhen(profile.id_photo_uploaded_at)}` : ''}` : 'Not uploaded') : '' },
          { label: 'Approval status', value: profile?.verification_status ?? '' },
        ] },
        { title: 'Earnings', rows: profile ? [
          { label: 'Today', value: earningsLine(profile.earnings_today, profile.rides_today) },
          { label: 'This week', value: earningsLine(profile.earnings_week, profile.rides_week) },
          { label: 'This month', value: earningsLine(profile.earnings_month, profile.rides_month) },
          { label: 'All time', value: earningsLine(profile.earnings_total, profile.total_rides) },
        ] : [] },
        { title: 'Driver activity', rows: [
          { label: 'Rating', value: profile?.rating == null ? '' : Number(profile.rating) > 0 ? `${Number(profile.rating).toFixed(1)} ★` : 'No ratings yet' },
          { label: 'Total rides', value: profile?.total_rides == null ? '' : String(profile.total_rides) },
        ] },
      ]}
    >
      {loadError && <p className="profile-layout__error" role="alert">{loadError}</p>}
      {profile && <DriverIdUpload profile={profile} onUploaded={() => void load()}/>}
    </ProfileLayout>
  );
}

function AdminProfile({ user, onLogout, onUserChange }: Omit<ProfileProps, 'role'>) {
  return (
    <ProfileLayout
      role="admin"
      user={user}
      onLogout={onLogout}
      onUserChange={onUserChange}
      sections={[]}
    />
  );
}

export default function Profile({ role, ...props }: ProfileProps) {
  if (role === 'admin') return <AdminProfile {...props}/>;
  if (role === 'driver') return <DriverProfile {...props}/>;
  return <PassengerProfile {...props}/>;
}
