import { DISPLAY, FONT, INK, INK_2 } from './index.tsx'

/**
 * A moving bus (kinetic store) and a book on a high shelf (gravitational potential store).
 *
 * The two scenes used to sit side by side in a 420-unit-wide canvas, which scrolled 94px
 * on a phone. There are no props to vary, so the fix is simply to stack the two scenes
 * instead of placing them side by side, each one centred in a 280-unit-wide canvas — well
 * inside the "gravitational potential store" caption's own width, which is the widest
 * thing either scene draws.
 */
export function EnergyStores({ alt }: { props: Record<string, unknown>; alt: string }) {
  return (
    <svg viewBox="0 0 280 404" width="100%" style={{ maxWidth: 320 }} role="img" aria-label={alt}>
      {/* road and bus */}
      <line x1="35" y1="140" x2="245" y2="140" stroke={INK_2} strokeWidth="2" />
      <rect x="75" y="76" width="130" height="56" rx="8" fill="var(--subject-soft)" stroke={INK} strokeWidth="2" />
      {[87, 115, 143, 171].map((x) => <rect key={x} x={x} y="86" width="20" height="16" rx="2" fill="#fff" stroke={INK} />)}
      <circle cx="105" cy="136" r="10" fill="#fff" stroke={INK} strokeWidth="2" />
      <circle cx="175" cy="136" r="10" fill="#fff" stroke={INK} strokeWidth="2" />
      {[100, 108, 116].map((y, i) => <line key={y} x1={45 - i * 4} y1={y} x2={67} y2={y} stroke="#d25b3b" strokeWidth="2" strokeLinecap="round" />)}
      <text x="140" y="170" textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>kinetic store</text>
      <text x="140" y="184" textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>because it is moving</text>
      {/* shelf and book, stacked below the bus rather than beside it */}
      <line x1="75" y1="350" x2="75" y2="240" stroke={INK_2} strokeWidth="2" />
      <line x1="75" y1="350" x2="205" y2="350" stroke={INK_2} strokeWidth="2" />
      <rect x="85" y="262" width="110" height="6" fill={INK} />
      <rect x="115" y="230" width="22" height="32" rx="2" fill="#d25b3b" stroke={INK} strokeWidth="1.5" />
      <rect x="119" y="234" width="14" height="4" fill="#fff" />
      <path d="M126 272 v70" stroke={INK_2} strokeWidth="1.5" strokeDasharray="4 4" />
      <text x="150" y="310" fontFamily={FONT} fontSize="11" fill={INK_2}>height</text>
      <text x="140" y="380" textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>gravitational potential store</text>
      <text x="140" y="394" textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>because of where it is</text>
    </svg>
  )
}
