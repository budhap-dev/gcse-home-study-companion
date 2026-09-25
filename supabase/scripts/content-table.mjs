#!/usr/bin/env node
/* Regenerate the "What is written, by school year" table in docs/content-order.md from
 * the content pack itself.
 *
 * The table was maintained by hand and had drifted: on 15 September 2026 it listed ten
 * French topics when sixteen were written. That table is the queue this project is
 * worked from, so a stale one is worse than no table. contentTable() below is also used
 * by a test in packages/shared, which fails when the doc no longer matches the content.
 *
 *   node supabase/scripts/content-table.mjs           # check, exits 1 if stale
 *   node supabase/scripts/content-table.mjs --write   # rewrite the table
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const CONTENT = join(ROOT, 'supabase/seed/content')
export const DOC = join(ROOT, 'docs/content-order.md')

/** The order the table has always used, and the display name each subject appears under. */
const SUBJECTS = [
  ['maths', 'Mathematics'], ['further-maths', 'Further Maths'], ['physics', 'Physics'],
  ['chemistry', 'Chemistry'], ['biology', 'Biology'], ['computer-science', 'Computer Science'],
  ['business', 'Business'], ['french', 'French'], ['music', 'Music'],
  ['english-language', 'English Language'], ['english-literature', 'English Literature'],
]

/**
 * A subject whose content directory exists but which nobody added to the list above was
 * simply left out of the table, and the script still reported the doc as current. Fail
 * instead: a missing subject is a missing section of the plan, not a formatting detail.
 */
function checkSubjectsAreComplete() {
  const onDisk = readdirSync(CONTENT).filter((n) => statSync(join(CONTENT, n)).isDirectory())
  const listed = new Set(SUBJECTS.map(([dir]) => dir))
  const missing = onDisk.filter((dir) => !listed.has(dir))
  if (missing.length) throw new Error(`content-table.mjs has no entry for: ${missing.join(', ')}`)
}

const cell = (titles) =>
  titles.length === 0
    ? '—'
    : `${titles.length}: ${[...titles].sort((a, b) => a.localeCompare(b, 'en')).join(' · ')}`

export function contentTable() {
  checkSubjectsAreComplete()
  const rows = SUBJECTS.map(([dir, name]) => {
    let files = []
    try {
      files = readdirSync(join(CONTENT, dir)).filter((f) => f.endsWith('.json'))
    } catch {
      /* a subject with no content directory yet shows as three dashes */
    }
    const topics = files.map((f) => JSON.parse(readFileSync(join(CONTENT, dir, f), 'utf8')))
    const titles = (y) => topics.filter((t) => t.year === y).map((t) => t.title)
    return `| ${name} | ${cell(titles(9))} | ${cell(titles(10))} | ${cell(titles(11))} |`
  })
  return `| Subject | Year 9 (recap) | Year 10 (current) | Year 11 |\n|---|---|---|---|\n${rows.join('\n')}`
}

const START = '| Subject | Year 9 (recap)'
const END = '\n\nCounts are topics drafted'

/** The doc as it should be, given what is actually in the content pack. */
export function expectedDoc() {
  const doc = readFileSync(DOC, 'utf8')
  const start = doc.indexOf(START)
  const end = doc.indexOf(END, start)
  if (start === -1 || end === -1) throw new Error('cannot find the table in docs/content-order.md')
  return { doc, next: doc.slice(0, start) + contentTable() + doc.slice(end) }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { doc, next } = expectedDoc()
  if (process.argv.includes('--write')) {
    if (next !== doc) writeFileSync(DOC, next)
    console.log(next === doc ? 'table already current' : 'table rewritten')
  } else if (next !== doc) {
    console.error('docs/content-order.md is stale; run: node supabase/scripts/content-table.mjs --write')
    process.exit(1)
  } else {
    console.log('table is current')
  }
}
