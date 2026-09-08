import { useId, useState } from 'react'
import { DISPLAY, FONT, INK, INK_2, RULE } from '../diagrams/index.tsx'

type Formula = 'kinetic' | 'fall-speed' | 'square' | 'linear'

/**
 * A slider drives one input; the graph shows the whole curve and the current point.
 * Config: formula, x and y labels, xMax, plus formula constants (mass, g, m, c).
 */
export function SliderGraph({ config, alt }: { config: Record<string, unknown>; alt: string }) {
  const formula = (config.formula as Formula | undefined) ?? (config.mass !== undefined ? 'kinetic' : config.g !== undefined ? 'fall-speed' : 'square')
  const xMax = Number(config.xMax ?? 10)
  const mass = Number(config.mass ?? 1)
  const g = Number(config.g ?? 9.8)
  const f = (x: number) => {
    switch (formula) {
      case 'kinetic': return 0.5 * mass * x * x
      case 'fall-speed': return Math.sqrt(2 * g * x)
      case 'linear': return Number(config.m ?? 1) * x + Number(config.c ?? 0)
      default: return x * x
    }
  }
  const [x, setX] = useState(Math.round(xMax / 2))
  const id = useId()
  const yMax = Math.max(...Array.from({ length: 41 }, (_, i) => f((i / 40) * xMax)), 1)
  const W = 360
  const H = 220
  const pad = 34
  const sx = (v: number) => pad + (v / xMax) * (W - 2 * pad)
  const sy = (v: number) => H - pad - (v / yMax) * (H - 2 * pad)
  const path = Array.from({ length: 81 }, (_, i) => { const xv = (i / 80) * xMax; return `${i ? 'L' : 'M'}${sx(xv).toFixed(1)} ${sy(f(xv)).toFixed(1)}` }).join(' ')
  const y = f(x)
  const fmt = (v: number) => (v >= 1000 ? Math.round(v).toLocaleString('en-GB') : v >= 100 ? v.toFixed(0) : v.toFixed(1))
  return (
    <figure className="flex flex-col gap-3 rounded-xl border border-rule bg-surface p-4">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 440 }} role="img" aria-label={alt}>
        {[0.25, 0.5, 0.75, 1].map((k) => <line key={k} x1={pad} y1={sy(k * yMax)} x2={W - pad} y2={sy(k * yMax)} stroke={RULE} />)}
        <line x1={pad} y1={sy(0)} x2={W - pad} y2={sy(0)} stroke={INK} strokeWidth="1.5" />
        <line x1={sx(0)} y1={pad} x2={sx(0)} y2={H - pad} stroke={INK} strokeWidth="1.5" />
        <path d={path} fill="none" stroke="var(--subject)" strokeWidth="2.5" />
        <line x1={sx(x)} y1={sy(0)} x2={sx(x)} y2={sy(y)} stroke={INK_2} strokeDasharray="4 4" />
        <line x1={sx(0)} y1={sy(y)} x2={sx(x)} y2={sy(y)} stroke={INK_2} strokeDasharray="4 4" />
        <circle cx={sx(x)} cy={sy(y)} r="6" fill="#fff" stroke="var(--subject)" strokeWidth="3" />
        <text x={W - pad} y={H - 8} textAnchor="end" fontFamily={FONT} fontSize="11" fill={INK_2}>{String(config.x ?? 'x')}</text>
        <text x={6} y={pad - 8} fontFamily={FONT} fontSize="11" fill={INK_2}>{String(config.y ?? 'y')}</text>
        <text x={sx(x)} y={H - pad + 14} textAnchor="middle" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={INK}>{fmt(x)}</text>
        <text x={pad - 6} y={sy(y) + 4} textAnchor="end" fontFamily={DISPLAY} fontSize="12" fontWeight="700" fill={INK}>{fmt(y)}</text>
      </svg>
      <label htmlFor={id} className="flex items-center gap-3 text-sm">
        <span className="whitespace-nowrap text-ink-2">{String(config.x ?? 'x')}</span>
        <input id={id} type="range" min={0} max={xMax} step={xMax / 40} value={x} onChange={(e) => setX(Number(e.target.value))} className="h-11 flex-grow accent-[color:var(--subject)]" />
        <span className="w-20 text-right font-bold tabular-nums">{fmt(x)} → {fmt(y)}</span>
      </label>
    </figure>
  )
}
