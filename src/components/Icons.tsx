import type { ReactNode } from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

// Every icon shares one 24px frame with 2px rounded strokes in currentColor,
// so icons match in weight and take their colour from the surrounding text.
function Icon({ size = 20, className = '', children }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={`app-icon ${className}`} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export function IconChart({ size = 24, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M8 17v-4"/><path d="M13 17V8"/><path d="M18 17V5"/></Icon>;
}

export function IconCheck({ size = 20, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="M20 6 9 17l-5-5"/></Icon>;
}

export function IconCheckCircle({ size = 24, className = '' }: IconProps) {
  return <Icon size={size} className={className}><circle cx="12" cy="12" r="9.5"/><path d="m8.5 12 2.5 2.5 4.5-5"/></Icon>;
}

export function IconAlertCircle({ size = 18, className = '' }: IconProps) {
  return <Icon size={size} className={className}><circle cx="12" cy="12" r="9.5"/><path d="M12 7.5v5"/><path d="M12 16.5h.01"/></Icon>;
}

export function IconPackage({ size = 20, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="M11 21.7a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7Z"/><path d="M12 22V12"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="m7.5 4.3 9 5.1"/></Icon>;
}

export function IconCamera({ size = 24, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z"/><circle cx="12" cy="13" r="3.5"/></Icon>;
}

export function IconArrowLeft({ size = 20, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></Icon>;
}

export function IconArrowRight({ size = 20, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></Icon>;
}

export function IconMegaphone({ size = 18, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="m3 11 18-5v12L3 14v-3Z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></Icon>;
}

export function IconFile({ size = 18, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h8"/><path d="M8 17h8"/></Icon>;
}

export function IconHome({ size = 24, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="M15 21v-7a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v7"/><path d="M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></Icon>;
}

export function IconMap({ size = 24, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="M14.1 5.6a2 2 0 0 0 1.8 0l3.7-1.9A1 1 0 0 1 21 4.6v12.8a1 1 0 0 1-.6.9l-4.5 2.3a2 2 0 0 1-1.8 0l-4.2-2.1a2 2 0 0 0-1.8 0l-3.7 1.9A1 1 0 0 1 3 19.4V6.6a1 1 0 0 1 .6-.9l4.5-2.3a2 2 0 0 1 1.8 0Z"/><path d="M15 5.8v15"/><path d="M9 3.2v15"/></Icon>;
}

// Ride history: a clock running backwards.
export function IconBookings({ size = 24, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="M3 12a9 9 0 1 0 9-9 9.8 9.8 0 0 0-6.7 2.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3.5 2"/></Icon>;
}

export function IconAlerts({ size = 24, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="M10.3 21a2 2 0 0 0 3.4 0"/><path d="M3.3 15.3A1 1 0 0 0 4 17h16a1 1 0 0 0 .7-1.7C19.4 14 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.4 6-2.7 7.3"/></Icon>;
}

export function IconProfile({ size = 24, className = '' }: IconProps) {
  return <Icon size={size} className={className}><circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="10" r="3.5"/><path d="M6.2 18.6a6.5 6.5 0 0 1 11.6 0"/></Icon>;
}

export function IconLocation({ size = 20, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></Icon>;
}

export function IconStar({ size = 16, className = '', filled = false }: IconProps & { filled?: boolean }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`app-icon ${className}`} aria-hidden="true" focusable="false"><path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.5 6.3-.9Z"/></svg>;
}

export function IconSearch({ size = 20, className = '' }: IconProps) {
  return <Icon size={size} className={className}><circle cx="11" cy="11" r="7.5"/><path d="m20.5 20.5-4.2-4.2"/></Icon>;
}

export function IconChevronDown({ size = 20, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="m6 9 6 6 6-6"/></Icon>;
}

export function IconX({ size = 20, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></Icon>;
}

export function IconPhone({ size = 20, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2.1Z"/></Icon>;
}

export function IconShare({ size = 20, className = '' }: IconProps) {
  return <Icon size={size} className={className}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></Icon>;
}

export function IconSignal({ size = 20, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="M3 20h.01"/><path d="M8 20v-4"/><path d="M13 20v-8"/><path d="M18 20V8" opacity=".35"/></Icon>;
}

export function IconWallet({ size = 20, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></Icon>;
}

// Verified badge used for TODA-approved drivers.
export function IconTODA({ size = 20, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="M3.9 8.6a4 4 0 0 1 4.7-4.7 4 4 0 0 1 6.8 0 4 4 0 0 1 4.7 4.7 4 4 0 0 1 0 6.8 4 4 0 0 1-4.7 4.7 4 4 0 0 1-6.8 0 4 4 0 0 1-4.7-4.7 4 4 0 0 1 0-6.8Z"/><path d="m9 12 2 2 4-4"/></Icon>;
}

export function IconLogout({ size = 20, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></Icon>;
}

export function IconWeather({ size = 20, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z"/></Icon>;
}

export function IconAdmin({ size = 20, className = '' }: IconProps) {
  return <Icon size={size} className={className}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></Icon>;
}

// A covered three-wheeler seen from the side, simple enough to read at 16px.
export function IconDriver({ size = 20, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="M4 16.5V10a5 5 0 0 1 5-5h4.2a2 2 0 0 1 1.8 1.1L18 12h1.5a1.5 1.5 0 0 1 1.5 1.5v3"/><path d="M7.5 12V9.5a1 1 0 0 1 1-1H13l1.8 3.5Z"/><path d="M4 16.5h1.5"/><path d="M10.5 16.5h3"/><path d="M18.5 16.5H21"/><circle cx="8" cy="16.5" r="2.5"/><circle cx="16" cy="16.5" r="2.5"/></Icon>;
}

export function IconShield({ size = 20, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.7 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z"/><path d="m9 12 2 2 4-4"/></Icon>;
}

export function IconClock({ size = 20, className = '' }: IconProps) {
  return <Icon size={size} className={className}><circle cx="12" cy="12" r="9.5"/><path d="M12 7v5l3 2"/></Icon>;
}

export function IconUsers({ size = 20, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/></Icon>;
}

export function IconKey({ size = 20, className = '' }: IconProps) {
  return <Icon size={size} className={className}><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></Icon>;
}

export function IconNavigation({ size = 20, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="m3 11 19-9-9 19-2-8Z"/></Icon>;
}

export function IconTag({ size = 20, className = '' }: IconProps) {
  return <Icon size={size} className={className}><path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4Z"/><circle cx="7.5" cy="7.5" r="1"/></Icon>;
}
