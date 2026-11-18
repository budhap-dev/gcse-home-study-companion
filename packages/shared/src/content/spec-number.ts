/**
 * The specification reference a topic shows before its title, such as "1.4" for an
 * Edexcel Business section or "4.1.1.1, 4.1.1.4–4.1.1.7" for an AQA Chemistry topic.
 *
 * Business sections match the app's topics one for one, so a Business topic names its
 * section (`specCode`). Elsewhere a topic covers a handful of the board's points, and
 * a section number would claim the whole section when the topic teaches part of it, so
 * the label is the points themselves. Three or more that run in sequence under the same
 * parent are written as a range; the run is read off the topic's own list, so a range
 * never covers a point the topic does not list.
 *
 * A topic whose references are not the board's numbers — a Year 9 bridging topic, or a
 * subject such as English, French or Music that names papers and themes instead — has
 * no label, and nothing is shown.
 */
export function topicNumber(topic: { specCode?: string; specPoints: string[] }): string | undefined {
  if (topic.specCode) return topic.specCode
  const parsed = [...new Set(topic.specPoints)].map(parseSpecPoint)
  if (!parsed.length || parsed.some((p) => !p)) return undefined
  const points = (parsed as SpecPoint[]).sort(comparePoints)

  const out: string[] = []
  let run: SpecPoint[] = [points[0]]
  const flush = () => {
    if (run.length >= 3) out.push(`${run[0].text}–${run[run.length - 1].text}`)
    else out.push(...run.map((p) => p.text))
  }
  for (const p of points.slice(1)) {
    const last = run[run.length - 1]
    if (p.parent === last.parent && p.n === last.n + 1) run.push(p)
    else {
      flush()
      run = [p]
    }
  }
  flush()
  return out.join(', ')
}

interface SpecPoint {
  text: string
  /** Everything before the last number: "4.1.1." for 4.1.1.4, "N" for N13. */
  parent: string
  n: number
  /** Sort key for the parent: the dotted numbers, or the strand's place in the spec. */
  key: number[]
}

/** Edexcel 1MA1 lists its strands in this order, which is the order a student meets them in the spec. */
const MATHS_STRANDS = ['N', 'A', 'R', 'G', 'P', 'S']

/**
 * A board reference: dotted numbers ("4.5.6.1.3", "2.14"), optionally with Edexcel
 * Biology's capital suffix for separate-science content ("5.17B"), or a 1MA1 strand
 * code ("G14"). Anything else is prose and has no number.
 */
export function parseSpecPoint(text: string): SpecPoint | null {
  const dotted = text.match(/^((?:\d+\.)*)(\d+)[A-Z]?$/)
  if (dotted) {
    const parent = dotted[1]
    return { text, parent, n: Number(dotted[2]), key: parent.split('.').filter(Boolean).map(Number) }
  }
  const strand = text.match(/^([NARGPS])(\d+)$/)
  if (strand) return { text, parent: strand[1], n: Number(strand[2]), key: [MATHS_STRANDS.indexOf(strand[1])] }
  return null
}

function comparePoints(a: SpecPoint, b: SpecPoint): number {
  const ka = [...a.key, a.n]
  const kb = [...b.key, b.n]
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    // A shorter reference is the parent section and comes first: 3.6.2 before 3.6.2.2.
    if (ka[i] === undefined) return -1
    if (kb[i] === undefined) return 1
    if (ka[i] !== kb[i]) return ka[i] - kb[i]
  }
  return a.text.localeCompare(b.text)
}

/** The points a lesson step teaches: none, one, or the two to four it lists. */
export function stepPoints(step: { specPoint?: string | string[] }): string[] {
  const p = step.specPoint
  return p === undefined ? [] : typeof p === 'string' ? [p] : p
}

/** Specification order: 4.1.1.2 before 4.1.1.10, 3.6.2 before 3.6.2.2, N13 before G14. */
export function compareSpecPoints(a: string, b: string): number {
  const pa = parseSpecPoint(a)
  const pb = parseSpecPoint(b)
  return pa && pb ? comparePoints(pa, pb) : a.localeCompare(b, 'en', { numeric: true })
}

/**
 * Where a topic sits in its board's specification, for the specification order (a
 * teacher's view, not the school's plan). `home` is the first numbered point the topic
 * lists: authors list the point a topic exists to teach first, and the lowest point is
 * often one used in passing (Electrolysis of molten compounds lists 4.4.3.1 first and
 * 4.4.1.4, oxidation in terms of electrons, last). `label` is the topic's number from its
 * home on; `also` holds the points that come before its home in the specification, which
 * the label would otherwise lead with, putting the topic's number out of sequence.
 *
 * A topic with no numbered point (a Year 9 bridging topic, or English, French and Music,
 * whose boards name papers and themes) has no place, and keeps the school's order.
 */
export function specPlace(topic: { specCode?: string; specPoints: string[] }): { home: string; label: string; also?: string } | undefined {
  // A Business section ("1.4") names itself. A topic summary's specCode can instead be the
  // whole label ("4.1.1.1, 4.1.1.4–4.1.1.7"), which is no one point: work from the points.
  if (topic.specCode && parseSpecPoint(topic.specCode)) return { home: topic.specCode, label: topic.specCode }
  const points = [...new Set(topic.specPoints)].filter((p) => parseSpecPoint(p))
  const home = points[0]
  if (!home) return undefined
  const before = points.filter((p) => compareSpecPoints(p, home) < 0)
  const from = points.filter((p) => compareSpecPoints(p, home) >= 0)
  const label = topicNumber({ specPoints: from })!
  const also = before.length ? topicNumber({ specPoints: before }) : undefined
  return also ? { home, label, also } : { home, label }
}

/** A step's numbers as its heading shows them: "1.4.2", "7.15, 7.16" or "4.8.2.1–4.8.2.4". */
export function stepNumber(step: { specPoint?: string | string[] }): string | undefined {
  const points = stepPoints(step)
  return points.length ? topicNumber({ specPoints: points }) : undefined
}
