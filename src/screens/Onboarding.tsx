import { useRef, useState, type ReactNode } from 'react';
import { IconArrowRight, IconDriver, IconLocation, IconShield, IconTag } from '../components/Icons';

interface OnboardingProps {
  onComplete: () => void;
}

const SLIDES: { eyebrow: string; eyebrowIcon: ReactNode; title: string; description: string; art: ReactNode }[] = [
  {
    eyebrow: 'Book in seconds',
    eyebrowIcon: <IconLocation size={14}/>,
    title: 'Your tricycle, just a tap away',
    description: 'Book a TODA-verified tricycle anywhere in Carrascal, Cantilan, Madrid, Carmen and Lanuza.',
    art: <BookingArt/>,
  },
  {
    eyebrow: 'Fixed fares',
    eyebrowIcon: <IconTag size={14}/>,
    title: 'Know your fare before you ride',
    description: 'See the full fare up front: a base fare plus distance. No surge pricing, and you pay the driver in cash.',
    art: <FareArt/>,
  },
  {
    eyebrow: 'Ride safe',
    eyebrowIcon: <IconShield size={14}/>,
    title: 'Verified drivers, shared trips',
    description: 'Every driver is TODA-verified, with plate and body number shown. Share your live trip with someone you trust.',
    art: <SafetyArt/>,
  },
];

function Backdrop() {
  return <>
    <circle cx="160" cy="150" r="132" fill="#FFF4EC"/>
    <circle cx="160" cy="150" r="98" fill="#FCE9DC"/>
    <circle cx="44" cy="64" r="6" fill="#F2A65A"/>
    <circle cx="282" cy="236" r="8" fill="#F2A65A" opacity=".6"/>
    <circle cx="276" cy="58" r="4" fill="#D86F2F" opacity=".5"/>
  </>;
}

// A side-view tricycle: covered sidecar, motorcycle front, two wheels.
function Tricycle({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="68" cy="96" rx="70" ry="6" fill="#1E1A17" opacity=".12"/>
      <rect x="2" y="12" width="92" height="11" rx="5.5" fill="#A94C1B"/>
      <path d="M8 74V34a12 12 0 0 1 12-12h58l14 28v24Z" fill="#D86F2F"/>
      <path d="M22 30h48l10 20H22Z" fill="#FFF4EC"/>
      <path d="M46 30v20" stroke="#D86F2F" strokeWidth="4"/>
      <path d="M90 50h26l14 24H90Z" fill="#BF531A"/>
      <path d="M118 34l10 44" stroke="#1E1A17" strokeWidth="5" strokeLinecap="round"/>
      <path d="M112 34h14" stroke="#1E1A17" strokeWidth="5" strokeLinecap="round"/>
      <circle cx="130" cy="52" r="5" fill="#F2A65A"/>
      <rect x="6" y="68" width="124" height="9" rx="4.5" fill="#A94C1B"/>
      <circle cx="38" cy="80" r="15" fill="#1E1A17"/>
      <circle cx="38" cy="80" r="6" fill="#FFF4EC"/>
      <circle cx="122" cy="80" r="15" fill="#1E1A17"/>
      <circle cx="122" cy="80" r="6" fill="#FFF4EC"/>
    </g>
  );
}

function BookingArt() {
  return (
    <svg viewBox="0 0 320 300" role="img" aria-label="A phone showing a booked tricycle route">
      <Backdrop/>
      <rect x="112" y="30" width="116" height="216" rx="24" fill="#1E1A17"/>
      <rect x="118" y="38" width="104" height="200" rx="19" fill="#fff"/>
      <path d="M118 57a19 19 0 0 1 19-19h66a19 19 0 0 1 19 19v99H118Z" fill="#E9EFEC"/>
      <path d="M118 128c30-12 52 8 104-24" stroke="#fff" strokeWidth="9" fill="none"/>
      <path d="M160 38v118" stroke="#fff" strokeWidth="9"/>
      <path d="M140 140c18-22 30-40 52-62" stroke="#BF531A" strokeWidth="3" strokeDasharray="6 5" strokeLinecap="round" fill="none"/>
      <circle cx="140" cy="140" r="7" fill="#2F7A5A" stroke="#fff" strokeWidth="3"/>
      <path d="M192 52c-8 0-14 6-14 14 0 10 14 22 14 22s14-12 14-22c0-8-6-14-14-14Z" fill="#BF531A"/>
      <circle cx="192" cy="66" r="5" fill="#fff"/>
      <rect x="128" y="168" width="84" height="30" rx="10" fill="#FFF4EC"/>
      <rect x="136" y="176" width="44" height="5" rx="2.5" fill="#D86F2F"/>
      <rect x="136" y="186" width="62" height="5" rx="2.5" fill="#E4DCD4"/>
      <rect x="128" y="206" width="84" height="22" rx="11" fill="#BF531A"/>
      <rect x="150" y="215" width="40" height="4" rx="2" fill="#fff"/>
      <g>
        <rect x="214" y="96" width="88" height="34" rx="17" fill="#fff" stroke="#ECE6E0"/>
        <circle cx="232" cy="113" r="9" fill="#E8F5EE"/>
        <path d="M232 108v5l3 2" stroke="#2F7A5A" strokeWidth="2" strokeLinecap="round" fill="none"/>
        <text x="246" y="117" fontSize="11" fontWeight="700" fill="#1E1A17">2 min away</text>
      </g>
      <Tricycle x={22} y={176} scale={0.92}/>
    </svg>
  );
}

// Sample 5 km fare using the seeded ₱30 base (includes 1 km) + ₱5/km.
function FareArt() {
  return (
    <svg viewBox="0 0 320 300" role="img" aria-label="A sample fare receipt: ₱30 base including 1 km, ₱20 for the next 4 km, ₱50 total">
      <Backdrop/>
      <rect x="78" y="40" width="164" height="212" rx="20" fill="#fff" stroke="#ECE6E0"/>
      <path d="M78 60a20 20 0 0 1 20-20h124a20 20 0 0 1 20 20v38H78Z" fill="#BF531A"/>
      <text x="96" y="68" fontSize="14" fontWeight="800" fill="#fff">Sample fare</text>
      <text x="96" y="86" fontSize="10.5" fontWeight="600" fill="#fff" opacity=".9">5 km · No surge pricing</text>
      <text x="96" y="126" fontSize="11.5" fontWeight="600" fill="#6B625B">Base · first 1 km</text>
      <text x="224" y="126" fontSize="12.5" fontWeight="800" fill="#1E1A17" textAnchor="end">₱30</text>
      <text x="96" y="154" fontSize="11.5" fontWeight="600" fill="#6B625B">Next 4 km</text>
      <text x="224" y="154" fontSize="12.5" fontWeight="800" fill="#1E1A17" textAnchor="end">₱20</text>
      <path d="M96 176h128" stroke="#DDD5CD" strokeWidth="1.5" strokeDasharray="4 4"/>
      <text x="96" y="210" fontSize="13" fontWeight="800" fill="#1E1A17">Total</text>
      <text x="224" y="212" fontSize="26" fontWeight="800" fill="#BF531A" textAnchor="end">₱50</text>
      <text x="96" y="234" fontSize="10" fontWeight="600" fill="#6B625B">Pay your driver in cash</text>
      <circle cx="262" cy="200" r="16" fill="#F2A65A" opacity=".7"/>
      <circle cx="252" cy="226" r="24" fill="#F2A65A" stroke="#D86F2F" strokeWidth="3"/>
      <text x="252" y="234" fontSize="22" fontWeight="800" fill="#fff" textAnchor="middle">₱</text>
      <circle cx="74" cy="226" r="20" fill="#2F7A5A"/>
      <path d="m65 226 6 6 12-12" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

function SafetyArt() {
  return (
    <svg viewBox="0 0 320 300" role="img" aria-label="A TODA driver ID card with a verified badge and a safety shield">
      <Backdrop/>
      <rect x="54" y="96" width="212" height="132" rx="20" fill="#fff" stroke="#ECE6E0"/>
      <path d="M54 116a20 20 0 0 1 20-20h172a20 20 0 0 1 20 20v14H54Z" fill="#FCE9DC"/>
      <text x="74" y="119" fontSize="10.5" fontWeight="800" fill="#A94C1B" letterSpacing=".08em">TODA DRIVER ID</text>
      <circle cx="100" cy="174" r="26" fill="#E07A35"/>
      <circle cx="100" cy="166" r="9.5" fill="#fff"/>
      <path d="M83 192a17 13 0 0 1 34 0Z" fill="#fff"/>
      <text x="138" y="160" fontSize="13" fontWeight="800" fill="#1E1A17">Verified driver</text>
      <text x="138" y="178" fontSize="10.5" fontWeight="600" fill="#6B625B">Plate SDS-1234 · CRL-042</text>
      <rect x="138" y="188" width="92" height="22" rx="11" fill="#E8F5EE"/>
      <circle cx="151" cy="199" r="5" fill="#2F7A5A"/>
      <text x="161" y="203" fontSize="10" fontWeight="800" fill="#2F7A5A">TODA verified</text>
      <path d="M242 34 272 46v24c0 20-13 33-30 40-17-7-30-20-30-40V46Z" fill="#BF531A"/>
      <path d="m229 71 9 9 17-18" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="70" cy="244" r="22" fill="#fff" stroke="#ECE6E0"/>
      <circle cx="78" cy="236" r="4" fill="none" stroke="#BF531A" strokeWidth="2.5"/>
      <circle cx="62" cy="244" r="4" fill="none" stroke="#BF531A" strokeWidth="2.5"/>
      <circle cx="78" cy="252" r="4" fill="none" stroke="#BF531A" strokeWidth="2.5"/>
      <path d="m65.5 242 9-4M65.5 246l9 4" stroke="#BF531A" strokeWidth="2.5" strokeLinecap="round"/>
      <text x="100" y="249" fontSize="11" fontWeight="700" fill="#1E1A17">Live trip link shared</text>
    </svg>
  );
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [current, setCurrent] = useState(0);
  const swipeStart = useRef<number | null>(null);
  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  const goNext = () => (isLast ? onComplete() : setCurrent(current + 1));
  const goPrevious = () => setCurrent(Math.max(0, current - 1));

  return (
    <main className="onboarding">
      <header className="onboarding__top">
        <div className="onboarding__brand">
          <span className="brand-mark brand-mark--small"><IconDriver size={20}/></span>
          <span className="brand-wordmark">PASAKJA</span>
        </div>
        <button type="button" onClick={onComplete} className="onboarding-skip">Skip</button>
      </header>

      <section
        className="onboarding__visual"
        aria-roledescription="carousel"
        aria-label="Introduction"
        onPointerDown={event => { swipeStart.current = event.clientX; }}
        onPointerUp={event => {
          if (swipeStart.current === null) return;
          const distance = event.clientX - swipeStart.current;
          swipeStart.current = null;
          if (distance < -48) goNext();
          if (distance > 48) goPrevious();
        }}
        onPointerCancel={() => { swipeStart.current = null; }}
      >
        <div key={current} className="onboarding__art">{slide.art}</div>
      </section>

      <section className="onboarding__panel">
        <div key={current} className="onboarding__copy" aria-live="polite">
          <span className="onboarding__eyebrow">{slide.eyebrowIcon}{slide.eyebrow}</span>
          <h1>{slide.title}</h1>
          <p>{slide.description}</p>
        </div>

        <div className="onboarding__controls">
          <div className="onboarding__dots">
            {SLIDES.map((item, index) => (
              <button
                key={item.title}
                type="button"
                className="onboarding-dot"
                aria-label={`Go to slide ${index + 1} of ${SLIDES.length}`}
                aria-current={index === current ? 'step' : undefined}
                onClick={() => setCurrent(index)}
              />
            ))}
          </div>
          <button type="button" onClick={goNext} className="btn-primary btn-large onboarding__next">
            {isLast ? 'Get started' : 'Next'}
            <IconArrowRight size={20}/>
          </button>
        </div>
      </section>
    </main>
  );
}
