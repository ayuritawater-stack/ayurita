// Transparent-background bottle graphic meant to sit on top of a real
// hero photo (see Home.jsx). Kept separate from HeroBottleScene (which
// paints its own backdrop) so it can be layered over an uploaded photo.
export default function HeroBottleOverlay({ className = "" }) {
  return (
    <svg
      viewBox="0 0 600 720"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Ayurita packaged drinking water bottle"
    >
      <defs>
        <linearGradient id="ov-bottleBody" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#DCEBFA" stopOpacity="0.85" />
          <stop offset="35%" stopColor="#F4F9FE" stopOpacity="0.7" />
          <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#CFE2F5" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="ov-cap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1B4A8C" />
          <stop offset="100%" stopColor="#0D2C5C" />
        </linearGradient>
        <linearGradient id="ov-wave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#123B7A" />
          <stop offset="50%" stopColor="#D42128" />
          <stop offset="100%" stopColor="#123B7A" />
        </linearGradient>
      </defs>

      {/* soft contact shadow */}
      <ellipse cx="300" cy="672" rx="95" ry="18" fill="#0B2249" opacity="0.22" />

      {/* cap */}
      <rect x="272" y="60" width="56" height="30" rx="8" fill="url(#ov-cap)" />
      <rect x="266" y="86" width="68" height="16" rx="6" fill="url(#ov-cap)" />
      {/* neck */}
      <path d="M282 102 L318 102 L322 140 L278 140 Z" fill="url(#ov-bottleBody)" stroke="#B9D1EA" strokeWidth="1.5" />
      {/* shoulder + body */}
      <path
        d="M278 140
           C278 160 340 160 322 140
           L336 200
           C346 260 346 560 336 620
           C330 655 270 655 264 620
           C254 560 254 260 264 200
           Z"
        fill="url(#ov-bottleBody)"
        stroke="#B9D1EA"
        strokeWidth="1.5"
      />
      {/* highlight streak */}
      <path d="M280 160 C274 280 274 500 282 610" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round" opacity="0.6" />
      {/* ribbing near base */}
      {[600, 612, 624, 636].map((y) => (
        <path key={y} d={`M266 ${y} Q300 ${y + 6} 334 ${y}`} stroke="#B9D1EA" strokeWidth="1.5" fill="none" opacity="0.6" />
      ))}

      {/* label */}
      <rect x="255" y="330" width="90" height="150" rx="6" fill="#FFFFFF" stroke="#E2EBF5" strokeWidth="1" />
      <text x="300" y="372" textAnchor="middle" fontFamily="Archivo, sans-serif" fontWeight="800" fontSize="20" fill="#123B7A" letterSpacing="0.5">
        AYURITA
      </text>
      <text x="300" y="392" textAnchor="middle" fontFamily="'Playfair Display', serif" fontStyle="italic" fontSize="10" fill="#55708F">
        [ayu-rita] / noun
      </text>
      <line x1="270" y1="402" x2="330" y2="402" stroke="#D7E3F1" strokeWidth="1" />
      <text x="300" y="418" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="7.5" fill="#3E5A7A">
        A quiet expression
      </text>
      <text x="300" y="429" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="7.5" fill="#3E5A7A">
        of what sustains us.
      </text>
      {/* wave band at base of label */}
      <path d="M255 458 Q278 445 300 458 T345 458 L345 480 L255 480 Z" fill="url(#ov-wave)" opacity="0.92" />
    </svg>
  );
}
