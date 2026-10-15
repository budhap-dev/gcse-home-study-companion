/**
 * A specification reference: "1.4" or "4.1.1.1, 4.1.1.4–4.1.1.7" against a topic, "1.4.2"
 * against a lesson step. The topic's label comes from topicNumber in @study/shared.
 *
 * It sits in the same line of text as the title it labels, so a long label wraps with the
 * title on a phone instead of squeezing it. Each reference or range stays whole: a line
 * never breaks inside "4.1.1.4–4.1.1.7". Topics whose board names papers or themes rather
 * than numbering its content carry no number and this renders nothing. It is deliberately
 * quiet: the number is for checking work against a syllabus, not for reading. In a
 * heading it is set smaller than the title (`text-[0.6em]`), so a list of five points
 * does not outweigh the name of the topic.
 */
export function SpecNumber({ code, className = '', tone = 'text-ink-3' }: { code?: string; className?: string; tone?: string }) {
  if (!code) return null
  const parts = code.split(', ')
  return (
    <span className={`font-bold tabular-nums ${tone} ${className}`} aria-label={`Specification ${code}`}>
      {parts.map((part, i) => (
        <span key={part} className="whitespace-nowrap">{part}{i < parts.length - 1 ? ', ' : ''}</span>
      ))}
    </span>
  )
}
