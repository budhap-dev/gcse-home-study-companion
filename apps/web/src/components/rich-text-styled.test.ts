import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderRichText } from './RichText.tsx'

const SEED = join(import.meta.dirname, '../../../../supabase/seed')
const CSS = readFileSync(join(import.meta.dirname, '../styles.css'), 'utf8')

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? jsonFiles(full) : name.endsWith('.json') ? [full] : []
  })
}
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out))
  else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out)
  return out
}

/**
 * `marked` accepts all of GFM, but styles.css covers only part of it, and the gap is
 * silent: the tag reaches the page, inherits whatever it inherits, and looks like body
 * text. Tailwind's preflight makes it worse by actively resetting elements — it sets
 * `list-style: none` on every list, so 5444 authored bullet lines across the pack were
 * rendering with no bullet and no indent until a rule put the marker back.
 *
 * So the rule is: any block element the pack's own markdown actually produces must have
 * a `.rich-text` rule written for it. Tags nobody authors are not the test's business,
 * which is why the list is taken from the content rather than from the HTML spec.
 */
const NEEDS_A_RULE = new Set([
  'ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody', 'th', 'td',
  'pre', 'code', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'img', 'a', 'p', 'strong',
])
/** Covered by a rule written against something other than the bare tag name. */
const COVERED_BY = new Map([
  ['table', /\.rich-text table\b/],
  ['thead', /\.rich-text thead\b/],
  ['tbody', /\.rich-text tbody\b/],
  ['th', /\.rich-text th\b|\.rich-text th,/],
  ['td', /\.rich-text [^{]*\btd\b/],
])

describe('every markdown feature the pack uses is styled', () => {
  const rendered = jsonFiles(SEED).flatMap((f) => strings(JSON.parse(readFileSync(f, 'utf8'))))
    .filter((s) => /[*_>|#`[-]/.test(s))
    .map((s) => renderRichText(s))

  it('rendered the pack', () => {
    expect(rendered.length).toBeGreaterThan(1000)
  })

  it('has a rule for every block element the content produces', () => {
    const tags = new Set<string>()
    for (const html of rendered) {
      // KaTeX output is styled by its own stylesheet, so it is not this test's business.
      const prose = html.replace(/<span class="katex[\s\S]*?<\/span>\s*(?=<|$)/g, '')
      for (const m of prose.matchAll(/<([a-z][a-z0-9]*)[\s>]/g)) tags.add(m[1]!)
    }
    const unstyled = [...tags]
      .filter((t) => NEEDS_A_RULE.has(t))
      .filter((t) => {
        const byName = new RegExp(`\\.rich-text[^{,]*\\b${t}\\b`)
        return !(COVERED_BY.get(t) ?? byName).test(CSS)
      })
    expect(unstyled, `these tags reach the page with no rule of their own: ${unstyled.join(', ')}`).toEqual([])
  })

  /**
   * Preflight's reset is the specific trap, and a rule that sets only margin and padding
   * looks like it handles lists while leaving them markerless. Pin the marker itself.
   */
  it('puts the list marker back that Tailwind removes', () => {
    expect(CSS).toMatch(/\.rich-text ul\s*\{[^}]*list-style:\s*disc/)
    expect(CSS).toMatch(/\.rich-text ol\s*\{[^}]*list-style:\s*decimal/)
  })

  it('makes a blockquote look different from a paragraph', () => {
    const rule = /\.rich-text blockquote\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? ''
    expect(rule, 'a blockquote with no rule is indistinguishable from body text').not.toBe('')
    expect(rule).toMatch(/border-left|background|padding/)
  })
})
