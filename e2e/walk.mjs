// The browser walk: visits lesson steps and why pages in a real browser, at phone and
// desktop width, and fails on what unit tests cannot see.
//
//   - a diagram or the page scrolling sideways (a diagram stops shrinking at its natural
//     width, so one too wide for a phone hides its right-hand side);
//   - a drawn line running through a diagram label;
//   - a script error on the page;
//   - at phone width, a lesson check that is not marked Correct when given its own answer.
//
// Usage: node e2e/walk.mjs [--base http://localhost:4173] [--widths 390,1280]
//   TOPICS=id,id   walk these topics (plus the sample when SAMPLE=1)
//   SAMPLE=1       walk the fixed sample below
//   SHARD=k/n      walk every topic, split n ways, this run taking part k
// Writes e2e-report.json and exits 1 if anything was found.
import { chromium } from 'playwright-core'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'seed', 'content')
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback }
const BASE = arg('base', 'http://localhost:4173')
const WIDTHS = arg('widths', '390,1280').split(',').map(Number)

/** Topics chosen to reach every subject and every kind of diagram that has broken before. */
const SAMPLE = [
  'quadratic-curves', 'circle-theorems', 'charts-and-diagrams-for-data', 'constructing-triangles', 'pythagoras-in-3d',
  'equation-of-a-circle', 'describing-motion', 'lenses', 'alkenes-and-their-reactions', 'ionic-bonding',
  'diffusion-osmosis-and-active-transport', 'logic-circuits', 'making-operational-decisions', 'defying-gravity',
  'narrative-writing', 'the-power-of-humans', 'geometrical-proof', 'relative-pronouns-and-time-expressions',
]

const all = []
for (const s of readdirSync(ROOT).filter((d) => !d.includes('.'))) {
  for (const f of readdirSync(join(ROOT, s)).filter((f) => f.endsWith('.json'))) all.push({ s, t: JSON.parse(readFileSync(join(ROOT, s, f), 'utf8')) })
}
all.sort((a, b) => a.t.id.localeCompare(b.t.id))
const byId = new Map(all.map((x) => [x.t.id, x]))

let chosen
if (process.env.SHARD) {
  const [k, n] = process.env.SHARD.split('/').map(Number)
  chosen = all.filter((_, i) => i % n === k - 1)
} else {
  const ids = new Set((process.env.TOPICS ?? '').split(',').map((x) => x.trim()).filter(Boolean))
  if (process.env.SAMPLE === '1') SAMPLE.forEach((id) => ids.add(id))
  const missing = [...ids].filter((id) => !byId.has(id))
  if (missing.length) { console.error(`unknown topic ids: ${missing.join(', ')}`); process.exit(2) }
  chosen = [...ids].map((id) => byId.get(id))
}

const pages = []
for (const { s, t } of chosen) {
  if (t.why?.examples?.some((e) => e.visual)) pages.push({ s, t: t.id, where: 'why', url: `/subjects/${s}/topics/${t.id}/why` })
  t.lesson.steps.forEach((st, i) => pages.push({ s, t: t.id, where: st.id, url: `/subjects/${s}/topics/${t.id}/lesson?step=${i + 1}`, check: st.check }))
}

/** In the page: what scrolls sideways, and which drawn lines pass through a label. */
const scan = () => {
  const out = []
  const w = window.innerWidth
  if (document.documentElement.scrollWidth > w) out.push({ kind: 'page scrolls sideways', detail: `${document.documentElement.scrollWidth} > ${w}` })
  for (const fig of document.querySelectorAll('figure[data-diagram]')) {
    const over = fig.scrollWidth - fig.clientWidth
    if (over > 1) out.push({ kind: 'diagram scrolls sideways', detail: `${fig.getAttribute('data-diagram')} by ${over}px` })
  }
  // Code blocks, display maths and the maths field scroll in their own box by design.
  for (const el of document.querySelectorAll('main *')) {
    if (el.closest('figure[data-diagram], .katex-display, pre, math-field') || el.classList.contains('sr-only')) continue
    const over = el.scrollWidth - el.clientWidth
    if (over > 2 && el.clientWidth > 4 && getComputedStyle(el).overflowX !== 'visible') out.push({ kind: 'element scrolls sideways', detail: `${el.tagName.toLowerCase()} by ${over}px` })
  }
  // Lines through labels: compared in the svg's own space; a label on a white halo is meant
  // to sit over the drawing; a line hidden under an opaque shape painted later does not count;
  // and a line must pass through (span most of the label), not merely end at it.
  const toSvg = (el, x, y) => { const m = el.getCTM(); return m ? { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f } : { x, y } }
  const opaque = (el) => { const cs = getComputedStyle(el); return cs.fill !== 'none' && !/rgba\(.*, 0(\.\d+)?\)$/.test(cs.fill) && parseFloat(cs.fillOpacity) >= 0.9 && parseFloat(cs.opacity) >= 0.9 }
  for (const svg of document.querySelectorAll('figure[data-diagram] svg[role="img"]')) {
    const kind = svg.closest('[data-diagram]').getAttribute('data-diagram')
    const labels = [...svg.querySelectorAll('text')].filter((t) => {
      if (!t.textContent.replace(/[​\s]/g, '').length) return false
      for (let e = t; e && e !== svg; e = e.parentElement) if ((e.getAttribute('transform') || '').includes('rotate')) return false
      const cs = getComputedStyle(t)
      return !(cs.paintOrder.startsWith('stroke') && cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 1) && cs.opacity !== '0'
    }).map((t) => { const b = t.getBBox(); const c = [toSvg(t, b.x, b.y), toSvg(t, b.x + b.width, b.y + b.height)]; return { txt: t.textContent, box: { x: Math.min(c[0].x, c[1].x), y: Math.min(c[0].y, c[1].y), width: Math.abs(c[1].x - c[0].x), height: Math.abs(c[1].y - c[0].y) } } })
    const shapes = [...svg.querySelectorAll('path, line, polyline, polygon, rect, circle, ellipse')].filter((el) => typeof el.getTotalLength === 'function' && !el.closest('defs, marker, clipPath, mask'))
    for (const el of shapes) {
      const cs = getComputedStyle(el)
      if (cs.stroke === 'none' || parseFloat(cs.strokeWidth) === 0 || cs.strokeOpacity === '0' || cs.opacity === '0' || el.getAttribute('stroke') === '#e3e0d8') continue
      let L = 0
      try { L = el.getTotalLength() } catch { continue }
      if (!L || L > 20000) continue
      const covers = shapes.filter((s) => s !== el && (el.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING) && opaque(s))
      const hidden = (p) => covers.some((s) => { const m = s.getCTM()?.inverse(); if (!m) return false; try { return s.isPointInFill(new DOMPoint(p.x, p.y).matrixTransform(m)) } catch { return false } })
      const pts = []
      for (let d = 0; d <= L; d += 1.5) { const q = el.getPointAtLength(d); pts.push(toSvg(el, q.x, q.y)) }
      for (const { box, txt } of labels) {
        const inside = pts.filter((p) => p.x > box.x && p.x < box.x + box.width && p.y > box.y + 1 && p.y < box.y + box.height - 1 && !hidden(p))
        if (inside.length < 2) continue
        const sx = (Math.max(...inside.map((p) => p.x)) - Math.min(...inside.map((p) => p.x))) / box.width
        const sy = (Math.max(...inside.map((p) => p.y)) - Math.min(...inside.map((p) => p.y))) / box.height
        if (sx > 0.6 || sy > 0.6) out.push({ kind: 'line through a label', detail: `${el.tagName} through "${txt.slice(0, 40)}" in ${kind}` })
      }
    }
  }
  return out
}

const typeInto = async (page, value) => {
  // MathLive loads after the page, so wait for whichever field this prompt has.
  await page.waitForSelector('main input:not([type="hidden"]), main textarea, main math-field', { timeout: 15000, state: 'attached' })
  await page.waitForTimeout(300)
  if (await page.locator('input[placeholder="Number"]').count()) {
    const own = page.getByRole('button', { name: /use my keyboard/i })
    if (await own.count()) { await own.first().evaluate((el) => el.click()); await page.waitForTimeout(300) }
    await page.locator('input[placeholder="Number"]').first().fill(String(value))
  } else if (await page.locator('main math-field').count()) {
    const ascii = String(value).replace(/√\(([^)]+)\)/g, 'sqrt($1)').replace(/√/g, 'sqrt').replace(/±/g, '+-')
    await page.locator('main math-field').first().evaluate((el, v) => { el.setValue(v, { format: 'ascii-math' }); el.dispatchEvent(new Event('input', { bubbles: true })) }, ascii)
  } else {
    await page.locator('main').getByRole('textbox').first().fill(String(value))
  }
}

/** Answers a lesson check with its own right answer; returns what went wrong, or null. */
const answer = async (page, c) => {
  if (c.type === 'multiple-choice') {
    // data-option is each button's index in the content, so an option written only in
    // maths is found exactly, whatever order the options are shown in.
    for (const i of c.correct) await page.locator(`main [data-option="${i}"]`).evaluate((el) => el.click())
  } else if (c.type === 'numeric') await typeInto(page, c.answer)
  else if (c.type === 'short-text') await typeInto(page, c.accepted[0])
  else if (c.type === 'ordering') {
    const rows = page.locator('li:has(button[aria-label="Move up"])')
    for (let i = 0; i < c.items.length; i++) {
      const texts = await rows.evaluateAll((els) => els.map((li) => li.querySelector('.flex-grow').textContent.trim()))
      let p = texts.indexOf(c.items[i])
      if (p < 0) return `ordering item not found: ${c.items[i]}`
      while (p > i) { await rows.nth(p).getByRole('button', { name: 'Move up' }).evaluate((el) => el.click()); p-- }
    }
  } else return `unhandled check type ${c.type}`
  await page.getByRole('button', { name: /check answer/i }).evaluate((el) => el.click())
  await page.waitForFunction(() => { const b = [...document.querySelectorAll('button')].find((x) => /^(next step|finish)/i.test(x.textContent.trim())); return b && !b.disabled }, null, { timeout: 8000 })
  const text = await page.locator('main').innerText()
  // The verdicts are "Correct" and "Not quite", capitalised; lesson text can say "not quite" too.
  return /\bCorrect\b/.test(text) && !/\bNot quite\b/.test(text) ? null : `not marked Correct: ${text.replace(/\s+/g, ' ').slice(-160)}`
}

const browser = await chromium.launch({ channel: 'chrome' })
const found = []
let visits = 0, checks = 0
for (const width of WIDTHS) {
  const queue = [...pages]
  const worker = async () => {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 })
    let current = ''
    page.on('pageerror', (e) => found.push({ width, url: current, kind: 'script error', detail: e.message.slice(0, 200) }))
    while (queue.length) {
      const p = queue.shift()
      current = p.url
      try {
        await page.goto(BASE + p.url, { waitUntil: 'load', timeout: 60000 })
        // A topic's content is fetched after the page loads (OPS-1): scan it, not the loading state.
        await page.waitForFunction(() => ![...document.querySelectorAll('main [role="status"]')].some((e) => e.textContent === 'Loading…'), null, { timeout: 20000 })
        // Wait for animations that end. The menu's drifting gradient runs forever, and waiting
        // for it too timed out at 5 s on every visit: the walk went from 90 s to 535 s in CI.
        await page.waitForFunction(() => document.getAnimations().every((a) => a.playState === 'finished' || a.playState === 'idle' || a.effect?.getComputedTiming().iterations === Infinity), null, { timeout: 5000 }).catch(() => {})
        await page.waitForTimeout(250)
        for (const f of await page.evaluate(scan)) found.push({ width, url: p.url, ...f })
        visits++
        if (p.check && width === WIDTHS[0]) {
          checks++
          const bad = await answer(page, p.check)
          if (bad) found.push({ width, url: p.url, kind: 'lesson check', detail: `${p.check.id} ${bad}` })
        }
      } catch (e) {
        found.push({ width, url: p.url, kind: 'walk error', detail: String(e.message).split('\n')[0].slice(0, 200) })
      }
    }
    await page.close()
  }
  await Promise.all(Array.from({ length: Number(process.env.WORKERS ?? 4) }, worker))
}
await browser.close()

writeFileSync('e2e-report.json', JSON.stringify({ topics: chosen.map((x) => x.t.id), visits, checks, found }, null, 1))
console.log(`${chosen.length} topics, ${visits} page visits at ${WIDTHS.join(' and ')} px, ${checks} lesson checks answered`)
if (found.length) {
  console.log(`\n${found.length} finding(s):`)
  for (const f of found) console.log(`  [${f.width}] ${f.kind}: ${f.detail}\n        ${BASE}${f.url}`)
  process.exit(1)
}
console.log('no findings')
