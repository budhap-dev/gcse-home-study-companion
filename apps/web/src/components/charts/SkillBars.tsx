import { SUBJECTS } from '@study/shared'
import type { SkillStat } from '../../progress/xp.ts'

const subjectName = new Map<string, string>(SUBJECTS.map((s) => [s.id, s.name]))

/** Weak, middling, strong. The bands the app already uses for strengths and weaknesses. */
const colourFor = (pct: number) => (pct < 60 ? 'var(--color-status-not-secure)' : pct < 80 ? 'var(--color-status-developing)' : 'var(--color-status-secure)')

/**
 * Skills as ranked horizontal bars, weakest at the top.
 *
 * Bars rather than a pie, and deliberately: these are values to compare against each
 * other, and a length is far easier to compare than an angle. They are also not parts of
 * any whole — a set of percentages that happen to be listed together does not add to
 * anything — so a pie would be drawing a relationship that is not there.
 *
 * Colour carries the same three bands the rest of the app uses, and the number is printed
 * beside every bar so colour is never the only thing saying how it went.
 */
export function SkillBars({ skills, empty }: { skills: SkillStat[]; empty: string }) {
  if (skills.length === 0) return <p className="text-sm text-ink-2">{empty}</p>
  return (
    <ul className="flex flex-col gap-2">
      {skills.map((s) => (
        <li key={`${s.subjectId}|${s.skill}`} className="flex flex-col gap-1">
          <span className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">
              {s.skill}
              <span className="text-ink-3"> · {subjectName.get(s.subjectId) ?? s.subjectId}</span>
            </span>
            <strong className="shrink-0 tabular-nums">{s.pct}%</strong>
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-panel">
              <span className="block h-full rounded-full" style={{ width: `${Math.max(2, s.pct)}%`, background: colourFor(s.pct) }} />
            </span>
            <span className="w-16 shrink-0 text-right text-[11px] text-ink-3">{s.attempts} question{s.attempts === 1 ? '' : 's'}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
