import { useState } from 'react';

interface OnboardingProps {
  onComplete: () => void;
}

const SLIDES = [
  {
    id: 1,
    title: 'Book a Tricycle in Seconds',
    subtitle: 'Where to?',
    description: 'Find a TODA-verified tricycle near you in Carrascal, Cantilan, Madrid, Carmen, or Lanuza — anytime, anywhere.',
    illustrationBg: 'from-orange to-sunset',
  },
  {
    id: 2,
    title: 'Know Your Fare',
    subtitle: 'Know Your Fare First',
    description: 'See the exact fare before you ride. Fixed zone rates, transparent breakdown, and community discounts for students, seniors, and PWDs.',
    illustrationBg: 'from-orange-dark to-orange',
  },
  {
    id: 3,
    title: 'Safe and Reliable',
    subtitle: 'Your Own Local TODA',
    description: 'Every driver is TODA-verified with plate and body number visible. Share your trip link and use emergency contacts at any time.',
    illustrationBg: 'from-ink to-ink-soft',
  },
];

function CoastalIllustration({ slide }: { slide: number }) {
  const colors = [
    { sky: '#FFF3EA', sea: '#B8D4E3', land: '#e8ddd0', road: '#d4c4b4' },
    { sky: '#FCE9DC', sea: '#9FC4D8', land: '#ddd0c0', road: '#c8b8a8' },
    { sky: '#FFFAF6', sea: '#B8D4E3', land: '#e8ddd0', road: '#d4c4b4' },
  ];
  const c = colors[slide - 1];

  return (
    <svg viewBox="0 0 390 280" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
      {/* Sky */}
      <rect x="0" y="0" width="390" height="200" fill={c.sky}/>

      {/* Sun */}
      <circle cx="320" cy="60" r="30" fill="#F2A65A" opacity="0.4"/>
      <circle cx="320" cy="60" r="20" fill="#F2A65A" opacity="0.7"/>

      {/* Clouds */}
      <ellipse cx="80" cy="50" rx="35" ry="18" fill="white" opacity="0.8"/>
      <ellipse cx="110" cy="45" rx="30" ry="15" fill="white" opacity="0.9"/>
      <ellipse cx="55" cy="55" rx="25" ry="14" fill="white" opacity="0.7"/>

      <ellipse cx="250" cy="35" rx="28" ry="14" fill="white" opacity="0.6"/>
      <ellipse cx="275" cy="30" rx="22" ry="12" fill="white" opacity="0.7"/>

      {/* Sea / water */}
      <path d="M0 190 Q100 180 200 190 Q300 200 390 190 L390 280 L0 280Z" fill={c.sea}/>
      {/* Wave lines */}
      <path d="M0 200 Q50 195 100 200 Q150 205 200 200 Q250 195 300 200 Q350 205 390 200"
        stroke="white" strokeWidth="2" fill="none" opacity="0.5"/>
      <path d="M0 215 Q60 210 120 215 Q180 220 240 215 Q300 210 390 215"
        stroke="white" strokeWidth="1.5" fill="none" opacity="0.4"/>

      {/* Land / road */}
      <path d="M0 175 Q100 170 200 175 Q300 180 390 175 L390 200 L0 200Z" fill={c.land}/>

      {/* Road */}
      <path d="M80 200 L80 175 L310 175 L310 200Z" fill={c.road}/>
      <path d="M195 175 L195 200" stroke="white" strokeWidth="2" strokeDasharray="8 6"/>

      {/* Palm trees */}
      <g transform="translate(30, 130)">
        <path d="M10 70 L10 20" stroke="#5a4a3a" strokeWidth="4" strokeLinecap="round"/>
        <path d="M10 20 C10 20 -20 10 -25 -5 C-18 5 0 15 10 20Z" fill="#568570"/>
        <path d="M10 20 C10 20 35 5 38 -8 C30 5 12 15 10 20Z" fill="#568570"/>
        <path d="M10 20 C10 20 -5 0 0 -18 C2 -5 8 10 10 20Z" fill="#568570"/>
        <path d="M10 20 C10 20 22 2 30 -10 C22 3 12 12 10 20Z" fill="#568570" opacity="0.8"/>
      </g>
      <g transform="translate(340, 120)">
        <path d="M10 80 Q8 50 12 20" stroke="#5a4a3a" strokeWidth="3.5" strokeLinecap="round"/>
        <path d="M11 20 C11 20 -15 8 -20 -5 C-12 6 2 14 11 20Z" fill="#568570"/>
        <path d="M11 20 C11 20 32 5 34 -8 C26 4 14 13 11 20Z" fill="#568570"/>
        <path d="M11 20 C11 20 -2 -2 4 -16 C4 -3 8 10 11 20Z" fill="#568570"/>
      </g>

      {/* Tricycle on road */}
      {slide === 1 && (
        <g transform="translate(155, 158)">
          <rect x="0" y="8" width="18" height="11" rx="3" fill="#D86F2F"/>
          <rect x="16" y="4" width="28" height="14" rx="3" fill="#D86F2F"/>
          <rect x="18" y="6" width="14" height="9" rx="2" fill="white" opacity="0.25"/>
          <circle cx="7" cy="21" r="5" stroke="#26211E" strokeWidth="1.8" fill="white"/>
          <circle cx="7" cy="21" r="2" fill="#26211E"/>
          <circle cx="38" cy="20" r="5" stroke="#26211E" strokeWidth="1.8" fill="white"/>
          <circle cx="38" cy="20" r="2" fill="#26211E"/>
        </g>
      )}

      {/* Fare card illustration for slide 2 */}
      {slide === 2 && (
        <g transform="translate(120, 100)">
          <rect x="0" y="0" width="150" height="90" rx="12" fill="white" opacity="0.95"/>
          <rect x="0" y="0" width="150" height="30" rx="12" fill="#D86F2F"/>
          <rect x="0" y="22" width="150" height="8" rx="0" fill="#D86F2F"/>
          <text x="12" y="20" fontFamily="Poppins" fontSize="11" fontWeight="600" fill="white">Fare Breakdown</text>
          <text x="12" y="48" fontFamily="Poppins" fontSize="9" fill="#7A6F68">Base Fare (Zone A)</text>
          <text x="120" y="48" fontFamily="Poppins" fontSize="9" fontWeight="600" fill="#26211E">₱20</text>
          <text x="12" y="62" fontFamily="Poppins" fontSize="9" fill="#7A6F68">Distance (1.2 km)</text>
          <text x="120" y="62" fontFamily="Poppins" fontSize="9" fontWeight="600" fill="#26211E">₱8</text>
          <text x="12" y="76" fontFamily="Poppins" fontSize="9" fontWeight="600" fill="#D86F2F">Senior Discount</text>
          <text x="114" y="76" fontFamily="Poppins" fontSize="9" fontWeight="600" fill="#568570">-₱5.60</text>
          <line x1="12" y1="80" x2="138" y2="80" stroke="#DED5CD" strokeWidth="1"/>
          <text x="12" y="89" fontFamily="Poppins" fontSize="10" fontWeight="700" fill="#26211E">Total</text>
          <text x="112" y="89" fontFamily="Poppins" fontSize="10" fontWeight="700" fill="#D86F2F">₱22.40</text>
        </g>
      )}

      {/* Safety illustration for slide 3 */}
      {slide === 3 && (
        <g transform="translate(140, 100)">
          <rect x="0" y="0" width="110" height="90" rx="12" fill="white" opacity="0.95"/>
          <circle cx="55" cy="30" r="20" fill="#ECF7F2"/>
          <path d="M55 12L58 22H69L61 28L64 38L55 32L46 38L49 28L41 22H52L55 12Z"
            fill="#D86F2F"/>
          <text x="55" y="62" textAnchor="middle" fontFamily="Poppins" fontSize="9" fontWeight="600" fill="#26211E">TODA Verified</text>
          <text x="55" y="74" textAnchor="middle" fontFamily="Poppins" fontSize="8" fill="#7A6F68">SDS-1234 · CRL-042</text>
          <text x="55" y="86" textAnchor="middle" fontFamily="Poppins" fontSize="7.5" fill="#568570">Yellow & Blue</text>
        </g>
      )}
    </svg>
  );
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [current, setCurrent] = useState(0);

  const goNext = () => {
    if (current < SLIDES.length - 1) setCurrent(current + 1);
    else onComplete();
  };

  const slide = SLIDES[current];

  return (
    <div className="min-h-screen bg-warm flex flex-col" style={{ background: '#FFFAF6' }}>
      {/* Illustration area */}
      <div className="onboarding-visual relative flex-1 overflow-hidden">
        <CoastalIllustration slide={slide.id}/>
        {/* Skip button */}
        <button
          onClick={onComplete}
          className="onboarding-skip absolute top-4 right-4 text-sm font-medium text-ink-soft bg-white/70 backdrop-blur-sm px-4 py-1.5 rounded-full border border-border/50"
        >
          Skip
        </button>
        {/* Logo */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <span className="font-bold text-ink text-base tracking-tight">PASAKJA</span>
        </div>
      </div>

      {/* Content */}
      <div className="bg-surface rounded-t-3xl -mt-6 flex-none px-6 pt-8 pb-8 flex flex-col gap-6">
        {/* Dots */}
        <div className="flex gap-2 justify-center">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                i === current ? 'w-8 bg-orange' : 'w-2 bg-border'
              }`}
            />
          ))}
        </div>

        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-orange tracking-wide uppercase">{slide.subtitle}</p>
          <h2 className="text-2xl font-semibold text-ink leading-snug">{slide.title}</h2>
          <p className="text-ink-soft text-sm leading-relaxed">{slide.description}</p>
        </div>

        <button
          onClick={goNext}
          className="btn-primary btn-large w-full"
        >
          {current < SLIDES.length - 1 ? 'Next' : 'Get Started'}
        </button>

      </div>
    </div>
  );
}
