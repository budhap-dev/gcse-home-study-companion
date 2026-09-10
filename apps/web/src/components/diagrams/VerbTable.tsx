import { ACCENT, DISPLAY, FONT, INK, INK_2, RULE } from './index.tsx'

/**
 * A conjugation with the stem and the ending drawn apart. That split is the whole lesson:
 * once a student sees that the stem stays put and only the ending moves, a tense becomes
 * six endings to learn rather than six words. Irregular forms are marked so they are not
 * mistaken for the pattern.
 *
 * Props: `infinitive`, `tense`, `stem` (shown once above), and `forms`: one entry per
 * person as { person, stem?, ending, irregular? }. A per-form `stem` overrides the shared
 * one, which is how avoir and être are shown.
 */
interface Form {
  person: string
  stem?: string
  ending: string
  irregular?: boolean
}

export function VerbTable({ props, alt }: { props: Record<string, unknown>; alt: string }) {
  const infinitive = String(props.infinitive ?? '')
  const tense = String(props.tense ?? '')
  const stem = props.stem === undefined ? '' : String(props.stem)
  const forms = (props.forms as Form[] | undefined) ?? []

  const rowH = 30
  const headH = stem ? 54 : 30
  const W = 400
  const H = headH + forms.length * rowH + 16
  const personX = 16
  const splitX = 170

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 460 }} role="img" aria-label={alt}>
      <text x={personX} y={18} fontFamily={DISPLAY} fontSize="14" fontWeight="700" fill={INK}>
        {infinitive}
        {tense && <tspan fontFamily={FONT} fontSize="12" fontWeight="400" fill={INK_2}>{`  ·  ${tense}`}</tspan>}
      </text>

      {stem && (
        <text x={personX} y={40} fontFamily={FONT} fontSize="12" fill={INK_2}>
          stem <tspan fontFamily={DISPLAY} fontSize="13" fontWeight="700" fill={ACCENT}>{stem}</tspan> stays the same; only the ending changes
        </text>
      )}

      {forms.map((form, i) => {
        const y = headH + i * rowH
        const rowStem = form.stem ?? stem
        return (
          <g key={i}>
            <line x1={personX} y1={y + 6} x2={W - 16} y2={y + 6} stroke={RULE} />
            <text x={personX} y={y + 24} fontFamily={FONT} fontSize="13" fill={INK_2}>{form.person}</text>
            <text x={splitX} y={y + 24} textAnchor="end" fontFamily={DISPLAY} fontSize="15" fontWeight="700" fill={form.irregular ? INK : INK_2}>
              {rowStem}
            </text>
            <text x={splitX + 1} y={y + 24} fontFamily={DISPLAY} fontSize="15" fontWeight="700" fill={form.irregular ? INK : ACCENT}>
              {form.ending}
            </text>
            {form.irregular && (
              <text x={splitX + 96} y={y + 24} fontFamily={FONT} fontSize="11" fill={INK_2}>irregular</text>
            )}
          </g>
        )
      })}
      <line x1={personX} y1={headH + forms.length * rowH + 6} x2={W - 16} y2={headH + forms.length * rowH + 6} stroke={RULE} />
    </svg>
  )
}
