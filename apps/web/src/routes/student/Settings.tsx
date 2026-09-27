import { useEffect, useState } from 'react'
import { signOut, useAuth } from '../../auth/useAuth.ts'
import { FamilyPanel } from '../../auth/FamilyPanel.tsx'
import { AUTO_THEME, THEMES, applyTheme, currentThemeId, resolveTheme } from '../../theme/themes.ts'
import { setPref, usePref } from '../../theme/prefs.ts'
import { APP_BUILT, VERSION_LABEL } from '../../app/version.ts'
import { clearProgress, isoDate, setGoalMinutes, toggleDayOff, weekDays } from '../../progress/store.ts'
import { useProgress } from '../../progress/useProgress.ts'
import { ProfileForm } from '../../components/ProfileForm.tsx'

export function Settings() {
  const progress = useProgress()
  // Home's "Set up" card links to #you; the router does not scroll to a hash by itself.
  useEffect(() => {
    if (location.hash === '#you') document.getElementById('you')?.scrollIntoView({ block: 'start' })
  }, [])
  const [goal, setGoal] = useState(String(progress.goalMinutes))
  const [confirmClear, setConfirmClear] = useState(false)
  const days = weekDays()
  const today = isoDate()
  const [theme, setTheme] = useState(currentThemeId)
  const motion = usePref('motion')
  const smileys = usePref('smileys')

  return (
    <article className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold leading-tight">Settings</h1>
        <p className="text-ink-2">Theme and preferences live on this device. Progress follows your account when family sign-in is set up.</p>
      </header>

      <section id="you" className="flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-4">
        <h2 className="font-bold">Your year and subjects</h2>
        <ProfileForm profile={progress.profile ?? {}} />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-4">
        <h2 className="font-bold">Theme</h2>
        <p className="text-sm text-ink-2">Pick the look you like. Subject colours stay the same in every theme.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
          {[AUTO_THEME, ...THEMES].map((t) => {
            const on = t.id === theme
            // The device choice shows a swatch of both themes it moves between.
            const swatches = t.id === AUTO_THEME.id ? [resolveTheme(t.id, false), resolveTheme(t.id, true)] : [resolveTheme(t.id)]
            return (
              <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => { applyTheme(t.id); setTheme(t.id) }} className={`press flex flex-col gap-2 rounded-xl border-2 p-3 text-left ${on ? 'border-[color:var(--subject)]' : 'border-rule'}`}>
                <span className="flex h-10 w-full gap-1" aria-hidden>
                  {swatches.map((s) => {
                    const v = (k: string, fallback: string) => s.vars[k] ?? fallback
                    return (
                      <span key={s.id} className="flex h-full flex-1 items-end gap-1 rounded-lg p-1.5" style={{ background: v('--color-paper', '#f7f5ef') }}>
                        <span className="h-full w-1/3 rounded" style={{ background: v('--color-panel', '#f0ede4') }} />
                        <span className="h-2/3 w-1/3 rounded" style={{ background: v('--color-ink', '#1e2330') }} />
                        {/* The theme's banner gradient, which the map look paints its headers in. */}
                        <span className="h-1/2 w-1/3 rounded" style={{ background: `linear-gradient(135deg, ${v('--hero-1', '#0b6e78')}, ${v('--hero-2', '#5a4bd1')}, ${v('--hero-3', '#a83e6b')})` }} />
                      </span>
                    )
                  })}
                </span>
                <span className="text-sm font-bold">{t.name}</span>
                <span className="text-xs text-ink-2">{t.blurb}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-4">
        <h2 className="font-bold">Animations and smileys</h2>
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
          <span className="flex flex-col"><span className="font-bold">Animations</span><span className="text-sm text-ink-2">Confetti, pops, and page transitions. Also off when the device asks for reduced motion.</span></span>
          <input type="checkbox" checked={motion} onChange={(e) => setPref('motion', e.target.checked)} className="h-6 w-6" />
        </label>
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
          <span className="flex flex-col"><span className="font-bold">Smileys</span><span className="text-sm text-ink-2">Faces and stickers on feedback, scores, and badges.</span></span>
          <input type="checkbox" checked={smileys} onChange={(e) => setPref('smileys', e.target.checked)} className="h-6 w-6" />
        </label>
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
                <span className="text-[11px] font-normal">{d.slice(8)}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-4">
        <h2 className="font-bold">About</h2>
        <p className="text-sm text-ink-2">GCSE Home Study Companion {VERSION_LABEL}, built {APP_BUILT}.</p>
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

      <section className="flex flex-col gap-2 rounded-2xl border border-rule bg-surface p-4">
        <h2 className="font-bold">Account</h2>
        <AccountPanel />
      </section>
      <FamilySection />
    </article>
  )
}


function AccountPanel() {
  const auth = useAuth()
  if (auth.status === 'disabled') return <p className="text-sm text-ink-2">Sign-in is not set up on this copy of the app, so progress stays on this device.</p>
  if (auth.status !== 'allowed') return <p className="text-sm text-ink-2">Not signed in.</p>
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-3 text-sm">
        {auth.avatar && <img src={auth.avatar} alt="" className="h-9 w-9 rounded-full" referrerPolicy="no-referrer" />}
        <span>Signed in as <strong>{auth.name ?? auth.email}</strong> ({auth.email}, {auth.role}). Progress is saved to this account and follows you between devices.</span>
      </p>
      <button type="button" onClick={() => void signOut()} className="h-11 shrink-0 rounded-xl border border-rule bg-surface px-4 font-bold">Sign out</button>
    </div>
  )
}

function FamilySection() {
  const auth = useAuth()
  if (auth.status !== 'allowed') return null
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-rule bg-surface p-4">
      <h2 className="font-bold">Family</h2>
      <FamilyPanel />
    </section>
  )
}
