import type { GradeBand } from './content/common.ts'
import type { SubjectId } from './subjects.ts'

/** XP per completed item, weighted by grade band. Points come only from attempts, never from time. */
export const XP = {
  lessonStep: 3,
  lessonComplete: 15,
  question: { '4-5': 4, '6-7': 6, '8-9': 10 } as Record<GradeBand, number>,
  /** Bonus on top of the question value for a fully correct answer. */
  correctBonus: { '4-5': 2, '6-7': 4, '8-9': 8 } as Record<GradeBand, number>,
  cleanSweep: 25,
} as const

/** Cumulative XP needed to reach each level. Level 1 starts at 0. */
export const LEVEL_THRESHOLDS = [0, 60, 150, 300, 500, 800, 1200, 1700, 2400, 3200, 4200]

/** Subject-themed level names, one per level. */
export const LEVEL_NAMES: Record<SubjectId, string[]> = {
  maths: ['Counter', 'Adder', 'Multiplier', 'Factoriser', 'Solver', 'Grapher', 'Algebraist', 'Geometer', 'Prover', 'Analyst', 'Mathematician'],
  'further-maths': ['Integer', 'Surd', 'Polynomial', 'Function', 'Gradient', 'Tangent', 'Derivative', 'Matrix', 'Identity', 'Proof', 'Further mathematician'],
  physics: ['Milli', 'Centi', 'Deci', 'Unit', 'Deca', 'Hecto', 'Kilo', 'Mega', 'Giga', 'Tera', 'Peta'],
  chemistry: ['Hydrogen', 'Helium', 'Lithium', 'Carbon', 'Oxygen', 'Sodium', 'Iron', 'Copper', 'Silver', 'Gold', 'Platinum'],
  biology: ['Cell', 'Tissue', 'Organ', 'System', 'Organism', 'Population', 'Community', 'Ecosystem', 'Biome', 'Biosphere', 'Biologist'],
  'computer-science': ['Bit', 'Nibble', 'Byte', 'Kilobyte', 'Megabyte', 'Gigabyte', 'Terabyte', 'Petabyte', 'Exabyte', 'Zettabyte', 'Yottabyte'],
  business: ['Idea', 'Start-up', 'Sole trader', 'Partnership', 'Ltd', 'Brand', 'Franchise', 'PLC', 'Multinational', 'Conglomerate', 'Entrepreneur'],
  french: ['Débutant', 'A1', 'A1+', 'A2', 'A2+', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'Francophone'],
  music: ['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'sfz', 'Crescendo', 'Maestro'],
}

export interface LevelInfo {
  level: number
  name: string
  /** XP into the current level and the size of the level. */
  into: number
  span: number
  /** 0 to 1 progress through the current level. */
  progress: number
  nextName?: string
}

export function levelFor(subjectId: SubjectId, xp: number): LevelInfo {
  let level = 1
  while (level < LEVEL_THRESHOLDS.length && xp >= LEVEL_THRESHOLDS[level]!) level++
  const names = LEVEL_NAMES[subjectId]
  const floor = LEVEL_THRESHOLDS[level - 1]!
  const ceiling = LEVEL_THRESHOLDS[level] ?? floor + 1000
  const span = ceiling - floor
  return {
    level,
    name: names[Math.min(level - 1, names.length - 1)]!,
    into: xp - floor,
    span,
    progress: Math.min(1, (xp - floor) / span),
    nextName: names[Math.min(level, names.length - 1)],
  }
}

/** Badges name a learning event a parent would recognise. */
export interface Badge {
  id: string
  name: string
  description: string
  emoji: string
}

export const BADGES: Badge[] = [
  { id: 'first-lesson', name: 'First lesson', description: 'Finished a lesson from start to end.', emoji: '📖' },
  { id: 'first-quiz', name: 'First quiz', description: 'Completed a topic quiz.', emoji: '✏️' },
  { id: 'clean-sweep', name: 'Clean sweep', description: 'Scored 100% on a quiz.', emoji: '💯' },
  { id: 'advanced-first', name: 'Into the deep end', description: 'Finished an Advanced worksheet.', emoji: '🏊' },
  { id: 'secure-first', name: 'Secure', description: 'Took a topic to Secure.', emoji: '🔒' },
  { id: 'grade-9-first', name: 'Mastered', description: 'Took a topic all the way to mastered.', emoji: '⭐' },
  { id: 'grade-9-five', name: 'Five at the top', description: 'Five topics mastered.', emoji: '🌟' },
  { id: 'streak-3', name: 'Three in a row', description: 'Studied three days in a row.', emoji: '🔥' },
  { id: 'streak-7', name: 'Seven-day streak', description: 'Studied seven days in a row.', emoji: '🚀' },
  { id: 'streak-30', name: 'A whole month', description: 'Studied thirty days in a row.', emoji: '🏆' },
  { id: 'comeback', name: 'Comeback', description: 'Improved a quiz score by 20 points or more.', emoji: '📈' },
  { id: 'goal-week', name: 'Goal reached', description: 'Hit the weekly minutes goal.', emoji: '🎯' },
  { id: 'subject-explorer', name: 'Explorer', description: 'Finished lessons in two different subjects.', emoji: '🧭' },
]

/** Short messages by outcome, so feedback never reads as a form letter. */
export const MESSAGES = {
  perfect: ['You understand this. Could you explain it to someone else?', 'Every one right. This idea is yours now.', 'Clean sweep. Try the harder questions to see how far the idea stretches.'],
  great: ['Great effort. You have most of this.', 'Almost there. The one you missed is the one to learn from.', 'You clearly get the main idea. Look at the slip and it is complete.'],
  good: ['Good progress. Mistakes are where the learning happens.', 'You are getting there. Read the solutions for the ones you missed.', 'Half way to understanding this. Another go will show what has clicked.'],
  low: ["Let's try another question. Every wrong answer shows you something.", 'Tough one. Go back to the lesson and take it one step at a time.', 'This has not clicked yet, and that is normal. It will.'],
  improved: ['You learned something since last time. That is what counts.', 'Better than before. You can see yourself improving.', 'Up on last time. Whatever you did in between worked.'],
  levelUp: ['Level up.', 'New level unlocked.', 'You just moved up a level.'],
} as const

/** A face for an outcome, for screens that show smileys. */
export function emojiForScore(pct: number, previousPct?: number): string {
  if (previousPct !== undefined && pct - previousPct >= 10) return '🚀'
  if (pct === 100) return '🤩'
  if (pct >= 80) return '😄'
  if (pct >= 50) return '🙂'
  return '💪'
}

export function pick<T>(list: readonly T[], seed: number): T {
  return list[Math.abs(seed) % list.length]!
}

export function messageForScore(pct: number, previousPct?: number, seed = 0): string {
  if (previousPct !== undefined && pct - previousPct >= 10) return pick(MESSAGES.improved, seed)
  if (pct === 100) return pick(MESSAGES.perfect, seed)
  if (pct >= 80) return pick(MESSAGES.great, seed)
  if (pct >= 50) return pick(MESSAGES.good, seed)
  return pick(MESSAGES.low, seed)
}
