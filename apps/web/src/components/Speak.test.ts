import { describe, expect, it } from 'vitest'
import { rankFrenchVoice } from './Speak.tsx'

/** The French voices macOS Chrome listed on 6 October 2026, in its order. */
const MAC = ['Amélie:fr-CA', 'Eddy (French (Canada)):fr-CA', 'Eddy (French (France)):fr-FR', 'Flo (French (France)):fr-FR', 'Grandma (French (France)):fr-FR', 'Grandpa (French (France)):fr-FR', 'Jacques:fr-FR', 'Rocko (French (France)):fr-FR', 'Thomas:fr-FR']
  .map((s) => { const [name, lang] = s.split(':'); return { name: name!, lang: lang! } })

describe('choosing a French voice', () => {
  it("takes the platform's main France French voice over a character voice listed first", () => {
    const best = [...MAC].sort((a, b) => rankFrenchVoice(b) - rankFrenchVoice(a))[0]!
    expect(best.name).toBe('Thomas')
  })

  it('prefers Google français in Chrome, and never an English voice', () => {
    expect(rankFrenchVoice({ name: 'Google français', lang: 'fr-FR' })).toBeGreaterThan(rankFrenchVoice({ name: 'Jacques', lang: 'fr-FR' }))
    expect(rankFrenchVoice({ name: 'Daniel', lang: 'en-GB' })).toBe(-1)
  })

  it('still uses a character voice when it is the only French one', () => {
    expect(rankFrenchVoice({ name: 'Grandpa (French (France))', lang: 'fr-FR' })).toBeGreaterThanOrEqual(0)
  })
})
