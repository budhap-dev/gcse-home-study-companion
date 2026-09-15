import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * `docs/content-order.md` is the queue this project is worked from, and the table at the
 * top of it says what has been written. It was maintained by hand and drifted badly: on
 * 15 September 2026 it claimed 24 Maths topics against 38 on disk, 4 Physics against 15,
 * and 10 French against 22. A queue that misreports what is done is worse than none, so
 * the table is now generated, and this test fails when the doc no longer matches the
 * content pack.
 *
 * To fix a failure: `node supabase/scripts/content-table.mjs --write`
 */
const ROOT = join(import.meta.dirname, '../../..')

describe('docs/content-order.md', () => {
  it('has a table matching what is actually written', async () => {
    const { expectedDoc } = await import(
      join(ROOT, 'supabase/scripts/content-table.mjs')
    )
    const { doc, next } = expectedDoc()
    expect(
      doc === next,
      'the table is stale; run: node supabase/scripts/content-table.mjs --write',
    ).toBe(true)
  })

  it('names every subject that has content', () => {
    const doc = readFileSync(join(ROOT, 'docs/content-order.md'), 'utf8')
    for (const name of [
      'Mathematics', 'Physics', 'Chemistry', 'Biology',
      'Computer Science', 'Business', 'French', 'Music',
    ]) {
      expect(doc, name).toContain(`| ${name} |`)
    }
  })
})
