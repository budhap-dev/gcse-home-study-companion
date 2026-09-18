import type { Week } from '../../progress/charts.ts'

/**
 * Minutes per week against the goal.
 *
 * Bars rather than a pie: the question is whether the habit is holding, and that is a
 * shape over time, not a share of a whole. The goal is a dashed line across the chart so
 * a short week is obvious without reading any numbers.
 *
 * The scale is the larger of the goal and the best week, so a week that beat the goal is
 * not clipped and the goal line never sits off the top.
 */
export function WeeklyBars({ weeks, goal }: { weeks: Week[]; goal: number }) {
  const best = Math.max(goal, ...weeks.map((w) => w.minutes), 1)
  const total = weeks.reduce((s, w) => s + w.minutes, 0)
  const met = weeks.filter((w) => w.minutes >= goal).length
  return (
    <div className="flex flex-col gap-2">
      <div className="relative flex h-32 items-end gap-1.5">
        {/* The goal, drawn behind the bars so a bar that clears it reads as clearing it. */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-3"
          style={{ bottom: `${(100 * goal) / best}%` }} />
        {/* Each column is h-full because a percentage height resolves against its parent's
            height: in an auto-height column every bar computed to zero and drew nothing. */}
        {weeks.map((w) => (
          <span key={w.start} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${w.minutes} minutes in the week of ${w.label}`}>
            <span className="text-[10px] tabular-nums text-ink-3">{w.minutes || ''}</span>
            <span
              className={`w-full rounded-t ${w.minutes >= goal ? 'bg-status-secure' : w.minutes > 0 ? 'bg-status-developing' : 'bg-panel'}`}
              style={{ height: `${Math.max(w.minutes > 0 ? 3 : 2, (100 * w.minutes) / best)}%` }}
            />
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        {weeks.map((w) => <span key={w.start} className="min-w-0 flex-1 truncate text-center text-[10px] text-ink-3">{w.label}</span>)}
      </div>
      <p className="text-xs text-ink-2">
        {total} minutes over {weeks.length} weeks · goal of {goal} met in {met} of {weeks.length}
      </p>
    </div>
  )
}
