import type { ProgressState } from './store.ts'

export interface PartsDone {
  lesson: boolean
  core: boolean
  higher: boolean
  advanced: boolean
  quiz: boolean
}

/** Which of a topic's five parts have been done at least once: the lesson finished, each worksheet and the quiz attempted. */
export function partsDone(topicId: string, state: Pick<ProgressState, 'lessons' | 'attempts'>): PartsDone {
  const mine = state.attempts.filter((a) => a.topicId === topicId)
  const sheet = (level: string) => mine.some((a) => a.kind === 'worksheet' && a.level === level)
  return {
    lesson: Boolean(state.lessons[topicId]?.completedAt),
    core: sheet('core'),
    higher: sheet('higher'),
    advanced: sheet('advanced'),
    quiz: mine.some((a) => a.kind === 'quiz'),
  }
}

export const PART_LETTERS: [keyof PartsDone, string, string][] = [
  ['lesson', 'L', 'Lesson'],
  ['core', 'C', 'Core worksheet'],
  ['higher', 'H', 'Higher worksheet'],
  ['advanced', 'A', 'Advanced worksheet'],
  ['quiz', 'Q', 'Quiz'],
]

/** "Lesson and Core worksheet done; Higher worksheet, Advanced worksheet and Quiz not yet", for a screen reader. */
export function partsLabel(done: PartsDone): string {
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)
  const yes = PART_LETTERS.filter(([k]) => done[k]).map(([, , name]) => name)
  const no = PART_LETTERS.filter(([k]) => !done[k]).map(([, , name]) => name)
  if (!yes.length) return 'Nothing done yet'
  if (!no.length) return 'All five parts done'
  return `${list(yes)} done; ${list(no)} not yet`
}
