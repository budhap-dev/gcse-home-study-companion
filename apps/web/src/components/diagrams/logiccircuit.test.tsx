import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LogicCircuit } from './LogicCircuit.tsx'

const svg = (props: Record<string, unknown>) => renderToStaticMarkup(<LogicCircuit props={props} alt="a logic circuit" />)
/** The Q column of the rendered truth table, top row first. */
const outputs = (markup: string) =>
  [...markup.matchAll(/data-cell="output"[^>]*>([01])</g)].map((m) => Number(m[1]))
const expression = (markup: string) => /data-expression="([^"]+)"/.exec(markup)?.[1] ?? ''

/**
 * The truth table is evaluated from the same tree the gates are drawn from, so a circuit
 * and the table beside it cannot disagree. A three-input table has eight rows, and one
 * wrong cell looks exactly like seven right ones — which is why this is worth deriving.
 */
describe('logic circuit', () => {
  it('builds the truth table for each single gate', () => {
    expect(outputs(svg({ expression: { op: 'NOT', inputs: ['A'] } }))).toEqual([1, 0])
    expect(outputs(svg({ expression: { op: 'AND', inputs: ['A', 'B'] } }))).toEqual([0, 0, 0, 1])
    expect(outputs(svg({ expression: { op: 'OR', inputs: ['A', 'B'] } }))).toEqual([0, 1, 1, 1])
    expect(outputs(svg({ expression: { op: 'XOR', inputs: ['A', 'B'] } }))).toEqual([0, 1, 1, 0])
  })

  it('counts the inputs up in binary, as an exam table does', () => {
    const markup = svg({ expression: { op: 'AND', inputs: ['A', 'B'] } })
    const cells = [...markup.matchAll(/data-cell="(?:input|output)"[^>]*>([01])</g)].map((m) => m[1])
    // Rows are 00, 01, 10, 11 with the output appended to each.
    expect(cells.join('')).toBe('000' + '010' + '100' + '111')
  })

  it('evaluates a combination of gates over three inputs', () => {
    // Q = (A AND B) OR (NOT C): true whenever A and B are both set, or C is clear.
    const expr = { op: 'OR', inputs: [{ op: 'AND', inputs: ['A', 'B'] }, { op: 'NOT', inputs: ['C'] }] }
    const expected = []
    for (let i = 0; i < 8; i++) {
      const [a, b, c] = [Boolean(i & 4), Boolean(i & 2), Boolean(i & 1)]
      expected.push((a && b) || !c ? 1 : 0)
    }
    expect(outputs(svg({ expression: expr }))).toEqual(expected)
    expect(outputs(svg({ expression: expr }))).toHaveLength(8)
  })

  it("writes the expression in the specification's notation", () => {
    // AQA: . for AND, + for OR, XOR as a circled plus, and an overbar for NOT.
    const expr = { op: 'OR', inputs: [{ op: 'AND', inputs: ['A', 'B'] }, { op: 'NOT', inputs: ['C'] }] }
    expect(expression(svg({ expression: expr }))).toBe('(A . B) + NOT C')
    expect(svg({ expression: expr })).toContain('overline')
    expect(expression(svg({ expression: { op: 'XOR', inputs: ['A', 'B'] } }))).toBe('A ⊕ B')
  })

  it('draws one gate shape per operation, and a bubble only on the NOT', () => {
    const notGate = svg({ expression: { op: 'NOT', inputs: ['A'] }, show: 'circuit' })
    const andGate = svg({ expression: { op: 'AND', inputs: ['A', 'B'] }, show: 'circuit' })
    expect(notGate).toContain('<circle')      // the inverting bubble
    expect(andGate).not.toContain('<circle')
    expect(notGate).toContain('>NOT<')
    expect(andGate).toContain('>AND<')
  })

  /**
   * The AND gate's curve started from the gate's centre, so its nose stopped 11 units
   * short of where the output wire begins and the wire to Q hung in the air beside it.
   */
  it('brings the nose of the AND gate out to meet its output wire', () => {
    for (const expr of [
      { op: 'AND', inputs: ['A', 'B'] },
      { op: 'OR', inputs: [{ op: 'AND', inputs: ['A', 'B'] }, { op: 'NOT', inputs: ['C'] }] },
      { op: 'AND', inputs: [{ op: 'AND', inputs: ['A', 'B'] }, { op: 'AND', inputs: ['C', 'D'] }] },
    ]) {
      const markup = svg({ expression: expr, show: 'circuit' })
      const gates = [...markup.matchAll(/data-gate="AND" data-right="([\d.]+)" d="M ([\d.]+) ([\d.]+) L ([\d.]+) [\d.]+ A ([\d.]+) /g)]
      expect(gates.length).toBeGreaterThan(0)
      // Every wire as drawn: a line, or the first point of a bent one.
      const starts = [
        ...[...markup.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)"/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) })),
        ...[...markup.matchAll(/<polyline points="([\d.]+),([\d.]+) /g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) })),
      ]
      for (const [, right, left, top, turn, radius] of gates) {
        expect(Number(turn) + Number(radius), 'the curve ends at the right edge').toBeCloseTo(Number(right), 5)
        expect(Number(turn), 'with a flat top before it').toBeGreaterThan(Number(left))
        const mid = Number(top) + Number(radius)
        expect(starts.some((s) => Math.abs(s.x - Number(right)) < 0.01 && Math.abs(s.y - mid) < 0.01), 'and a wire leaves from the nose').toBe(true)
      }
    }
  })

  /**
   * The back of an OR or XOR gate curves inwards, so a wire that stopped at the gate's
   * left edge stopped short of the gate. Each wire must end on the curve itself.
   */
  it('ends every input wire on the curved back of an OR or XOR gate', () => {
    for (const expr of [
      { op: 'OR', inputs: ['A', 'B'] },
      { op: 'XOR', inputs: ['A', 'B'] },
      { op: 'OR', inputs: [{ op: 'AND', inputs: ['A', 'B'] }, { op: 'NOT', inputs: ['C'] }] },
      { op: 'OR', inputs: ['A', 'B', 'C'] },
    ]) {
      const markup = svg({ expression: expr, show: 'circuit' })
      const gates = [...markup.matchAll(/data-gate="(?:OR|XOR)" data-left="([\d.]+)" data-mid="([\d.]+)"><path d="M [\d.]+ ([\d.]+) Q/g)]
      expect(gates.length).toBeGreaterThan(0)
      const ends = [
        ...[...markup.matchAll(/<line x1="[\d.]+" y1="[\d.]+" x2="([\d.]+)" y2="([\d.]+)"/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) })),
        ...[...markup.matchAll(/<polyline points="[^"]* ([\d.]+),([\d.]+)"/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) })),
      ]
      for (const [, left, mid, top] of gates) {
        const [l, y, half] = [Number(left), Number(mid), Number(mid) - Number(top)]
        const inputs = ends.filter((e) => e.x >= l && e.x <= l + 7 && Math.abs(e.y - y) < half)
        expect(inputs.length, 'wires into the gate').toBe((expr.inputs as unknown[]).length)
        for (const e of inputs) {
          // The back is a curve from the bottom corner to the top one, pulled in by a point 12 units along.
          const t = (1 - (e.y - y) / half) / 2
          expect(e.x, `wire at ${e.y}`).toBeCloseTo(l + 24 * t * (1 - t), 5)
        }
      }
    }
  })

  it('gives XOR the extra arc that distinguishes it from OR', () => {
    const or = svg({ expression: { op: 'OR', inputs: ['A', 'B'] }, show: 'circuit' })
    const xor = svg({ expression: { op: 'XOR', inputs: ['A', 'B'] }, show: 'circuit' })
    expect((xor.match(/<path/g) ?? []).length).toBe((or.match(/<path/g) ?? []).length + 1)
  })

  /**
   * The output wire was two pixels long, so every circuit in the pack had a speck between
   * its last gate and the Q instead of a wire leaving it. Nothing failed: the gates were
   * right, the table was right, and the alt text described a wire that was not drawn.
   */
  it('draws a visible wire from the last gate to the Q', () => {
    for (const expr of [
      { op: 'AND', inputs: ['A', 'B'] },
      { op: 'AND', inputs: ['A', { op: 'OR', inputs: ['D', 'W'] }] },
      { op: 'OR', inputs: [{ op: 'AND', inputs: ['A', 'B'] }, { op: 'NOT', inputs: ['C'] }] },
    ]) {
      const markup = svg({ expression: expr, show: 'circuit' })
      const width = Number(/viewBox="0 0 ([\d.]+)/.exec(markup)![1])
      const q = /<text x="([\d.]+)"[^>]*>Q</.exec(markup)
      expect(q, 'the output is labelled Q').not.toBeNull()
      const qx = Number(q![1])
      const horizontal = [...markup.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g)]
        .filter((m) => m[2] === m[4])
        .map((m) => ({ x1: Number(m[1]), x2: Number(m[3]) }))
      const output = horizontal.find((l) => l.x2 > qx - 20 && l.x2 <= qx)
      expect(output, 'a wire runs into the Q').toBeDefined()
      expect(output!.x2 - output!.x1).toBeGreaterThanOrEqual(20)
      expect(qx).toBeLessThan(width)
    }
  })

  it('falls back to the alt text with no expression', () => {
    expect(svg({})).toContain('a logic circuit')
  })
})
