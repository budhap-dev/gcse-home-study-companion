import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { keyboardToHand } from './keyboardToHand.ts'

const device = (matches: (query: string) => boolean) => vi.stubGlobal('matchMedia', (query: string) => ({ matches: matches(query) }))

describe('whether a page may take the cursor as it opens', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('does with a mouse or a trackpad', () => {
    device(() => true)
    expect(keyboardToHand()).toBe(true)
  })

  it('does not on a phone or a tablet, where focus raises the keyboard', () => {
    device((query) => !/hover: hover|pointer: fine/.test(query))
    expect(keyboardToHand()).toBe(false)
  })

  it('does not where the browser cannot say', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(keyboardToHand()).toBe(false)
  })
})

/** Every file of the app's own source, tests aside. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sources(path)
    return /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.') ? [path] : []
  })
}

/**
 * The Glossary and the Search page each focused their field in an effect, and each raised
 * the keyboard on a phone. A focus inside an effect runs by itself, so it must ask first;
 * one inside a key or click handler answers the reader and need not.
 */
describe('a page that opens', () => {
  const SRC = join(import.meta.dirname, '..')
  const files = sources(SRC).map((path) => ({ path: path.slice(SRC.length + 1), text: readFileSync(path, 'utf8') }))

  it('never focuses a text field by itself without asking', () => {
    expect(files.length).toBeGreaterThan(100)
    const unasked: string[] = []
    let asked = 0
    for (const { path, text } of files) {
      text.split('\n').forEach((line, i) => {
        if (/\bautoFocus\b/.test(line) && /<(input|textarea)\b/.test(line)) unasked.push(`${path}:${i + 1}`)
        if (!/(inputRef|fieldRef|searchRef)\.current\?*\.focus\(/.test(line)) return
        if (line.includes('keyboardToHand()')) asked++
        else unasked.push(`${path}:${i + 1}`)
      })
    }
    expect(unasked).toEqual([])
    // A floor, so that a pattern which matched nothing could not pass as one that found nothing.
    expect(asked).toBeGreaterThanOrEqual(2)
  })
})
