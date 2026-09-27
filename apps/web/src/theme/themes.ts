export interface Theme {
  id: string
  name: string
  blurb: string
  /** Overrides for the Tailwind colour tokens declared in styles.css. */
  vars: Record<string, string>
  dark?: boolean
}

/**
 * A dark theme's accent floor.
 *
 * The subject accents and the chip colours are authored for a light page. styles.css turns
 * each of them into readable text by clamping its OKLCH lightness between these two, which
 * keeps the hue and the saturation and moves only how light it is: on a dark ground navy
 * becomes a light periwinkle rather than a washed-out grey. Measured worst case across every
 * accent and every theme afterwards is 5.1:1, against 1.4:1 before.
 *
 * Light themes use the defaults in styles.css (cap at 0.5); only the dark ones lift the floor.
 */
const DARK_ACCENT = { '--accent-l-min': '0.78', '--accent-l-max': '1', '--map-l-min': '0.62' }

/**
 * A banner's three colours and the page's two soft lights (the map look). White text sits on
 * the banner, so every stop and every blend between two stops clears AA for white; the
 * contrast test holds each theme to that. Paper's are the defaults in styles.css.
 */
function look(hero: [string, string, string], glow: [string, string], mapEmpty?: string): Record<string, string> {
  return { '--hero-1': hero[0], '--hero-2': hero[1], '--hero-3': hero[2], '--glow-1': glow[0], '--glow-2': glow[1], ...(mapEmpty ? { '--map-empty': mapEmpty } : {}) }
}
/** The outline of a map square not started, on a dark page. */
const DARK_EMPTY = 'rgb(255 255 255 / 0.28)'

export const THEMES: Theme[] = [
  { id: 'paper', name: 'Paper', blurb: 'Warm and calm, like a good exercise book.', vars: {} },
  { id: 'midnight', name: 'Midnight', blurb: 'Dark background, easy on the eyes at night.', dark: true,
    vars: { '--color-paper': '#151a22', '--color-surface': '#1e2430', '--color-ink': '#eef0f4', '--color-ink-2': '#b3b9c6', '--color-ink-3': '#8d95a7', '--color-rule': '#2e3644', '--color-panel': '#262d3a', '--subject-soft': '#2a3244', ...DARK_ACCENT, ...look(['#1d5f8a', '#4b3fb0', '#8a3163'], ['rgb(90 75 209 / 0.18)', 'rgb(29 95 138 / 0.18)'], DARK_EMPTY) } },
  { id: 'ocean', name: 'Ocean', blurb: 'Cool blues and sea glass.', vars: { '--color-paper': '#eef5f7', '--color-surface': '#ffffff', '--color-ink': '#12303a', '--color-ink-2': '#4d6b75', '--color-ink-3': '#546b72', '--color-rule': '#cfe0e5', '--color-panel': '#dcebef', ...look(['#0b6e78', '#1f5f9c', '#4a45b8'], ['rgb(31 95 156 / 0.12)', 'rgb(11 110 120 / 0.1)'], '#b9cfd5') } },
  { id: 'sunset', name: 'Sunset', blurb: 'Peach and coral, a bit of warmth.', vars: { '--color-paper': '#fff4ec', '--color-surface': '#fffaf6', '--color-ink': '#3a2418', '--color-ink-2': '#7a5646', '--color-ink-3': '#7e6254', '--color-rule': '#f0d9cb', '--color-panel': '#fbe6d8', ...look(['#b5451b', '#b8324f', '#8f3a8f'], ['rgb(184 50 79 / 0.1)', 'rgb(217 115 27 / 0.1)'], '#e3c2b0') } },
  { id: 'forest', name: 'Forest', blurb: 'Deep greens, quiet focus.', dark: true,
    vars: { '--color-paper': '#132019', '--color-surface': '#1b2b22', '--color-ink': '#eaf3ec', '--color-ink-2': '#aec5b5', '--color-ink-3': '#8ba394', '--color-rule': '#2b4033', '--color-panel': '#24382c', '--subject-soft': '#284133', ...DARK_ACCENT, ...look(['#1f6b45', '#0e6a5a', '#3f6a1c'], ['rgb(46 139 87 / 0.18)', 'rgb(14 106 90 / 0.16)'], DARK_EMPTY) } },
  { id: 'candy', name: 'Candy', blurb: 'Pink and lilac. Loud on purpose.', vars: { '--color-paper': '#fdf0f7', '--color-surface': '#fffafd', '--color-ink': '#3b1e33', '--color-ink-2': '#7c4f70', '--color-ink-3': '#7e5b75', '--color-rule': '#f2d3e6', '--color-panel': '#f9e0ef', '--bg-pattern': "radial-gradient(circle at 20% 30%, #f8c8e4 0 6px, transparent 7px), radial-gradient(circle at 70% 80%, #e6d4f5 0 8px, transparent 9px)", '--bg-size': '180px 180px', ...look(['#a83e6b', '#8b3fa8', '#5a4bd1'], ['rgb(168 62 107 / 0.12)', 'rgb(139 63 168 / 0.1)'], '#e4bcd4') } },
  { id: 'space', name: 'Space', blurb: 'Stars on deep navy. For night-time missions.', dark: true,
    vars: { '--color-paper': '#0f1530', '--color-surface': '#1a2145', '--color-ink': '#f1f3ff', '--color-ink-2': '#b9c0e6', '--color-ink-3': '#8b95ca', '--color-rule': '#2c3663', '--color-panel': '#232c55', '--subject-soft': '#2a3466', ...DARK_ACCENT, '--bg-pattern': "radial-gradient(circle at 10% 20%, #ffffff 0 1px, transparent 2px), radial-gradient(circle at 60% 70%, #ffffff 0 1.5px, transparent 2.5px), radial-gradient(circle at 85% 15%, #ffe9a8 0 1px, transparent 2px), radial-gradient(circle at 35% 85%, #ffffff 0 1px, transparent 2px)", '--bg-size': '220px 220px', ...look(['#2a3aa8', '#5a4bd1', '#8a3fa8'], ['rgb(90 75 209 / 0.22)', 'rgb(138 63 168 / 0.16)'], DARK_EMPTY) } },
  { id: 'jungle', name: 'Jungle', blurb: 'Leafy greens and a splash of sun.', vars: { '--color-paper': '#eef7ea', '--color-surface': '#ffffff', '--color-ink': '#1d3320', '--color-ink-2': '#4f6f52', '--color-ink-3': '#546e57', '--color-rule': '#cfe3cc', '--color-panel': '#dcefd8', '--bg-pattern': "radial-gradient(ellipse at 15% 25%, #cfe9c5 0 14px, transparent 15px), radial-gradient(ellipse at 80% 70%, #ffe8a3 0 10px, transparent 11px)", '--bg-size': '260px 260px', ...look(['#2e7d4a', '#0b6e78', '#5b6b1f'], ['rgb(46 125 74 / 0.12)', 'rgb(217 162 27 / 0.1)'], '#b9d3b4') } },
  { id: 'sunshine', name: 'Sunshine', blurb: 'Bright yellow, big smiles.', vars: { '--color-paper': '#fff8dc', '--color-surface': '#fffdf3', '--color-ink': '#3a2f0b', '--color-ink-2': '#7a6a2c', '--color-ink-3': '#796b35', '--color-rule': '#f3e5a8', '--color-panel': '#fdf0bb', '--bg-pattern': "radial-gradient(circle at 25% 25%, #ffe680 0 10px, transparent 11px), radial-gradient(circle at 75% 75%, #ffd166 0 6px, transparent 7px)", '--bg-size': '200px 200px', ...look(['#a15300', '#b5451b', '#a83e6b'], ['rgb(217 162 27 / 0.16)', 'rgb(181 69 27 / 0.08)'], '#e2cf8a') } },
  { id: 'aurora', name: 'Aurora', blurb: 'Cool and bright, with a glow of violet and pink.',
    vars: { '--color-paper': '#f4f5fa', '--color-surface': '#ffffff', '--color-ink': '#1e2330', '--color-ink-2': '#545b6e', '--color-ink-3': '#5d6475', '--color-rule': '#e1e4ee', '--color-panel': '#eceef6', ...look(['#2f5fb8', '#5a4bd1', '#a83e6b'], ['rgb(168 62 107 / 0.16)', 'rgb(90 75 209 / 0.12)'], '#c8cbd8') } },
  { id: 'nebula', name: 'Nebula', blurb: 'Deep violet with a pink glow. Bold after dark.', dark: true,
    vars: { '--color-paper': '#120f24', '--color-surface': '#1c1836', '--color-ink': '#f2efff', '--color-ink-2': '#bdb6e0', '--color-ink-3': '#9a93c4', '--color-rule': '#2f2954', '--color-panel': '#262046', '--subject-soft': '#2b2550', ...DARK_ACCENT, ...look(['#3b2fa8', '#6d2f99', '#a3305f'], ['rgb(163 48 95 / 0.24)', 'rgb(90 75 209 / 0.22)'], DARK_EMPTY) } },
]

const KEY = 'study-companion.theme'

export function currentThemeId(): string {
  try {
    return localStorage.getItem(KEY) ?? 'paper'
  } catch {
    return 'paper'
  }
}

/**
 * "Match my device": Paper by day and Midnight by night, following the device's own light or
 * dark setting and switching when it does. Stored as its own choice rather than as whichever
 * theme it resolved to, so the next change of the device's setting is still followed.
 */
export const AUTO_THEME = { id: 'auto', name: 'Match my device', blurb: 'Paper when your device is light, Midnight when it is dark.' } as const

const prefersDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches

/** The theme a choice paints: itself, or for "auto" the one the device's setting picks. */
export function resolveTheme(id: string, dark = prefersDark()): Theme {
  if (id === AUTO_THEME.id) return THEMES.find((t) => t.id === (dark ? 'midnight' : 'paper'))!
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!
}

let following = false

/** Applies a theme to the document root. Called at start-up and from Settings. */
export function applyTheme(id: string) {
  const choice = id === AUTO_THEME.id ? id : resolveTheme(id).id
  const theme = resolveTheme(choice)
  const root = document.documentElement
  for (const t of THEMES) for (const k of Object.keys(t.vars)) root.style.removeProperty(k)
  root.style.removeProperty('--bg-pattern')
  root.style.removeProperty('--bg-size')
  for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(k, v)
  root.dataset.theme = theme.id
  root.style.colorScheme = theme.dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.vars['--color-paper'] ?? '#f7f5ef')
  try {
    localStorage.setItem(KEY, choice)
  } catch {
    // no storage: theme lasts for this visit
  }
  // One listener for the life of the page; it re-applies only while the choice is still "auto".
  if (choice === AUTO_THEME.id && !following && typeof matchMedia === 'function') {
    following = true
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (currentThemeId() === AUTO_THEME.id) applyTheme(AUTO_THEME.id)
    })
  }
}
