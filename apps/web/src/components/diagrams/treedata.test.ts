import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content')
function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? jsonFiles(full) : name.endsWith('.json') ? [full] : []
  })
}

interface TreeNode { label?: string; count?: number; children?: TreeNode[] }
interface Visual { type?: string; component?: string; props?: Record<string, unknown> }

/**
 * A frequency tree's branches must add up to the node they come from. The component
 * draws exactly the counts it is given — deliberately, so a wrong tree shows its error
 * rather than hiding it behind arithmetic done at render time — which leaves the numbers
 * unchecked once the generator that produced them has been thrown away. This is the
 * check that outlives the generator.
 */
describe('frequency tree data', () => {
  const trees: { file: string; step: string; root: TreeNode }[] = []
  for (const file of jsonFiles(ROOT)) {
    const topic = JSON.parse(readFileSync(file, 'utf8'))
    for (const step of topic.lesson?.steps ?? []) {
      for (const v of (step.visuals ?? []) as Visual[]) {
        if (v.component === 'frequency-tree' && v.props?.root) {
          trees.push({ file: file.split('/').pop()!, step: step.id, root: v.props.root as TreeNode })
        }
      }
    }
  }

  it('has every pair of branches adding to its parent', () => {
    const bad: string[] = []
    const walk = (node: TreeNode, where: string) => {
      const kids = node.children ?? []
      if (!kids.length) return
      const sum = kids.reduce((s, k) => s + (k.count ?? 0), 0)
      if (sum !== node.count) {
        bad.push(`${where}: ${node.label ?? 'node'} is ${node.count} but its branches add to ${sum}`)
      }
      for (const k of kids) walk(k, where)
    }
    for (const t of trees) walk(t.root, `${t.file} ${t.step}`)
    expect(bad).toEqual([])
  })

  it('gives every node a count', () => {
    const bad: string[] = []
    const walk = (node: TreeNode, where: string) => {
      if (typeof node.count !== 'number') bad.push(`${where}: ${node.label ?? 'a node'} has no count`)
      for (const k of node.children ?? []) walk(k, where)
    }
    for (const t of trees) walk(t.root, `${t.file} ${t.step}`)
    expect(bad).toEqual([])
  })

  /** The checks above pass trivially if the scan finds nothing. */
  it('found the frequency trees in the content', () => {
    expect(trees.length).toBeGreaterThan(0)
  })
})
