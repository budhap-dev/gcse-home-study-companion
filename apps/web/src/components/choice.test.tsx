import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Choice } from './Choice.tsx'

const opts = [{ value: 'a', label: 'Apple' }, { value: 'b', label: 'Banana' }]

/**
 * This exists because a native select opens an OS popup the page cannot style, so the
 * appearance is only under our control if the list is ours. What matters in markup is
 * that it still announces itself as a combobox and shows the current choice.
 */
describe('Choice', () => {
  it('shows the label of the current value, not the value', () => {
    const html = renderToStaticMarkup(<Choice label="Fruit" value="b" options={opts} onChange={() => {}} />)
    expect(html).toContain('Banana')
    expect(html).toContain('Fruit')
  })

  it('announces itself as a collapsed combobox with an accessible name', () => {
    const html = renderToStaticMarkup(<Choice label="Fruit" value="a" options={opts} onChange={() => {}} />)
    expect(html).toContain('role="combobox"')
    expect(html).toContain('aria-label="Fruit"')
    expect(html).toContain('aria-expanded="false"')
    // Closed, so no listbox is in the markup at all.
    expect(html).not.toContain('role="listbox"')
  })

  it('renders nothing for a value that is not among the options, rather than crashing', () => {
    const html = renderToStaticMarkup(<Choice label="Fruit" value="zzz" options={opts} onChange={() => {}} />)
    expect(html).toContain('role="combobox"')
    expect(html).not.toContain('Apple')
  })
})
