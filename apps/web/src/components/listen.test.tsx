import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { getFullTopic } from '../content/all.ts'
import { Listen, listenLinks } from './Listen.tsx'

describe('the Listen card', () => {
  const r = getFullTopic('music', 'samba-em-preludio')!.listen!

  it('searches YouTube and Spotify for the named recording, encoded', () => {
    expect(listenLinks(r).map((l) => l.url)).toEqual([
      'https://www.youtube.com/results?search_query=Samba%20em%20Preludio%20Esperanza%20Spalding',
      'https://open.spotify.com/search/Samba%20em%20Preludio%20Esperanza%20Spalding',
    ])
  })

  it('names work, performers, album and track, and opens the search in a new tab', () => {
    const html = renderToStaticMarkup(<Listen recording={r} />)
    for (const s of ['Samba Em Prelúdio', 'Esperanza Spalding', '<cite>Esperanza</cite>, track 12', 'Search YouTube', 'Search Spotify']) expect(html).toContain(s)
    expect(html.match(/target="_blank" rel="noopener noreferrer"/g)).toHaveLength(2)
  })
})
