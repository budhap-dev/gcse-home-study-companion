import type { Week } from '../../progress/charts.ts'

/**
 * Days on goal per week: how many days of each week reached the daily minutes goal.
 *
 * Bars rather than a pie: the question is whether the habit is holding, and that is a
 * shape over time, not a share of a whole. Each week has a faint track as tall as the days
 * that had a goal (days off, and days still to come, have none), and the bar fills it as the
 * goal is met, so a full bar is a week with no day missed whatever the days off.
 *
 * Until 6 October 2026 this drew minutes per week against a weekly goal; the goal became
 * daily because a week was too far off to aim at.
 */
export function WeeklyBars({ weeks, goal }: { weeks: Week[]; goal: number }) {
  const total = weeks.reduce((s, w) => s + w.minutes, 0)
  const met = weeks.reduce((s, w) => s + w.goal.met, 0)
  return (
    <div className="flex flex-col gap-2">
      {/* Each column is h-full because a percentage height resolves against its parent's
          height: in an auto-height column every bar computed to zero and drew nothing. */}
      <div className="flex h-32 items-end gap-1.5">
        {weeks.map((w) => (
          <span key={w.start} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
            title={`Week of ${w.label}: goal met on ${w.goal.met} of ${w.goal.of} ${w.goal.of === 1 ? 'day' : 'days'}, ${w.minutes} minutes in all`}>
            <span className="text-[11px] tabular-nums text-ink-3">{w.goal.of > 0 ? `${w.goal.met}/${w.goal.of}` : ''}</span>
            <span className="relative w-full rounded-t bg-panel" style={{ height: `${Math.max(2, (100 * w.goal.of) / 7)}%` }}>
              {w.goal.met > 0 && (
                <span
                  className={`absolute inset-x-0 bottom-0 rounded-t ${w.goal.met >= w.goal.of ? 'bg-status-secure' : 'bg-status-developing'}`}
                  style={{ height: `${(100 * w.goal.met) / w.goal.of}%` }}
                />
              )}
            </span>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        {weeks.map((w) => <span key={w.start} className="min-w-0 flex-1 truncate text-center text-[11px] text-ink-3">{w.label}</span>)}
      </div>
      <p className="text-xs text-ink-2">
        {goal} minutes reached on {met} {met === 1 ? 'day' : 'days'} over {weeks.length} weeks · {total} minutes in all
      </p>
    </div>
  )
}
