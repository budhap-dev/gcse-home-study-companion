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
import { SurfaceAreaVolume } from './SurfaceAreaVolume.tsx'
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
import { Histogram } from './Histogram.tsx'
import { RayDiagram } from './RayDiagram.tsx'
import { ReactionProfile } from './ReactionProfile.tsx'
import { InequalityLine } from './InequalityLine.tsx'
import { InequalityRegion } from './InequalityRegion.tsx'
import { DisplayedFormula } from './DisplayedFormula.tsx'
import { CircuitDiagram } from './CircuitDiagram.tsx'
import { ElectricField } from './ElectricField.tsx'
import { MagnetField } from './MagnetField.tsx'
import { LensDiagram } from './LensDiagram.tsx'
import { LogicCircuit } from './LogicCircuit.tsx'
import { VectorFigure } from './VectorFigure.tsx'
import { Cuboid } from './Cuboid.tsx'
import { BoxPlot } from './BoxPlot.tsx'
import { CumulativeFrequency } from './CumulativeFrequency.tsx'
import { FrequencyTree } from './FrequencyTree.tsx'
import { Flowchart } from './Flowchart.tsx'
import { SizeCompare } from './SizeCompare.tsx'
import { AngleFigure } from './AngleFigure.tsx'
import { NetworkTopology } from './NetworkTopology.tsx'
import { PieChart } from './PieChart.tsx'
import { BarChart } from './BarChart.tsx'
import { Pictogram } from './Pictogram.tsx'
import { PlanElevation } from './PlanElevation.tsx'

/**
 * The SVG diagram library. Content names a component and passes props; anything
 * not listed here falls back to the visual's alt text. Every diagram is vector,
 * takes the subject accent from CSS, and carries its alt text for screen readers.
 */
export const DIAGRAMS: Record<string, ComponentType<{ props: Record<string, unknown>; alt: string }>> = {
  'repeated-multiplication': RepeatedMultiplication,
  'ray-diagram': RayDiagram,
  'reaction-profile': ReactionProfile,
  'inequality-line': InequalityLine,
  'inequality-region': InequalityRegion,
  'vector-figure': VectorFigure,
  'displayed-formula': DisplayedFormula,
  'electric-field': ElectricField,
  'magnet-field': MagnetField,
  'circuit-diagram': CircuitDiagram,
  'lens-diagram': LensDiagram,
  'logic-circuit': LogicCircuit,
  'cuboid': Cuboid,
  'index-ladder': IndexLadder,
  'root-number-line': RootNumberLine,
  'power-of-power': PowerOfPower,
  'index-laws-card': IndexLawsCard,
  'line-graph': LineGraph,
  'angle-figure': AngleFigure,
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
  'surface-area-volume': SurfaceAreaVolume,
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
  'histogram': Histogram,
  'box-plot': BoxPlot,
  'cumulative-frequency': CumulativeFrequency,
  'frequency-tree': FrequencyTree,
  'flowchart': Flowchart,
  'size-compare': SizeCompare,
  'network-topology': NetworkTopology,
  'pie-chart': PieChart,
  'bar-chart': BarChart,
  'pictogram': Pictogram,
  'plan-elevation': PlanElevation,
}

export const INK = '#1e2330'
export const INK_2 = '#5a6070'
export const RULE = '#e3e0d8'
export const ACCENT = 'var(--subject)'
export const FONT = 'Atkinson Hyperlegible, Helvetica Neue, Arial, sans-serif'
export const DISPLAY = 'Bricolage Grotesque, Helvetica Neue, Arial, sans-serif'
