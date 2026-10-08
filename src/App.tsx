import { useEffect, useRef, useState } from 'react';
import { IconAlerts, IconBookings, IconDriver, IconHome, IconLogout, IconMap, IconMenu, IconProfile, IconSettings } from './components/Icons';
import Onboarding from './screens/Onboarding';
import Auth from './screens/Auth';
import PassengerHome from './screens/PassengerHome';
import FindingDriver from './screens/FindingDriver';
import RideTracking from './screens/RideTracking';
import Bookings from './screens/Bookings';
import Alerts from './screens/Alerts';
import Profile from './screens/Profile';
import DriverDashboard from './screens/DriverDashboard';
import AdminDashboard from './screens/AdminDashboard';
import type { AdminTab } from './screens/AdminDashboard';
import Map from './components/Map';
import PublicTrip from './screens/PublicTrip';
import { AppShell, BottomTabBar as SharedBottomTabBar, TopBar } from './components/ui';
import { SAMPLE_ALERTS } from './data';
import { acceptRide, authenticate, createRide, getCurrentUser, signOut, type ApiUser, type AuthPayload, type RideRequest } from './services/api';
import { AUTH_PATHS, isExactRoleRoute, pathForRide, pathForScreen, resolveRolePath, rideFallbackPath, useRoleRoutes, type AppRole, type AppScreen } from './navigation/roleRoutes';
import { useBackNavigation } from './navigation/useBackNavigation';

type Screen = AppScreen;
type AppState = 'onboarding' | 'auth' | 'app';
type RideState = 'idle' | 'finding' | 'tracking';
type UserRole = AppRole;
const MENU_ICONS = {
  alerts: IconAlerts,
  bookings: IconBookings,
  driver: IconDriver,
  home: IconHome,
  map: IconMap,
  profile: IconProfile,
};

function RoleSidebar({ activeScreen, onNavigate, onLogout, role, unreadCount, user }: {
  activeScreen: Screen;
  onNavigate: (s: Screen) => void;
  onLogout: () => void;
  role: UserRole;
  unreadCount: number;
  user: ApiUser | null;
}) {
  const links = useRoleRoutes(role).menu;
  const roleLabel = role === 'admin' ? 'Admin Portal' : role === 'driver' ? 'Driver Portal' : 'Passenger Portal';

  return (
    <aside className="w-56 flex-shrink-0 bg-surface border-r border-border flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="font-bold text-lg text-ink tracking-tight">PASAKJA</h1>
            <p className="text-xs text-ink-soft">{roleLabel}</p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ id, label, icon }) => {
          const Icon = icon ? MENU_ICONS[icon] : undefined;
          const isActive = activeScreen === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 relative ${
                isActive
                  ? 'bg-orange text-white shadow-btn'
                  : 'text-ink-soft hover:bg-warm hover:text-ink'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r bg-orange-dark"/>
              )}
              {Icon && <Icon size={20}/>}
              <span>{label}</span>
              {id === 'alerts' && unreadCount > 0 && (
                <span className={`ml-auto text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${
                  isActive ? 'bg-white/25 text-white' : 'bg-orange text-white'
                }`}>{unreadCount}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Role badge + logout */}
      <div className="px-4 py-4 border-t border-border space-y-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-warm">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-ink">{user?.name ?? 'Account'}</p>
            <p className="text-xs text-ink-soft capitalize">{role}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-ink-soft text-sm hover:bg-danger/10 hover:text-danger transition-colors"
        >
          Log Out
        </button>
      </div>
    </aside>
  );
}

function RoleBottomTabBar({ activeScreen, onNavigate, role, unreadCount }: {
  activeScreen: Screen;
  onNavigate: (s: Screen) => void;
  role: UserRole;
  unreadCount: number;
}) {
  const tabs = useRoleRoutes(role).menu;
  return <SharedBottomTabBar active={activeScreen} onSelect={id => onNavigate(id as Screen)} tabs={tabs.map(({ id, label, icon }) => {
    const Icon = icon ? MENU_ICONS[icon] : undefined;
    return {
      id,
      label,
      icon: Icon ? <Icon size={20}/> : undefined,
      badge: id === 'alerts' && unreadCount > 0 ? <span className="flex h-4 w-4 items-center justify-center rounded-full bg-orange text-xs font-bold text-white">{unreadCount}</span> : undefined,
    };
  })}/>;
}

function RoleTopBar({ title, onBack, onAlerts, onProfile, onLogout, onNavigate, activeScreen, role, unreadCount }: { title: string; onBack?: () => void; onAlerts: () => void; onProfile: () => void; onLogout: () => void; onNavigate: (screen: Screen) => void; activeScreen: Screen; role: UserRole; unreadCount: number }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const menu = useRoleRoutes(role).menu;
  useEffect(() => {
    if (!settingsOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false);
    };
    document.addEventListener('pointerdown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [settingsOpen]);

  return (
    <div className="md:hidden relative"><TopBar title={title}
      leading={role === 'admin' ? <button type="button" onClick={() => setMenuOpen(open => !open)} aria-label="Open navigation menu" aria-expanded={menuOpen} className="app-navigation-bar__action"><IconMenu size={20}/></button> : onBack && <button type="button" onClick={onBack} aria-label="Back" className="app-navigation-bar__action"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m7 7-7-7 7-7"/></svg></button>}
      trailing={<div className={`app-navigation-bar__actions${role === 'admin' ? ' app-navigation-bar__actions--admin' : ''}`}>
        <button type="button" onClick={onAlerts} aria-label="Alerts" className="app-navigation-bar__action"><IconAlerts size={20}/>{unreadCount > 0 && <span className="app-alert-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}</button>
        <button type="button" onClick={onProfile} aria-label="Profile" className="app-navigation-bar__action"><IconProfile size={20}/></button>
        {role === 'admin' && <div className="admin-settings-anchor" ref={settingsRef}>
          <button type="button" onClick={() => setSettingsOpen(open => !open)} aria-label="Admin settings" aria-controls="admin-settings-menu" aria-expanded={settingsOpen} className="app-navigation-bar__action"><IconSettings size={20}/></button>
          {settingsOpen && <div className="admin-settings-menu" id="admin-settings-menu" aria-label="Admin settings">
            <p className="admin-settings-menu__heading">Account</p>
            <button type="button" className="admin-settings-menu__item" onClick={onProfile}><IconProfile size={18}/><span>Account profile</span></button>
            <div className="admin-settings-menu__divider"/>
            <button type="button" className="admin-settings-menu__item admin-settings-menu__logout" onClick={() => { setSettingsOpen(false); onLogout(); }}><IconLogout size={18}/><span>Log out</span></button>
          </div>}
        </div>}
      </div>}/>        {menuOpen && <nav className="admin-mobile-drawer" aria-label="Admin navigation">
          {menu.map(({ id, label, icon }) => {
            const Icon = icon ? MENU_ICONS[icon] : undefined;
            return <button key={id} type="button" className={activeScreen === id ? 'admin-mobile-drawer__item is-active' : 'admin-mobile-drawer__item'} onClick={() => { onNavigate(id); setMenuOpen(false); }}>
              {Icon && <Icon size={20}/>}<span>{label}</span>{id === 'alerts' && unreadCount > 0 && <span className="admin-mobile-drawer__badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>;
        })}
        </nav>}
      </div>
  );
}

function ScreenContent({ screen, role, user, rideState, rideId, adminTab, onAdminTabChange, onPassengerBookingStart, onDriverAcceptRide, onRideFound, onComplete, onLogout }: {
  screen: Screen;
  role: UserRole;
  user: ApiUser | null;
  rideState: RideState;
  rideId: number | null;
  adminTab: AdminTab;
  onAdminTabChange: (tab: AdminTab) => void;
  onPassengerBookingStart: (ride: RideRequest) => Promise<void>;
  onDriverAcceptRide: (rideId: number) => Promise<void>;
  onRideFound: () => void;
  onComplete: () => void;
  onLogout: () => void;
}) {
  if (rideState === 'finding') return <FindingDriver rideId={rideId} onFound={onRideFound} onCancel={onComplete}/>;
  if (rideState === 'tracking') return <RideTracking rideId={rideId} onComplete={onComplete} isDriver={role === 'driver'}/>;

  switch (screen) {
    case 'home': return <PassengerHome onBookingStart={onPassengerBookingStart}/>;
    case 'map': return (
      <div className="flex-1 p-4">
        <Map activeMunicipality="carrascal" showRoute={false} className="h-full"/>
      </div>
    );
    case 'bookings': return <Bookings/>;
    case 'alerts': return <Alerts role={role}/>;
    case 'profile': return <Profile role={role} user={user} onLogout={onLogout}/>;
    case 'driver': return <DriverDashboard onAcceptRide={onDriverAcceptRide}/>;
    case 'admin': return <AdminDashboard initialTab={adminTab} onTabChange={onAdminTabChange}/>;
    case 'drivers': return <AdminDashboard initialTab="drivers" onTabChange={onAdminTabChange}/>;
    default: return <PassengerHome onBookingStart={onPassengerBookingStart}/>;
  }
}

export default function App() {
  const publicTripMatch = window.location.pathname.match(/(?:^|\/)trip\/([a-f0-9]{64})\/?$/i);
  if (publicTripMatch) return <PublicTrip token={publicTripMatch[1]}/>;

  const [appState, setAppState] = useState<AppState>(() => window.location.pathname === AUTH_PATHS.signIn || window.location.pathname === AUTH_PATHS.signUp ? 'auth' : 'onboarding');
  const [activeScreen, setActiveScreen] = useState<Screen>('home');
  const [adminTab, setAdminTab] = useState<AdminTab>('overview');
  const [rideState, setRideState] = useState<RideState>('idle');
  const [role, setRole] = useState<UserRole>('passenger');
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);
  const [activeRideId, setActiveRideId] = useState<number | null>(null);
  const [authNotice, setAuthNotice] = useState('');
  const navigateToPath = (destination: string, screen: Screen, replace = false) => {
    const historyState = { role, routePath: destination, previousPath: window.history.state?.routePath };
    if (replace) window.history.replaceState(historyState, '', destination);
    else if (window.location.pathname !== destination) window.history.pushState(historyState, '', destination);
    setActiveScreen(screen);
    setRideState('idle');
  };

  useEffect(() => {
    let mounted = true;
    const handleExpired = () => {
      setAuthNotice('Your session expired. Please sign in again.');
      setCurrentUser(null);
      setRideState('idle');
      window.history.replaceState({ role: null, routePath: AUTH_PATHS.signIn }, '', AUTH_PATHS.signIn);
      setAppState('auth');
    };
    window.addEventListener('pasakja:auth-expired', handleExpired);
    getCurrentUser().then(user => {
      if (!mounted) return;
      if (!user) {
        if (resolveRolePath(window.location.pathname)) {
          window.history.replaceState({ role: null, routePath: AUTH_PATHS.signIn }, '', AUTH_PATHS.signIn);
          setAppState('auth');
        }
        return;
      }
      setCurrentUser(user);
      setRole(user.role);
      const found = resolveRolePath(window.location.pathname);
      const screen = found?.role === user.role && isExactRoleRoute(user.role, window.location.pathname)
        ? found.screen
        : user.role === 'admin' ? 'admin' : user.role === 'driver' ? 'driver' : 'home';
      const rideId = window.location.pathname.match(/^\/(?:passenger|driver)\/ride\/(\d+)$/)?.[1];
      const activeScreen = rideId ? 'bookings' : screen;
      const destination = isExactRoleRoute(user.role, window.location.pathname) && found?.role === user.role
        ? window.location.pathname
        : pathForScreen(user.role, activeScreen);
      window.history.replaceState({ role: user.role, routePath: destination }, '', destination);
      setActiveScreen(activeScreen);
      if (rideId) {
        setActiveRideId(Number(rideId));
        setRideState('tracking');
      }
      setAppState('app');
    }).catch(error => {
      if (!mounted) return;
      setAuthNotice(error instanceof Error ? error.message : 'Could not verify your session. Please sign in again.');
      window.history.replaceState({ role: null, routePath: AUTH_PATHS.signIn }, '', AUTH_PATHS.signIn);
      setAppState('auth');
    });
    return () => { mounted = false; window.removeEventListener('pasakja:auth-expired', handleExpired); };
  }, []);

  const unreadCount = SAMPLE_ALERTS.filter(a => !a.isRead).length;
  const navigateScreen = (screen: Screen, replace = false) => {
    navigateToPath(pathForScreen(role, screen), screen, replace);
  };

  const handleAuth = async (_r: 'passenger' | 'driver', credentials: AuthPayload) => {
    const user: ApiUser = await authenticate(credentials);
    setRole(user.role);
    setCurrentUser(user);
    setAuthNotice('');
    const homeScreen = user.role === 'admin' ? 'admin' : user.role === 'driver' ? 'driver' : 'home';
    setActiveScreen(homeScreen);
    window.history.replaceState({ role: user.role, routePath: pathForScreen(user.role, homeScreen) }, '', pathForScreen(user.role, homeScreen));
    setAppState('app');
  };

  const handleLogout = async () => {
    if (!window.confirm('Log out of PASAKJA?')) return;
    try {
      await signOut();
    } catch (error) {
      console.error('Could not sign out cleanly.', error);
    } finally {
      setCurrentUser(null);
      setAppState('auth');
      setRideState('idle');
      setActiveScreen('home');
      window.history.replaceState({ role: null, routePath: AUTH_PATHS.signIn }, '', AUTH_PATHS.signIn);
    }
  };

  const handlePassengerBookingStart = async (ride: RideRequest) => {
    const created = await createRide(ride);
    setActiveRideId(created.id);
    setRideState('finding');
    navigateToPath(pathForRide(role, created.id), 'bookings', false);
  };
  const handleDriverAcceptRide = async (rideId: number) => {
    await acceptRide(rideId);
    setActiveRideId(rideId);
    setRideState('tracking');
    navigateToPath(pathForRide(role, rideId), 'bookings', false);
  };
  const handleRideFound = () => setRideState('tracking');
  const handleRideComplete = () => {
    setRideState('idle');
    setActiveRideId(null);
    navigateScreen(role === 'admin' ? 'admin' : 'bookings', true);
  };
  const backToHome = useBackNavigation(
    role,
    rideFallbackPath(role),
    () => {
      setRideState('idle');
      setActiveScreen(role === 'admin' ? 'admin' : 'bookings');
    },
  );

  useEffect(() => {
    const handlePopState = () => {
      if (appState !== 'app') {
        const authPath = appState === 'onboarding' ? AUTH_PATHS.onboarding : AUTH_PATHS.signIn;
        window.history.replaceState({ role: null, routePath: authPath }, '', authPath);
        return;
      }
      const route = resolveRolePath(window.location.pathname);
      if (!route || route.role !== role) {
        const home = role === 'admin' ? 'admin' : role === 'driver' ? 'driver' : 'home';
        const destination = pathForScreen(role, home);
        window.history.replaceState({ role, routePath: destination }, '', destination);
        setActiveScreen(home);
        return;
      }
      const isExact = isExactRoleRoute(role, window.location.pathname);
      if (!isExact) {
        const home = role === 'admin' ? 'admin' : role === 'driver' ? 'driver' : 'home';
        window.history.replaceState({ role, routePath: pathForScreen(role, home) }, '', pathForScreen(role, home));
        setActiveScreen(home);
      } else {
        const rideId = window.location.pathname.match(/^\/(?:passenger|driver)\/ride\/(\d+)$/)?.[1];
        setActiveScreen(rideId ? 'bookings' : route.screen);
        setRideState(rideId ? 'tracking' : 'idle');
        setActiveRideId(rideId ? Number(rideId) : null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [appState, role]);

  if (appState === 'onboarding') {
    return <Onboarding onComplete={() => {
      window.history.replaceState({ role: null, routePath: AUTH_PATHS.signIn }, '', AUTH_PATHS.signIn);
      setAppState('auth');
    }}/>;
  }
  if (appState === 'auth') {
    return <Auth
      onAuth={handleAuth}
      notice={authNotice}
      initialMode={window.location.pathname === AUTH_PATHS.signUp ? 'register' : 'login'}
      onModeChange={mode => {
        const path = mode === 'register' ? AUTH_PATHS.signUp : AUTH_PATHS.signIn;
        window.history.replaceState({ role: null, routePath: path }, '', path);
      }}
      onBack={() => {
        window.history.replaceState({ role: null, routePath: AUTH_PATHS.onboarding }, '', AUTH_PATHS.onboarding);
        setAppState('onboarding');
      }}
    />;
  }

  return (
    <AppShell
      navigation={<div className="hidden md:flex">
        <RoleSidebar
          activeScreen={activeScreen}
          onNavigate={navigateScreen}
          onLogout={handleLogout}
          role={role}
          unreadCount={unreadCount}
          user={currentUser}
        />
      </div>}
      header={<>
        {/* Mobile header */}
        <RoleTopBar
          title={rideState === 'idle' ? ({ home: 'Home', map: 'Map', bookings: 'Rides', alerts: 'Alerts', profile: 'Profile', driver: 'Requests', admin: 'Overview', drivers: 'Drivers' } as Record<Screen, string>)[activeScreen] : rideState === 'finding' ? 'Finding a ride' : 'Ride details'}
          onBack={rideState !== 'idle' ? backToHome : undefined}
          onAlerts={() => navigateScreen('alerts')}
          onProfile={() => navigateScreen('profile')}
          onLogout={handleLogout}
          onNavigate={navigateScreen}
          activeScreen={activeScreen}
          role={role}
          unreadCount={unreadCount}
        />

        {/* Desktop location bar */}
        <div className="hidden md:flex items-center justify-between px-6 py-3 border-b border-border bg-surface">
          <div className="flex flex-col">
            <h1 className="app-desktop-header__title">{rideState === 'idle' ? ({ home: 'Home', map: 'Map', bookings: 'Rides', alerts: 'Alerts', profile: 'Profile', driver: 'Requests', admin: 'Overview', drivers: 'Drivers' } as Record<Screen, string>)[activeScreen] : rideState === 'finding' ? 'Finding a ride' : 'Ride details'}</h1>
            <span className="text-xs text-ink-soft">CarCanMadCarLan · Surigao del Sur</span>
          </div>
          <div className="app-navigation-bar__actions">
            <button type="button" onClick={() => navigateScreen('alerts')} aria-label="Alerts" className="app-navigation-bar__action"><IconAlerts size={20}/>{unreadCount > 0 && <span className="app-alert-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}</button>
            <button type="button" onClick={() => navigateScreen('profile')} aria-label="Profile" className="app-navigation-bar__action"><IconProfile size={20}/></button>
          </div>
        </div>
      </>}
      footer={rideState === 'idle' && role !== 'admin' ? (
        <div className="md:hidden">
          <RoleBottomTabBar activeScreen={activeScreen} onNavigate={navigateScreen} role={role} unreadCount={unreadCount}/>
        </div>
      ) : undefined}
    >
      <div className="flex-1 flex flex-col overflow-hidden relative">
          <ScreenContent
            screen={activeScreen}
            role={role}
            user={currentUser}
            rideState={rideState}
            rideId={activeRideId}
            adminTab={adminTab}
            onAdminTabChange={setAdminTab}
            onPassengerBookingStart={handlePassengerBookingStart}
            onDriverAcceptRide={handleDriverAcceptRide}
            onRideFound={handleRideFound}
            onComplete={handleRideComplete}
            onLogout={handleLogout}
          />
      </div>
    </AppShell>
  );
}
