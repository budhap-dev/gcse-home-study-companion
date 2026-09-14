import type { ComponentType } from 'react'
import { IndexLadder } from './IndexLadder.tsx'
import { IndexLawsCard } from './IndexLawsCard.tsx'
import { LineGraph } from './LineGraph.tsx'
import { PowerOfPower } from './PowerOfPower.tsx'
import { RepeatedMultiplication } from './RepeatedMultiplication.tsx'
import { RootNumberLine } from './RootNumberLine.tsx'
import { TriangleConstruction } from './TriangleConstruction.tsx'
import { TrianglePair } from './TrianglePair.tsx'
import { CircleTheorem } from './CircleTheorem.tsx'
import { ElectrolysisCell } from './ElectrolysisCell.tsx'
import { SpringLoad } from './SpringLoad.tsx'
import { BeamMoments } from './BeamMoments.tsx'
import { Collision } from './Collision.tsx'
import { FluidColumn } from './FluidColumn.tsx'
import { FourBox } from './FourBox.tsx'
import { DotAndCross } from './DotAndCross.tsx'
import { Lattice } from './Lattice.tsx'
import { MarketMap } from './MarketMap.tsx'
import { MusicTimeline } from './MusicTimeline.tsx'
import { EnergyStores } from './EnergyStores.tsx'
import { EnergyTransferBars } from './EnergyTransferBars.tsx'
import { EquationCard } from './EquationCard.tsx'
import { CurveGraph } from './CurveGraph.tsx'
import { Plant } from './Plant.tsx'
import { TraceTable } from './TraceTable.tsx'
import { VerbTable } from './VerbTable.tsx'
import { MotionGraph } from './MotionGraph.tsx'
import { FreeBody } from './FreeBody.tsx'
import { VectorTriangle } from './VectorTriangle.tsx'
import { HuffmanTree } from './HuffmanTree.tsx'
import { VennDiagram } from './VennDiagram.tsx'
import { ProbabilityTree } from './ProbabilityTree.tsx'

/**
 * The SVG diagram library. Content names a component and passes props; anything
 * not listed here falls back to the visual's alt text. Every diagram is vector,
 * takes the subject accent from CSS, and carries its alt text for screen readers.
 */
export const DIAGRAMS: Record<string, ComponentType<{ props: Record<string, unknown>; alt: string }>> = {
  'repeated-multiplication': RepeatedMultiplication,
  'index-ladder': IndexLadder,
  'root-number-line': RootNumberLine,
  'power-of-power': PowerOfPower,
  'index-laws-card': IndexLawsCard,
  'line-graph': LineGraph,
  'triangle-construction': TriangleConstruction,
  'triangle-pair': TrianglePair,
  'circle-theorem': CircleTheorem,
  'electrolysis-cell': ElectrolysisCell,
  'spring-load': SpringLoad,
  'beam-moments': BeamMoments,
  'collision': Collision,
  'fluid-column': FluidColumn,
  'four-box': FourBox,
  'dot-and-cross': DotAndCross,
  'lattice': Lattice,
  'market-map': MarketMap,
  'music-timeline': MusicTimeline,
  'energy-stores': EnergyStores,
  'energy-transfer-bars': EnergyTransferBars,
  'equation-card': EquationCard,
  'curve-graph': CurveGraph,
  'plant': Plant,
  'trace-table': TraceTable,
  'verb-table': VerbTable,
  'motion-graph': MotionGraph,
  'free-body': FreeBody,
  'vector-triangle': VectorTriangle,
  'huffman-tree': HuffmanTree,
  'venn-diagram': VennDiagram,
  'probability-tree': ProbabilityTree,
}

export const INK = '#1e2330'
export const INK_2 = '#5a6070'
export const RULE = '#e3e0d8'
export const ACCENT = 'var(--subject)'
export const FONT = 'Atkinson Hyperlegible, Helvetica Neue, Arial, sans-serif'
export const DISPLAY = 'Bricolage Grotesque, Helvetica Neue, Arial, sans-serif'
