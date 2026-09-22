/**
 * A specification reference: "1.4" against a topic, "1.4.2" against a lesson step.
 *
 * Only some boards number their content in a way the app's topics line up with one for
 * one — Edexcel Business does, and its ten topics are its ten sections — so most topics
 * carry no number and this renders nothing. It is deliberately quiet: the number is for
 * checking work against a syllabus or a revision list, not for reading.
 */
export function SpecNumber({ code, className = '' }: { code?: string; className?: string }) {
  if (!code) return null
  return (
    <span className={`shrink-0 font-bold tabular-nums text-ink-3 ${className}`} aria-label={`Specification ${code}`}>
      {code}
    </span>
  )
}
