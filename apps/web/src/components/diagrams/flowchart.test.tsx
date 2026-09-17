import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Flowchart } from './Flowchart.tsx'

/**
 * AQA names four flowchart symbols and examines them by shape, so each kind has to draw
 * as its own shape: a rounded terminal, a rectangular process, a parallelogram for input
 * or output, and a diamond for a decision.
 */
describe('flowchart', () => {
  const NODES = [
    { kind: 'terminal', text: 'START' },
    { kind: 'io', text: 'INPUT n' },
    { kind: 'process', text: 'total ← 0' },
    { kind: 'decision', text: 'n > 10?', yes: 'Yes', no: 'No' },
    { kind: 'terminal', text: 'STOP' },
  ]

  it('gives each kind its own shape', () => {
    const html = renderToStaticMarkup(<Flowchart alt="" props={{ nodes: NODES }} />)
    // A diamond and a parallelogram are both polygons; the rectangles are rects.
    expect(html.match(/<polygon /g)?.length).toBe(2)
    expect(html.match(/<rect /g)?.length).toBe(3)
    // A terminal is fully rounded, a process is not.
    expect(html).toMatch(/rx="24"/)
    expect(html).toMatch(/rx="4"/)
  })

  it('labels both exits of a decision', () => {
    const html = renderToStaticMarkup(<Flowchart alt="" props={{ nodes: NODES }} />)
    expect(html).toContain('>Yes<')
    expect(html).toContain('>No<')
  })

  /**
   * A while loop is the commonest flowchart shape there is: the body returns to the
   * decision, and the decision's other exit skips past the body to what follows. Drawing
   * the body falling straight through would show a different algorithm from the one the
   * lesson describes.
   */
  it('sends the loop body back and routes the other exit past it', () => {
    const looped = renderToStaticMarkup(<Flowchart alt="" props={{ nodes: NODES, loop: { from: 3, to: 2 } }} />)
    // Two routed paths: the body returning, and the decision's other exit.
    expect(looped.match(/<path d="M [\d.]+ [\d.]+ H/g)?.length).toBe(2)
    // The body no longer falls through to the next box, so one straight edge is gone.
    const plain = renderToStaticMarkup(<Flowchart alt="" props={{ nodes: NODES }} />)
    expect((looped.match(/<line /g) ?? []).length).toBe((plain.match(/<line /g) ?? []).length - 1)
  })

  it('draws a loop back to an earlier node for iteration', () => {
    const plain = renderToStaticMarkup(<Flowchart alt="" props={{ nodes: NODES }} />)
    const looped = renderToStaticMarkup(<Flowchart alt="" props={{ nodes: NODES, loop: { from: 3, to: 1 } }} />)
    // The arrowhead marker is a path too, so match the loop's own horizontal and
    // vertical run rather than any path at all.
    const loopPath = /<path d="M [\d.]+ [\d.]+ H [\d.]+ V [\d.]+ H/
    expect(plain).not.toMatch(loopPath)
    expect(looped).toMatch(loopPath)
  })

  it('keeps every node inside the picture', () => {
    const html = renderToStaticMarkup(<Flowchart alt="" props={{ nodes: NODES, loop: { from: 3, to: 1 } }} />)
    for (const m of html.matchAll(/x="([\d.]+)"/g)) expect(Number(m[1])).toBeLessThanOrEqual(460)
  })

  it('falls back to the alt text rather than crashing when given no nodes', () => {
    expect(renderToStaticMarkup(<Flowchart alt="a flowchart" props={{}} />)).toContain('a flowchart')
  })
})
