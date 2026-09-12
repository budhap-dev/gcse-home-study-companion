import { describe, expect, it } from 'vitest'
import { sameStem, search, searchIndex } from './index.ts'
import { TOPICS } from '../content/index.ts'
import { GLOSSARY } from '../content/glossary.ts'

describe('search index', () => {
  it('covers every topic and every lesson step', () => {
    const index = searchIndex()
    const steps = TOPICS.reduce((n, t) => n + t.lesson.steps.length, 0)
    // one topic record, one per step, one exam-technique and one question record
    expect(index.length).toBe(TOPICS.length * 3 + steps)
    for (const t of TOPICS) expect(index.some((r) => r.key === t.id), t.id).toBe(true)
  })

  it('strips maths and markdown out of the searchable text', () => {
    const index = searchIndex()
    for (const record of index) {
      expect(record.text, record.key).not.toMatch(/\$\$|\\tfrac|\\dfrac|\*\*|```/)
    }
  })

  it('deep-links a lesson step to that step', () => {
    const step = searchIndex().find((r) => r.kind === 'lesson')!
    expect(step.to).toMatch(/\/lesson\?step=\d+$/)
  })
})

describe('search', () => {
  it('ranks the topic named in the query first', () => {
    for (const [query, topicId] of [
      ['momentum', 'momentum'],
      ['surds', 'surds'],
      ['congruency', 'congruency'],
      ['pressure in fluids', 'pressure-in-fluids'],
    ] as const) {
      expect(search(query)[0]?.record.topicId, query).toBe(topicId)
    }
  })

  it('finds an idea that is taught inside a step rather than named in a title', () => {
    const hits = search('upthrust')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((h) => h.record.subjectId === 'physics')).toBe(true)
  })

  it('needs two letters, and returns nothing below that', () => {
    expect(search('a')).toEqual([])
    expect(search('')).toEqual([])
  })

  it('gives every hit a snippet with the match inside it', () => {
    // The match may be a stem hit (electrode for electrons), and the snippet must show that word.
    for (const hit of search('electrons').slice(0, 5)) {
      const words = hit.snippet.toLowerCase().match(/[a-z0-9]+/g) ?? []
      expect(words.some((w) => sameStem(w, 'electrons')), hit.record.key).toBe(true)
    }
  })

  it('scores a title match above a passing mention in a body', () => {
    const hits = search('gears')
    expect(hits[0]!.record.topicTitle).toContain('Moments')
  })
})

describe('glossary and content agree', () => {
  it('has a glossary term for every subject that has topics', () => {
    const subjects = new Set(TOPICS.map((t) => t.subjectId))
    for (const s of subjects) expect(GLOSSARY.some((t) => t.subjectId === s), s).toBe(true)
  })

  it('links every term to a topic that really teaches its subject', () => {
    for (const term of GLOSSARY) {
      for (const topicId of term.topics) {
        const topic = TOPICS.find((t) => t.id === topicId)
        expect(topic, `${term.term} → ${topicId}`).toBeDefined()
        expect(topic!.subjectId, term.term).toBe(term.subjectId)
      }
    }
  })
})

describe('stem matching', () => {
  it('finds a topic the school names differently from its title', () => {
    // The school says "congruency"; the topic is called "Congruent triangles".
    expect(search('congruency')[0]!.record.topicId).toBe('congruency')
  })

  it('handles the endings school vocabulary actually takes', () => {
    for (const [query, expected] of [
      ['congruency', 'Congruent triangles'],
      ['surd', 'Surds'],
      ['moments', 'Moments, levers and gears'],
      ['indices', 'Laws of indices'],
    ] as const) {
      expect(search(query)[0]?.record.topicTitle, query).toBe(expected)
    }
  })

  it('does not join words that merely start alike', () => {
    // "graphical" shares five letters with graphite and graphene and must reach neither.
    expect(search('graphical')).toEqual([])
    expect(search('readxyz')).toEqual([])
    expect(search('zebra')).toEqual([])
  })

  it('finds a hyphenated idea typed without the hyphen', () => {
    // The content writes "break-even"; students type "breakeven".
    expect(search('breakeven')[0]?.record.topicId).toBe('putting-a-business-idea-into-practice')
    expect(search('break-even')[0]?.record.topicId).toBe('putting-a-business-idea-into-practice')
  })

  it('keeps an exact match above an inflected one', () => {
    const hits = search('momentum')
    expect(hits[0]!.record.topicId).toBe('momentum')
  })
})

describe('snippets', () => {
  it('does not repeat the heading it is shown under', () => {
    const hits = search('upthrust').filter((h) => h.record.kind === 'lesson')
    for (const hit of hits) {
      expect(hit.snippet.startsWith(hit.record.heading), hit.record.key).toBe(false)
    }
  })

  it('still finds a lesson step by words in its title', () => {
    // The title is out of the body text, so this can only pass through the heading.
    expect(search('why things float').some((h) => h.record.heading.includes('why things float'))).toBe(true)
  })
})
