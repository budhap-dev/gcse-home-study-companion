import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALL_TOPICS } from './all.ts'
import { TOPICS } from './index.ts'
import { chunkFor } from '../../contentPlugin.ts'

// OPS-1 split the content: a small catalogue ships with the app and each topic's full
// content is fetched when it is opened. Two ways that could quietly go wrong are pinned here.
describe('content loaded on demand', () => {
  it('the app never imports every topic in full', () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !p.endsWith(join('content', 'all.ts')) && /content\/all\.ts'/.test(readFileSync(p, 'utf8'))) offenders.push(p)
      }
    }
    walk(join(import.meta.dirname, '..'))
    expect(offenders).toEqual([])
  })

  it('the catalogue matches the full content, topic by topic', () => {
    expect(TOPICS.length).toBe(ALL_TOPICS.length)
    const full = new Map(ALL_TOPICS.map((t) => [t.id, t]))
    for (const s of TOPICS) {
      const t = full.get(s.id)!
      expect(s.title, s.id).toBe(t.title)
      expect(s.lesson.steps.map((x) => x.id), s.id).toEqual(t.lesson.steps.map((x) => x.id))
      expect(s.questions.map((q) => `${q.id}:${q.type}:${q.marks}:${q.skill}:${q.gradeBand}`), s.id).toEqual(t.questions.map((q) => `${q.id}:${q.type}:${q.marks}:${q.skill}:${q.gradeBand}`))
      expect(s.quiz, s.id).toEqual({ questionIds: t.quiz.questionIds, sampleSize: t.quiz.sampleSize })
    }
  })
})

// The libraries and the bundled data are files of their own, so that a deploy which changes
// only the app's code leaves them cached. The paths are the ones a pnpm install produces.
describe('what is built into a file of its own', () => {
  const ROOT = '/repo/node_modules/.pnpm'

  it('puts each library with the others that change when it does', () => {
    expect(chunkFor(`${ROOT}/react-dom@19.2.8_react@19.2.8/node_modules/react-dom/cjs/react-dom-client.production.js`)).toBe('react')
    expect(chunkFor(`${ROOT}/react@19.2.8/node_modules/react/index.js`)).toBe('react')
    expect(chunkFor(`${ROOT}/react-router@7.18.3_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/react-router/dist/development/index.mjs`)).toBe('react')
    expect(chunkFor(`${ROOT}/@supabase+auth-js@2.114.0/node_modules/@supabase/auth-js/dist/module/GoTrueClient.js`)).toBe('supabase')
    expect(chunkFor(`${ROOT}/katex@0.18.7/node_modules/katex/dist/katex.mjs`)).toBe('maths')
    expect(chunkFor(`${ROOT}/marked@18.0.12/node_modules/marked/lib/marked.esm.js`)).toBe('maths')
    expect(chunkFor(`${ROOT}/zod@4.5.4/node_modules/zod/v4/core/schemas.js`)).toBe('zod')
  })

  it('leaves the maths keyboard to load when a maths answer is first asked for', () => {
    expect(chunkFor(`${ROOT}/mathlive@0.110.0/node_modules/mathlive/mathlive.min.mjs`)).toBeUndefined()
  })

  it('keeps the catalogue, the glossary, the exam guides and the reference pages apart from the code', () => {
    expect(chunkFor('\0virtual:topic-catalogue')).toBe('catalogue')
    expect(chunkFor('/repo/supabase/seed/glossary/physics.json')).toBe('glossary')
    expect(chunkFor('/repo/supabase/seed/resources/maths.json')).toBe('resources')
    expect(chunkFor('/repo/supabase/seed/guides/french.json')).toBe('guides')
  })

  it('names nothing of the app itself, nor a topic, which is fetched when opened', () => {
    expect(chunkFor('/repo/apps/web/src/routes/student/Home.tsx')).toBeUndefined()
    expect(chunkFor('/repo/packages/shared/src/marking.ts')).toBeUndefined()
    expect(chunkFor('/repo/supabase/seed/content/physics/behaviour-of-gases.json')).toBeUndefined()
    expect(chunkFor('\0virtual:search-text')).toBeUndefined()
  })
})
