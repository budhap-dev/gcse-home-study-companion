import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PastPaperIndex } from './pastPapers.ts'
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
    const ids = new Set(cs.series.flatMap((s) => s.papers.map((p) => p.id)))
    expect([...ids].sort()).toEqual(['1A', '2'])
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
})
