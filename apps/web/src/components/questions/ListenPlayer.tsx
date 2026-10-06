import { useEffect, useRef, useState } from 'react'
import { useFrenchVoice } from '../Speak.tsx'

/** Plays before answering, as the listening paper plays each recording three times. */
export const PLAYS = 3
/** The pause between sentences of a dictation, which the exam reads with gaps to write in. */
const DICTATION_GAP_MS = 1800

const sentences = (text: string) => text.match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text]

/**
 * The French a listening question is answered from, read by the device's own voice. Three
 * plays until the answer is in, then as many as wanted. The words are never shown before
 * marking, except on a device with no French voice at all, where the question would
 * otherwise be impossible: then a comprehension question shows its text to read instead,
 * and a dictation asks for someone to read it aloud.
 */
export function ListenPlayer({ text, dictation = false, answered = false }: { text: string; dictation?: boolean; answered?: boolean }) {
  const voice = useFrenchVoice()
  const [left, setLeft] = useState(PLAYS)
  const [playing, setPlaying] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const stop = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    window.speechSynthesis?.cancel()
    setPlaying(false)
  }
  useEffect(() => stop, [])

  if (voice === null) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-rule bg-panel p-3 text-sm">
        <p className="font-bold">This device has no French voice to read the recording.</p>
        {dictation ? (
          <>
            <p className="text-ink-2">Ask someone to read it to you three times, with a pause after each sentence.</p>
            <details><summary className="cursor-pointer font-bold">Show the French, for the person reading it</summary><p lang="fr" className="mt-1">{text}</p></details>
          </>
        ) : (
          <><p className="text-ink-2">Read it instead:</p><p lang="fr" className="text-base">{text}</p></>
        )}
      </div>
    )
  }

  const play = () => {
    if (!voice || (!answered && left === 0)) return
    stop()
    setPlaying(true)
    if (!answered) setLeft((n) => n - 1)
    const parts = dictation ? sentences(text) : [text]
    const say = (i: number) => {
      const u = new SpeechSynthesisUtterance(parts[i]!)
      u.voice = voice
      u.lang = voice.lang
      u.rate = 0.9
      u.onend = () => {
        if (i + 1 < parts.length) timers.current.push(setTimeout(() => say(i + 1), DICTATION_GAP_MS))
        else setPlaying(false)
      }
      u.onerror = () => setPlaying(false)
      window.speechSynthesis.speak(u)
    }
    say(0)
  }

  const spent = !answered && left === 0
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rule bg-panel p-3">
      <button
        type="button"
        onClick={playing ? stop : play}
        disabled={!voice || (spent && !playing)}
        className="press inline-flex h-11 items-center gap-2 rounded-lg bg-[color:var(--subject)] px-4 font-bold text-white disabled:opacity-40"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          {playing ? <path d="M7 5h4v14H7zM13 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}
        </svg>
        {playing ? 'Stop' : left === PLAYS && !answered ? 'Play the recording' : 'Play again'}
      </button>
      <span className="text-sm text-ink-2" aria-live="polite">
        {!voice ? 'Finding a French voice…' : answered ? 'Play it as often as you like now.' : spent ? 'All three plays used, as in the exam.' : `${left} of ${PLAYS} plays left${dictation ? ', with a pause after each sentence' : ''}.`}
      </span>
    </div>
  )
}
