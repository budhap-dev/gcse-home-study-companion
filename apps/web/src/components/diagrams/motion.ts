import type { CSSProperties } from 'react'

/**
 * Figures that move (backlog section 15, Part B), where the idea is movement or change:
 * current going round a circuit, a ray travelling into a lens, a beam tipping until it
 * balances.
 *
 * A diagram tags a part with `move(kind, delay, duration)` and spreads the result onto it.
 * Nothing moves until the figure around it (DiagramFigure in Visual.tsx) sets `data-anim`,
 * which it does once, when the figure is well on screen, and again from its Play again
 * button. The rules this keeps, held by motion.test.tsx and the browser checks:
 * - The final frame is the figure as it is drawn without motion, so print, worksheets,
 *   motion off, reduced motion and the screens checks all see the same drawing. A part that
 *   only exists in motion (the dots of a current) is `fa-only`: invisible when still.
 * - Every movement ends: no infinite plays, and a figure is done within FIGURE_MAX_SECONDS.
 * - Movement stays inside the drawing (the svg clips it), so nothing slides sideways off
 *   the page (#351).
 *
 * Kinds, each a keyframe set in styles.css (`fa-<kind>`):
 * - draw: a stroke drawing itself along its path, from where the path starts. Paths only:
 *   it needs `pathLength`, which a <line> does not take everywhere.
 * - fade: from transparent.
 * - grow, grow-x, grow-y: scaling up from `at`, the point it grows out of.
 * - tip: rotating about `at` to `tilt` and settling back level with a little wobble.
 * - spin-y: a flat shape turning about a horizontal axis through `at`, seen side on.
 * - flow: dots moving along a dashed path by `run` units, fading in and out (fa-only).
 * - wipe: revealed left to right, as a trace drawn against time.
 * - slide: arriving from `dx`, `dy` units away.
 */
export type Move = 'draw' | 'fade' | 'grow' | 'grow-x' | 'grow-y' | 'tip' | 'spin-y' | 'flow' | 'wipe' | 'slide'

/** The longest any one figure moves for, delays included. Longer reads as waiting. */
export const FIGURE_MAX_SECONDS = 4

export interface MoveOptions {
  /** The point, in the svg's own units, that a grow, tip or spin-y works about. */
  at?: [number, number]
  /** Custom properties the keyframes read: tilt ('6deg'), run (100), dx/dy ('-20px'). */
  vars?: Record<string, string | number>
  /** An easing other than the kind's own. */
  ease?: string
  /** How many times it plays; never infinite. */
  plays?: number
}

export interface Moving {
  className: string
  style: CSSProperties
  /** When it stops, in seconds from the start, for the tests to add up. */
  'data-fa-end': string
  pathLength?: number
}

export function move(kind: Move, delay: number, duration: number, o: MoveOptions = {}): Moving {
  const plays = Math.max(1, Math.floor(o.plays ?? 1))
  const style: Record<string, string | number> = { '--d': `${delay.toFixed(2)}s`, '--t': `${duration.toFixed(2)}s` }
  if (o.at) {
    style.transformOrigin = `${o.at[0].toFixed(1)}px ${o.at[1].toFixed(1)}px`
    style.transformBox = 'view-box'
  }
  if (o.ease) style.animationTimingFunction = o.ease
  if (plays > 1) style.animationIterationCount = plays
  for (const [k, v] of Object.entries(o.vars ?? {})) style[`--${k}`] = String(v)
  return {
    className: `fa fa-${kind}${kind === 'flow' ? ' fa-only' : ''}`,
    style: style as CSSProperties,
    'data-fa-end': (delay + duration * plays).toFixed(2),
    ...(kind === 'draw' ? { pathLength: 1 } : {}),
  }
}

/** A straight segment as path data, so it can be drawn with `draw`. */
export function seg(x1: number, y1: number, x2: number, y2: number): string {
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

/** Points as path data, for a polyline that is drawn with `draw`. */
export function polyPath(pts: readonly (readonly [number, number])[]): string {
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
}

/** Delays for a run of parts that arrive one after another inside a time budget. */
export function stagger(count: number, start: number, gap: number, maxEnd: number, each: number): number[] {
  const step = count > 1 ? Math.min(gap, (maxEnd - each - start) / (count - 1)) : 0
  return Array.from({ length: count }, (_, i) => start + i * Math.max(0, step))
}
