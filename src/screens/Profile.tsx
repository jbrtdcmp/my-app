import { useEffect, useRef, useState } from 'react';
import { IconChevronRight, IconLogout, IconProfile } from '../components/Icons';
import { AppBadge, AppCard, ListRow } from '../components/ui';
import SosControl from '../components/SosControl';
import { LANGUAGES } from '../data';
import { getDriverProfile, type ApiUser } from '../services/api';
import type { AppRole } from '../navigation/roleRoutes';

interface ProfileProps {
  role: AppRole;
  user: ApiUser | null;
  onLogout: () => void;
}

interface ProfileSection {
  title: string;
  rows: { label: string; value: string }[];
}

function ProfileLayout({ role, user, sections, onLogout, children }: {
  role: AppRole;
  user: ApiUser | null;
  sections: ProfileSection[];
  onLogout: () => void;
  children?: React.ReactNode;
}) {
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const avatarInput = useRef<HTMLInputElement>(null);
  const roleLabel = role === 'admin' ? 'Admin' : role === 'driver' ? 'Driver' : 'Passenger';

  useEffect(() => () => {
    if (avatarUrl) URL.revokeObjectURL(avatarUrl);
  }, [avatarUrl]);

  const chooseAvatar = (file?: File) => {
    setAvatarError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError('Choose an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Profile image must be 2 MB or smaller.');
      return;
    }
    if (avatarUrl) URL.revokeObjectURL(avatarUrl);
    setAvatarUrl(URL.createObjectURL(file));
  };

  return (
    <div className="profile-layout flex-1 overflow-y-auto bg-warm">
      <header className="profile-layout__header">
        <button type="button" className="profile-layout__avatar" onClick={() => avatarInput.current?.click()} aria-label="Choose profile photo">
          {avatarUrl ? <img src={avatarUrl} alt="Profile preview"/> : user?.name?.slice(0, 1).toUpperCase() ?? <IconProfile size={24}/>}
        </button>
        <input ref={avatarInput} className="auth-file-input" type="file" accept="image/*" onChange={event => chooseAvatar(event.target.files?.[0])}/>
        <div className="min-w-0">
          <h1>{user?.name || 'Account'}</h1>
          <AppBadge className="profile-layout__role">{roleLabel}</AppBadge>
          <p>{user?.email || user?.phone || 'Profile details'}</p>
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
        <button type="button" onClick={onLogout} className="profile-layout__logout">
          <IconLogout size={18}/> Log Out <IconChevronRight size={16}/>
        </button>
      </div>
    </div>
  );
}

function PassengerProfile({ user, onLogout }: Omit<ProfileProps, 'role'>) {
  return (
    <ProfileLayout
      role="passenger"
      user={user}
      onLogout={onLogout}
      sections={[
        { title: 'Personal information', rows: [
          { label: 'Full name', value: user?.name ?? '' },
          { label: 'Phone number', value: user?.phone ?? '' },
          { label: 'Email', value: user?.email ?? '' },
          { label: 'Municipality', value: '' },
        ] },
        { title: 'Ride preferences', rows: [
          { label: 'Saved places', value: 'Not available' },
          { label: 'Favorite drivers', value: 'Not available' },
          { label: 'Language', value: LANGUAGES.find(language => language.id === 'en')?.label ?? 'English' },
          { label: 'Low-data mode', value: 'Not available' },
        ] },
        { title: 'Account support', rows: [
          { label: 'Change password', value: 'Not available' },
          { label: 'Help and SOS contacts', value: 'Available on your ride screen' },
        ] },
      ]}
    >
      <SosControl municipality="Carrascal"/>
    </ProfileLayout>
  );
}

function DriverProfile({ user, onLogout }: Omit<ProfileProps, 'role'>) {
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
      sections={[
        { title: 'Personal information', rows: [
          { label: 'Full name', value: user?.name ?? '' },
          { label: 'Phone number', value: user?.phone ?? '' },
          { label: 'Email', value: user?.email ?? '' },
          { label: 'Municipality', value: '' },
        ] },
        { title: 'Vehicle and verification', rows: [
          { label: 'Plate number', value: profile?.plate_number ?? '' },
          { label: 'Body number', value: profile?.body_number ?? '' },
          { label: 'Vehicle type', value: '' },
          { label: 'License number', value: '' },
          { label: 'TODA', value: profile?.toda_name ?? '' },
          { label: 'ID photo', value: '' },
          { label: 'Approval status', value: profile?.verification_status ?? '' },
        ] },
        { title: 'Driver activity', rows: [
          { label: 'Rating', value: profile?.rating == null ? '' : String(profile.rating) },
          { label: 'Total rides', value: profile?.total_rides == null ? '' : String(profile.total_rides) },
          { label: 'Language', value: LANGUAGES.find(language => language.id === 'en')?.label ?? 'English' },
          { label: 'Change password', value: 'Not available' },
        ] },
      ]}
    >
      {loadError && <p className="profile-layout__error" role="alert">{loadError}</p>}
    </ProfileLayout>
  );
}

function AdminProfile({ user, onLogout }: Omit<ProfileProps, 'role'>) {
  return (
    <ProfileLayout
      role="admin"
      user={user}
      onLogout={onLogout}
      sections={[
        { title: 'Admin account', rows: [
          { label: 'Full name', value: user?.name ?? '' },
          { label: 'Email', value: user?.email ?? '' },
          { label: 'Role and permissions', value: user?.role ?? '' },
          { label: 'Last login', value: '' },
        ] },
        { title: 'Preferences', rows: [
          { label: 'Change password', value: 'Not available' },
          { label: 'Language', value: LANGUAGES.find(language => language.id === 'en')?.label ?? 'English' },
          { label: 'Display preferences', value: 'Not available' },
          { label: 'Settings', value: 'Open Settings from the admin menu' },
        ] },
      ]}
    />
  );
}

export default function Profile(props: ProfileProps) {
  if (props.role === 'admin') return <AdminProfile user={props.user} onLogout={props.onLogout}/>;
  if (props.role === 'driver') return <DriverProfile user={props.user} onLogout={props.onLogout}/>;
  return <PassengerProfile user={props.user} onLogout={props.onLogout}/>;
}
