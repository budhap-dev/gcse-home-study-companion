import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ProfileForm } from './ProfileForm.tsx'

const saveButtons = (html: string) => html.match(/<button[^>]*>(Save|Start)<\/button>/g) ?? []

describe('the school year form', () => {
  // Settings (19 November 2026): a Save beside the year already saved read as a step still
  // to do, so it waits until a different year is picked.
  it('in Settings, shows no Save while the saved year is the one chosen', () => {
    expect(saveButtons(renderToStaticMarkup(<ProfileForm profile={{ year: 10 }} saveWhen="changed" />))).toHaveLength(0)
    expect(saveButtons(renderToStaticMarkup(<ProfileForm profile={{}} saveWhen="changed" />))).toHaveLength(0)
  })

  it('on a first visit, always shows its button, since nothing is saved yet', () => {
    expect(saveButtons(renderToStaticMarkup(<ProfileForm profile={{}} saveLabel="Start" />))).toEqual(['<button type="button" class="btn btn-primary btn-lg">Start</button>'])
    expect(saveButtons(renderToStaticMarkup(<ProfileForm profile={{ year: 10 }} />))).toHaveLength(1)
  })
})
