/**
 * Ayurita brand wordmark.
 *
 * Geometric sans "Ayurita" (Poppins) where the tittle of the "i" is replaced by
 * a red blossom. The "i" itself is rendered as a dotless i (U+0131) so the
 * blossom sits alone above the stem.
 *
 * Sizing comes entirely from font-size, so pass a text-* class:
 *   <Logo className="text-2xl" />
 * Colour defaults to the brand logo blue; override with a text-* colour class:
 *   <Logo className="text-lg text-white" />
 */

const PETALS = 7;
const PETAL_ORBIT = 6.6;
const PETAL_RADIUS = 4.6;

function Blossom({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true" focusable="false">
      {Array.from({ length: PETALS }, (_, i) => {
        const angle = ((i * 360) / PETALS - 90) * (Math.PI / 180);
        return (
          <circle
            key={i}
            cx={12 + PETAL_ORBIT * Math.cos(angle)}
            cy={12 + PETAL_ORBIT * Math.sin(angle)}
            r={PETAL_RADIUS}
          />
        );
      })}
      <circle cx="12" cy="12" r="5.4" />
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
          {/* dotless i — the blossom below is its tittle */}
          {"ı"}
          {/* Poppins metrics (asc 1.05 / desc 0.35 em) put the top of the dotless
              stem ~0.30em below the line box top; -0.06em leaves a tittle-sized gap. */}
          <Blossom
            className={`absolute left-1/2 -translate-x-1/2 -top-[0.06em] w-[0.30em] h-[0.30em] ${petalClassName}`}
          />
        </span>
        ta
      </span>
    </span>
  );
}
