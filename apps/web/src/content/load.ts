import { useEffect, useState } from 'react'
import { Topic, type Topic as TopicRecord } from '@study/shared'

/**
 * A topic's full content, fetched when the topic is opened (OPS-1). Each topic file is its
 * own chunk in the build, so a phone downloads the one it needs rather than all 358, and
 * validates only that one. Fetched topics are kept for the rest of the visit.
 */
const files = import.meta.glob('../../../../supabase/seed/content/**/*.json', { import: 'default' })
const byKey = new Map(Object.entries(files).map(([path, load]) => {
  const [, subjectId, topicId] = /content\/([^/]+)\/([^/]+)\.json$/.exec(path)!
  return [`${subjectId}/${topicId}`, load]
}))
const cache = new Map<string, TopicRecord>()
const pending = new Map<string, Promise<TopicRecord | undefined>>()

export function cachedTopic(subjectId: string, topicId: string): TopicRecord | undefined {
  return cache.get(`${subjectId}/${topicId}`)
}

export function loadTopic(subjectId: string, topicId: string): Promise<TopicRecord | undefined> {
  const key = `${subjectId}/${topicId}`
  const hit = cache.get(key)
  if (hit) return Promise.resolve(hit)
  const load = byKey.get(key)
  if (!load) return Promise.resolve(undefined)
  let p = pending.get(key)
  if (!p) {
    p = load().then((raw) => {
      const topic = Topic.parse(raw)
      cache.set(key, topic)
      pending.delete(key)
      return topic
    }, (e) => { pending.delete(key); throw e })
    pending.set(key, p)
  }
  return p
}

/**
 * The full topic for a screen: undefined while it loads, null if there is no such topic.
 * A topic opened before is returned at once, with no loading state.
 */
export function useTopic(subjectId: string | undefined, topicId: string | undefined): TopicRecord | undefined | null {
  const key = subjectId && topicId ? `${subjectId}/${topicId}` : ''
  const [state, setState] = useState<{ key: string; topic: TopicRecord | undefined | null }>(() => ({ key, topic: key ? cache.get(key) : null }))
  useEffect(() => {
    if (!subjectId || !topicId) { setState({ key, topic: null }); return }
    if (cache.has(key)) { setState({ key, topic: cache.get(key) }); return }
    let live = true
    setState({ key, topic: undefined })
    loadTopic(subjectId, topicId).then((t) => { if (live) setState({ key, topic: t ?? null }) }, () => { if (live) setState({ key, topic: null }) })
    return () => { live = false }
  }, [key, subjectId, topicId])
  // No such topic file: say so at once rather than show a loading state first.
  if (!key || !byKey.has(key)) return null
  // A render for a new key before the effect runs must not show the previous topic.
  return state.key === key ? state.topic : cache.get(key) ?? undefined
}

/** Several topics at once, for a screen that spans topics (Redo my mistakes). */
export function useTopics(keys: { subjectId: string; topicId: string }[]): Map<string, TopicRecord> | undefined {
  const sig = keys.map((k) => `${k.subjectId}/${k.topicId}`).sort().join(',')
  const ready = () => keys.every((k) => cache.has(`${k.subjectId}/${k.topicId}`))
  const [, bump] = useState(0)
  useEffect(() => {
    if (ready()) return
    let live = true
    Promise.all(keys.map((k) => loadTopic(k.subjectId, k.topicId))).finally(() => { if (live) bump((n) => n + 1) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])
  return ready() ? new Map(keys.map((k) => [k.topicId, cache.get(`${k.subjectId}/${k.topicId}`)!])) : undefined
}

/** Puts topics straight into the cache, so a screen renders them without a loading state. For tests. */
export function primeTopicCache(topics: TopicRecord[]) {
  for (const t of topics) cache.set(`${t.subjectId}/${t.id}`, t)
}
