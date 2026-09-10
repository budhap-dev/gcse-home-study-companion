import { useEffect, useRef, useState } from 'react'

/** One pen stroke. Points are fractions of the canvas width, so strokes survive a resize. */
export interface Stroke {
  colour: string
  width: number
  points: [number, number][]
}

const COLOURS = ['#1e2330', '#0e7a86', '#d25b3b']
const ASPECT = 0.62
/**
 * The sheet and its squares keep their own light ground whatever the theme, the same
 * way diagrams do: the pens are dark ink, so on a dark surface the strokes vanish.
 */
const PAPER = '#ffffff'
const GRID = '#ece9e1'

interface Props {
  strokes: Stroke[]
  onChange: (strokes: Stroke[]) => void
  disabled?: boolean
}

/**
 * Handwriting area for working. Pointer events cover pen, finger, and mouse.
 * Strokes are vector data kept with the attempt, not an image.
 */
export function ScratchCanvas({ strokes, onChange, disabled = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<Stroke | null>(null)
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [colour, setColour] = useState(COLOURS[0]!)

  const redraw = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = Math.round(w * ASPECT)
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    // faint grid, like squared paper
    ctx.strokeStyle = GRID
    ctx.lineWidth = 1
    for (let x = 0; x <= w; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
    for (let y = 0; y <= h; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const s of [...strokes, ...(drawing.current ? [drawing.current] : [])]) {
      ctx.strokeStyle = s.colour
      ctx.lineWidth = s.width
      ctx.beginPath()
      s.points.forEach(([px, py], i) => {
        const x = px * w
        const y = py * w
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    }
  }

  useEffect(() => {
    redraw()
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => redraw())
    ro.observe(canvas)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes])

  const point = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect()
    return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.width]
  }

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = point(e)
    if (tool === 'eraser') {
      eraseAt(p)
      return
    }
    drawing.current = { colour, width: e.pointerType === 'pen' ? 2 : 2.5, points: [p] }
    redraw()
  }
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    if (tool === 'eraser') {
      if (e.buttons) eraseAt(point(e))
      return
    }
    if (!drawing.current) return
    drawing.current.points.push(point(e))
    redraw()
  }
  const onUp = () => {
    if (!drawing.current) return
    const s = drawing.current
    drawing.current = null
    if (s.points.length > 1) onChange([...strokes, s])
    else redraw()
  }
  const eraseAt = ([x, y]: [number, number]) => {
    const r = 0.02
    const keep = strokes.filter((s) => !s.points.some(([px, py]) => Math.hypot(px - x, py - y) < r))
    if (keep.length !== strokes.length) onChange(keep)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <ToolButton active={tool === 'pen'} onClick={() => setTool('pen')} label="Pen" />
        <ToolButton active={tool === 'eraser'} onClick={() => setTool('eraser')} label="Eraser" />
        <ToolButton onClick={() => onChange(strokes.slice(0, -1))} label="Undo" disabled={strokes.length === 0} />
        <ToolButton onClick={() => onChange([])} label="Clear" disabled={strokes.length === 0} />
        <span className="ml-auto flex items-center gap-1.5">
          {COLOURS.map((c) => (
            <button key={c} type="button" aria-label={`Pen colour ${c}`} aria-pressed={colour === c} onClick={() => { setColour(c); setTool('pen') }} className="h-7 w-7 rounded-full border-2" style={{ background: c, borderColor: colour === c ? '#fff' : c, boxShadow: colour === c ? `0 0 0 2px ${c}` : 'none' }} />
          ))}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
        className="w-full touch-none rounded-xl border border-rule"
        style={{ background: PAPER, aspectRatio: `1 / ${ASPECT}`, cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
        aria-label="Scratch canvas for working"
      />
      <p className="text-xs text-ink-2">Working is saved with your answer.</p>
    </div>
  )
}

function ToolButton({ label, active = false, disabled = false, onClick }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active} className={`h-9 rounded-lg px-3 text-sm font-bold ${active ? 'bg-ink text-surface' : 'border border-rule bg-surface'} disabled:opacity-40`}>
      {label}
    </button>
  )
}
