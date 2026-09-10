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
