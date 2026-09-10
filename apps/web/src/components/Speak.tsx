import { useEffect, useState } from 'react'

/**
 * Reads French aloud with the browser's own speech synthesis. No audio files, no licence,
 * and it works offline once a voice is installed.
 *
 * It is honest about its limits: a synthetic voice is a pronunciation guide, not a model
 * of how the listening exam sounds, and the button says so through its title. Where no
 * French voice exists at all the button hides rather than reading French in an English
 * accent, which would teach the wrong thing.
 */
function frenchVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices() ?? []
  return voices.find((v) => v.lang === 'fr-FR') ?? voices.find((v) => v.lang.startsWith('fr'))
}

export function useFrenchVoice(): SpeechSynthesisVoice | undefined | null {
  // undefined while we are still waiting for the list, null when there is none.
  const [voice, setVoice] = useState<SpeechSynthesisVoice | undefined | null>(undefined)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) { setVoice(null); return }
    const read = () => setVoice(frenchVoice() ?? null)
    read()
    // Chrome loads voices asynchronously and fires this once they arrive.
    window.speechSynthesis.addEventListener('voiceschanged', read)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', read)
  }, [])
  return voice
}

export function SpeakButton({ text, label, className = '' }: { text: string; label?: string; className?: string }) {
  const voice = useFrenchVoice()
  const [speaking, setSpeaking] = useState(false)
  if (!voice) return null

  const speak = () => {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = voice
    utterance.lang = voice.lang
    // Slower than natural: this is for hearing the shape of a word, not for fluency practice.
    utterance.rate = 0.85
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  return (
    <button
      type="button"
      onClick={speak}
      aria-label={label ?? `Hear ${text} in French`}
      title="A computer voice, so it is a guide to the sounds rather than a model accent"
      className={`press inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rule bg-surface text-ink-2 hover:border-[color:var(--subject)] ${className}`}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 9v6h4l5 4V5L8 9H4z" />
        {speaking ? <path d="M16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14" /> : <path d="M16.5 9.5a3.5 3.5 0 0 1 0 5" />}
      </svg>
    </button>
  )
}
