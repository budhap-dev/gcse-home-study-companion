// Checks every past-paper link still opens a PDF on the board's site. Run before a release:
//   node supabase/scripts/check-past-papers.mjs
// Boards move and withdraw files (AQA keeps most for about three years), so a link that fails
// here is either replaced from the board's finder or removed. Not run in CI: it reads hundreds
// of files from the boards' servers, and their outages would fail unrelated builds.
import { readdirSync, readFileSync } from 'node:fs'

const dir = new URL('../seed/past-papers/', import.meta.url)
const urls = new Set()
for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const index = JSON.parse(readFileSync(new URL(f, dir), 'utf8'))
  for (const s of index.series) for (const l of [...s.papers.flatMap((p) => p.links), ...s.sheets]) urls.add(l.url)
}

async function check(url) {
  try {
    const r = await fetch(url, { headers: { Range: 'bytes=0-1023', 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' })
    const head = new Uint8Array(await r.arrayBuffer()).slice(0, 4)
    return { url, ok: String.fromCharCode(...head) === '%PDF', status: r.status, final: r.url }
  } catch (e) {
    return { url, ok: false, status: 0, final: String(e) }
  }
}

const list = [...urls]
const results = []
for (let i = 0; i < list.length; i += 4) results.push(...(await Promise.all(list.slice(i, i + 4).map(check))))
const bad = results.filter((r) => !r.ok)
for (const r of bad) console.log('NOT A PDF', r.status, r.url, '->', r.final)
console.log(`${results.length - bad.length} of ${results.length} links open a PDF`)
process.exitCode = bad.length ? 1 : 0
