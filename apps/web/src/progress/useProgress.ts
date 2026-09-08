import { useSyncExternalStore } from 'react'
import { evidenceFor, getState, subscribe, type TopicEvidence } from './store.ts'

let snapshot = getState()
let version = 0
subscribe(() => {
  snapshot = getState()
  version++
})

function getVersion() {
  return version
}

/** Re-renders when progress changes anywhere in the app. */
export function useProgress() {
  useSyncExternalStore(subscribe, getVersion, getVersion)
  return snapshot
}

export function useTopicEvidence(topicId: string): TopicEvidence {
  const state = useProgress()
  return evidenceFor(topicId, state)
}
