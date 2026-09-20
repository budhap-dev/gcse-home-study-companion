import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { everyVisual } from './visuals.ts'

const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')
function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? jsonFiles(full) : name.endsWith('.json') ? [full] : []
  })
}
const topics = jsonFiles(ROOT).map((f) => JSON.parse(readFileSync(f, 'utf8')))

/**
 * Four scanners hold the diagram library to its rules, and all four now walk this. A
 * collector that quietly returned fewer visuals would make every one of them pass while
 * checking nothing — the same shape of failure as the blind spot it was written to close.
 * So each location is asserted to contribute, both on a fixture and across the real pack.
 */
describe('everyVisual', () => {
  it('finds a visual in each place a topic can hold one', () => {
    const topic = {
      why: { examples: [{ title: 'The door handle', visual: { type: 'diagram', component: 'beam-moments' } }] },
      lesson: { steps: [{ id: 'step-1', visuals: [{ type: 'diagram', component: 'line-graph' }, { type: 'diagram', component: 'trace-table' }] }] },
      questions: [{ id: 'q1', visual: { type: 'diagram', component: 'venn-diagram' } }, { id: 'q2' }],
    }
    expect(everyVisual(topic).map((v) => `${v.where}: ${(v.visual as { component: string }).component}`)).toEqual([
      'why[0] The door handle: beam-moments',
      'step-1: line-graph',
      'step-1: trace-table',
      'q1: venn-diagram',
    ])
  })

  it('survives a topic missing every one of them', () => {
    expect(everyVisual({})).toEqual([])
    expect(everyVisual({ lesson: {}, questions: [], why: { examples: [] } })).toEqual([])
  })

  it('finds visuals from all three places in the real content pack', () => {
    const wheres = topics.flatMap((t) => everyVisual(t).map((v) => v.where))
    expect(wheres.filter((w) => w.startsWith('why[')).length).toBeGreaterThan(50)
    expect(wheres.filter((w) => /^s\d+$/.test(w)).length).toBeGreaterThan(2000)
    expect(wheres.filter((w) => /^q\d+$/.test(w)).length).toBeGreaterThan(20)
  })
})
