import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HuffmanTree } from './HuffmanTree.tsx'

interface Node { char?: string; weight?: number; left?: Node; right?: Node }

/** Walk the tree the way the picture tells a student to: left is 0, right is 1. */
function codes(node: Node, prefix = ''): Record<string, string> {
  if (node.char !== undefined) return { [node.char]: prefix || '0' }
  return { ...codes(node.left!, `${prefix}0`), ...codes(node.right!, `${prefix}1`) }
}

const BANANA: Node = {
  weight: 6,
  left: { char: 'a', weight: 3 },
  right: { weight: 3, left: { char: 'b', weight: 1 }, right: { char: 'n', weight: 2 } },
}

describe('huffman tree', () => {
  it('prints the code of every leaf, read left as 0 and right as 1', () => {
    const html = renderToStaticMarkup(<HuffmanTree alt="" props={{ tree: BANANA }} />)
    for (const [char, code] of Object.entries(codes(BANANA))) {
      expect(html, char).toContain(`>${char}<`)
      expect(html, char).toContain(`>${code}<`)
    }
  })

  it('shows each leaf its frequency and each branch its weight', () => {
    const html = renderToStaticMarkup(<HuffmanTree alt="" props={{ tree: BANANA }} />)
    expect(html).toContain('>6<')
    expect(html).toContain('>3<')
  })

  it('falls back to the alt text rather than crashing when given no tree', () => {
    expect(renderToStaticMarkup(<HuffmanTree alt="a Huffman tree" props={{}} />)).toContain('a Huffman tree')
  })

  it('agrees with the codes the compression topic teaches', () => {
    // The picture is the authority a student reads codes off, so it must match the prose.
    const topic = JSON.parse(
      readFileSync(join(import.meta.dirname, '../../../../../supabase/seed/content/computer-science/data-compression.json'), 'utf8'),
    ) as { lesson: { steps: { visuals: { component?: string; props?: { tree?: Node } }[] }[] } }
    const trees = topic.lesson.steps.flatMap((s) => s.visuals).filter((v) => v.component === 'huffman-tree')
    expect(trees.length).toBeGreaterThanOrEqual(2)
    const found = trees.map((t) => codes(t.props!.tree!))
    expect(found).toContainEqual({ a: '0', b: '10', n: '11' })
    expect(found).toContainEqual({ s: '0', m: '100', p: '101', i: '11' })
  })
})
