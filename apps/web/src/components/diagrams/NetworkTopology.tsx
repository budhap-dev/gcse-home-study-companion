import type { ReactElement } from 'react'
import { ACCENT, DISPLAY, FONT, INK, INK_2 } from './index.tsx'
import { wrapCell } from './tableLayout.ts'

/**
 * A star or a bus network, the two topologies AQA 8525 asks students to draw. The spec
 * says "Students should be able to draw topology diagrams", and the lesson asked for one
 * while showing only tables, so a student had never seen the picture they were to draw.
 *
 * Star: every device on its own cable to the switch in the middle. Bus: every device on a
 * short drop cable to one shared backbone, with a terminator closing each end. The
 * terminators are drawn because they are the reason a break in the backbone brings the
 * whole network down rather than splitting it in two.
 *
 * Drawn 296 units wide so it fits a phone card without scrolling.
 *
 * Props: { layout: 'star' | 'bus', devices: string[] (star up to 8, bus up to 6),
 *          centre?: string (star only, default "Switch"), caption?: string }
 */
const W = 296
const BOX_W = 64
const LABEL_PX = 11
const LINE = 13
/** Characters that fit across a device box at 11px. */
const BOX_CHARS = 9

function Device({ x, y, label }: { x: number; y: number; label: string }) {
  const lines = wrapCell(label, BOX_CHARS).slice(0, 2)
  const h = 12 + lines.length * LINE
  return (
    <g>
      <rect x={x - BOX_W / 2} y={y - h / 2} width={BOX_W} height={h} rx={5} fill="white" stroke={INK} strokeWidth={1.5} />
      {lines.map((l, i) => (
        <text key={i} x={x} y={y - ((lines.length - 1) * LINE) / 2 + i * LINE + 4} textAnchor="middle" fontSize={LABEL_PX} fontFamily={FONT} fill={INK}>
          {l}
        </text>
      ))}
    </g>
  )
}

export function NetworkTopology({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const layout = props.layout === 'bus' ? 'bus' : 'star'
  const devices = ((props.devices as string[] | undefined) ?? []).slice(0, layout === 'bus' ? 6 : 8)
  const centre = String(props.centre ?? 'Switch')
  const caption = props.caption ? wrapCell(String(props.caption), 50) : []

  let body: ReactElement
  let H: number
  if (layout === 'star') {
    const cx = W / 2
    const cy = 128
    const R = 96
    const at = devices.map((_, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, devices.length)
      return [cx + R * Math.cos(a), cy + R * Math.sin(a)] as const
    })
    H = 256
    body = (
      <g>
        {at.map(([x, y], i) => (
          <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={INK_2} strokeWidth={2} />
        ))}
        <rect x={cx - 38} y={cy - 16} width={76} height={32} rx={6} fill={ACCENT} />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize={13} fontWeight={700} fontFamily={DISPLAY} fill="white">
          {centre}
        </text>
        {at.map(([x, y], i) => (
          <Device key={i} x={x} y={y} label={devices[i]!} />
        ))}
      </g>
    )
  } else {
    const spine = 104
    const top = devices.filter((_, i) => i % 2 === 0)
    const bottom = devices.filter((_, i) => i % 2 === 1)
    const bottomY = 172
    const xs = (n: number, shift: number) => Array.from({ length: n }, (_, i) => (n === 1 ? W / 2 + shift : 76 + ((W - 152) * i) / (n - 1) + shift))
    const topX = xs(top.length, bottom.length === top.length ? -14 : 0)
    const bottomX = xs(bottom.length, 14)
    // The backbone and terminators are named in a key under the drawing, not beside
    // them: a drop cable lands wherever the device count puts it, and a label at the
    // end of the backbone had a cable running through it.
    const key = bottomY + 36
    H = key + 8
    body = (
      <g>
        <line x1={12} y1={spine} x2={W - 12} y2={spine} stroke={INK} strokeWidth={3} />
        <rect x={6} y={spine - 9} width={7} height={18} fill={ACCENT} />
        <rect x={W - 13} y={spine - 9} width={7} height={18} fill={ACCENT} />
        {top.map((_, i) => <line key={`t${i}`} x1={topX[i]} y1={spine} x2={topX[i]} y2={36} stroke={INK_2} strokeWidth={2} />)}
        {bottom.map((_, i) => <line key={`b${i}`} x1={bottomX[i]} y1={spine} x2={bottomX[i]} y2={bottomY} stroke={INK_2} strokeWidth={2} />)}
        {top.map((d, i) => <Device key={`dt${i}`} x={topX[i]!} y={36} label={d} />)}
        {bottom.map((d, i) => <Device key={`db${i}`} x={bottomX[i]!} y={bottomY} label={d} />)}
        <path d={`M ${W / 2 - 118} ${key - 4} h 22`} stroke={INK} strokeWidth={3} />
        <text x={W / 2 - 90} y={key} fontSize={LABEL_PX} fontFamily={FONT} fill={INK_2}>backbone</text>
        <rect x={W / 2 + 12} y={key - 12} width={7} height={14} fill={ACCENT} />
        <text x={W / 2 + 26} y={key} fontSize={LABEL_PX} fontFamily={FONT} fill={INK_2}>terminator</text>
      </g>
    )
  }

  const total = H + (caption.length ? 8 + caption.length * LINE : 0)
  return (
    <svg viewBox={`0 0 ${W} ${total}`} width="100%" style={{ maxWidth: 420 }} role="img" aria-label={alt}>
      {body}
      {caption.map((l, i) => (
        <text key={i} x={W / 2} y={H + 8 + (i + 1) * LINE - 3} textAnchor="middle" fontSize={11} fontFamily={FONT} fill={INK_2}>
          {l}
        </text>
      ))}
    </svg>
  )
}
