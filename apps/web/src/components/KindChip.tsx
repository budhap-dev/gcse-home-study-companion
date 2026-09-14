import { Smiley } from './Smiley.tsx'

/** Colour and emoji for each kind of lesson step, so the flow of a lesson reads at a glance. */
export const KINDS = {
  explain: { label: 'Explain', colour: 'var(--subject)', emoji: '💡' },
  'worked-example': { label: 'Worked example', colour: '#1f3a93', emoji: '🛠️' },
  'your-turn': { label: 'Your turn', colour: '#c27a00', emoji: '✍️' },
  'grade-9': { label: 'Go deeper', colour: '#6B4E9B', emoji: '🏆' },
  summary: { label: 'Summary', colour: '#2e8b57', emoji: '📌' },
  check: { label: 'Check', colour: '#c8501f', emoji: '❓' },
} as const

export function KindChip({ kind, label }: { kind: keyof typeof KINDS; label?: string }) {
  const k = KINDS[kind]
  return (
    <span className="chip" style={{ '--chip': k.colour } as React.CSSProperties}>
      <Smiley>{k.emoji}</Smiley>{label ?? k.label}
    </span>
  )
}

/** A coloured section heading: chip-style label with an optional emoji. */
export function SectionLabel({ children, colour = 'var(--subject)', emoji }: { children: string; colour?: string; emoji?: string }) {
  return (
    <h2 className="chip w-fit" style={{ '--chip': colour } as React.CSSProperties}>
      {emoji && <Smiley>{emoji}</Smiley>}{children}
    </h2>
  )
}
