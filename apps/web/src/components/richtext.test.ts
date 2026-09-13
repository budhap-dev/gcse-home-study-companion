import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderRichText } from './RichText.tsx'

const SEED = join(import.meta.dirname, '../../../../supabase/seed')

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? jsonFiles(full) : name.endsWith('.json') ? [full] : []
  })
}

/** Every string the content pack can put on screen, with its path for the failure message. */
function strings(value: unknown, path: string, out: [string, string][] = []): [string, string][] {
  if (typeof value === 'string') out.push([path, value])
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${path}[${i}]`, out))
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) strings(v, `${path}.${k}`, out)
  return out
}

/**
 * KaTeX is told not to throw, so a broken formula reaches the student as red error
 * text rather than a build failure. Rendering the whole pack here is the only thing
 * that catches it, and the pack carries over two thousand maths spans.
 */
describe('content renders', () => {
  const files = jsonFiles(SEED)

  it('has content to check', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it('renders every string without a KaTeX error', () => {
    const broken: string[] = []
    for (const file of files) {
      const where = file.split('/seed/')[1]
      for (const [path, text] of strings(JSON.parse(readFileSync(file, 'utf8')), '')) {
        if (!text.includes('$')) continue
        const html = renderRichText(text)
        if (html.includes('katex-error')) broken.push(`${where}${path}: ${text.slice(0, 80)}`)
      }
    }
    expect(broken).toEqual([])
  })
})

/**
 * A dollar sign is a maths delimiter, so a Business question that prices a machine
 * in dollars has to escape it. Before the escape existed, "$12 000. The exchange
 * rate is £1 = $1.50" rendered the whole middle as maths and lost both prices.
 */
describe('escaped dollars', () => {
  it('renders \\$ as a literal dollar and leaves maths alone', () => {
    const html = renderRichText('A machine costs \\$12 000 and $x^2$ is maths.')
    expect(html).toContain('$12 000')
    expect(html).toContain('katex')
    expect(html).not.toContain('\\$')
  })

  it('never lets a maths span swallow prose anywhere in the pack', () => {
    const swallowed: string[] = []
    for (const file of jsonFiles(SEED)) {
      const where = file.split('/seed/')[1]
      for (const [path, text] of strings(JSON.parse(readFileSync(file, 'utf8')), '')) {
        if (!text.includes('$')) continue
        const prose = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '').replace(/\\\$/g, '').replace(/\$\$[\s\S]+?\$\$/g, '')
        for (const [, tex] of prose.matchAll(/\$([^$\n]+?)\$/g)) {
          // A sentence break or two plain English words in a row inside $...$ is prose that a
          // stray $ has captured. Words inside \text{} are deliberate, and a pound sign is
          // not a signal: the Business solutions write $= 9500 - 7200 = £2300$ on purpose.
          const bare = tex.replace(/\\text\{[^}]*\}/g, '')
          if (/\.\s+[A-Z]|(?<![\\a-z])[a-z]{3,}\s+[a-z]{2,}\b/.test(bare)) swallowed.push(`${where}${path}: $${tex.slice(0, 60)}$`)
        }
      }
    }
    expect(swallowed).toEqual([])
  })
})
