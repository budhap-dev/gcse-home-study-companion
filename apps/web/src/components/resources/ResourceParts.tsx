import { RESOURCE_STATUS_LABEL, isComingSoon, type Resource, type ResourceBlock, type ResourceStatus } from '@study/shared'
import { RichText } from '../RichText.tsx'
import { Smiley } from '../Smiley.tsx'
import { Visual } from '../Visual.tsx'

/**
 * The badge a student reads first: does the exam hand this over, or must it be in their
 * head? Green for given, amber for learn, blue for a map of the course. The words carry
 * the meaning too, so the colour is never the only signal.
 */
export const STATUS_STYLE: Record<ResourceStatus, { colour: string; emoji: string }> = {
  given: { colour: '#2e7d4f', emoji: '📄' },
  learn: { colour: '#b35c00', emoji: '🧠' },
  reference: { colour: '#1f5fbf', emoji: '🧭' },
}

export function StatusBadge({ status }: { status: ResourceStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <span className="chip" style={{ '--chip': s.colour } as React.CSSProperties}>
      <Smiley>{s.emoji}</Smiley>{RESOURCE_STATUS_LABEL[status]}
    </span>
  )
}

export function ComingSoonBadge() {
  return <span className="chip" style={{ '--chip': '#5f6b7a' } as React.CSSProperties}>Coming soon</span>
}

/** The badges on a tile or a page head: its status, and Coming soon while it is planned. */
export function ResourceBadges({ resource }: { resource: Resource }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      <StatusBadge status={resource.status} />
      {isComingSoon(resource) && <ComingSoonBadge />}
    </span>
  )
}

/** One block of a resource: a formula group, a table, a paragraph or a drawing. */
export function Block({ block }: { block: ResourceBlock }) {
  switch (block.kind) {
    case 'formulae':
      return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {block.groups.map((group) => (
            <section
              key={group.title}
              className="break-inside-avoid flex flex-col overflow-hidden rounded-xl border border-rule bg-surface"
              style={{ borderLeft: `6px solid ${group.colour}` }}
            >
              {/* A chip, not an inline colour: the chip clamps its ink so it still reads on a dark theme. */}
              <h3 className="chip mx-4 mt-3" style={{ '--chip': group.colour } as React.CSSProperties}>{group.title}</h3>
              <ul className="flex flex-col divide-y divide-rule">
                {group.items.map((f) => (
                  <li key={f.name} className="flex flex-col gap-1 px-4 py-2.5">
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                      {f.name}
                      {f.higher && <span className="chip" style={{ '--chip': '#6B4E9B' } as React.CSSProperties} title="Higher tier only">HT</span>}
                      {f.status && <StatusBadge status={f.status} />}
                    </span>
                    <span className="text-lg" style={{ overflowWrap: 'anywhere' }}><RichText source={f.formula} inline /></span>
                    {f.symbols && <RichText source={f.symbols} className="text-sm text-ink-2" />}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )
    case 'table':
      return (
        <figure className="flex flex-col gap-2">
          {block.title && <figcaption className="font-bold">{block.title}</figcaption>}
          <div className="overflow-x-auto rounded-xl border border-rule bg-surface">
            <table className="w-full border-collapse text-left text-[15px]">
              <thead>
                <tr className="bg-[color:var(--subject-soft)]">
                  {block.columns.map((c) => <th key={c} scope="col" className="px-3 py-2 align-bottom text-sm font-bold">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, i) => (
                  <tr key={i} className="break-inside-avoid border-t border-rule align-top">
                    {row.map((cell, j) => (
                      j === 0
                        ? <th key={j} scope="row" className="px-3 py-2 font-bold"><RichText source={cell || ' '} inline /></th>
                        : <td key={j} className="px-3 py-2"><RichText source={cell || ' '} inline /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.note && <RichText source={block.note} className="text-sm text-ink-2" />}
        </figure>
      )
    case 'text':
      return <RichText source={block.body} className="max-w-3xl" />
    case 'visual':
      return (
        <figure className="break-inside-avoid flex flex-col gap-2">
          <Visual visual={block.visual} />
          {block.caption && <figcaption><RichText source={block.caption} className="text-sm text-ink-2" /></figcaption>}
        </figure>
      )
  }
}
