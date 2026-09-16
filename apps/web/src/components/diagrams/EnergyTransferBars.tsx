import { DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

/**
 * Before and after bar charts of energy stores. Props: { before: Record<store, J>, after: Record<store, J> }.
 * Defaults to a drop where 20% is dissipated to the thermal store.
 */
export function EnergyTransferBars({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const before = (props.before as Record<string, number> | undefined) ?? { 'gravitational potential': 100, kinetic: 0, thermal: 0 }
  const after = (props.after as Record<string, number> | undefined) ?? { 'gravitational potential': 0, kinetic: 80, thermal: 20 }
  const stores = [...new Set([...Object.keys(before), ...Object.keys(after)])]
  const max = Math.max(...Object.values(before), ...Object.values(after), 1)
  const colours: Record<string, string> = { 'gravitational potential': '#5A4BD1', kinetic: '#2E8B57', thermal: '#D25B3B', elastic: '#D9A21B' }
  const panel = (title: string, data: Record<string, number>, x0: number) => (
    <g>
      <text x={x0 + 90} y="18" textAnchor="middle" fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={INK}>{title}</text>
      <line x1={x0 + 10} y1="150" x2={x0 + 170} y2="150" stroke={INK} />
      {stores.map((s, i) => {
        const v = data[s] ?? 0
        const h = (v / max) * 110
        const x = x0 + 16 + i * 52
        return (
          <g key={s}>
            <rect x={x} y={150 - h} width="36" height={h} fill={colours[s] ?? INK_2} rx="3" />
            <text x={x + 18} y={146 - h} textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK}>{v ? `${v}%` : ''}</text>
            <text x={x + 18} y="166" textAnchor="middle" fontFamily={FONT} fontSize="11" fill={INK_2}>{s.split(' ')[0]}</text>
          </g>
        )
      })}
    </g>
  )
  return (
    <svg viewBox="0 0 400 180" width="100%" style={{ maxWidth: 480 }} role="img" aria-label={alt}>
      {panel('Before the drop', before, 10)}
      <line x1="200" y1="10" x2="200" y2="170" stroke={RULE} />
      {panel('At the bottom', after, 210)}
    </svg>
  )
}
