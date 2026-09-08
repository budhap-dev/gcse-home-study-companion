import { useState } from 'react'
import { THEMES, applyTheme, currentThemeId } from '../../theme/themes.ts'
import { clearProgress, isoDate, setGoalMinutes, toggleDayOff, weekDays } from '../../progress/store.ts'
import { useProgress } from '../../progress/useProgress.ts'

export function Settings() {
  const progress = useProgress()
  const [goal, setGoal] = useState(String(progress.goalMinutes))
  const [confirmClear, setConfirmClear] = useState(false)
  const days = weekDays()
  const today = isoDate()
  const [theme, setTheme] = useState(currentThemeId)

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold leading-tight">Settings</h1>
        <p className="text-ink-2">Everything here lives on this device. Sign-in to keep progress across devices comes later.</p>
      </header>

      <section className="flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-4">
        <h2 className="font-bold">Theme</h2>
        <p className="text-sm text-ink-2">Pick the look you like. Subject colours stay the same in every theme.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => {
            const on = t.id === theme
            const paper = t.vars['--color-paper'] ?? '#f7f5ef'
            const ink = t.vars['--color-ink'] ?? '#1e2330'
            const panel = t.vars['--color-panel'] ?? '#f0ede4'
            return (
              <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => { applyTheme(t.id); setTheme(t.id) }} className={`flex flex-col gap-2 rounded-xl border-2 p-3 text-left ${on ? 'border-[color:var(--subject)]' : 'border-rule'}`}>
                <span className="flex h-10 w-full items-end gap-1 rounded-lg p-1.5" style={{ background: paper }} aria-hidden>
                  <span className="h-full w-1/3 rounded" style={{ background: panel }} />
                  <span className="h-2/3 w-1/3 rounded" style={{ background: ink }} />
                  <span className="h-1/2 w-1/3 rounded bg-[#0E7A86]" />
                </span>
                <span className="text-sm font-bold">{t.name}</span>
                <span className="text-xs text-ink-2">{t.blurb}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-4">
        <h2 className="font-bold">Weekly goal</h2>
        <p className="text-sm text-ink-2">Minutes of study per week. The ring on the home screen fills towards it.</p>
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); setGoalMinutes(Number(goal)) }}>
          <input type="number" inputMode="numeric" min={30} max={2000} step={10} value={goal} onChange={(e) => setGoal(e.target.value)} className="h-11 w-28 rounded-lg border border-rule px-3 text-lg" aria-label="Weekly goal in minutes" />
          <span className="text-sm text-ink-2">minutes</span>
          <button type="submit" className="ml-auto h-11 rounded-lg bg-ink px-4 font-bold text-surface">Save</button>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-4">
        <h2 className="font-bold">Days off this week</h2>
        <p className="text-sm text-ink-2">A day off does not break the streak.</p>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const on = progress.daysOff.includes(d)
            return (
              <button key={d} type="button" aria-pressed={on} onClick={() => toggleDayOff(d)} className={`flex h-14 flex-col items-center justify-center rounded-lg text-xs font-bold ${on ? 'bg-ink text-surface' : 'border border-rule'} ${d === today ? 'ring-2 ring-[color:var(--subject)] ring-offset-1' : ''}`}>
                <span>{new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2)}</span>
                <span className="text-[10px] font-normal">{d.slice(8)}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-4">
        <h2 className="font-bold">Clear progress</h2>
        <p className="text-sm text-ink-2">Removes every attempt, lesson position, and study minute from this device. Cannot be undone.</p>
        {confirmClear ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => { clearProgress(); setConfirmClear(false) }} className="h-11 rounded-lg bg-status-not-secure px-4 font-bold text-white">Yes, clear everything</button>
            <button type="button" onClick={() => setConfirmClear(false)} className="h-11 rounded-lg border border-rule px-4 font-bold">Keep it</button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmClear(true)} className="h-11 w-fit rounded-lg border border-rule px-4 font-bold">Clear progress on this device</button>
        )}
      </section>
    </article>
  )
}
