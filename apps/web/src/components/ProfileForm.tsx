import { useState } from 'react'
import { setProfile, type Profile } from '../progress/store.ts'

/**
 * The student's school year (UXI-10). Used on first visit and in Settings. Optional: nothing
 * here is required to use the app.
 *
 * It once asked for each subject's exam date too, for a countdown on Home. That was taken out
 * on 28 September 2026: school exams follow the topics taught, so the dates are not known in
 * advance, and a countdown to a guessed date would mislead. The tick list of subjects taken
 * went on 1 October 2026 ("not useful for now"): the plan and the map cover every subject.
 *
 * `legend` hides the group's name where the page already shows it as a heading (Settings);
 * screen readers still hear it.
 */
export function ProfileForm({ profile, onSaved, saveLabel = 'Save', legend = 'shown' }: { profile: Profile; onSaved?: () => void; saveLabel?: string; legend?: 'shown' | 'hidden' }) {
  const [year, setYear] = useState<Profile['year']>(profile.year)
  const [saved, setSaved] = useState(false)
  const save = () => {
    setProfile({ year, setupAt: new Date().toISOString() })
    setSaved(true)
    onSaved?.()
  }
  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className={legend === 'hidden' ? 'sr-only' : 'mb-1 font-bold'}>Your school year</legend>
        <div className="flex gap-2">
          {([9, 10, 11] as const).map((y) => (
            <button key={y} type="button" aria-pressed={year === y} onClick={() => { setSaved(false); setYear(y) }}
              className={`h-11 min-w-20 rounded-xl px-4 font-bold ${year === y ? 'bg-ink text-surface' : 'border border-rule bg-surface'}`}>Year {y}</button>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} className="h-12 rounded-xl bg-ink px-5 font-bold text-surface">{saveLabel}</button>
        {saved && <span className="text-sm text-ink-2" role="status">Saved.</span>}
      </div>
    </div>
  )
}
