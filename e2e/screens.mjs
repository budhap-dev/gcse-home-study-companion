// The screens walk: the app's main screens in a real browser, at phone and desktop width and
// in each theme, with a sample student's progress loaded so the maps, rings and bars have
// something to draw. It fails on what the lesson walk (walk.mjs) does not visit:
//
//   - the page scrolling sideways;
//   - a script error on the page;
//   - text under 11px, or text cut off by its own box;
//   - text below WCAG AA contrast against the solid colour behind it (4.5:1, or 3:1 for
//     large text). Text on a banner gradient is skipped here: contrast.test.ts holds every
//     theme's gradient to 5:1 for white;
//   - at phone width, a button or link smaller than 24 by 24 pixels (WCAG 2.2 target size),
//     unless it sits inside a line of text;
//   - at phone width, a page that opens with the cursor already in a field, which raises
//     the on-screen keyboard over the page before any of it has been read;
//   - a formula on a reference sheet that is wider than its card, and so scrolls;
//   - after pressing a control, the page widening while whatever it set off is still moving.
//     A phone browser widens its layout viewport to fit a page that has grown sideways, and
//     the menu dock at the foot goes with it: a flashcard flying off to the right took the
//     dock off the screen and back on every "Got it".
//
// Usage: node e2e/screens.mjs [--base http://localhost:4173] [--widths 390,1280]
//          [--themes paper,midnight | all] [--shots dir] [--motion on|off] [--only /flashcards]
// Writes e2e-screens-report.json and exits 1 if anything was found.
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', 'supabase', 'seed', 'content')
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback }
const BASE = arg('base', 'http://localhost:4173')
const WIDTHS = arg('widths', '390,1280').split(',').map(Number)
const THEME_SOURCE = readFileSync(join(HERE, '..', 'apps', 'web', 'src', 'theme', 'themes.ts'), 'utf8')
const ALL_THEMES = [...THEME_SOURCE.matchAll(/\{ id: '([a-z-]+)', name:/g)].map((m) => m[1])
const THEMES = arg('themes', 'paper,midnight') === 'all' ? ALL_THEMES : arg('themes', 'paper,midnight').split(',')
const SHOTS = arg('shots', '')
// --motion off: the Settings switch for animations, which must leave every page complete.
const MOTION = arg('motion', 'on')
// --only: just the routes whose path contains this, while working on one screen.
const ONLY = arg('only', '')

// A route with `press` is scanned again after pressing that control, for what only shows then.
// A route with `tap` presses each of those controls in turn (the first match of each), for a
// screen that needs a sequence: turn a card over, then say it is known. Both are watched
// for the page widening while the press's animation runs.
// A route with `seed` starts from that student instead of the sample: 'new' has never opened
// the app (the welcome questions), 'blank' has answered them and done nothing since.
const ROUTES = [
  '/',
  { path: '/', seed: 'new' },
  { path: '/', seed: 'blank' },
  { path: '/subjects/physics', seed: 'blank', press: 'button[aria-pressed][title]' },
  '/subjects',
  { path: '/subjects/maths', press: 'button[aria-pressed][title]' },
  '/subjects/maths?view=list',
  '/subjects/maths/topics/circle-theorems',
  '/subjects/physics',
  '/subjects/english-literature/topics/an-inspector-calls-themes',
  '/progress',
  '/settings',
  '/glossary',
  '/search',
  '/search?q=momentum',
  '/resources',
  { path: '/resources', press: 'button[aria-pressed="false"]' },
  '/resources/physics/equation-sheet',
  // A fraction too wide for a phone's card, a drawing with a wider form for a laptop, a
  // drawing beside its table, and drawings that share rows.
  '/resources/business/business-formulae',
  '/resources/physics/electromagnetic-spectrum',
  '/resources/biology/the-heart',
  '/resources/computer-science/logic-gates',
  // The press picks a family, fading the rest of the table: the faded cells must still pass.
  { path: '/resources/chemistry/periodic-table', press: 'figure button.rounded-full' },
  // Turn the card, then send it off the deck: the flight must stay within the page.
  { path: '/subjects/physics/topics/behaviour-of-gases/flashcards', tap: ['.flashcard', 'button:has-text("Got it")'] },
]

/** The sample student: Year 10, a spread of statuses in every subject, a lesson half done. */
function sampleProgress() {
  const now = Date.now()
  const daysAgo = (d) => new Date(now - d * 86400000).toISOString()
  const attempts = []
  const lessons = {}
  let n = 0
  const attempt = (topicId, kind, pct, level, ago) => attempts.push({
    id: `sample-${n++}`, topicId, kind, level, marksScored: pct, marksAvailable: 100, markedHow: 'auto', completedAt: daysAgo(ago), xp: Math.round(pct / 2),
  })
  for (const subject of readdirSync(ROOT).filter((d) => !d.includes('.')).sort()) {
    const ids = readdirSync(join(ROOT, subject)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort()
    ids.forEach((id, i) => {
      // Of every nine topics: one mastered, two secure, two developing, one not secure, three untouched.
      const k = i % 9
      if (k === 0) { attempt(id, 'quiz', 95, undefined, 3); attempt(id, 'worksheet', 85, 'higher', 4); attempt(id, 'worksheet', 80, 'advanced', 3) }
      if (k === 1 || k === 2) { attempt(id, 'quiz', 85, undefined, 5 + k); attempt(id, 'worksheet', 75, 'higher', 6) }
      if (k === 3) attempt(id, 'quiz', 60, undefined, 2)
      if (k === 4) lessons[id] = { topicId: id, stepIndex: 7, completedAt: daysAgo(1), updatedAt: daysAgo(1) }
      if (k === 5) attempt(id, 'quiz', 35, undefined, 1)
      if (k < 5) lessons[id] ??= { topicId: id, stepIndex: 6, completedAt: daysAgo(8), updatedAt: daysAgo(8) }
    })
  }
  lessons['circle-theorems'] = { topicId: 'circle-theorems', stepIndex: 4, updatedAt: daysAgo(0) }
  // A redo session has no level; the Progress page once crashed listing one under Recent.
  attempt('circle-theorems', 'review', 70, undefined, 0)
  const minutes = {}
  for (let d = 0; d < 6; d++) minutes[new Date(now - d * 86400000).toISOString().slice(0, 10)] = [22, 0, 15, 13, 30, 8][d]
  return {
    attempts, lessons, activities: [], minutes, time: {}, goalMinutes: 180, daysOff: [], badges: {}, milestones: {},
    profile: { year: 10, setupAt: daysAgo(20) },
  }
}

/** In the page: everything this walk fails on. Runs after the entrance animations settle. */
const scan = ({ phone }) => {
  const out = []
  const push = (kind, el, detail) => out.push({ kind, where: describe(el), detail })
  function describe(el) {
    if (!el || el === document.documentElement) return 'page'
    const text = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 50)
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} "${text}"`
  }
  if (document.documentElement.scrollWidth > window.innerWidth) out.push({ kind: 'page scrolls sideways', where: 'page', detail: `${document.documentElement.scrollWidth} > ${window.innerWidth}` })

  // Any CSS colour, oklch and color-mix included, to sRGB bytes: paint it and read it back.
  const cvs = document.createElement('canvas'); cvs.width = cvs.height = 1
  const ctx = cvs.getContext('2d', { willReadFrequently: true })
  const toRgba = (css) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1); const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data; return [r, g, b, a / 255] }
  const lin = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  const over = (top, under) => top.slice(0, 3).map((v, i) => v * top[3] + under[i] * (1 - top[3]))
  /** The solid colour painted behind an element, or null where a gradient or image is behind it. */
  const groundOf = (el) => {
    const layers = []
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.backgroundImage !== 'none' && e !== document.documentElement && e !== document.body) return null
      const c = toRgba(cs.backgroundColor)
      if (c[3] > 0) { layers.push(c); if (c[3] >= 1) break }
    }
    let ground = toRgba(getComputedStyle(document.documentElement).backgroundColor)
    for (const layer of layers.reverse()) ground = over(layer, ground)
    return ground
  }
  const visible = (el) => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })

  for (const el of document.querySelectorAll('main *, header *, nav *, aside *')) {
    if (el.closest('svg, .katex, .sr-only, math-field, figure[data-diagram]')) continue
    const own = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())
    if (!own || !visible(el)) continue
    const cs = getComputedStyle(el)
    const size = parseFloat(cs.fontSize)
    if (size < 11) push('text under 11px', el, `${size}px`)
    if ((cs.overflow === 'hidden' || cs.overflowX === 'hidden') && cs.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 1) push('text cut off', el, `${el.scrollWidth} > ${el.clientWidth}`)
    const ground = groundOf(el)
    if (!ground) continue
    // A control that cannot be used yet is dimmed on purpose: WCAG 1.4.3 leaves inactive
    // controls out, and the flashcard's Again and Got it wait, faded, for the card to turn.
    if (el.closest(':disabled, [aria-disabled="true"]')) continue
    let opacity = 1
    for (let e = el; e; e = e.parentElement) opacity *= parseFloat(getComputedStyle(e).opacity)
    const ink = toRgba(cs.color)
    const painted = over([...ink.slice(0, 3), ink[3] * opacity], ground)
    const [hi, lo] = [lum(painted), lum(ground)].sort((a, b) => b - a)
    const ratio = (hi + 0.05) / (lo + 0.05)
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700)
    if (ratio < (large ? 3 : 4.5)) push('low contrast', el, `${ratio.toFixed(2)}:1 at ${size}px`)
  }

  for (const el of document.querySelectorAll('main .formula-line')) {
    if (visible(el) && el.scrollWidth > el.clientWidth + 1) push('formula wider than its card', el, `${el.scrollWidth} > ${el.clientWidth}`)
  }

  if (phone) {
    for (const el of document.querySelectorAll('main a, main button, main [role="button"], main input, main select, nav a')) {
      // A control inside a label is reached through the whole label, which is the real target.
      if (!visible(el) || el.closest('p, li > span, .rich-text') || (el.tagName === 'INPUT' && el.closest('label'))) continue
      const r = el.getBoundingClientRect()
      if (r.width < 24 || r.height < 24) push('target under 24px', el, `${Math.round(r.width)}x${Math.round(r.height)}`)
    }
    const at = document.activeElement
    if (at && at.matches('input:not([type="checkbox"], [type="radio"], [type="range"], [type="button"]), textarea, math-field, [contenteditable="true"]')) push('keyboard raised on open', at, at.getAttribute('aria-label') ?? at.tagName.toLowerCase())
  }
  return out
}

const browser = await chromium.launch({ channel: 'chrome' })
const findings = []
const progress = JSON.stringify(sampleProgress())
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
for (const theme of THEMES) {
  for (const width of WIDTHS) {
    const phone = width < 768
    // A phone is touched, not pointed at: the page can ask, and what it does on opening depends on the answer.
    const context = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, deviceScaleFactor: 1, hasTouch: phone })
    const SEEDS = { sample: progress, new: '', blank: JSON.stringify({ profile: { setupAt: new Date().toISOString() } }) }
    await context.addInitScript(([seeds, t, motion]) => {
      const seed = seeds[sessionStorage.getItem('screens.seed') ?? 'sample']
      if (seed) localStorage.setItem('study-companion.progress.v1', seed)
      else localStorage.removeItem('study-companion.progress.v1')
      localStorage.setItem('study-companion.theme', t)
      localStorage.setItem('study-companion.motion', motion)
    }, [SEEDS, theme, MOTION])
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()) })
    const shot = (name) => SHOTS ? page.screenshot({ path: join(SHOTS, `${theme}-${width}${name.replace(/[/?=]/g, '_') || '_home'}.png`), fullPage: true }) : undefined
    for (const entry of ROUTES) {
      const { path, press, tap, seed = 'sample' } = typeof entry === 'string' ? { path: entry } : entry
      if (ONLY && !path.includes(ONLY)) continue
      const route = seed === 'sample' ? path : `${path} (${seed} student)`
      errors.length = 0
      // The seed is chosen per visit through sessionStorage, which the init script reads first.
      await page.goto(BASE + '/404-seed', { waitUntil: 'load' })
      await page.evaluate((s) => sessionStorage.setItem('screens.seed', s), seed)
      await page.goto(BASE + path, { waitUntil: 'load', timeout: 60000 })
      await page.waitForSelector('main h1', { timeout: 20000 }).catch(() => errors.push('no heading rendered'))
      // Entrance animations run to about 1.6s; measuring mid-animation reports boxes that are not the layout.
      await page.waitForTimeout(2200)
      const found = await page.evaluate(scan, { phone })
      await shot(route.replace(/[ ()]/g, '-'))
      if (press || tap) {
        /** The widest the page gets while a press's animation runs: sampled for 600ms, every 30ms. */
        const widest = async () => {
          let most = 0
          for (let i = 0; i < 20; i++) {
            most = Math.max(most, await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
            await page.waitForTimeout(30)
          }
          return most
        }
        let widened = 0
        if (press) { await page.locator(press).nth(3).click(); widened = await widest() }
        for (const selector of tap ?? []) { await page.locator(selector).first().click(); widened = Math.max(widened, await widest()) }
        await page.waitForTimeout(300)
        const after = await page.evaluate(scan, { phone })
        if (widened > 0) after.push({ kind: 'page widens while animating', where: 'page', detail: `by ${widened}px` })
        // Anything opened over the page must stay clear of the phone's menu bar.
        const hidden = await page.evaluate(() => {
          // Two menus share the name, the top band's and the dock's; only one is shown at a width.
          const nav = [...document.querySelectorAll('nav[aria-label="Primary"]')].find((n) => getComputedStyle(n).display !== 'none')
          const navTop = nav && nav.getBoundingClientRect().bottom > window.innerHeight / 2 ? nav.getBoundingClientRect().top : Infinity
          return [...document.querySelectorAll('aside')].filter((a) => getComputedStyle(a).position === 'fixed' && a.checkVisibility())
            .map((a) => a.getBoundingClientRect().bottom - navTop).filter((d) => d > 0.5)
        })
        for (const d of hidden) after.push({ kind: 'sheet under the menu bar', where: 'aside', detail: `${Math.round(d)}px` })
        for (const f of after) found.push({ ...f, where: `after pressing: ${f.where}` })
        await shot(route.replace(/[ ()]/g, '-') + '-pressed')
      }
      for (const e of errors) found.push({ kind: 'script error', where: 'page', detail: e.slice(0, 200) })
      for (const f of found) findings.push({ theme, width, route, ...f })
      console.log(`${theme} ${width} ${route}: ${found.length ? found.length + ' found' : 'clean'}`)
    }
    await context.close()
  }
}
await browser.close()

writeFileSync(join(HERE, '..', 'e2e-screens-report.json'), JSON.stringify(findings, null, 2))
if (findings.length) {
  const byKind = Object.groupBy(findings, (f) => f.kind)
  for (const [kind, list] of Object.entries(byKind)) {
    console.log(`\n${kind}: ${list.length}`)
    for (const f of list.slice(0, 12)) console.log(`  ${f.theme} ${f.width} ${f.route} ${f.where} ${f.detail}`)
  }
  process.exit(1)
}
console.log('\nAll screens clean.')
