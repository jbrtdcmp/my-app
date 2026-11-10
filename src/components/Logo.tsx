import { useId } from 'react';

// PASAKJA logo: the letter P drawn as a tricycle. The bowl of the P is the
// covered cab with its windshield and window, the foot of the P is a wheel,
// a second wheel sits under the cab, and the wave below is the coastal road
// that links the five towns.
//
// "color" is the orange app tile with a white tricycle-P. "inverse" is a white
// tile with an orange tricycle-P, for orange backgrounds.

const COLORS = {
  color: { ink: '#FFFFFF', accent: '#C9581E', road: '#FFFFFF', roadOpacity: 0.6 },
  inverse: { ink: '#BF531A', accent: '#FFFFFF', road: '#BF531A', roadOpacity: 0.45 },
} as const;

export function LogoMark({ width = 40, variant = 'color', className = '', title }: {
  width?: number;
  variant?: keyof typeof COLORS;
  className?: string;
  title?: string;
}) {
  // A unique gradient id per instance, so a hidden copy (for example the
  // desktop sidebar on a phone) never breaks the visible one.
  const gradientId = `pasakja-tile-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const colors = COLORS[variant];
  return (
    <svg width={width} height={width} viewBox="0 0 64 64" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false">
      {variant === 'color' && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F0924A"/>
            <stop offset="1" stopColor="#B84E17"/>
          </linearGradient>
        </defs>
      )}
      <rect width="64" height="64" rx="18" fill={variant === 'color' ? `url(#${gradientId})` : '#FFFFFF'}/>
      <path fill={colors.ink} d="M17 19a5 5 0 0 1 5-5h15.6a5 5 0 0 1 4.6 3l4.7 10.9A3.6 3.6 0 0 1 43.6 33H26v8h-9Z"/>
      <path fill={colors.accent} d="M26 21h9.4a1.6 1.6 0 0 1 1.5 1l2.3 5.4A1.2 1.2 0 0 1 38.1 29H26Z"/>
      <circle cx="21.5" cy="44" r="6.5" fill={colors.ink}/>
      <circle cx="21.5" cy="44" r="2.6" fill={colors.accent}/>
      <circle cx="41" cy="40" r="5.4" fill={colors.ink}/>
      <circle cx="41" cy="40" r="2.1" fill={colors.accent}/>
      <path d="M8 55c6-3 11-3 16 0s10 3 16 0 10-3 16 0" stroke={colors.road} strokeOpacity={colors.roadOpacity} strokeWidth="2.8" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

// Mark plus the PASAKJA wordmark. "light" is for orange or dark backgrounds.
export function Logo({ width = 40, tone = 'dark', variant = 'color', tagline, className = '' }: {
  width?: number;
  tone?: 'dark' | 'light';
  variant?: keyof typeof COLORS;
  tagline?: string;
  className?: string;
}) {
  return (
    <span className={`brand-lockup${tone === 'light' ? ' brand-lockup--light' : ''} ${className}`}>
      <LogoMark width={width} variant={variant}/>
      <span className="brand-lockup__text">
        <span className="brand-lockup__name">PASAKJA</span>
        {tagline && <span className="brand-lockup__tagline">{tagline}</span>}
      </span>
    </span>
  );
}
