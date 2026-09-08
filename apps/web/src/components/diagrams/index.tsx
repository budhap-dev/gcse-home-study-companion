import type { ComponentType } from 'react'
import { IndexLadder } from './IndexLadder.tsx'
import { IndexLawsCard } from './IndexLawsCard.tsx'
import { LineGraph } from './LineGraph.tsx'
import { PowerOfPower } from './PowerOfPower.tsx'
import { RepeatedMultiplication } from './RepeatedMultiplication.tsx'

/**
 * The SVG diagram library. Content names a component and passes props; anything
 * not listed here falls back to the visual's alt text. Every diagram is vector,
 * takes the subject accent from CSS, and carries its alt text for screen readers.
 */
export const DIAGRAMS: Record<string, ComponentType<{ props: Record<string, unknown>; alt: string }>> = {
  'repeated-multiplication': RepeatedMultiplication,
  'index-ladder': IndexLadder,
  'power-of-power': PowerOfPower,
  'index-laws-card': IndexLawsCard,
  'line-graph': LineGraph,
}

export const INK = '#1e2330'
export const INK_2 = '#5a6070'
export const RULE = '#e3e0d8'
export const ACCENT = 'var(--subject)'
export const FONT = 'Atkinson Hyperlegible, Helvetica Neue, Arial, sans-serif'
export const DISPLAY = 'Bricolage Grotesque, Helvetica Neue, Arial, sans-serif'
