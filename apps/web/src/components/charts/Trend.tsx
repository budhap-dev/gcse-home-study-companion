import type { SubjectTrend, TrendWeek } from '../../progress/trend.ts'

/**
 * Eight weeks of one subject (PAR-5): a column per week, as tall as its minutes, with the
 * average mark on that week's quizzes and worksheets under it. Minutes and marks on one
 * chart, because the question is whether more time is turning into better marks. Weeks
 * with nothing in them keep their column, since a gap is the most telling shape here.
 */
export function TrendBars({ weeks }: { weeks: TrendWeek[] }) {
  const most = Math.max(30, ...weeks.map((w) => w.minutes))
  const said = weeks.map((w) => `week of ${w.label}: ${w.minutes} min${w.avgPct !== undefined ? `, average ${w.avgPct}%` : ''}`).join('; ')
  return (
    <div className="flex flex-col gap-1.5" role="img" aria-label={`Minutes and average mark by week. ${said}`}>
      {/* Each column is h-full because a percentage height resolves against its parent's
          height: in an auto-height column every bar computed to zero and drew nothing. */}
      <div className="flex h-28 items-end gap-1.5">
        {weeks.map((w) => (
          <span key={w.start} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            {w.minutes > 0 && <span className="text-[11px] tabular-nums text-ink-2">{w.minutes}</span>}
            <span className="w-full rounded-t" style={{ height: `${Math.max(2, (100 * w.minutes) / most)}%`, background: w.minutes ? 'var(--subject)' : 'var(--color-panel)' }} />
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        {weeks.map((w) => (
          <span key={w.start} className={`min-w-0 flex-1 text-center text-[11px] font-bold tabular-nums ${w.avgPct === undefined ? 'text-ink-3' : ''}`}>
            {w.avgPct === undefined ? '–' : `${w.avgPct}%`}
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        {weeks.map((w) => <span key={w.start} className="min-w-0 flex-1 truncate text-center text-[11px] text-ink-3">{w.label}</span>)}
      </div>
    </div>
  )
}

/**
 * Eight weeks of every subject with anything in them (PAR-5), as a table: minutes in bold
 * and the week's average mark under them. A table rather than eight small charts, because
 * a parent reads the numbers; it scrolls sideways on a phone rather than squeezing.
 */
export function TrendTable({ weeks, subjects }: { weeks: { start: string; label: string }[]; subjects: SubjectTrend[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-rule bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-2">
            <th className="px-2 py-2 font-bold">Subject</th>
            {weeks.map((w) => <th key={w.start} className="whitespace-nowrap px-2 py-2 text-center font-bold">{w.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {subjects.map((s) => (
            <tr key={s.subjectId} className="border-t border-rule/60">
              <td className="whitespace-nowrap px-2 py-2 font-bold"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.colour }} aria-hidden />{s.name}</td>
              {s.weeks.map((w) => (
                <td key={w.start} className="px-2 py-2 text-center tabular-nums">
                  {w.minutes || w.marked ? (
                    <span className="flex flex-col leading-tight">
                      <span className="font-bold">{w.minutes}</span>
                      <span className="text-xs text-ink-2">{w.avgPct !== undefined ? `${w.avgPct}%` : ''}</span>
                    </span>
                  ) : <span className="text-ink-3">–</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
