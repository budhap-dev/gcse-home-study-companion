import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Topic } from './topic.ts'

const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')
function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? jsonFiles(full) : name.endsWith('.json') ? [full] : []
  })
}
const topics = jsonFiles(ROOT).map((f) => ({ file: f.split('/').pop()!, topic: Topic.parse(JSON.parse(readFileSync(f, 'utf8'))) }))

/**
 * Diagram props are rendered as **plain text** inside SVG — a table cell is a `<text>`
 * node, not Markdown and not KaTeX. So `**right**` in a cell reaches the page with the
 * asterisks still attached, and nothing catches it: the Markdown render test only looks
 * at fields that actually go through `marked`, and every unit test passes either way.
 *
 * This was found by walking a page in a browser, which is a slow way to find a typo. The
 * rule is simple enough to assert directly: no emphasis markers in a diagram's props.
 *
 * `___` is deliberately allowed — French exercises use it as a fill-in-the-blank, and it
 * is meant to appear literally.
 */
describe('diagram props are plain text', () => {
  it('has no Markdown emphasis in any diagram prop', () => {
    const bad: string[] = []
    for (const { file, topic } of topics) {
      for (const step of topic.lesson?.steps ?? []) {
        for (const visual of step.visuals ?? []) {
          if (visual.type !== 'diagram') continue
          const walk = (value: unknown, path: string): void => {
            if (typeof value === 'string') {
              // Bold or italic markers, but not the ___ used as an answer blank.
              if (/\*\*|(^|\s)\*\S/.test(value)) bad.push(`${file} ${step.id} ${path}: ${value.slice(0, 60)}`)
            } else if (Array.isArray(value)) {
              value.forEach((item, i) => walk(item, `${path}[${i}]`))
            } else if (value && typeof value === 'object') {
              for (const [key, item] of Object.entries(value)) walk(item, `${path}.${key}`)
            }
          }
          walk(visual.props, 'props')
        }
      }
    }
    expect(bad).toEqual([])
  })
})
