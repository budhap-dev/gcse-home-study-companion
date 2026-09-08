import { DISPLAY, FONT, INK, INK_2 } from './index.tsx'

/** A moving bus (kinetic store) and a book on a high shelf (gravitational potential store). */
export function EnergyStores({ alt }: { props: Record<string, unknown>; alt: string }) {
  return (
    <svg viewBox="0 0 420 190" width="100%" style={{ maxWidth: 480 }} role="img" aria-label={alt}>
      {/* road and bus */}
      <line x1="20" y1="140" x2="230" y2="140" stroke={INK_2} strokeWidth="2" />
      <rect x="60" y="76" width="130" height="56" rx="8" fill="var(--subject-soft)" stroke={INK} strokeWidth="2" />
      {[72, 100, 128, 156].map((x) => <rect key={x} x={x} y="86" width="20" height="16" rx="2" fill="#fff" stroke={INK} />)}
      <circle cx="90" cy="136" r="10" fill="#fff" stroke={INK} strokeWidth="2" />
      <circle cx="160" cy="136" r="10" fill="#fff" stroke={INK} strokeWidth="2" />
      {[100, 108, 116].map((y, i) => <line key={y} x1={30 - i * 4} y1={y} x2={52} y2={y} stroke="#d25b3b" strokeWidth="2" strokeLinecap="round" />)}
      <text x="125" y="170" textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>kinetic store</text>
      <text x="125" y="184" textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>because it is moving</text>
      {/* shelf and book */}
      <line x1="270" y1="140" x2="270" y2="30" stroke={INK_2} strokeWidth="2" />
      <line x1="270" y1="140" x2="400" y2="140" stroke={INK_2} strokeWidth="2" />
      <rect x="280" y="52" width="110" height="6" fill={INK} />
      <rect x="310" y="20" width="22" height="32" rx="2" fill="#d25b3b" stroke={INK} strokeWidth="1.5" />
      <rect x="314" y="24" width="14" height="4" fill="#fff" />
      <path d="M321 62 v70" stroke={INK_2} strokeWidth="1.5" strokeDasharray="4 4" />
      <text x="345" y="100" fontFamily={FONT} fontSize="11" fill={INK_2}>height</text>
      <text x="335" y="170" textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>gravitational potential store</text>
      <text x="335" y="184" textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>because of where it is</text>
    </svg>
  )
}
