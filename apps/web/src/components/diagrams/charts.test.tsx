import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BarChart } from './BarChart.tsx'
import { PieChart } from './PieChart.tsx'
import { Pictogram } from './Pictogram.tsx'
import { PlanElevation, viewEdges } from './PlanElevation.tsx'

const viewBoxWidth = (markup: string) => Number(/viewBox="0 0 ([\d.]+)/.exec(markup)?.[1])

describe('pie chart', () => {
  const pie = (props: Record<string, unknown>) => renderToStaticMarkup(<PieChart props={props} alt="a pie chart" />)

  it('works out each angle from the frequencies', () => {
    // 60 people: 30, 15, 10 and 5 take 180, 90, 60 and 30 degrees.
    const markup = pie({ slices: [{ label: 'Bus', value: 30 }, { label: 'Car', value: 15 }, { label: 'Walk', value: 10 }, { label: 'Cycle', value: 5 }], showAngles: true })
    for (const a of ['180°', '90°', '60°', '30°']) expect(markup).toContain(a)
    expect(markup.match(/<path /g)).toHaveLength(4)
  })

  it('draws the large-arc flag only for a sector over half the circle', () => {
    const markup = pie({ slices: [{ label: 'A', value: 3 }, { label: 'B', value: 1 }] })
    const flags = [...markup.matchAll(/A 84 84 0 ([01]) 1/g)].map((m) => m[1])
    expect(flags).toEqual(['1', '0'])
  })

  it('fits a phone', () => {
    expect(viewBoxWidth(pie({ slices: [{ label: 'A', value: 1 }] }))).toBeLessThanOrEqual(298)
  })
})

describe('bar chart', () => {
  const bars = (props: Record<string, unknown>) => renderToStaticMarkup(<BarChart props={props} alt="a bar chart" />)

  it('draws one bar per category, or two with a second series', () => {
    expect(bars({ categories: ['a', 'b', 'c'], values: [3, 5, 2] }).match(/<rect /g)).toHaveLength(3)
    expect(bars({ categories: ['a', 'b'], values: [3, 5], values2: [4, 1], names: ['Boys', 'Girls'] }).match(/<rect /g)).toHaveLength(4 + 2)
  })

  it('draws a vertical line chart with lines, not bars', () => {
    const markup = bars({ categories: ['0', '1', '2'], values: [4, 7, 2], style: 'line' })
    expect(markup).not.toContain('<rect')
    expect(markup).toContain('stroke-width="3"')
  })

  it('makes a bar as tall as its value on the axis', () => {
    // Values 0 to 10: the 10 bar reaches the top tick, the 5 bar half as high.
    const markup = bars({ categories: ['a', 'b'], values: [10, 5] })
    const heights = [...markup.matchAll(/<rect [^>]*height="([\d.]+)"/g)].map((m) => Number(m[1]))
    expect(heights[0]).toBeCloseTo(2 * heights[1]!, 5)
  })

  it('fits a phone', () => {
    expect(viewBoxWidth(bars({ categories: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], values: [1, 2, 3, 4, 5] }))).toBeLessThanOrEqual(298)
  })
})

describe('pictogram', () => {
  const pic = (props: Record<string, unknown>) => renderToStaticMarkup(<Pictogram props={props} alt="a pictogram" />)

  it('draws whole symbols and a part symbol cut to the remainder', () => {
    // Key 4: 10 is two whole symbols and half of a third; 8 is exactly two.
    const markup = pic({ rows: [{ label: 'Mon', value: 10 }, { label: 'Tue', value: 8 }], key: 4 })
    const widths = [...markup.matchAll(/<rect [^>]*width="([\d.]+)"/g)].map((m) => Number(m[1]))
    // 2 + 1 part + 2, then the key symbol.
    expect(widths).toEqual([18, 18, 9, 18, 18, 18])
  })
})

describe('plan and elevation', () => {
  it('draws a line inside a view only where the depth changes', () => {
    // Two cells side by side at the same depth are one face: outline only, 6 edges.
    expect(viewEdges([{ col: 0, row: 0, depth: 1 }, { col: 1, row: 0, depth: 1 }])).toHaveLength(6)
    // At different depths there is a step between them, so one more line.
    expect(viewEdges([{ col: 0, row: 0, depth: 1 }, { col: 1, row: 0, depth: 2 }])).toHaveLength(7)
  })

  it('reads the three views off an L-shaped solid', () => {
    // Three cubes along the front, and one more on top of the left-hand cube.
    const cubes = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 0, 1]]
    const markup = renderToStaticMarkup(<PlanElevation props={{ cubes, show: 'views' }} alt="views of an L shape" />)
    // Edges are counted in unit lengths.
    // Plan: a row of 3 cells, 8 outline edges. The left column is two cubes tall and
    //   the others one, so a line separates it from its neighbour: 8 + 1.
    // Front: an L of 4 cells all at the front, so 16 sides minus 2 for each of the 3
    //   shared sides: 10, and no inner line.
    // Side: a column of 2 cells, 6 outline edges. The bottom cell's nearest cube is the
    //   right-hand one (x = 2) and the top cell's is at x = 0, so the depth changes: 6 + 1.
    expect(markup).toContain('Plan')
    expect(markup).toContain('Front elevation')
    expect(markup).toContain('Side elevation')
    const edges = (markup.match(/stroke-width="2" stroke-linecap="round"/g) ?? []).length
    expect(edges).toBe((8 + 1) + 10 + (6 + 1))
  })

  it('fits a phone', () => {
    const markup = renderToStaticMarkup(<PlanElevation props={{ cubes: [[0, 0, 0], [3, 3, 3]] }} alt="two cubes at opposite corners" />)
    expect(viewBoxWidth(markup)).toBeLessThanOrEqual(298)
  })
})
