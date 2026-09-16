import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SurfaceAreaVolume } from './SurfaceAreaVolume.tsx'

const svg = (props: Record<string, unknown>) =>
  renderToStaticMarkup(<SurfaceAreaVolume props={props} alt="cubes compared by surface area to volume ratio" />)

/** The text of one cube's labels, in the order they are drawn. */
function cube(markup: string, index: number): string[] {
  const groups = markup.split('<g>').slice(1)
  return [...(groups[index] ?? '').matchAll(/<text[^>]*>([^<]*(?:<!-- -->[^<]*)*)<\/text>/g)].map((m) => m[1]!.replace(/<!-- -->/g, ''))
}

/**
 * The point of this component is that the numbers under a cube are derived from the same
 * side length that draws it, so a table of surface area to volume ratios cannot be
 * subtly wrong in a way a student could not detect. These tests check that arithmetic.
 */
describe('surface area to volume', () => {
  it('computes surface area, volume and ratio from the side', () => {
    const labels = cube(svg({ sides: [2] }), 0)
    expect(labels).toEqual(['side 2 cm', 'area 24 cm²', 'volume 8 cm³', '3 : 1'])
  })

  it('gives a ratio of 6 : 1 for a unit cube, and falls as the cube grows', () => {
    const markup = svg({ sides: [1, 2, 3] })
    expect(cube(markup, 0)).toContain('6 : 1')
    expect(cube(markup, 1)).toContain('3 : 1')
    expect(cube(markup, 2)).toContain('2 : 1')
  })

  /**
   * The biology this diagram exists for: a bigger organism has less surface for each unit
   * of its volume, which is why diffusion alone stops being enough.
   */
  it('always falls as the side length increases', () => {
    const ratios = [1, 2, 4, 5, 10].map((side) => {
      const labels = cube(svg({ sides: [side] }), 0)
      return Number(labels.at(-1)!.split(' : ')[0])
    })
    for (let i = 1; i < ratios.length; i++) expect(ratios[i]!).toBeLessThan(ratios[i - 1]!)
  })

  it('shows a non-integer ratio to two decimal places', () => {
    // A cube of side 4 has surface area 96 and volume 64, giving 1.5 : 1.
    expect(cube(svg({ sides: [4] }), 0)).toContain('1.5 : 1')
    // Side 3 gives exactly 2, which must print without a decimal point.
    expect(cube(svg({ sides: [3] }), 0)).toContain('2 : 1')
  })

  it('honours the unit and ignores sides that are not positive', () => {
    expect(svg({ sides: [2], unit: 'mm' })).toContain('area 24 mm²')
    const markup = svg({ sides: [0, -1, 2] })
    expect(markup.split('<g>').length - 1).toBe(1)
  })

  it('draws a caption only when one is given', () => {
    expect(svg({ sides: [1, 2], title: 'the ratio falls as the cube grows' })).toContain('the ratio falls as the cube grows')
    expect(svg({ sides: [1, 2] })).not.toContain('</line>')
  })
})
