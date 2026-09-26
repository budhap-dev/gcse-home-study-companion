import { DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

/**
 * Springs hanging from a clamp, each with a load, showing extension against a ruler.
 * Props: { loads: number[] in N, k: spring constant in N/m, naturalLength: cm, unit: 'cm' }.
 * Extension in cm = load / k * 100.
 *
 * The extension bracket used to sit beside the spring, with its "12 cm" label another
 * 27px further out again: at a 90-unit gap between springs that was fine, but it made
 * every extra spring add 90 units of width, and four springs scrolled 132px on a phone.
 * The bracket now sits tight against the spring and its label moves underneath the load
 * instead of out to the side, so a spring's whole footprint is its own load box (32
 * units) rather than the label's width, and springs can sit closer together.
 */
export function SpringLoad({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const loads = (props.loads as number[] | undefined) ?? [0, 1, 2, 3]
  const k = Number(props.k ?? 25)
  const natural = Number(props.naturalLength ?? 5)
  const scale = 9 // px per cm
  const gap = 58
  const W = 70 + Math.max(0, loads.length - 1) * gap + 40
  const maxExt = Math.max(...loads.map((F) => (F / k) * 100))
  const H = 60 + (natural + maxExt) * scale + 90
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: Math.min(420, W * 1.2) }} role="img" aria-label={alt}>
      <rect x="10" y="20" width={W - 20} height="10" fill={INK} />
      {/* ruler */}
      <line x1="34" y1="30" x2="34" y2={H - 30} stroke={INK_2} />
      {Array.from({ length: Math.floor((natural + maxExt)) + 1 }, (_, i) => (
        <g key={i}>
          <line x1="30" y1={30 + i * scale} x2={i % 5 === 0 ? 42 : 38} y2={30 + i * scale} stroke={INK_2} />
          {i % 5 === 0 && <text x="20" y={34 + i * scale} textAnchor="end" fontFamily={FONT} fontSize="11" fill={INK_2}>{i}</text>}
        </g>
      ))}
      {loads.map((F, idx) => {
        const x = 70 + idx * gap
        const ext = (F / k) * 100
        const len = (natural + ext) * scale
        const coils = 8
        const path = ['M', x, 30]
        for (let c = 0; c < coils; c++) {
          const y0 = 30 + (len / coils) * c
          const y1 = 30 + (len / coils) * (c + 1)
          path.push('L', x + 10, y0 + (y1 - y0) * 0.25, 'L', x - 10, y0 + (y1 - y0) * 0.75, 'L', x, y1)
        }
        return (
          <g key={idx}>
            <path d={path.join(' ')} fill="none" stroke="var(--subject)" strokeWidth="2" strokeLinejoin="round" />
            <line x1={x} y1={30 + len} x2={x} y2={30 + len + 10} stroke={INK} strokeWidth="2" />
            <rect x={x - 16} y={30 + len + 10} width="32" height="22" rx="3" fill={F > 0 ? INK : '#fff'} stroke={INK} />
            <text x={x} y={30 + len + 25} textAnchor="middle" fontFamily={DISPLAY} fontSize="11" fontWeight="700" fill={F > 0 ? '#fff' : INK}>{F} N</text>
            {ext > 0 && (
              <g>
                <line x1={x + 17} y1={30 + natural * scale} x2={x + 17} y2={30 + len} stroke="#d25b3b" strokeWidth="1.5" />
                <line x1={x + 14} y1={30 + natural * scale} x2={x + 20} y2={30 + natural * scale} stroke="#d25b3b" strokeWidth="1.5" />
                <line x1={x + 14} y1={30 + len} x2={x + 20} y2={30 + len} stroke="#d25b3b" strokeWidth="1.5" />
                <text x={x} y={30 + len + 46} textAnchor="middle" fontFamily={FONT} fontSize="11" fill="#d25b3b">{ext.toFixed(ext % 1 ? 1 : 0)} cm</text>
              </g>
            )}
          </g>
        )
      })}
      <line x1="0" y1={H - 0.5} x2={W} y2={H - 0.5} stroke={RULE} />
    </svg>
  )
}
