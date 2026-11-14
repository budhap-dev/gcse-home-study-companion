import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { gradeFor, PastPaperIndex } from './pastPapers.ts'
import { SUBJECTS } from './subjects.ts'

const DIR = new URL('../../../supabase/seed/past-papers/', import.meta.url)
const CONTENT = new URL('../../../supabase/seed/content/', import.meta.url)
const files = readdirSync(DIR).filter((f) => f.endsWith('.json'))
const indexes = files.map((f) => ({ file: f, index: PastPaperIndex.parse(JSON.parse(readFileSync(new URL(f, DIR), 'utf8'))) }))

/**
 * Past papers (backlog section 14): links to the boards' own PDFs, never a copy and never a
 * mirror. The schema holds every link to https on the board's site; these hold the rest.
 */
describe('the past papers index', () => {
  it('has one file per subject, named for it', () => {
    expect(files.map((f) => f.replace('.json', '')).sort()).toEqual(SUBJECTS.map((s) => s.id).sort())
    for (const { file, index } of indexes) expect(file).toBe(`${index.subjectId}.json`)
  })

  it('lists exam series newest first, the sample set last, each once', () => {
    for (const { index } of indexes) {
      const ids = index.series.map((s) => s.id)
      expect(new Set(ids).size, index.subjectId).toBe(ids.length)
      const exams = ids.filter((id) => id !== 'sample')
      expect(exams, index.subjectId).toEqual([...exams].sort().reverse())
      if (ids.includes('sample')) expect(ids.at(-1), index.subjectId).toBe('sample')
    }
  })

  it('lists Higher papers only, each with its question paper, and no link twice', () => {
    for (const { index } of indexes) {
      for (const s of index.series) {
        for (const p of s.papers) {
          expect(p.id, `${index.subjectId} ${s.id}`).not.toMatch(/F$/)
          expect(p.links.some((l) => l.kind === 'question-paper'), `${index.subjectId} ${s.id} ${p.id}`).toBe(true)
        }
        const urls = [...s.papers.flatMap((p) => p.links), ...s.sheets].map((l) => l.url)
        expect(new Set(urls).size, `${index.subjectId} ${s.id}`).toBe(urls.length)
        for (const u of urls) expect(u, `${index.subjectId} ${s.id}`).not.toMatch(/\/secure\/|foundation|[-_/][1-3]f[-_]/i)
      }
    }
  })

  it('names a series by its month and year', () => {
    const MONTH: Record<string, string> = { '01': 'January', '06': 'June', '11': 'November' }
    for (const { index } of indexes) {
      for (const s of index.series) {
        if (s.id === 'sample') continue
        const [y, m] = s.id.split('-')
        expect(s.label, `${index.subjectId} ${s.id}`).toBe(`${MONTH[m!]} ${y}`)
      }
    }
  })

  it('gives Computer Science the C# Paper 1 only, the version the school enters', () => {
    const cs = indexes.find((x) => x.index.subjectId === 'computer-science')!.index
    // 8525 papers: the C# Paper 1 and Paper 2. November 2021 was the last series of the course
    // before (8520), which had one Paper 1 for every language; it is listed, marked as such.
    const ids = new Set(cs.series.filter((s) => s.id !== '2021-11').flatMap((s) => s.papers.map((p) => p.id)))
    expect([...ids].sort()).toEqual(['1A', '2'])
    const old = cs.series.find((s) => s.id === '2021-11')!
    expect(old.papers.map((p) => p.id)).toEqual(['1', '2'])
    expect(old.papers.every((p) => p.name.includes('(8520)'))).toBe(true)
    expect(old.note).toContain('8520')
    expect(cs.practice?.url).toBe('https://red-dune-0f7372e10.7.azurestaticapps.net/')
  })

  it('tags questions only with topics the subject has', () => {
    for (const { index } of indexes) {
      const ids = new Set(readdirSync(new URL(`${index.subjectId}/`, CONTENT)).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')))
      for (const s of index.series) {
        for (const p of s.papers) {
          for (const q of p.questions ?? []) {
            for (const t of q.topics) expect(ids.has(t), `${index.subjectId} ${s.id} ${p.id} Q${q.n}: ${t}`).toBe(true)
          }
        }
      }
    }
  })

  it('tags every Maths paper, 80 marks each, nearly every question to a topic (box 2)', () => {
    const maths = indexes.find((x) => x.index.subjectId === 'maths')!.index
    const papers = maths.series.flatMap((s) => s.papers.map((p) => ({ s: s.id, p })))
    for (const { s, p } of papers) {
      expect(p.questions?.length, `${s} ${p.id}`).toBeGreaterThan(15)
      expect(p.marks, `${s} ${p.id}`).toBe(80)
    }
    const qs = papers.flatMap(({ p }) => p.questions ?? [])
    expect(qs.length).toBe(740)
    // Every question has a topic. Tagging first found three skills no topic taught (frequency
    // polygons, stem and leaf diagrams, linear equations), and they were written on 13 November
    // 2026. A question with no topic is a gap in the content, not a tag to leave empty.
    expect(qs.filter((q) => q.topics.length === 0)).toEqual([])
  })

  // Box 5. Business 90 a paper, English Language and Music 80; every question tagged. English
  // Language's spoken language endorsement is coursework, so no paper asks it; Music's two
  // background topics are listening context no question names.
  it.each([
    ['business', 14, 98, 90, []],
    ['english-language', 19, 95, 80, ['spoken-language-endorsement']],
    ['music', 8, 72, 80, ['analysing-a-set-work', 'theme-and-variations']],
  ])('tags every %s paper, every question to a topic (box 5)', (subjectId, paperCount, questionCount, total, unasked) => {
    const index = indexes.find((x) => x.index.subjectId === subjectId)!.index
    const papers = index.series.flatMap((s) => s.papers.map((p) => ({ s: s.id, p })))
    expect(papers.length).toBe(paperCount)
    for (const { s, p } of papers) expect(p.marks, `${s} ${p.id}`).toBe(total)
    const qs = papers.flatMap(({ p }) => p.questions ?? [])
    expect(qs.length).toBe(questionCount)
    expect(qs.filter((q) => q.topics.length === 0)).toEqual([])
    const asked = new Set(qs.flatMap((q) => q.topics))
    const ids = readdirSync(new URL(`${subjectId}/`, CONTENT)).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''))
    expect(ids.filter((id) => !asked.has(id))).toEqual(unasked)
  })

  // English Literature: every question is listed with the text it is on; only the school's set
  // texts and the unseen poetry carry topics, and every one of those questions does.
  it('lists every English Literature question by its text, and tags the set texts (box 5)', () => {
    const index = indexes.find((x) => x.index.subjectId === 'english-literature')!.index
    const papers = index.series.flatMap((s) => s.papers.map((p) => ({ s: s.id, p })))
    expect(papers.length).toBe(18)
    const qs = papers.flatMap(({ p }) => p.questions ?? [])
    expect(qs.length).toBe(281)
    for (const { s, p } of papers) {
      expect(p.answer, `${s} ${p.id}`).toMatch(/^Answer /)
      expect(p.questions?.every((q) => q.title), `${s} ${p.id}`).toBe(true)
    }
    const SET = ['Macbeth', 'The Strange Case of Dr Jekyll and Mr Hyde', 'An Inspector Calls', 'Power and conflict', 'Unseen poetry']
    for (const q of qs) expect(q.topics.length > 0, `${q.title} Q${q.n}`).toBe(SET.includes(q.title!))
    expect(qs.filter((q) => q.topics.length > 0).length).toBe(42)
    // November 2021 and June 2022 were sat as four papers, each with its own links.
    for (const id of ['2021-11', '2022-06']) {
      const s = index.series.find((x) => x.id === id)!
      expect(s.papers.map((p) => p.id)).toEqual(['1M', '1N', '1P', '2'])
      for (const p of s.papers) expect(p.links.filter((l) => l.kind === 'question-paper')).toHaveLength(1)
    }
  })

  // Box 4. Further Maths papers are 80 marks; Computer Science 8525 papers 90, the two 8520
  // papers of November 2021 80. Marks per question were read from the paper and checked
  // against a second extraction or the mark scheme.
  it.each([
    ['further-maths', 12, 259],
    ['computer-science', 12, 186],
  ])('tags every %s paper, every question to a topic (box 4)', (subjectId, paperCount, questionCount) => {
    const index = indexes.find((x) => x.index.subjectId === subjectId)!.index
    const papers = index.series.flatMap((s) => s.papers.map((p) => ({ s: s.id, p })))
    expect(papers.length).toBe(paperCount)
    for (const { s, p } of papers) {
      const total = subjectId === 'further-maths' ? 80 : s === '2021-11' ? 80 : 90
      expect(p.marks, `${s} ${p.id}`).toBe(total)
    }
    const qs = papers.flatMap(({ p }) => p.questions ?? [])
    expect(qs.length).toBe(questionCount)
    expect(qs.filter((q) => q.topics.length === 0)).toEqual([])
    const asked = new Set(qs.flatMap((q) => q.topics))
    const ids = readdirSync(new URL(`${subjectId}/`, CONTENT)).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''))
    expect(ids.filter((id) => !asked.has(id))).toEqual([])
  })

  // Box 3. Each question's marks are the total its mark scheme prints (AQA) or the paper's own
  // "Total for Question" line (Pearson), so a paper adds up to 100 only if the split is right.
  it.each([
    ['physics', 16, 156],
    ['chemistry', 17, 157],
    ['biology', 12, 120],
  ])('tags every %s paper, 100 marks each, every question to a topic (box 3)', (subjectId, paperCount, questionCount) => {
    const index = indexes.find((x) => x.index.subjectId === subjectId)!.index
    const papers = index.series.flatMap((s) => s.papers.map((p) => ({ s: s.id, p })))
    expect(papers.length).toBe(paperCount)
    for (const { s, p } of papers) {
      expect(p.marks, `${s} ${p.id}`).toBe(100)
      expect(p.questions?.length, `${s} ${p.id}`).toBeGreaterThanOrEqual(7)
    }
    const qs = papers.flatMap(({ p }) => p.questions ?? [])
    expect(qs.length).toBe(questionCount)
    expect(qs.filter((q) => q.topics.length === 0)).toEqual([])
    // Every topic the subject teaches comes up at least once on these papers.
    const asked = new Set(qs.flatMap((q) => q.topics))
    const ids = readdirSync(new URL(`${subjectId}/`, CONTENT)).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''))
    expect(ids.filter((id) => !asked.has(id))).toEqual([])
  })

  // Box 6. Grade boundaries read from the boards' own files (14 November 2026). The schema
  // holds their order and that the subject table covers exactly the papers listed; these pin
  // the coverage and a few figures to the lines they were read from.
  it('has the boards\' boundaries wherever the board publishes them (box 6)', () => {
    const series = indexes.flatMap(({ index }) => index.series.map((s) => ({ subject: index.subjectId, s })))
    const withB = series.filter(({ s }) => s.boundaries)
    expect(withB.length).toBe(58)
    expect(withB.flatMap(({ s }) => s.papers.filter((p) => p.grades)).length).toBe(119)
    expect(withB.filter(({ s }) => s.boundaries!.subject).length).toBe(46)
    // No sample paper has boundaries: no one sat it.
    expect(series.filter(({ s }) => s.id === 'sample' && s.boundaries)).toEqual([])
    const find = (subject: string, sid: string) => series.find((x) => x.subject === subject && x.s.id === sid)!.s
    // AQA-GCSE-GDE-BDY-JUN-2024: "8463/1H PHYSICS PAPER 1 TIER H 100 79 72 66 57 48 39 34 - -"
    expect(find('physics', '2024-06').papers.find((p) => p.id === '1')!.grades).toEqual({ 9: 79, 8: 72, 7: 66, 6: 57, 5: 48, 4: 39, 3: 34 })
    // grade-boundaries-june-2024-notional-component-gcse: "1MA1 Mathematics (Higher) Raw 80 65 55 45 34 24 14 9 0 Paper 1H"
    expect(find('maths', '2024-06').papers.find((p) => p.id === '1H')!.grades).toEqual({ 9: 65, 8: 55, 7: 45, 6: 34, 5: 24, 4: 14, 3: 9 })
    // AQA-L2-CERT-GDE-BDY-JUN-2024: "8365 FURTHER MATHEMATICS 160 136 119 103 86 69 60", grades 9 to 4
    expect(find('further-maths', '2024-06').boundaries!.subject).toEqual({ max: 160, grades: { 9: 136, 8: 119, 7: 103, 6: 86, 5: 69, 4: 60 } })
    // English Literature in 2021-11 and 2022-06 was graded by option (two of 1M, 1N, 1P), so no
    // single subject table covers the four papers listed.
    expect(find('english-literature', '2022-06').boundaries!.subject).toBeUndefined()
  })

  it('turns a raw mark into the grade on a boundary table', () => {
    const g = { 9: 79, 8: 72, 7: 66, 6: 57, 5: 48, 4: 39, 3: 34 }
    expect(gradeFor(100, g)).toBe(9)
    expect(gradeFor(79, g)).toBe(9)
    expect(gradeFor(78, g)).toBe(8)
    expect(gradeFor(39, g)).toBe(4)
    expect(gradeFor(34, g)).toBe(3)
    expect(gradeFor(33, g)).toBeNull()
  })
})
