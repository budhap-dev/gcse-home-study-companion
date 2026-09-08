import type { Question } from './content/questions.ts'

export interface MarkResult {
  correct: boolean
  marksScored: number
  marksAvailable: number
}

const SUPERSCRIPTS: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' }

/**
 * Superscript digits and signs to caret form, so x⁸ and x^8 compare equal. Also:
 * Unicode minus and dashes to a hyphen, √ and "root" to sqrt, brackets around a root
 * argument dropped, multiplication signs dropped, and a leading "y=" dropped so
 * "y = 2x - 2" and "2x-2" compare equal.
 */
export function normaliseText(s: string): string {
  let out = s.toLowerCase()
  out = out.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (run) => '^' + [...run].map((c) => SUPERSCRIPTS[c] ?? c).join(''))
  return out
    .replace(/\s+/g, '')
    .replace(/[−–—]/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/√\(([^)]+)\)/g, 'sqrt$1')
    .replace(/√/g, 'sqrt')
    .replace(/sqrt\(([^)]+)\)/g, 'sqrt$1')
    .replace(/root/g, 'sqrt')
    .replace(/\*/g, '')
    .replace(/[{}]/g, '')
    .replace(/\^\(([^)]+)\)/g, '^$1')
    .replace(/^y=/, '')
}

/** Parses "0.25", "1/4", "-2", "3 m/s", "1,000". Returns undefined when it is not a number. */
export function parseNumber(input: string, units?: string): number | undefined {
  let s = input.trim().toLowerCase().replace(/,/g, '')
  if (units) s = s.replace(units.toLowerCase(), '').trim()
  s = s.replace(/[a-z°%]+$/i, '').trim()
  const frac = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/)
  if (frac) {
    const d = Number(frac[2])
    return d === 0 ? undefined : Number(frac[1]) / d
  }
  if (!/^-?\d*\.?\d+(e-?\d+)?$/.test(s)) return undefined
  return Number(s)
}

/**
 * Marks an auto-markable answer. Extended responses are self-assessed and return
 * whatever marks the student awarded themselves, capped at the marks available.
 * `answer` shapes: multiple-choice number[]; numeric string; short-text string;
 * ordering number[] (indexes into items in the student's order); labelling
 * Record<labelId, labelId placed>; extended number (self-awarded marks).
 */
export function mark(question: Question, answer: unknown): MarkResult {
  const available = question.marks
  const result = (correct: boolean): MarkResult => ({ correct, marksScored: correct ? available : 0, marksAvailable: available })
  switch (question.type) {
    case 'multiple-choice': {
      const chosen = Array.isArray(answer) ? [...(answer as number[])].sort() : []
      const correct = [...question.correct].sort()
      return result(chosen.length === correct.length && chosen.every((v, i) => v === correct[i]))
    }
    case 'numeric': {
      const value = typeof answer === 'string' ? parseNumber(answer, question.units) : typeof answer === 'number' ? answer : undefined
      if (value === undefined) return result(false)
      return result(Math.abs(value - question.answer) <= question.tolerance + 1e-9)
    }
    case 'short-text': {
      const given = normaliseText(String(answer ?? ''))
      return result(given.length > 0 && question.accepted.some((a) => normaliseText(a) === given))
    }
    case 'ordering': {
      const order = Array.isArray(answer) ? (answer as number[]) : []
      return result(order.length === question.items.length && order.every((v, i) => v === i))
    }
    case 'labelling': {
      const placed = (answer ?? {}) as Record<string, string>
      return result(question.labels.every((l) => placed[l.id] === l.id))
    }
    case 'extended': {
      const self = typeof answer === 'number' ? Math.max(0, Math.min(available, Math.round(answer))) : 0
      return { correct: self === available, marksScored: self, marksAvailable: available }
    }
  }
}
