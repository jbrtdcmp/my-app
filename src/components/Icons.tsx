interface IconProps {
  className?: string;
  size?: number;
}

export function IconChart({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 20V5M4 20H21M8 17v-5M13 17V8M18 17V4"
        stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconCheck({ size = 20, className = '' }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}><path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export function IconCheckCircle({ size = 24, className = '' }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/><path d="m8 12 2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export function IconAlertCircle({ size = 18, className = '' }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7.5v5M12 16.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
}

export function IconPackage({ size = 20, className = '' }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}><path d="m4 7 8-4 8 4v10l-8 4-8-4V7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="m4.5 7.3 7.5 4 7.5-4M12 11.5V21M8 5l8 4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>;
}

export function IconCalendar({ size = 20, className = '' }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
}

export function IconCamera({ size = 24, className = '' }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}><path d="M4 8h3l1.5-2h7L17 8h3v11H4V8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.7"/></svg>;
}

export function IconBuilding({ size = 20, className = '' }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}><path d="M4 21V5l8-2v18M12 9h8v12M2 21h20M7 7h2M7 11h2M7 15h2M15 12h2M15 16h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export function IconArrowDown({ size = 18, className = '' }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}><path d="M12 4v15M6 13l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export function IconArrowUpDown({ size = 16, className = '' }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}><path d="m7 7 3-3 3 3M10 4v16m7-3-3 3-3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export function IconMegaphone({ size = 18, className = '' }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}><path d="M4 13V9a2 2 0 0 1 2-2h3l9-4v17l-9-4H6a2 2 0 0 1-2-2ZM9 16l2 5h3l-2-6M18 8l3-2M18 14l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export function IconFile({ size = 18, className = '' }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}><path d="M6 3h8l5 5v13H6V3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M14 3v6h5M9 13h7M9 17h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
}

export function IconHome({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M3 9.5L12 3L21 9.5V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V9.5Z"
        stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconMap({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M3 5L9 3L15 6L21 3V19L15 22L9 19L3 22V5Z"
        stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 3V19M15 6V22" stroke="currentColor" strokeWidth="1.75"/>
    </svg>
  );
}

export function IconBookings({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="1.75"/>
      <path d="M3 9H21M8 2V6M16 2V6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M7 13H12M7 17H16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  );
}

export function IconAlerts({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M5 10C5 6.69 7.69 4 11 4C14.31 4 17 6.69 17 10V15L19 17H3L5 15V10Z"
        stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 17C9 18.1 9.9 19 11 19C12.1 19 13 18.1 13 17" stroke="currentColor" strokeWidth="1.75"/>
    </svg>
  );
}

export function IconProfile({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.75"/>
      <path d="M4 20C4 16.69 7.58 14 12 14C16.42 14 20 16.69 20 20"
        stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  );
}

export function IconLocation({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M10 2C7.24 2 5 4.24 5 7C5 11 10 18 10 18C10 18 15 11 15 7C15 4.24 12.76 2 10 2Z"
        stroke="currentColor" strokeWidth="1.8" fill="none"/>
      <circle cx="10" cy="7" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    </svg>
  );
}

export function IconDestination({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="3" y="3" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.8"/>
      <rect x="7" y="7" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    </svg>
  );
}

export function IconStar({ size = 16, className = '', filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 2L9.65 5.92L14 6.36L10.8 9.24L11.77 13.5L8 11.35L4.23 13.5L5.2 9.24L2 6.36L6.35 5.92L8 2Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconSearch({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.75"/>
      <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  );
}

export function IconChevronDown({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconChevronRight({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconX({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  );
}

export function IconPhone({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M6.5 3H4C3.45 3 3 3.45 3 4C3 12.28 9.72 19 18 19C18.55 19 19 18.55 19 18V15.5C19 14.95 18.55 14.5 18 14.5C16.76 14.5 15.56 14.28 14.46 13.88C14.22 13.8 13.96 13.85 13.77 14.04L11.82 15.99C9.18 14.64 7.36 12.82 6.01 10.18L7.96 8.23C8.15 8.04 8.2 7.78 8.12 7.54C7.72 6.44 7.5 5.24 7.5 4C7.5 3.45 7.05 3 6.5 3Z"
        stroke="currentColor" strokeWidth="1.8" fill="none"/>
    </svg>
  );
}

export function IconShare({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <circle cx="16" cy="4" r="2" stroke="currentColor" strokeWidth="1.8"/>
      <circle cx="4" cy="10" r="2" stroke="currentColor" strokeWidth="1.8"/>
      <circle cx="16" cy="16" r="2" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M6 9L14 5M6 11L14 15" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  );
}

export function IconSignal({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M3 17V13M7 17V9M11 17V5M15 17V1" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" opacity="0.4"/>
      <path d="M3 17V13M7 17V9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  );
}

export function IconWallet({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="2" y="5" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M2 9H18" stroke="currentColor" strokeWidth="1.8"/>
      <circle cx="15" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.6"/>
    </svg>
  );
}

export function IconTODA({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" fill="none" className={className}>
      <path d="M9 1L10.5 5.5H15.5L11.5 8L13 12.5L9 10L5 12.5L6.5 8L2.5 5.5H7.5L9 1Z"
        stroke="#D86F2F" strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M6.5 9L8 10.5L11.5 7" stroke="#D86F2F" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconPickupPin({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 40" fill="none" className={className}>
      <path d="M16 36S27 24 27 14A11 11 0 1 0 5 14C5 24 16 36 16 36Z" stroke="#D86F2F" strokeWidth="1.8"/>
      <circle cx="16" cy="14" r="4" stroke="#D86F2F" strokeWidth="1.8"/>
    </svg>
  );
}

export function IconDropPin({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 40" fill="none" className={className}>
      <path d="M16 36S27 24 27 14A11 11 0 1 0 5 14C5 24 16 36 16 36Z" stroke="#26211E" strokeWidth="1.8"/>
      <circle cx="16" cy="14" r="4" stroke="#26211E" strokeWidth="1.8"/>
    </svg>
  );
}

export function IconMenu({ size = 24, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M3 6H21M3 12H21M3 18H21" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  );
}

export function IconLogout({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M8 3H4C3.45 3 3 3.45 3 4V16C3 16.55 3.45 17 4 17H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M13 7L17 10M17 10L13 13M17 10H7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconSettings({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M9.7 3h4.6l.7 2.2 1.5.9 2.2-.7 2.3 4-1.6 1.6v1.8l1.6 1.6-2.3 4-2.2-.7-1.5.9-.7 2.2H9.7L9 18.6l-1.5-.9-2.2.7-2.3-4 1.6-1.6V11l-1.6-1.6 2.3-4 2.2.7L9 5.2 9.7 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  );
}

export function IconWeather({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M5 14C3.34 14 2 12.66 2 11C2 9.34 3.34 8 5 8C5.19 8 5.38 8.02 5.56 8.05C6.2 6.27 7.95 5 10 5C12.76 5 15 7.24 15 10C16.66 10 18 11.34 18 13C18 14.66 16.66 16 15 16H5C5 16 5 14 5 14Z"
        stroke="currentColor" strokeWidth="1.8" fill="none"/>
    </svg>
  );
}

export function IconAdmin({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="2" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
      <rect x="11" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
      <rect x="2" y="12" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
      <rect x="11" y="12" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  );
}

export function IconDriver({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M4 18C4 14.69 6.69 12 10 12C13.31 12 16 14.69 16 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
