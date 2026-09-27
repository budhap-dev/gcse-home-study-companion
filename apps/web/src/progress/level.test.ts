import { describe, expect, it } from 'vitest'
import { suggestedLevel } from './level.ts'

describe('the worksheet level to start at', () => {
  it('follows the topic status, Advanced once Secure', () => {
    expect(suggestedLevel('not-secure')).toBe('core')
    expect(suggestedLevel('developing')).toBe('higher')
    expect(suggestedLevel('secure')).toBe('advanced')
    expect(suggestedLevel('grade-9-ready')).toBe('advanced')
  })
})
