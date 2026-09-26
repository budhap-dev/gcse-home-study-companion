import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SCRATCH_NOTE, ScratchCanvas } from './ScratchCanvas.tsx'

/**
 * The strokes are kept only in the worksheet's session state, never in the attempt record,
 * so the canvas must not promise more. If working is ever saved with attempts, change the
 * note and this test together.
 */
describe('ScratchCanvas', () => {
  it('says the working is not saved with the score', () => {
    const html = renderToStaticMarkup(<ScratchCanvas strokes={[]} onChange={() => {}} />)
    expect(html).toContain(SCRATCH_NOTE)
    expect(html).not.toMatch(/saved with your answer/i)
    expect(SCRATCH_NOTE).toMatch(/not saved/)
  })
})
