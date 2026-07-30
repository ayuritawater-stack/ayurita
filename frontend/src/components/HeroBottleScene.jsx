// Self-contained vector illustration used on the homepage hero when no
// custom hero photo has been uploaded via Admin → Settings → Website Images.
// Kept as inline SVG (no external image requests) so it always renders.
export default function HeroBottleScene({ className = "" }) {
  return (
    <svg
      viewBox="0 0 600 720"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Ayurita packaged drinking water bottle beside a lake"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EAF2FB" />
          <stop offset="100%" stopColor="#FBFDFF" />
        </linearGradient>
        <linearGradient id="mtnFar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C7D9EE" />
          <stop offset="100%" stopColor="#DCE9F6" />
        </linearGradient>
        <linearGradient id="mtnNear" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9FBBDD" />
          <stop offset="100%" stopColor="#C3D7EC" />
        </linearGradient>
        <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#BDD5EE" />
          <stop offset="100%" stopColor="#E7F0FA" />
        </linearGradient>
        <linearGradient id="bottleBody" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#DCEBFA" />
          <stop offset="35%" stopColor="#F4F9FE" />
          <stop offset="55%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#CFE2F5" />
        </linearGradient>
        <linearGradient id="cap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1B4A8C" />
          <stop offset="100%" stopColor="#0D2C5C" />
        </linearGradient>
        <linearGradient id="wave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#123B7A" />
          <stop offset="50%" stopColor="#D42128" />
          <stop offset="100%" stopColor="#123B7A" />
        </linearGradient>
        <radialGradient id="rockShade" cx="35%" cy="25%" r="80%">
          <stop offset="0%" stopColor="#6B7A8C" />
          <stop offset="100%" stopColor="#3E4A58" />
        </radialGradient>
      </defs>

      {/* sky */}
      <rect x="0" y="0" width="600" height="720" fill="url(#sky)" />

      {/* far mountains */}
      <path d="M0 300 L90 210 L170 280 L250 190 L340 300 L420 230 L520 300 L600 250 L600 420 L0 420 Z" fill="url(#mtnFar)" opacity="0.7" />
      {/* near mountains */}
      <path d="M0 360 L110 260 L200 340 L300 250 L390 350 L470 280 L600 360 L600 460 L0 460 Z" fill="url(#mtnNear)" opacity="0.85" />

      {/* lake */}
      <rect x="0" y="440" width="600" height="280" fill="url(#lake)" />
      {[470, 500, 530, 560, 590, 620].map((y, i) => (
        <path
          key={y}
          d={`M0 ${y} Q75 ${y - 6} 150 ${y} T300 ${y} T450 ${y} T600 ${y}`}
          stroke="#FFFFFF"
          strokeOpacity={0.35 - i * 0.03}
          strokeWidth="2"
          fill="none"
        />
      ))}

      {/* foreground rocks */}
      <ellipse cx="130" cy="660" rx="150" ry="60" fill="url(#rockShade)" opacity="0.9" />
      <ellipse cx="470" cy="675" rx="170" ry="55" fill="url(#rockShade)" opacity="0.85" />
      <ellipse cx="300" cy="695" rx="260" ry="45" fill="#37424E" opacity="0.9" />

      {/* leaves accent, bottom right */}
      <g opacity="0.9">
        <path d="M520 560 C560 540 580 500 570 460 C540 480 515 515 520 560 Z" fill="#2E7D5B" />
        <path d="M540 585 C585 575 610 540 605 500 C570 515 540 545 540 585 Z" fill="#3C9469" />
      </g>

      {/* bottle shadow */}
      <ellipse cx="300" cy="672" rx="95" ry="18" fill="#0B2249" opacity="0.18" />

      {/* bottle */}
      <g>
        {/* cap */}
        <rect x="272" y="60" width="56" height="30" rx="8" fill="url(#cap)" />
        <rect x="266" y="86" width="68" height="16" rx="6" fill="url(#cap)" />
        {/* neck */}
        <path d="M282 102 L318 102 L322 140 L278 140 Z" fill="url(#bottleBody)" stroke="#B9D1EA" strokeWidth="1.5" />
        {/* shoulder + body */}
        <path
          d="M278 140
             C278 160 340 160 322 140
             L336 200
             C346 260 346 560 336 620
             C330 655 270 655 264 620
             C254 560 254 260 264 200
             Z"
          fill="url(#bottleBody)"
          stroke="#B9D1EA"
          strokeWidth="1.5"
        />
        {/* highlight streak */}
        <path d="M280 160 C274 280 274 500 282 610" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round" opacity="0.55" />
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
        <path d="M255 458 Q278 445 300 458 T345 458 L345 480 L255 480 Z" fill="url(#wave)" opacity="0.9" />
      </g>
    </svg>
  );
}
