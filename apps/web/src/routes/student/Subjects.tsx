import { SUBJECTS } from '@study/shared'
import { Link } from 'react-router'
import { Placeholder } from '../../components/Placeholder.tsx'

export function Subjects() {
  return (
    <Placeholder
      area={'Student'}
      title={'Your subjects'}
      description="Every subject the student is taking, with its board, target grade, and how many topics are Grade 9 ready."
      stories={["LRN-1", "LRN-6"]}
      blocks={["Subject cards with Grade 9 ready count", "Target grade per subject", "Exam technique guide link per subject"]}
    >
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SUBJECTS.map((s) => (
          <li key={s.id}>
            <Link
              to={`/subjects/${s.id}`}
              style={{ '--subject': s.colour } as React.CSSProperties}
              className="flex items-center gap-3 rounded-xl border border-rule bg-surface px-4 py-3 hover:border-[color:var(--subject)]"
            >
              <span className="h-3 w-3 rounded-sm" style={{ background: s.colour }} aria-hidden />
              <span className="flex flex-col">
                <span className="font-bold">{s.name}</span>
                <span className="text-xs text-ink-2">{s.board} · Phase {s.phase}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Placeholder>
  )
}
