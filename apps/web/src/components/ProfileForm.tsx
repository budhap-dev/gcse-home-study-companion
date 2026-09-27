import { useState } from 'react'
import { SUBJECTS } from '@study/shared'
import { topicsForSubject } from '../content/index.ts'
import { setProfile, type Profile } from '../progress/store.ts'

const OFFERED = SUBJECTS.filter((s) => topicsForSubject(s.id).length > 0)

/**
 * Year, subjects and exam dates (UXI-10). Used on first visit and in Settings. Everything is
 * optional: no subject ticked means every subject, and an exam date left blank is simply not
 * shown. Nothing here is required to use the app.
 */
export function ProfileForm({ profile, onSaved, saveLabel = 'Save' }: { profile: Profile; onSaved?: () => void; saveLabel?: string }) {
  const [year, setYear] = useState<Profile['year']>(profile.year)
  const [subjects, setSubjects] = useState<string[]>(profile.subjects?.length ? profile.subjects : OFFERED.map((s) => s.id))
  const [dates, setDates] = useState<Record<string, string>>(profile.examDates ?? {})
  const [saved, setSaved] = useState(false)
  const toggle = (id: string) => { setSaved(false); setSubjects((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id])) }
  const save = () => {
    const examDates = Object.fromEntries(Object.entries(dates).filter(([id, d]) => d && subjects.includes(id)))
    // Every subject ticked is the same as none: the full list, and new subjects join it.
    setProfile({ year, subjects: subjects.length === OFFERED.length ? undefined : subjects, examDates, setupAt: new Date().toISOString() })
    setSaved(true)
    onSaved?.()
  }
  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-bold">Your school year</legend>
        <div className="flex gap-2">
          {([9, 10, 11] as const).map((y) => (
            <button key={y} type="button" aria-pressed={year === y} onClick={() => { setSaved(false); setYear(y) }}
              className={`h-11 min-w-20 rounded-xl px-4 font-bold ${year === y ? 'bg-ink text-surface' : 'border border-rule bg-surface'}`}>Year {y}</button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-bold">The subjects you take</legend>
        <p className="text-sm text-ink-2">The plan and your subject list show only these. The rest stay one tap away under Subjects.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {OFFERED.map((s) => (
            <label key={s.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-rule bg-surface px-3 py-2">
              <input type="checkbox" checked={subjects.includes(s.id)} onChange={() => toggle(s.id)} className="h-5 w-5" />
              <span className="h-3 w-3 rounded-sm" style={{ background: s.colour }} aria-hidden />
              <span className="font-bold">{s.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-bold">Exam dates, if you know them</legend>
        <p className="text-sm text-ink-2">The date of each subject's first paper. Leave any blank; you can add them later in Settings.</p>
        <div className="flex flex-col gap-2">
          {OFFERED.filter((s) => subjects.includes(s.id)).map((s) => (
            <label key={s.id} className="flex items-center justify-between gap-3">
              <span className="text-sm">{s.name}</span>
              <input type="date" value={dates[s.id] ?? ''} onChange={(e) => { setSaved(false); setDates((d) => ({ ...d, [s.id]: e.target.value })) }}
                className="h-10 rounded-lg border border-rule bg-surface px-2" />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={subjects.length === 0} className="h-12 rounded-xl bg-ink px-5 font-bold text-surface disabled:opacity-40">{saveLabel}</button>
        {saved && <span className="text-sm text-ink-2" role="status">Saved.</span>}
        {subjects.length === 0 && <span className="text-sm text-ink-2">Tick at least one subject.</span>}
      </div>
    </div>
  )
}

/** Days from today to an ISO date, for an exam countdown; undefined for a date already past. */
export function daysUntil(iso: string, today = new Date()): number | undefined {
  const d = Math.round((Date.parse(iso + 'T12:00:00') - Date.parse(today.toISOString().slice(0, 10) + 'T12:00:00')) / 86400000)
  return d >= 0 ? d : undefined
}
