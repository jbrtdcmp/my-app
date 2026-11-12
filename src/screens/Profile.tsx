import { useEffect, useRef, useState } from 'react';
import { IconCamera, IconKey, IconLogout, IconProfile } from '../components/Icons';
import { AppBadge, AppCard, ListRow } from '../components/ui';
import SosControl from '../components/SosControl';
import { LANGUAGES } from '../data';
import { changePassword, getDriverProfile, removeAvatar, saveAvatar, type ApiUser } from '../services/api';
import type { AppRole } from '../navigation/roleRoutes';

interface ProfileProps {
  role: AppRole;
  user: ApiUser | null;
  onLogout: () => void;
  onUserChange: (user: ApiUser) => void;
}

const AVATAR_SIDE = 320;

// Shrinks a photo to at most 320px and re-encodes it as JPEG, so a phone photo
// of several MB is stored as roughly 20-40 KB.
async function resizePhoto(file: File): Promise<string> {
  const source = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That image could not be opened.')); };
    image.src = url;
  });
  const scale = Math.min(1, AVATAR_SIDE / Math.max(source.naturalWidth, source.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(16, Math.round(source.naturalWidth * scale));
  canvas.height = Math.max(16, Math.round(source.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot prepare the photo.');
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.85, 0.7, 0.55]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length < 250000) return dataUrl;
  }
  throw new Error('That photo is too detailed to save. Try another one.');
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
          <ListRow>
            <span className="profile-layout__row-label flex items-center gap-2"><IconKey size={16}/>Password</span>
            <button type="button" onClick={() => { setOpen(true); setDone(''); }} className="text-link text-sm">Change password</button>
          </ListRow>
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

interface ProfileSection {
  title: string;
  rows: { label: string; value: string }[];
}

function ProfileLayout({ role, user, sections, onLogout, onUserChange, children }: {
  role: AppRole;
  user: ApiUser | null;
  sections: ProfileSection[];
  onLogout: () => void;
  onUserChange: (user: ApiUser) => void;
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
      const avatar = await saveAvatar(await resizePhoto(file));
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
        {sections.map(section => (
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
        <ChangePasswordCard/>
        <button type="button" onClick={onLogout} className="profile-layout__logout">
          <IconLogout size={18}/> Log out
        </button>
      </div>
    </div>
  );
}

function PassengerProfile({ user, onLogout, onUserChange }: Omit<ProfileProps, 'role'>) {
  return (
    <ProfileLayout
      role="passenger"
      user={user}
      onLogout={onLogout}
      onUserChange={onUserChange}
      sections={[
        { title: 'Personal information', rows: [
          { label: 'Full name', value: user?.name ?? '' },
          { label: 'Phone number', value: user?.phone ?? '' },
          { label: 'Email', value: user?.email ?? '' },
          { label: 'Home town', value: user?.municipality ?? '' },
          { label: 'Language', value: LANGUAGES.find(language => language.id === 'en')?.label ?? 'English' },
        ] },
      ]}
    >
      <SosControl municipality={user?.municipality || 'Carrascal'}/>
    </ProfileLayout>
  );
}

function DriverProfile({ user, onLogout, onUserChange }: Omit<ProfileProps, 'role'>) {
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getDriverProfile>> | null>(null);
  const [loadError, setLoadError] = useState('');

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
      sections={[
        { title: 'Personal information', rows: [
          { label: 'Full name', value: user?.name ?? '' },
          { label: 'Phone number', value: user?.phone ?? '' },
          { label: 'Email', value: user?.email ?? '' },
          { label: 'Language', value: LANGUAGES.find(language => language.id === 'en')?.label ?? 'English' },
        ] },
        { title: 'Vehicle and verification', rows: [
          { label: 'Plate number', value: profile?.plate_number ?? '' },
          { label: 'Body number', value: profile?.body_number ?? '' },
          { label: 'TODA', value: profile?.toda_name ?? '' },
          { label: 'Approval status', value: profile?.verification_status ?? '' },
        ] },
        { title: 'Driver activity', rows: [
          { label: 'Rating', value: profile?.rating == null ? '' : String(profile.rating) },
          { label: 'Total rides', value: profile?.total_rides == null ? '' : String(profile.total_rides) },
        ] },
      ]}
    >
      {loadError && <p className="profile-layout__error" role="alert">{loadError}</p>}
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
      sections={[
        { title: 'Admin account', rows: [
          { label: 'Full name', value: user?.name ?? '' },
          { label: 'Email', value: user?.email ?? '' },
          { label: 'Role and permissions', value: user?.role ?? '' },
          { label: 'Language', value: LANGUAGES.find(language => language.id === 'en')?.label ?? 'English' },
        ] },
      ]}
    />
  );
}

export default function Profile({ role, ...props }: ProfileProps) {
  if (role === 'admin') return <AdminProfile {...props}/>;
  if (role === 'driver') return <DriverProfile {...props}/>;
  return <PassengerProfile {...props}/>;
}
