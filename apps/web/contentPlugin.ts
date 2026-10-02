import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

/**
 * Two small modules built from the content pack, so the app no longer ships every topic in
 * its first download (OPS-1).
 *
 *   virtual:topic-catalogue  what screens across topics need: titles, units, years, step
 *                            titles, worksheet and quiz ids, and each question's type,
 *                            marks, skill and grade band. Loaded with the app.
 *   virtual:search-text      the text the search box looks through. Loaded the first time
 *                            someone searches.
 *
 * A topic's full content is imported on its own when the topic is opened
 * (src/content/load.ts), so a phone fetches one topic, not all 358.
 */
const CONTENT = join(import.meta.dirname, '..', '..', 'supabase', 'seed', 'content')

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

function topicFiles(): string[] {
  return readdirSync(CONTENT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => readdirSync(join(CONTENT, d.name)).filter((f) => f.endsWith('.json')).map((f) => join(CONTENT, d.name, f)))
    .sort()
}

export function catalogueEntry(t: Json) {
  const worksheets: Json = {}
  for (const [level, w] of Object.entries<Json>(t.worksheets)) worksheets[level] = { questionIds: w.questionIds, suggestedMinutes: w.suggestedMinutes }
  return {
    id: t.id, subjectId: t.subjectId, unitId: t.unitId, title: t.title, year: t.year, specPoints: t.specPoints,
    ...(t.specCode ? { specCode: t.specCode } : {}),
    ...(t.order !== undefined ? { order: t.order } : {}),
    whyExamples: t.why?.examples?.length ?? 0,
    lesson: { steps: t.lesson.steps.map((s: Json) => ({ id: s.id, title: s.title, kind: s.kind, ...(s.check?.skill ? { checkSkill: s.check.skill } : {}) })) },
    worksheets,
    quiz: { questionIds: t.quiz.questionIds, sampleSize: t.quiz.sampleSize },
    questions: t.questions.map((q: Json) => ({ id: q.id, type: q.type, marks: q.marks, skill: q.skill, gradeBand: q.gradeBand })),
  }
}

export function searchEntry(t: Json) {
  return {
    id: t.id, subjectId: t.subjectId, unitId: t.unitId, title: t.title, specPoints: t.specPoints,
    ...(t.specCode ? { specCode: t.specCode } : {}),
    steps: t.lesson.steps.map((s: Json) => ({ id: s.id, title: s.title, body: s.body, check: s.check?.prompt ?? '' })),
    examTechnique: { body: t.examTechnique.body, examinerErrors: t.examTechnique.examinerErrors, grade9Looks: t.examTechnique.grade9Looks },
    questions: t.questions.map((q: Json) => `${q.prompt} ${q.skill}`),
  }
}

export function contentPlugin(): Plugin {
  const ids = { 'virtual:topic-catalogue': catalogueEntry, 'virtual:search-text': searchEntry } as const
  return {
    name: 'study-content',
    resolveId(id) {
      return id in ids ? `\0${id}` : undefined
    },
    load(id) {
      const name = id.startsWith('\0') ? id.slice(1) : undefined
      if (!name || !(name in ids)) return undefined
      const pick = ids[name as keyof typeof ids]
      const files = topicFiles()
      for (const f of files) this.addWatchFile(f)
      const data = files.map((f) => pick(JSON.parse(readFileSync(f, 'utf8'))))
      // JSON.parse of a string literal is faster for an engine to load than the same object literal.
      return `export default JSON.parse(${JSON.stringify(JSON.stringify(data))})`
    },
  }
}

/**
 * What goes in a file of its own, by how often it changes.
 *
 * The app deploys with every merged PR, and each asset is cached by a name made from its
 * contents. As one file, any change at all renamed all 3.2 MB of it, so every device fetched
 * the libraries and the topic catalogue again after every deploy. Apart, a library file keeps
 * its name until the library is upgraded, and the catalogue until the content pack changes.
 *
 * Only libraries and data are named here: neither imports the app's own code, so no file
 * below can come to depend on one that changes more often than it does.
 */
const LIBRARIES: [name: string, packages: RegExp][] = [
  ['react', /^(react|react-dom|react-router|scheduler|cookie|set-cookie-parser)$/],
  ['supabase', /^(@supabase\/.+|iceberg-js|tslib)$/],
  ['maths', /^(katex|marked)$/],
  ['zod', /^zod$/],
]

export function chunkFor(id: string): string | undefined {
  if (id.includes('virtual:topic-catalogue')) return 'catalogue'
  // Each on its own: the glossary and the exam guides are read as the app opens, the
  // reference pages only by the screens that show them.
  const seed = /\/supabase\/seed\/(glossary|resources|guides)\//.exec(id)
  if (seed) return seed[1]
  // The package's own name: the last node_modules in the path, since pnpm nests them.
  const pkg = /.*\/node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(id)?.[1]
  return pkg ? LIBRARIES.find(([, packages]) => packages.test(pkg))?.[0] : undefined
}
