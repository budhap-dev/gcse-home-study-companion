import type { Topic } from './content/topic.ts'

/**
 * A one-page revision card, built from what the topic already holds.
 *
 * Nothing here is authored twice. The pack already carries everything a student wants
 * the night before a test — the mnemonics in `tips`, the equations on the equation
 * cards, the key points in the lesson's summary step, the traps in `examinerErrors` —
 * but each sits on a different screen, and three of the four are several taps deep.
 * A student revising does not want to walk a fifteen-step lesson to reach its summary.
 *
 * So the cheat sheet is a *view*, not new content. It costs no authoring, it exists for
 * all 284 topics the moment it ships, and it cannot drift from the lesson, because it
 * is the lesson's own words.
 */
export interface CheatSheet {
  title: string
  /** The board's own number for the topic, where the board numbers its sections. */
  specCode?: string
  /**
   * The `remember` tips: the mnemonics, the "which way round" cues, the rhymes. First on
   * the sheet because they are the only part a student cannot reconstruct by thinking.
   */
  memoryHooks: CheatTip[]
  /** The other three kinds of tip: how to spot it, a faster route, how to check it. */
  tactics: CheatTip[]
  /** Every equation the topic puts on an equation card, as text rather than a drawing. */
  formulae: CheatFormula[]
  /** The lesson's summary bullets, which are written as a bold cue and its detail. */
  keyPoints: string[]
  /** What examiners report going wrong. */
  traps: string[]
  /** What separates a grade 9 answer. */
  grade9: string
}

export interface CheatTip {
  kind: 'remember' | 'spot' | 'shortcut' | 'check'
  title: string
  body: string
}

export interface CheatFormula {
  name: string
  equation: string
  units: string
}

/** Rows of an `equation-card` visual, which is the one component that holds formulae as data. */
interface EquationRow {
  name?: unknown
  equation?: unknown
  units?: unknown
}

/**
 * The equations a topic teaches, in the order it teaches them.
 *
 * Taken from the equation cards' props rather than by rendering them. A cheat sheet is
 * dense by design, and an SVG scales its whole viewBox to its container: a 520-unit card
 * in a narrow column draws its text at a few pixels, which is the defect this pack has
 * hit repeatedly. Text in the page's own font cannot do that, and it reflows on a phone.
 */
export function formulaeOf(topic: Topic): CheatFormula[] {
  const out: CheatFormula[] = []
  const seen = new Set<string>()
  for (const step of topic.lesson.steps) {
    for (const visual of step.visuals) {
      if (visual.type !== 'diagram' || visual.component !== 'equation-card') continue
      const rows = (visual.props as { equations?: EquationRow[] }).equations
      if (!Array.isArray(rows)) continue
      for (const row of rows) {
        const equation = typeof row?.equation === 'string' ? row.equation.trim() : ''
        if (!equation) continue
        const name = typeof row?.name === 'string' ? row.name.trim() : ''
        const units = typeof row?.units === 'string' ? row.units.trim() : ''
        // The same equation is often carded twice, once where it is derived and once in
        // a recap. On a one-page sheet that reads as an error, so keep the first.
        const key = `${name}|${equation}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push({ name, equation, units })
      }
    }
  }
  return out
}

/**
 * The summary step's bullets, as authored.
 *
 * Kept whole rather than split into a cue and its detail the way a flashcard is. A
 * flashcard has to ask something; a cheat sheet is read, not tested, so cutting the
 * bullet in half would only lose the half that says what the cue means.
 */
export function keyPointsOf(topic: Topic): string[] {
  const summary = topic.lesson.steps.find((s) => s.kind === 'summary')
  if (!summary) return []
  return summary.body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
    .filter(Boolean)
}

/** Build the whole sheet. Every section may be empty; the screen omits the empty ones. */
export function cheatSheetOf(topic: Topic): CheatSheet {
  const tips = topic.tips ?? []
  // Within tactics, keep the authored order rather than grouping by kind: the tips of a
  // topic are written to be read in sequence, and a "check it" often refers to the
  // shortcut above it.
  return {
    title: topic.title,
    specCode: topic.specCode,
    memoryHooks: tips.filter((t) => t.kind === 'remember'),
    tactics: tips.filter((t) => t.kind !== 'remember'),
    formulae: formulaeOf(topic),
    keyPoints: keyPointsOf(topic),
    traps: topic.examTechnique.examinerErrors,
    grade9: topic.examTechnique.grade9Looks,
  }
}

/** True when there is enough on the sheet to be worth opening. */
export function cheatSheetHasContent(sheet: CheatSheet): boolean {
  return sheet.memoryHooks.length + sheet.tactics.length + sheet.formulae.length + sheet.keyPoints.length > 0
}
