import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ResourceFile } from '../resources.ts'

const ROOT = join(import.meta.dirname, '../../../../supabase/seed')
const physics = ResourceFile.parse(JSON.parse(readFileSync(join(ROOT, 'resources/physics.json'), 'utf8')))
const sheet = physics.resources.find((r) => r.id === 'equation-sheet')!
const formulae = sheet.blocks.flatMap((b) => (b.kind === 'formulae' ? b.groups.flatMap((g) => g.items) : []))

/** Every string in a topic, with where it is, so a failure names the step. */
function strings(value: unknown, path: string, out: { path: string; text: string }[] = []) {
  if (typeof value === 'string') out.push({ path, text: value })
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${path}/${i}`, out))
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) strings(v, `${path}/${k}`, out)
  return out
}

describe('the Physics equation sheet', () => {
  /**
   * AQA's sheet for 2027 prints every equation in the specification's Appendix A: the 23
   * it lists to recall and the 12 to select and apply. Ofqual's decision of 5 May 2026
   * keeps it, unchanged, for exams from 2028, and lists these as equations students "are
   * not required to memorise".
   */
  it('carries all 35 equations, six of them Higher tier', () => {
    expect(formulae).toHaveLength(35)
    expect(formulae.filter((f) => f.higher)).toHaveLength(6)
  })

  /**
   * The lessons were written to the specification's split, and fourteen topics told the
   * student that V = IR, v = fλ, p = mv, p = F/A and the power equations were "not on the
   * equation sheet". A student sitting in 2028 would have learned the wrong thing about
   * their own paper, and one quiz question marked the true answer wrong. With every
   * equation on the sheet, any such claim about an Appendix A equation is false.
   */
  it('is never said to leave an equation off, anywhere in the Physics content', () => {
    // A multiple-choice distractor is false on purpose, so the options are not scanned.
    const FALSE_CLAIM = /not(?:\*\*)? on the (?:AQA )?(?:physics )?(?:equation )?sheet|neither is on the sheet|on the recall list|does not give it on|must be recalled|has to be recalled|not given in the exam|had not been confirmed/i
    const dir = join(ROOT, 'content/physics')
    const found = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .flatMap((f) => strings(JSON.parse(readFileSync(join(dir, f), 'utf8')), f.replace('.json', '')))
      .filter((s) => !/\/questions\/\d+\/options\//.test(s.path) && FALSE_CLAIM.test(s.text))
      .map((s) => `${s.path}: ${s.text.match(FALSE_CLAIM)![0]}`)
    expect(found).toEqual([])
  })

  it('catches the phrasings it was written for', () => {
    const FALSE_CLAIM = /not(?:\*\*)? on the (?:AQA )?(?:physics )?(?:equation )?sheet|neither is on the sheet|on the recall list|does not give it on|must be recalled|has to be recalled|not given in the exam|had not been confirmed/i
    for (const s of ['This equation is **not** on the AQA equation sheet.', 'it is not on the sheet', 'v = fλ must be recalled', 'both on the recall list']) expect(FALSE_CLAIM.test(s), s).toBe(true)
    expect(FALSE_CLAIM.test('It is on the equation sheet, marked HT.')).toBe(false)
  })
})
