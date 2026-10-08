export type AppRole = 'passenger' | 'driver' | 'admin';
export type AppScreen = 'home' | 'map' | 'bookings' | 'alerts' | 'profile' | 'driver' | 'admin' | 'drivers';
export type RoleIcon = 'alerts' | 'bookings' | 'driver' | 'home' | 'map' | 'profile';
export const AUTH_PATHS = {
  onboarding: '/onboarding',
  signIn: '/sign-in',
  signUp: '/sign-up',
} as const;

export interface RoleMenuItem {
  id: AppScreen;
  label: string;
  path: string;
  icon?: RoleIcon;
}

interface RoleRouteConfig {
  home: string;
  profile: string;
  alerts: string;
  rideFallback: string;
  paths: Partial<Record<AppScreen, string>>;
  parents: Partial<Record<AppScreen, string>>;
  menu: RoleMenuItem[];
}

export const ROLE_ROUTES: Record<AppRole, RoleRouteConfig> = {
  passenger: {
    home: '/passenger/home',
    profile: '/passenger/profile',
    alerts: '/passenger/alerts',
    rideFallback: '/passenger/rides',
    paths: {
      home: '/passenger/home',
      map: '/passenger/map',
      bookings: '/passenger/rides',
      alerts: '/passenger/alerts',
      profile: '/passenger/profile',
    },
    parents: {
      map: '/passenger/home',
      bookings: '/passenger/home',
      alerts: '/passenger/home',
      profile: '/passenger/home',
    },
    menu: [
      { id: 'home', label: 'Home', path: '/passenger/home', icon: 'home' },
      { id: 'map', label: 'Map', path: '/passenger/map', icon: 'map' },
      { id: 'bookings', label: 'Rides', path: '/passenger/rides', icon: 'bookings' },
      { id: 'alerts', label: 'Alerts', path: '/passenger/alerts', icon: 'alerts' },
      { id: 'profile', label: 'Profile', path: '/passenger/profile', icon: 'profile' },
    ],
  },
  driver: {
    home: '/driver/requests',
    profile: '/driver/profile',
    alerts: '/driver/alerts',
    rideFallback: '/driver/rides',
    paths: {
      driver: '/driver/requests',
      map: '/driver/map',
      bookings: '/driver/rides',
      alerts: '/driver/alerts',
      profile: '/driver/profile',
    },
    parents: {
      map: '/driver/requests',
      bookings: '/driver/requests',
      alerts: '/driver/requests',
      profile: '/driver/requests',
    },
    menu: [
      { id: 'driver', label: 'Requests', path: '/driver/requests', icon: 'driver' },
      { id: 'map', label: 'Map', path: '/driver/map', icon: 'map' },
      { id: 'bookings', label: 'Rides', path: '/driver/rides', icon: 'bookings' },
      { id: 'alerts', label: 'Alerts', path: '/driver/alerts', icon: 'alerts' },
      { id: 'profile', label: 'Profile', path: '/driver/profile', icon: 'profile' },
    ],
  },
  admin: {
    home: '/admin/overview',
    profile: '/admin/profile',
    alerts: '/admin/alerts',
    rideFallback: '/admin/overview',
    paths: {
      admin: '/admin/overview',
      drivers: '/admin/drivers',
      bookings: '/admin/rides',
      alerts: '/admin/alerts',
      profile: '/admin/profile',
    },
    parents: {
      drivers: '/admin/overview',
      bookings: '/admin/overview',
      alerts: '/admin/overview',
      profile: '/admin/overview',
    },
    menu: [
      { id: 'admin', label: 'Overview', path: '/admin/overview', icon: 'home' },
      { id: 'drivers', label: 'Drivers', path: '/admin/drivers', icon: 'driver' },
      { id: 'bookings', label: 'Rides', path: '/admin/rides', icon: 'bookings' },
      { id: 'alerts', label: 'Alerts', path: '/admin/alerts', icon: 'alerts' },
      { id: 'profile', label: 'Profile', path: '/admin/profile', icon: 'profile' },
    ],
  },
};

export function useRoleRoutes(role: AppRole) {
  return ROLE_ROUTES[role];
}

export function resolveRolePath(pathname: string): { role: AppRole; screen: AppScreen } | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  const rideMatch = path.match(/^\/(passenger|driver)\/ride\/(\d+)$/);
  if (rideMatch) return { role: rideMatch[1] as AppRole, screen: 'bookings' };
  for (const role of Object.keys(ROLE_ROUTES) as AppRole[]) {
    const config = ROLE_ROUTES[role];
    const match = Object.entries(config.paths).find(([, routePath]) => routePath === path);
    if (match) return { role, screen: match[0] as AppScreen };
    if (path.startsWith(`/${role}/`)) return { role, screen: role === 'passenger' ? 'home' : role === 'driver' ? 'driver' : 'admin' };
  }
  return null;
}

export function pathForScreen(role: AppRole, screen: AppScreen): string {
  return ROLE_ROUTES[role].paths[screen] ?? ROLE_ROUTES[role].home;
}

export function parentPathForScreen(role: AppRole, screen: AppScreen): string {
  return ROLE_ROUTES[role].parents[screen] ?? ROLE_ROUTES[role].home;
}

export function rideFallbackPath(role: AppRole): string {
  return ROLE_ROUTES[role].rideFallback;
}

export function isExactRoleRoute(role: AppRole, pathname: string): boolean {
  return Object.values(ROLE_ROUTES[role].paths).includes(pathname)
    || ((role === 'passenger' || role === 'driver') && new RegExp(`^/${role}/ride/\\d+$`).test(pathname));
}

export function isPathInRoleTree(role: AppRole, pathname: string): boolean {
  const roleRoot = ROLE_ROUTES[role].home.split('/').slice(0, 2).join('/');
  return pathname === roleRoot || pathname.startsWith(`${roleRoot}/`);
}

export function pathForRide(role: AppRole, rideId: number): string {
  return `/${role}/ride/${rideId}`;
}
