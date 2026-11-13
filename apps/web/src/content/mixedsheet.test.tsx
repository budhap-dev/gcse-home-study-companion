import { AUTO_MARKED_TYPES, generatorFor, sheetQuestions, type Topic } from '@study/shared'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { getFullTopic } from './all.ts'
import { getGuide, topicsForSubject } from './index.ts'
import { LENGTHS, MIXED_MIN_TOPICS, mixedPath, parseSpec, pickForTime, pickItems, sheetFor, versionCodes, type MixedSpec } from './mixedSheet.ts'
import { minutesPerMark } from './paper.ts'
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

/**
 * A sheet with a length (13 November 2026): "how long have you got?" fills 10 minutes, 30 or an
 * hour at the exam's pace, from one topic across its levels or from several at one level.
 */
describe('a sheet with a length', () => {
  const perMark = minutesPerMark(getGuide('maths'))
  const minutesOf = (items: { topicId: string; questionId: string }[]) =>
    items.reduce((s, m) => s + (maths.find((t) => t.id === m.topicId)!.questions.find((q) => q.id === m.questionId)!.marks), 0) * perMark

  it('reads back from its link, and a one-topic practice needs a length', () => {
    const one: MixedSpec = { subjectId: 'maths', topicIds: [unit[0]!], level: 'all', minutes: 10, code: 'k7m2qp' }
    expect(parseSpec('maths', new URL(`https://x${mixedPath(one)}`).searchParams)).toEqual(one)
    expect(parseSpec('maths', new URLSearchParams(`topics=${unit[0]}&level=all&n=10&sheet=k7m2qp`))).toBeUndefined()
    expect(parseSpec('maths', new URLSearchParams(`topics=${unit[0]}&level=all&min=15&sheet=k7m2qp`))).toBeUndefined()
    expect(parseSpec('maths', new URLSearchParams(`topics=${unit[0]}&level=higher&min=10&sheet=k7m2qp`))).toBeUndefined()
  })

  it('fills its time without going over, for every Maths topic and length', () => {
    for (const t of maths) for (const minutes of LENGTHS) {
      const items = pickForTime({ subjectId: 'maths', topicIds: [t.id], level: 'all', minutes, code: 'k7m2qp' }, minutes, maths)
      expect(items.length, `${t.id} ${minutes}`).toBeGreaterThan(0)
      // Over only when a single question is longer than the whole length.
      if (items.length > 1) expect(minutesOf(items), `${t.id} ${minutes}`).toBeLessThanOrEqual(minutes + 1e-9)
      for (const m of items) expect(AUTO_MARKED_TYPES).toContain(t.questions.find((q) => q.id === m.questionId)!.type)
    }
  })

  it('climbs from Core to Advanced, and keeps the parts of a question together in letter order', () => {
    for (const t of maths) {
      const items = pickForTime({ subjectId: 'maths', topicIds: [t.id], level: 'all', minutes: 60, code: 'abcd23' }, 60, maths)
      const levelOf = (id: string) => (['core', 'higher', 'advanced'] as const).findIndex((l) => t.worksheets[l].questionIds.includes(id))
      const ranks = items.map((m) => levelOf(m.questionId))
      expect(ranks, t.id).toEqual([...ranks].sort((a, b) => a - b))
      const stems = items.map((m) => t.questions.find((q) => q.id === m.questionId)!.stemId)
      for (const stem of new Set(stems.filter(Boolean))) {
        const at = stems.flatMap((s, i) => (s === stem ? [i] : []))
        expect(at[at.length - 1]! - at[0]!, `${t.id} ${stem}`).toBe(at.length - 1)
        const order = at.map((i) => t.questions.findIndex((q) => q.id === items[i]!.questionId))
        expect(order, `${t.id} ${stem}`).toEqual([...order].sort((a, b) => a - b))
      }
    }
  })

  it('a longer length never asks fewer questions, and the code changes the questions', () => {
    const t = unit[0]!
    const pick = (minutes: number, code = 'k7m2qp') => pickForTime({ subjectId: 'maths', topicIds: [t], level: 'all', minutes, code }, minutes, maths)
    expect(pick(30).length).toBeGreaterThanOrEqual(pick(10).length)
    expect(pick(60).length).toBeGreaterThanOrEqual(pick(30).length)
    expect(pick(10)).toEqual(pick(10))
    expect(pickItems({ subjectId: 'maths', topicIds: unit, level: 'higher', minutes: 30, code: 'k7m2qp' }, maths)).not.toEqual(
      pickItems({ subjectId: 'maths', topicIds: unit, level: 'higher', minutes: 30, code: 'abcd23' }, maths))
  })
})
