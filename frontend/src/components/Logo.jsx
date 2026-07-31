/**
 * Ayurita brand wordmark.
 *
 * Geometric sans "Ayurita" (Poppins) where the tittle of the "i" is replaced by
 * a red lotus. The "i" itself is rendered as a dotless i (U+0131) so the lotus
 * sits alone above the stem.
 *
 * Sizing comes entirely from font-size, so pass a text-* class:
 *   <Logo className="text-2xl" />
 * Colour defaults to the brand logo blue; override with a text-* colour class:
 *   <Logo className="text-lg text-white" />
 */

// Five petals fanned around a pivot at the origin: [rotation°, lengthScale, widthScale].
const PETALS = [
  [-72, 0.8, 1.05],
  [-34, 0.93, 1],
  [0, 1, 1],
  [34, 0.93, 1],
  [72, 0.8, 1.05],
];

// One petal, tip up, base at the origin.
const PETAL_PATH = "M0,0 C-8,-8 -9,-18 0,-28 C9,-18 8,-8 0,0 Z";

function Lotus({ className = "" }) {
  return (
    <svg
      viewBox="-25 -29 50 32"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {PETALS.map(([rotation, lengthScale, widthScale]) => (
        <path
          key={rotation}
          d={PETAL_PATH}
          transform={`rotate(${rotation}) scale(${widthScale} ${lengthScale})`}
        />
      ))}
    </svg>
  );
}

export default function Logo({ className = "", petalClassName = "text-brand-logo-petal" }) {
  return (
    <span
      role="img"
      aria-label="Ayurita"
      data-testid="ayurita-logo"
      className={`font-logo font-semibold leading-none tracking-[-0.01em] text-brand-logo whitespace-nowrap ${className}`}
    >
      <span aria-hidden="true">
        Ayur
        <span className="relative inline-block">
          {/* dotless i — the lotus below is its tittle */}
          {"ı"}
          {/* Poppins metrics (asc 1.05 / desc 0.35 em) put the top of the dotless
              stem ~0.30em below the line box top; -0.02em leaves a tittle-sized gap. */}
          <Lotus
            className={`absolute left-1/2 -translate-x-1/2 -top-[0.02em] w-[0.42em] h-[0.27em] ${petalClassName}`}
          />
        </span>
        ta
      </span>
    </span>
  );
}
