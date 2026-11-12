import type { ReactNode } from 'react';
import { IconAlerts, IconCheckCircle, IconDriver, IconHome, IconKey, IconLocation, IconNavigation, IconPackage, IconShield, IconStar, IconWeather, IconX } from './Icons';
import type { AlertType } from '../services/api';

// Community alert types an admin can choose, in the order they appear.
export const ALERT_TYPE_CHOICES: { id: AlertType; label: string; icon: ReactNode }[] = [
  { id: 'community', label: 'Community', icon: <IconHome size={16}/> },
  { id: 'weather', label: 'Weather', icon: <IconWeather size={16}/> },
  { id: 'market', label: 'Market', icon: <IconPackage size={16}/> },
  { id: 'fiesta', label: 'Fiesta', icon: <IconStar size={16}/> },
  { id: 'port', label: 'Port', icon: <IconLocation size={16}/> },
];

// Icon and colour tone for any feed item: community alerts and personal notices.
const PRESENTATION: Record<string, { icon: (size: number) => ReactNode; tone: 'orange' | 'green' | 'red' | 'blue' }> = {
  community: { icon: size => <IconHome size={size}/>, tone: 'orange' },
  weather: { icon: size => <IconWeather size={size}/>, tone: 'blue' },
  market: { icon: size => <IconPackage size={size}/>, tone: 'orange' },
  fiesta: { icon: size => <IconStar size={size}/>, tone: 'orange' },
  port: { icon: size => <IconLocation size={size}/>, tone: 'blue' },
  ride_accepted: { icon: size => <IconDriver size={size}/>, tone: 'green' },
  ride_arriving: { icon: size => <IconNavigation size={size}/>, tone: 'green' },
  ride_started: { icon: size => <IconDriver size={size}/>, tone: 'green' },
  ride_completed: { icon: size => <IconCheckCircle size={size}/>, tone: 'green' },
  ride_cancelled: { icon: size => <IconX size={size}/>, tone: 'red' },
  sos: { icon: size => <IconShield size={size}/>, tone: 'red' },
  password_reset: { icon: size => <IconKey size={size}/>, tone: 'orange' },
};

export function alertPresentation(type: string, size: 16 | 20 = 20) {
  const found = PRESENTATION[type];
  return { icon: found ? found.icon(size) : <IconAlerts size={size}/>, tone: found?.tone ?? 'orange' };
}
