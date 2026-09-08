export interface Theme {
  id: string
  name: string
  blurb: string
  /** Overrides for the Tailwind colour tokens declared in styles.css. */
  vars: Record<string, string>
  dark?: boolean
}

export const THEMES: Theme[] = [
  { id: 'paper', name: 'Paper', blurb: 'Warm and calm, like a good exercise book.', vars: {} },
  { id: 'midnight', name: 'Midnight', blurb: 'Dark background, easy on the eyes at night.', dark: true,
    vars: { '--color-paper': '#151a22', '--color-surface': '#1e2430', '--color-ink': '#eef0f4', '--color-ink-2': '#b3b9c6', '--color-ink-3': '#7f8798', '--color-rule': '#2e3644', '--color-panel': '#262d3a', '--subject-soft': '#2a3244' } },
  { id: 'ocean', name: 'Ocean', blurb: 'Cool blues and sea glass.', vars: { '--color-paper': '#eef5f7', '--color-surface': '#ffffff', '--color-ink': '#12303a', '--color-ink-2': '#4d6b75', '--color-ink-3': '#7f979f', '--color-rule': '#cfe0e5', '--color-panel': '#dcebef' } },
  { id: 'sunset', name: 'Sunset', blurb: 'Peach and coral, a bit of warmth.', vars: { '--color-paper': '#fff4ec', '--color-surface': '#fffaf6', '--color-ink': '#3a2418', '--color-ink-2': '#7a5646', '--color-ink-3': '#a88a7c', '--color-rule': '#f0d9cb', '--color-panel': '#fbe6d8' } },
  { id: 'forest', name: 'Forest', blurb: 'Deep greens, quiet focus.', dark: true,
    vars: { '--color-paper': '#132019', '--color-surface': '#1b2b22', '--color-ink': '#eaf3ec', '--color-ink-2': '#aec5b5', '--color-ink-3': '#7f9788', '--color-rule': '#2b4033', '--color-panel': '#24382c', '--subject-soft': '#284133' } },
  { id: 'candy', name: 'Candy', blurb: 'Pink and lilac. Loud on purpose.', vars: { '--color-paper': '#fdf0f7', '--color-surface': '#fffafd', '--color-ink': '#3b1e33', '--color-ink-2': '#7c4f70', '--color-ink-3': '#ab86a1', '--color-rule': '#f2d3e6', '--color-panel': '#f9e0ef' } },
]

const KEY = 'study-companion.theme'

export function currentThemeId(): string {
  try {
    return localStorage.getItem(KEY) ?? 'paper'
  } catch {
    return 'paper'
  }
}

/** Applies a theme to the document root. Called at start-up and from Settings. */
export function applyTheme(id: string) {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0]!
  const root = document.documentElement
  for (const t of THEMES) for (const k of Object.keys(t.vars)) root.style.removeProperty(k)
  for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(k, v)
  root.dataset.theme = theme.id
  root.style.colorScheme = theme.dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.vars['--color-paper'] ?? '#f7f5ef')
  try {
    localStorage.setItem(KEY, theme.id)
  } catch {
    // no storage: theme lasts for this visit
  }
}
