import { useState } from 'react'
import { SectionLabel } from '../../components/KindChip.tsx'
import { MapLegend, TopicMark, squaresGrid } from '../../components/map/MapParts.tsx'
import { topicsForSubject, yearsForSubject } from '../../content/index.ts'
import { isSecure, unitGroups } from '../../progress/map.ts'
import type { ProgressState } from '../../progress/store.ts'

/**
 * The child's map of one subject, as they see it on their own subject page (PAR-2): every
 * topic a tile shaded by how well it is known, grouped by unit, opened on the child's own
 * year. Read only, like the rest of the parent's view: a tile names its topic and level and
 * does nothing when pressed. The tiles carry their names at every width, since there is no
 * panel here to name a square.
 */
export function ChildMap({ state, subjectId, first }: { state: ProgressState; subjectId: string; first: string }) {
  const years = yearsForSubject(subjectId)
  const mine = state.profile?.year
  const [year, setYear] = useState<number | 'all'>(mine && years.includes(mine) ? mine : 'all')
  const all = topicsForSubject(subjectId)
  const groups = unitGroups(subjectId, year === 'all' ? all : all.filter((t) => t.year === year), state)
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SectionLabel colour="#5a4bd1" emoji="🗺️">{`The map, as ${first} sees it`}</SectionLabel>
        {years.length > 1 && (
          <div role="group" aria-label="School year" className="flex w-fit flex-wrap gap-1 rounded-xl bg-panel p-1">
            {(['all', ...years] as const).map((y) => (
              <button key={y} type="button" aria-pressed={year === y} onClick={() => setYear(y)}
                className={`min-h-9 rounded-lg px-3 text-sm font-bold transition-colors ${year === y ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(30_35_48/0.12)]' : 'text-ink-2 hover:text-ink'}`}>
                {y === 'all' ? 'All years' : `Year ${y}`}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-sm text-ink-2">One tile per topic, darker the better it is known, grouped by unit. The same picture {first} sees, so a conversation can start from it.</p>
      <MapLegend />
      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
        {groups.map((g) => (
          <section key={g.id} className="flex flex-col gap-2.5 rounded-2xl border border-rule bg-surface p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-sans text-base font-bold leading-snug">{g.name}</h3>
              <span className="shrink-0 text-[13px] text-ink-2">{g.squares.filter(isSecure).length} of {g.squares.length} secure</span>
            </div>
            <div className={squaresGrid(true)}>
              {g.squares.map((s) => <TopicMark key={s.topic.id} square={s} />)}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}
