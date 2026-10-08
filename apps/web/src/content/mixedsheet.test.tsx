import { AUTO_MARKED_TYPES, generatorFor, sheetQuestions, type Topic } from '@study/shared'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { getFullTopic } from './all.ts'
import { topicsForSubject } from './index.ts'
import { MIXED_MIN_TOPICS, mixedPath, parseSpec, pickItems, sheetFor, versionCodes, type MixedSpec } from './mixedSheet.ts'
import { recordReview } from '../progress/reviewSession.ts'
import { getState, replaceState } from '../progress/store.ts'
import { MixedPrint } from '../routes/student/MixedPrint.tsx'

// The store keeps progress in local storage, which a Node test has to provide.
const store = new Map<string, string>()
globalThis.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } as unknown as Storage

/** A mixed worksheet (WKS-4): topics, level and count in the link, the sheet code deciding the rest. */
const maths = topicsForSubject('maths')
const unit = maths.filter((t) => t.unitId === 'number').map((t) => t.id)
const spec: MixedSpec = { subjectId: 'maths', topicIds: unit, level: 'higher', count: 12, code: 'k7m2qp' }
const loaded = new Map<string, Topic>(unit.map((id) => [id, getFullTopic('maths', id)!]))

describe('a mixed worksheet link', () => {
  it('reads back what made it, and refuses one that cannot be a mixed sheet', () => {
    const url = new URL(`https://x${mixedPath(spec)}`)
    expect(url.pathname).toBe('/subjects/maths/mixed')
    expect(parseSpec('maths', url.searchParams)).toEqual(spec)
    const bad = (q: string) => parseSpec('maths', new URLSearchParams(q))
    expect(bad(`topics=${unit.slice(0, MIXED_MIN_TOPICS - 1).join(',')}&level=higher&n=10&sheet=k7m2qp`)).toBeUndefined()
    expect(bad(`topics=${unit.join(',')}&level=hard&n=10&sheet=k7m2qp`)).toBeUndefined()
    expect(bad(`topics=${unit.join(',')}&level=higher&n=7&sheet=k7m2qp`)).toBeUndefined()
    expect(bad(`topics=${unit.join(',')}&level=higher&n=10&sheet=<b>`)).toBeUndefined()
  })

  it('prints up to four versions, the sheet itself first', () => {
    const print = new URL(`https://x${mixedPath(spec, { codes: ['k7m2qp', 'abcd23', 'wxyz45'] })}`)
    expect(versionCodes(print.searchParams, 'k7m2qp')).toEqual(['k7m2qp', 'abcd23', 'wxyz45'])
    expect(versionCodes(new URLSearchParams('sheets=a2b3c4,d5e6f7,g8h9j2,k2m3n4,p5q6r7'), 'zzzz99')).toHaveLength(4)
  })
})

describe('the questions a mixed sheet picks', () => {
  const items = pickItems(spec, maths)

  it('are the same for the same code and different for another', () => {
    expect(pickItems(spec, maths)).toEqual(items)
    expect(pickItems({ ...spec, code: 'abcd23' }, maths)).not.toEqual(items)
  })

  it('are as many as asked, from the chosen topics at the chosen level, and all markable on screen', () => {
    expect(items).toHaveLength(12)
    for (const m of items) {
      const t = maths.find((x) => x.id === m.topicId)!
      expect(unit).toContain(m.topicId)
      expect(t.worksheets.higher.questionIds).toContain(m.questionId)
      expect(AUTO_MARKED_TYPES).toContain(t.questions.find((q) => q.id === m.questionId)!.type)
    }
    expect(new Set(items.map((m) => `${m.topicId}/${m.questionId}`)).size).toBe(items.length)
  })

  it('spread across the topics and never ask one topic twice running while another has questions left', () => {
    expect(new Set(items.map((m) => m.topicId)).size).toBeGreaterThanOrEqual(MIXED_MIN_TOPICS)
    for (let i = 1; i < items.length; i++) expect(items[i]!.topicId, `question ${i + 1}`).not.toBe(items[i - 1]!.topicId)
  })

  it('stop at what there is when fewer questions exist than asked for', () => {
    const few = pickItems({ ...spec, topicIds: unit.slice(0, 3), level: 'core', count: 20 }, maths)
    const available = unit.slice(0, 3).reduce((s, id) => s + maths.find((t) => t.id === id)!.worksheets.core.questionIds.filter((q) => AUTO_MARKED_TYPES.includes(maths.find((t) => t.id === id)!.questions.find((x) => x.id === q)!.type)).length, 0)
    expect(few).toHaveLength(Math.min(20, available))
  })

  it('give new numbers wherever a generator exists, built from the sheet code', () => {
    const sheet = sheetFor(spec, items, loaded)
    expect(sheet.map((s) => s.item)).toEqual(items)
    const generated = sheet.filter((s) => s.generated)
    expect(generated.length).toBe(items.filter((m) => generatorFor('maths', m.topicId, m.questionId)).length)
    expect(generated.length).toBeGreaterThan(0)
    for (const s of generated) {
      const written = loaded.get(s.item.topicId)!.questions.find((q) => q.id === s.item.questionId)!
      expect(s.question).toEqual(sheetQuestions('maths', s.item.topicId, [written], 'k7m2qp')[0]!.question)
    }
  })
})

describe('a finished mixed sheet', () => {
  beforeEach(() => replaceState({ ...getState(), attempts: [] }))

  it('is recorded per topic with the sheet code, describing the answers to the questions asked', () => {
    const items = pickItems(spec, maths)
    const sheet = sheetFor(spec, items, loaded)
    const choice = sheet.find((s) => s.generated && s.question.type === 'multiple-choice')
    const answers = Object.fromEntries(sheet.map((s) => [`${s.item.topicId}/${s.item.questionId}`, { answer: s.question.type === 'multiple-choice' ? [0] : '1', result: { correct: false, marksScored: 0, marksAvailable: s.question.marks } }]))
    const seen = new Map(sheet.map((s) => [`${s.item.topicId}/${s.item.questionId}`, s.question]))
    recordReview('sess', items, answers, (id) => loaded.get(id), '2026-10-08T12:00:00Z', 'mixed', { seen: (m) => seen.get(`${m.topicId}/${m.questionId}`), seed: 'k7m2qp' })
    const attempts = getState().attempts
    expect(new Set(attempts.map((a) => a.topicId))).toEqual(new Set(items.map((m) => m.topicId)))
    for (const a of attempts) {
      expect(a.kind).toBe('review')
      expect(a.from).toBe('mixed')
      expect(a.seed).toBe('k7m2qp')
    }
    if (choice) {
      const a = attempts.find((x) => x.topicId === choice.item.topicId)!
      const r = a.questions!.find((q) => q.id === choice.item.questionId)!
      expect(r.answer).toBe(choice.question.type === 'multiple-choice' ? choice.question.options[0] : undefined)
    }
  })
})

describe('a printed mixed sheet', () => {
  const render = (path: string) => renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}><Routes><Route path="/subjects/:subjectId/mixed/print" element={<MixedPrint />} /></Routes></MemoryRouter>,
  )

  it('prints each version on its own page with its own code, and answer sheets to match', () => {
    const codes = ['k7m2qp', 'abcd23']
    const html = render(mixedPath(spec, { codes }))
    for (const c of codes) expect(html).toContain(`Sheet <strong class="font-mono text-ink">${c}</strong>`)
    expect(html).toContain('version 2')
    expect(html).toContain('break-before:page')
    const answers = render(mixedPath(spec, { codes, answers: true }))
    expect(answers).toContain('Answers for sheet abcd23 only')
    expect(answers).toContain('Answer:')
  })
})
