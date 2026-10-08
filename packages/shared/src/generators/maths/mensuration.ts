import { clearOfHalf, fixed, roundTo, show } from '../format.ts'
import { draw, int, pick } from '../random.ts'
import type { Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'

/** Generators for arcs and sectors, surface area and volume, 3D shapes. */

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))
const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
/** A value to four places, cut rather than rounded, with an ellipsis: 12.5663\ldots */
const dots = (x: number) => `${(Math.trunc(x * 10000) / 10000).toFixed(4)}\\ldots`
/** A tolerance no wider than the slot's and never over 2% of the answer. */
const within = (slotTolerance: number, answer: number) => Math.min(slotTolerance, roundTo(Math.abs(answer) * 0.02, 3))
const tol = (slot: { type: string }) => ('tolerance' in slot ? Number((slot as { tolerance: number }).tolerance) : 0)

/** n/d in its lowest terms as LaTeX: \frac{1}{5}. */
function fracTex(n: number, d: number): string {
  const g = gcd(n, d)
  const [a, b] = [n / g, d / g]
  return b === 1 ? String(a) : `\\frac{${a}}{${b}}`
}

/** (n/d)π in LaTeX, simplified: 4\pi, \pi, \frac{8}{3}\pi. */
export function piTex(n: number, d = 1): string {
  const g = gcd(n, d)
  const [a, b] = [n / g, d / g]
  if (b === 1) return a === 1 ? '\\pi' : `${a}\\pi`
  return `\\frac{${a}}{${b}}\\pi`
}

/**
 * Simpson's rule over a solid's height, exact for any solid whose cross-section area is a
 * quadratic in the height: a prism, a pyramid, a cone, a sphere cap, a cylinder. The second
 * route for every volume here: it never uses the solid's own volume formula.
 */
export const bySlices = (height: number, area: (z: number) => number) => (height / 6) * (area(0) + 4 * area(height / 2) + area(height))

// ---------------------------------------------------------------- arcs and sectors

const ARC = 'arc-length-and-sector-area'

interface SectorContext {
  /** How the prompt names it, after "Find the arc length of". */
  lead: string
  unit: 'cm' | 'm'
  r: [number, number]
  angle: [number, number]
}
const SECTORS: SectorContext[] = [
  { lead: 'a sector', unit: 'cm', r: [3, 25], angle: [10, 350] },
  { lead: 'a sector', unit: 'cm', r: [3, 25], angle: [10, 350] },
  { lead: 'a slice of pizza, which is a sector', unit: 'cm', r: [10, 18], angle: [20, 90] },
  { lead: 'a flower bed in the shape of a sector', unit: 'm', r: [2, 9], angle: [30, 180] },
  { lead: 'a paper fan, opened into a sector', unit: 'cm', r: [15, 30], angle: [90, 180] },
]

type SectorTask = 'arc' | 'area' | 'perimeter'
/** Each written slot's task: q3 an arc (core), q5 and q6 areas, q7 a perimeter (higher). */
const SECTOR_TASK: Record<string, SectorTask> = { q3: 'arc', q5: 'area', q6: 'area', q7: 'perimeter' }

/** An angle in multiples of 5 within a context's range, never a semicircle. */
const sectorAngle = (r: Rng, [lo, hi]: [number, number]) => draw(r, (r) => 5 * int(r, Math.ceil(lo / 5), Math.floor(hi / 5)), (a) => a !== 180 && a !== 360)

/**
 * Arc length, sector area and sector perimeter to 2 decimal places: written as q3 (r 10,
 * 72°, arc), q5 (r 10, 72°, area), q6 (r 6, 120°, area) and q7 (r 8, 45°, perimeter, 3
 * marks). Each slot keeps its own task. The second route works in radians: arc rθ, area
 * ½r²θ, never the fraction of 360.
 */
export const sectorMeasures: Generator = {
  id: 'sector-measures',
  subjectId: 'maths',
  topicId: ARC,
  replaces: ['q3', 'q5', 'q6', 'q7'],
  build(r, slot): Draft {
    const task = SECTOR_TASK[slot.id] ?? 'arc'
    const c = pick(r, SECTORS)
    const u = c.unit
    const value = (rad: number, angle: number) =>
      task === 'arc' ? (angle / 360) * 2 * Math.PI * rad : task === 'area' ? (angle / 360) * Math.PI * rad * rad : (angle / 360) * 2 * Math.PI * rad + 2 * rad
    const { rad, angle } = draw(r, (r) => ({ rad: int(r, c.r[0], c.r[1]), angle: sectorAngle(r, c.angle) }), ({ rad, angle }) => clearOfHalf(value(rad, angle), 2))
    const exact = value(rad, angle)
    const answer = roundTo(exact, 2)
    const part = fracTex(angle, 360)
    const arcExact = (angle / 360) * 2 * Math.PI * rad
    let prompt: string, solution: string, method: string[]
    if (task === 'area') {
      prompt = `Find the area of ${c.lead} of radius ${rad} ${u} with angle ${angle}°, in ${u}² to 2 decimal places.`
      solution = `$\\frac{${angle}}{360} = ${part}$ and the whole circle has area $\\pi \\times ${rad}^2 = ${piTex(rad * rad)}$, so the sector is $${part} \\times ${piTex(rad * rad)} = ${piTex(angle * rad * rad, 360)} = ${dots(exact)}$, which is $${fixed(exact, 2)}$ ${u}² to 2 decimal places.`
      method = [`uses (${angle}/360) × π × ${rad}²`]
    } else {
      const arc = `$\\frac{${angle}}{360} = ${part}$ and the circumference is $2\\pi \\times ${rad} = ${piTex(2 * rad)}$, so the arc is $${part} \\times ${piTex(2 * rad)} = ${piTex(2 * rad * angle, 360)} = ${dots(arcExact)}$`
      if (task === 'arc') {
        prompt = `Find the arc length of ${c.lead} of radius ${rad} ${u} with angle ${angle}°, in ${u} to 2 decimal places.`
        solution = `${arc}, which is $${fixed(exact, 2)}$ ${u} to 2 decimal places.`
        method = [`uses (${angle}/360) × 2π × ${rad}`]
      } else {
        prompt = `Find the perimeter of ${c.lead} of radius ${rad} ${u} with angle ${angle}°, in ${u} to 2 decimal places.`
        solution = `${arc} ${u}. The perimeter adds **both radii**: $${dots(arcExact)} + ${rad} + ${rad} = ${dots(exact)}$, which is $${fixed(exact, 2)}$ ${u} to 2 decimal places. Giving only the arc is the commonest error here.`
        method = ['finds the arc', `adds 2r = ${2 * rad}`]
      }
    }
    // Second route: the angle in radians, with no fraction of 360.
    const theta = (angle * Math.PI) / 180
    const other = task === 'arc' ? rad * theta : task === 'area' ? 0.5 * rad * rad * theta : rad * theta + 2 * rad
    return {
      question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, method, fixed(exact, 2)), answer, tolerance: 0.01 },
      check: { agrees: near(other, exact) && roundTo(other, 2) === answer, detail: `in radians: θ = ${show(roundTo(theta, 6))}, ${task} = ${show(roundTo(other, 6))}` },
      values: { task, r: rad, angle, unit: u },
    }
  },
}

type RoundShape = 'semicircle-radius' | 'semicircle-diameter' | 'quadrant'
const ROUND: { shape: RoundShape; lead: string; unit: 'cm' | 'm'; size: [number, number] }[] = [
  { shape: 'semicircle-radius', lead: 'A semicircle has radius', unit: 'cm', size: [3, 30] },
  { shape: 'semicircle-radius', lead: 'A semicircular rug has radius', unit: 'cm', size: [40, 90] },
  { shape: 'semicircle-diameter', lead: 'A semicircular window has diameter', unit: 'cm', size: [60, 160] },
  { shape: 'semicircle-diameter', lead: 'A semicircle has diameter', unit: 'cm', size: [5, 40] },
  { shape: 'semicircle-diameter', lead: 'A semicircular flower bed has diameter', unit: 'm', size: [3, 12] },
  { shape: 'quadrant', lead: 'A quadrant (a quarter of a circle) has radius', unit: 'cm', size: [3, 30] },
  { shape: 'quadrant', lead: 'A lawn in the shape of a quarter circle has radius', unit: 'm', size: [4, 20] },
]

/**
 * A semicircle's or a quadrant's perimeter: written as q15 (semicircle of radius 8, 3 marks).
 * The straight edges are the trap: a diameter for a semicircle, two radii for a quadrant.
 * The second route uses the diameter: πd/2 + d, or (π/4)d + d for a quadrant.
 */
export const roundPerimeter: Generator = {
  id: 'semicircle-perimeter',
  subjectId: 'maths',
  topicId: ARC,
  replaces: ['q15'],
  build(r, slot): Draft {
    const c = pick(r, ROUND)
    const u = c.unit
    const size = draw(r, (r) => int(r, c.size[0], c.size[1]), (s) => {
      const rad = c.shape === 'semicircle-diameter' ? s / 2 : s
      return clearOfHalf(c.shape === 'quadrant' ? (Math.PI * rad) / 2 + 2 * rad : Math.PI * rad + 2 * rad, 2)
    })
    const rad = c.shape === 'semicircle-diameter' ? size / 2 : size
    const d = 2 * rad
    const semi = c.shape !== 'quadrant'
    const arc = semi ? Math.PI * rad : (Math.PI * rad) / 2
    const exact = arc + 2 * rad
    const answer = roundTo(exact, 2)
    const prompt = `${c.lead} ${size} ${u}. Find its perimeter, in ${u} to 2 decimal places.`
    let solution: string, method: string[]
    if (semi) {
      const start = c.shape === 'semicircle-diameter' ? `The radius is $${size} \\div 2 = ${show(rad)}$ ${u}. ` : ''
      solution = `${start}A semicircle is a 180° sector, so its arc is half the circumference: $\\frac{1}{2} \\times ${d % 1 === 0 ? piTex(d) : `${show(d)}\\pi`} = ${rad % 1 === 0 ? piTex(rad) : `${show(rad)}\\pi`} = ${dots(arc)}$ ${u}. The perimeter adds the **diameter**, which is the two radii together: $${dots(arc)} + ${show(d)} = ${dots(exact)}$, which is $${fixed(exact, 2)}$ ${u}. The straight edge is easy to forget because it looks like a base rather than part of the boundary.`
      method = ['finds the semicircular arc', `adds the diameter of ${show(d)}`]
    } else {
      solution = `A quadrant is a 90° sector, so its arc is a quarter of the circumference: $\\frac{1}{4} \\times ${piTex(2 * rad)} = ${piTex(2 * rad, 4)} = ${dots(arc)}$ ${u}. The perimeter adds **both radii**, the two straight edges: $${dots(arc)} + ${rad} + ${rad} = ${dots(exact)}$, which is $${fixed(exact, 2)}$ ${u}. The straight edges are easy to forget because only the curve looks like the circle.`
      method = ['finds the quarter-circle arc', `adds both radii, 2 × ${rad}`]
    }
    // Second route: from the diameter, πd/2 or πd/4, plus the straight edges.
    const other = semi ? (Math.PI * d) / 2 + d : (Math.PI * d) / 4 + d
    return {
      question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, method, fixed(exact, 2)), answer, tolerance: 0.01 },
      check: { agrees: near(other, exact) && roundTo(other, 2) === answer, detail: `from the diameter ${show(d)}: ${show(roundTo(other, 6))}` },
      values: { shape: c.shape, size, unit: u },
    }
  },
}

/** Angles whose fraction of 360 is a common one. */
const NICE_ANGLES = [20, 30, 36, 40, 45, 60, 72, 80, 90, 100, 108, 120, 135, 140, 144, 150, 160, 200, 210, 216, 225, 240, 252, 270, 280, 288, 300, 315, 320, 324, 330]

/**
 * The angle at the centre from an arc or an area given in terms of π: written as q11 (r 6,
 * arc 4π, 3 marks, grade 8-9). π cancels from both sides. Either the arc or the area is
 * given; the second route builds the arc or area back from the angle in radians.
 */
export const sectorAngleFromPi: Generator = {
  id: 'sector-angle-from-pi',
  subjectId: 'maths',
  topicId: ARC,
  replaces: ['q11'],
  build(r, slot): Draft {
    const kind = r() < 0.6 ? 'arc' : 'area'
    const pendulum = kind === 'arc' && r() < 0.3
    const { rad, angle } = draw(
      r,
      (r) => ({ rad: pendulum ? 5 * int(r, 6, 20) : int(r, 2, 20), angle: pendulum ? pick(r, [20, 30, 36, 40, 45, 60, 72, 80, 90]) : pick(r, NICE_ANGLES) }),
      ({ rad, angle }) => (kind === 'arc' ? (rad * angle) % 180 === 0 && (rad * angle) / 180 >= 2 : (rad * rad * angle) % 360 === 0 && (rad * rad * angle) / 360 >= 2),
    )
    const k = kind === 'arc' ? (rad * angle) / 180 : (rad * rad * angle) / 360
    const whole = kind === 'arc' ? 2 * rad : rad * rad
    let prompt: string, solution: string, method: string[]
    if (kind === 'arc') {
      prompt = pendulum
        ? `The end of a pendulum ${rad} cm long swings along an arc of a circle of radius ${rad} cm. The arc has length $${piTex(k)}$ cm. Find the angle the pendulum swings through, in degrees.`
        : `A sector of radius ${rad} cm has an arc length of $${piTex(k)}$ cm. Find the angle at the centre, in degrees.`
      solution = `Substitute into the arc formula: $\\frac{\\theta}{360} \\times 2\\pi \\times ${rad} = ${piTex(k)}$, which is $\\frac{\\theta}{360} \\times ${piTex(whole)} = ${piTex(k)}$.`
      method = ['substitutes into the arc formula', 'cancels π and solves']
    } else {
      prompt = `A sector of radius ${rad} cm has an area of $${piTex(k)}$ cm². Find the angle at the centre, in degrees.`
      solution = `Substitute into the area formula: $\\frac{\\theta}{360} \\times \\pi \\times ${rad}^2 = ${piTex(k)}$, which is $\\frac{\\theta}{360} \\times ${piTex(whole)} = ${piTex(k)}$.`
      method = ['substitutes into the sector area formula', 'cancels π and solves']
    }
    solution += ` The $\\pi$ **cancels from both sides**, leaving $\\frac{\\theta}{360} = \\frac{${k}}{${whole}} = ${fracTex(k, whole)}$, so $\\theta = ${fracTex(k, whole)} \\times 360 = ${angle}°$. Check: ${angle}° is under 360°, as it must be.`
    // Second route: the angle in radians rebuilds the given arc or area, divided by π.
    const theta = (angle * Math.PI) / 180
    const rebuilt = (kind === 'arc' ? rad * theta : 0.5 * rad * rad * theta) / Math.PI
    return {
      question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, method, String(angle)), answer: angle, tolerance: 0 },
      check: { agrees: near(rebuilt, k) && angle > 0 && angle < 360, detail: `${angle}° is ${show(roundTo(theta, 6))} rad, giving ${kind} ${show(roundTo(rebuilt, 6))}π` },
      values: { kind, r: rad, angle, k },
    }
  },
}

/**
 * A sector's area in terms of π: written as q19 (r 6, 120°, 12π, 2 marks). The accepted
 * forms are the written pattern, "12π" and "12π cm²". The second route is ½r²θ in radians.
 */
export const sectorAreaExact: Generator = {
  id: 'sector-area-exact',
  subjectId: 'maths',
  topicId: ARC,
  replaces: ['q19'],
  build(r, slot): Draft {
    const { rad, angle } = draw(r, (r) => ({ rad: int(r, 2, 20), angle: pick(r, NICE_ANGLES) }), ({ rad, angle }) => (rad * rad * angle) % 360 === 0 && (rad * rad * angle) / 360 >= 2)
    const k = (rad * rad * angle) / 360
    const part = fracTex(angle, 360)
    const approx = fixed(k * Math.PI, 2)
    const accepted = [`${k}π`, `${k}π cm²`]
    // Second route: ½r²θ with θ in radians, as a multiple of π.
    const viaRadians = (0.5 * rad * rad * ((angle * Math.PI) / 180)) / Math.PI
    return {
      question: {
        type: 'short-text',
        prompt: `A sector has radius ${rad} cm and angle ${angle}°. Find its area. Give your answer in terms of $\\pi$.`,
        solution: `$\\frac{${angle}}{360} = ${part}$, and the whole circle has area $\\pi \\times ${rad}^2 = ${piTex(rad * rad)}$. $${part}$ of that is **${k}π** cm². Leaving $\\pi$ in is exactly what the question asks for: ${approx} would lose the mark, because it is a rounded approximation of an exact value.`,
        markScheme: scheme(slot, [`forms (${angle}/360) × π × ${rad}²`], `${k}π`),
        accepted,
      },
      check: { agrees: near(viaRadians, k) && Number.isInteger(k), detail: `½ × ${rad}² × ${angle}π/180 = ${show(roundTo(viaRadians, 6))}π` },
      values: { r: rad, angle, k },
    }
  },
}

// ---------------------------------------------------------------- surface area and volume

const SAV = 'surface-areas-and-volumes'

interface CylinderContext {
  lead: string
  unit: 'cm' | 'm'
  r: [number, number]
  h: [number, number]
  /** Whether a half-unit radius is realistic: a tin is 3.5 cm across the middle, a tank is not. */
  halves: boolean
}
const CYLINDERS: CylinderContext[] = [
  { lead: 'A cylinder has', unit: 'cm', r: [2, 12], h: [3, 25], halves: false },
  { lead: 'A cylinder has', unit: 'cm', r: [2, 12], h: [3, 25], halves: true },
  { lead: 'A tin of soup is a cylinder with', unit: 'cm', r: [3, 5], h: [8, 13], halves: true },
  { lead: 'A candle is a cylinder with', unit: 'cm', r: [2, 6], h: [5, 20], halves: true },
  { lead: 'A drinking glass is a cylinder with', unit: 'cm', r: [3, 4], h: [9, 15], halves: true },
  { lead: 'A round cake tin is a cylinder with', unit: 'cm', r: [8, 13], h: [5, 9], halves: false },
  { lead: 'A water tank is a cylinder with', unit: 'm', r: [2, 4], h: [2, 6], halves: true },
]

const drawCylinder = (r: Rng, c: CylinderContext, halves = c.halves) => ({
  rad: halves && r() < 0.5 ? int(r, c.r[0], c.r[1] - 1) + 0.5 : int(r, c.r[0], c.r[1]),
  h: int(r, c.h[0], c.h[1]),
})

/** "5^2", or "(3.5)^2" never: KaTeX reads 3.5^2 as 3.5². */
const sq = (x: number) => `${show(x)}^2`

/**
 * A cylinder's volume or curved surface area to 1 decimal place: written as q1 (r 5, h 12,
 * volume, core) and q5 (the same cylinder's curved surface, higher). Each slot keeps its
 * own task. The second routes: the volume as half the curved surface times the radius
 * (V = ½ × 2πrh × r), and the curved surface as the label unrolled, πd by h.
 */
export const cylinderMeasures: Generator = {
  id: 'cylinder-measures',
  subjectId: 'maths',
  topicId: SAV,
  replaces: ['q1', 'q5'],
  build(r, slot): Draft {
    const volume = slot.id === 'q1'
    const c = pick(r, CYLINDERS)
    const u = c.unit
    const f = (rad: number, h: number) => (volume ? Math.PI * rad * rad * h : 2 * Math.PI * rad * h)
    const { rad, h } = draw(r, (r) => drawCylinder(r, c), ({ rad, h }) => clearOfHalf(f(rad, h), 1) && f(rad, h) >= 30)
    const exact = f(rad, h)
    const answer = roundTo(exact, 1)
    const tolerance = within(tol(slot), answer)
    let prompt: string, solution: string, method: string[], other: number, detail: string
    if (volume) {
      prompt = `${c.lead} radius ${show(rad)} ${u} and height ${h} ${u}. What is its volume, in ${u}³ to 1 decimal place?`
      solution = `$V = \\pi r^2 h = \\pi \\times ${sq(rad)} \\times ${h} = ${show(rad * rad * h)}\\pi \\approx ${fixed(exact, 1)}$ ${u}³.`
      method = ['uses π r² h', `substitutes: π × ${show(rad)}² × ${h}`]
      const curved = 2 * Math.PI * rad * h
      other = (curved * rad) / 2
      detail = `half the curved surface ${show(roundTo(curved, 4))} times the radius: ${show(roundTo(other, 4))}`
    } else {
      prompt = `${c.lead} radius ${show(rad)} ${u} and height ${h} ${u}. What is its curved surface area, in ${u}² to 1 decimal place?`
      solution = `$2\\pi r h = 2 \\times \\pi \\times ${show(rad)} \\times ${h} = ${show(2 * rad * h)}\\pi \\approx ${fixed(exact, 1)}$ ${u}². Unrolled, the curved surface is a rectangle as long as the circumference and as wide as the height.`
      method = ['uses 2π r h', `substitutes: 2 × π × ${show(rad)} × ${h}`]
      other = Math.PI * (2 * rad) * h
      detail = `unrolled: πd = ${show(roundTo(Math.PI * 2 * rad, 4))} by ${h}`
    }
    return {
      question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, method, fixed(exact, 1)), answer, tolerance, units: `${u}${volume ? '³' : '²'}` },
      check: { agrees: near(other, exact) && roundTo(other, 1) === answer, detail },
      values: { task: volume ? 'volume' : 'curved surface', r: rad, h, unit: u },
    }
  },
}

/**
 * A cylinder's volume in terms of π: written as q19 (r 5, h 12, 300π). Accepted, as written,
 * "300π" and "300π cm³". The second route is half the curved surface times the radius.
 */
export const cylinderVolumeExact: Generator = {
  id: 'cylinder-volume-exact',
  subjectId: 'maths',
  topicId: SAV,
  replaces: ['q19'],
  build(r, slot): Draft {
    const c = pick(r, CYLINDERS)
    const u = c.unit
    const { rad, h } = drawCylinder(r, c, false)
    const k = rad * rad * h
    const viaCurved = (2 * rad * h * rad) / 2
    return {
      question: {
        type: 'short-text',
        prompt: `${c.lead} radius ${rad} ${u} and height ${h} ${u}. Find its volume. Give your answer in terms of $\\pi$.`,
        solution: `Volume of a cylinder is $\\pi r^2 h = \\pi \\times ${rad}^2 \\times ${h} = \\pi \\times ${k}$. So the volume is **${k}π** ${u}³. The exact form is quicker than the decimal as well as more accurate: $${rad * rad} \\times ${h}$ is the whole calculation.`,
        markScheme: scheme(slot, [`π × ${rad}² × ${h}`], `${k}π`),
        accepted: [`${k}π`, `${k}π ${u}³`],
      },
      check: { agrees: viaCurved === k, detail: `half of 2π × ${rad} × ${h}, times ${rad}: ${viaCurved}π` },
      values: { r: rad, h, unit: u },
    }
  },
}

const SPHERES: { lead: string; unit: 'cm' | 'm'; r: [number, number] }[] = [
  { lead: 'A sphere', unit: 'cm', r: [2, 15] },
  { lead: 'A snow globe is a sphere. It', unit: 'cm', r: [4, 8] },
  { lead: 'An orange is roughly a sphere. It', unit: 'cm', r: [3, 5] },
  { lead: 'A spherical gas tank', unit: 'm', r: [2, 6] },
  { lead: 'A beach ball', unit: 'cm', r: [15, 25] },
  { lead: 'A hamster ball', unit: 'cm', r: [8, 15] },
  { lead: 'A globe of the Earth', unit: 'cm', r: [10, 30] },
  { lead: 'A spherical paper lantern', unit: 'cm', r: [8, 25] },
  { lead: 'A football', unit: 'cm', r: [10, 12] },
]

/**
 * A sphere's volume to 1 decimal place: written as q6 (r 6, 288π, 904.8). Sometimes the
 * diameter is given, so it must be halved first. The second route is Archimedes': a sphere
 * is two thirds of the cylinder that just holds it, radius r and height 2r.
 */
export const sphereVolume: Generator = {
  id: 'sphere-volume',
  subjectId: 'maths',
  topicId: SAV,
  replaces: ['q6'],
  build(r, slot): Draft {
    const c = pick(r, SPHERES)
    const u = c.unit
    const rad = draw(r, (r) => (r() < 0.3 ? int(r, c.r[0], c.r[1] - 1) + 0.5 : int(r, c.r[0], c.r[1])), (x) => clearOfHalf((4 / 3) * Math.PI * x ** 3, 1))
    const diameter = r() < 0.3
    const exact = (4 / 3) * Math.PI * rad ** 3
    const answer = roundTo(exact, 1)
    const cube = rad ** 3
    const given = diameter ? `has diameter ${show(2 * rad)} ${u}` : `has radius ${show(rad)} ${u}`
    const halve = diameter ? `The radius is half the diameter: $${show(2 * rad)} \\div 2 = ${show(rad)}$ ${u}. ` : ''
    const inPi = Number.isInteger(cube) ? ` = ${piTex(4 * cube, 3)}` : ''
    // Second route: two thirds of the cylinder of radius r and height 2r.
    const cylinder = Math.PI * rad * rad * (2 * rad)
    return {
      question: {
        type: 'numeric',
        prompt: `${c.lead} ${given}. What is its volume, in ${u}³ to 1 decimal place?`,
        solution: `${halve}$V = \\frac{4}{3}\\pi r^3 = \\frac{4}{3}\\pi \\times ${show(rad)}^3 = \\frac{4}{3}\\pi \\times ${show(cube)}${inPi} \\approx ${fixed(exact, 1)}$ ${u}³.`,
        markScheme: scheme(slot, ['uses 4/3 π r³', `cubes the radius: ${show(rad)}³ = ${show(cube)}`], fixed(exact, 1)),
        answer,
        tolerance: within(tol(slot), answer),
        units: `${u}³`,
      },
      check: { agrees: near((2 / 3) * cylinder, exact) && roundTo((2 / 3) * cylinder, 1) === answer, detail: `two thirds of the cylinder ${show(roundTo(cylinder, 4))}` },
      values: { r: rad, given: diameter ? 'diameter' : 'radius', unit: u },
    }
  },
}

/** Pythagorean triples, the cone's radius and height as the two shorter sides. */
const TRIPLES: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [12, 35, 37], [9, 40, 41]]

type Build = 'tall' | 'wide' | 'any'

/** A cone with whole-number radius, height and slant height, within `max` cm: a traffic cone is tall, a heap of sand wide. */
function cone(r: Rng, max: number, build: Build = 'any') {
  return draw(
    r,
    (r) => {
      const [a, b, c] = pick(r, TRIPLES)
      const k = int(r, 1, 5)
      const flip = r() < 0.5
      return { rad: k * (flip ? b : a), h: k * (flip ? a : b), l: k * c }
    },
    ({ rad, h, l }) => l <= max && (build === 'any' || (build === 'tall' ? h > rad : rad > h)),
  )
}

const CONES: { lead: string; unit: 'cm' | 'm'; max: number; build: Build }[] = [
  { lead: 'A cone has', unit: 'cm', max: 120, build: 'any' },
  { lead: 'A party hat is a cone with', unit: 'cm', max: 30, build: 'tall' },
  { lead: 'A traffic cone has', unit: 'cm', max: 100, build: 'tall' },
  { lead: 'A funnel is a cone with', unit: 'cm', max: 30, build: 'any' },
  { lead: 'A conical roof on a garden tower is a cone with', unit: 'cm', max: 150, build: 'wide' },
]

/**
 * A cone's slant height, or its vertical height from the slant: written as q8 (r 3, h 4,
 * l 5). The answer is a whole number from a Pythagorean triple; the second route checks the
 * triple in whole numbers, r² + h² = l².
 */
export const coneSlantHeight: Generator = {
  id: 'cone-slant-height',
  subjectId: 'maths',
  topicId: SAV,
  replaces: ['q8'],
  build(r, slot): Draft {
    const c = pick(r, CONES)
    const u = c.unit
    const { rad, h, l } = cone(r, c.max, c.build)
    const findL = r() < 0.65
    const answer = findL ? l : h
    const prompt = findL
      ? `${c.lead} radius ${rad} ${u} and vertical height ${h} ${u}. What is its slant height, in ${u}?`
      : `${c.lead} radius ${rad} ${u} and slant height ${l} ${u}. What is its vertical height, in ${u}?`
    const solution = findL
      ? `The radius, the vertical height and the slant height make a right-angled triangle with the slant height as the hypotenuse: $l^2 = ${rad}^2 + ${h}^2 = ${rad * rad} + ${h * h} = ${l * l}$, so $l = ${l}$ ${u}.`
      : `The radius, the vertical height and the slant height make a right-angled triangle with the slant height as the hypotenuse, so subtract: $h^2 = ${l}^2 - ${rad}^2 = ${l * l} - ${rad * rad} = ${h * h}$, so $h = ${h}$ ${u}.`
    return {
      question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, ['uses Pythagoras'], `${answer} ${u}`), answer, tolerance: within(tol(slot), answer), units: u },
      check: { agrees: rad * rad + h * h === l * l && near(findL ? Math.hypot(rad, h) : Math.sqrt(l * l - rad * rad), answer), detail: `${rad}² + ${h}² = ${l}²` },
      values: { find: findL ? 'slant' : 'height', r: rad, h, l },
    }
  },
}

/**
 * A cone's curved surface area to 1 decimal place: written as q11 (r 3, h 4, 15π, 47.1,
 * grade 8-9). The slant height comes first. The second route is the net: the curved surface
 * unrolls to a sector of radius l and angle 360r/l.
 */
export const coneCurvedSurface: Generator = {
  id: 'cone-curved-surface',
  subjectId: 'maths',
  topicId: SAV,
  replaces: ['q11'],
  build(r, slot): Draft {
    const c = pick(r, CONES)
    const u = c.unit
    const { rad, h, l } = draw(r, (r) => cone(r, c.max, c.build), ({ rad, l }) => clearOfHalf(Math.PI * rad * l, 1))
    const exact = Math.PI * rad * l
    const answer = roundTo(exact, 1)
    const sectorAngle = (360 * rad) / l
    const viaNet = (sectorAngle / 360) * Math.PI * l * l
    return {
      question: {
        type: 'numeric',
        prompt: `${c.lead} ${r() < 0.5 ? 'radius' : 'base radius'} ${rad} ${u} and ${r() < 0.5 ? 'vertical' : 'perpendicular'} height ${h} ${u}. What is its curved surface area, in ${u}² to 1 decimal place?`,
        solution: `The formula needs the slant height, not the vertical height: $l = \\sqrt{${rad}^2 + ${h}^2} = \\sqrt{${l * l}} = ${l}$ ${u}. So $\\pi r l = \\pi \\times ${rad} \\times ${l} = ${rad * l}\\pi \\approx ${fixed(exact, 1)}$ ${u}².`,
        markScheme: scheme(slot, [`finds the slant height, l = ${l}`, 'uses π r l'], fixed(exact, 1)),
        answer,
        tolerance: within(tol(slot), answer),
        units: `${u}²`,
      },
      check: { agrees: near(viaNet, exact) && rad * rad + h * h === l * l, detail: `the net is a sector of radius ${l} and angle ${show(roundTo(sectorAngle, 4))}°: ${show(roundTo(viaNet, 4))}` },
      values: { r: rad, h, l, unit: u },
    }
  },
}

const PYRAMIDS: { lead: (base: string, h: string) => string; unit: 'cm' | 'm'; a: [number, number]; h: [number, number]; rect: boolean }[] = [
  { lead: (b, h) => `A square-based pyramid has a base of side ${b} and vertical height ${h}.`, unit: 'cm', a: [3, 15], h: [4, 30], rect: false },
  { lead: (b, h) => `A glass paperweight is a square-based pyramid with a base of side ${b} and vertical height ${h}.`, unit: 'cm', a: [5, 10], h: [4, 9], rect: false },
  { lead: (b, h) => `A tent is a square-based pyramid with a base of side ${b} and vertical height ${h}.`, unit: 'm', a: [2, 5], h: [2, 4], rect: false },
  { lead: (b, h) => `A rectangle-based pyramid has a base ${b} and vertical height ${h}.`, unit: 'cm', a: [3, 15], h: [4, 30], rect: true },
  { lead: (b, h) => `A roof is a rectangle-based pyramid with a base ${b} and vertical height ${h}.`, unit: 'm', a: [4, 12], h: [2, 6], rect: true },
]

/**
 * A pyramid's volume: written as q9 (base 6 by 6, height 10, 120 cm³). The base is square or
 * rectangular and the answer a whole number. The second route slices the pyramid: Simpson's
 * rule over the height, exact because each slice's area is a quadratic in the height.
 */
export const pyramidVolume: Generator = {
  id: 'pyramid-volume',
  subjectId: 'maths',
  topicId: SAV,
  replaces: ['q9'],
  build(r, slot): Draft {
    const c = pick(r, PYRAMIDS)
    const u = c.unit
    const { a, b, h } = draw(
      r,
      (r) => {
        const a = int(r, c.a[0], c.a[1])
        return { a, b: c.rect ? int(r, c.a[0], c.a[1]) : a, h: int(r, c.h[0], c.h[1]) }
      },
      ({ a, b, h }) => (a * b * h) % 3 === 0 && a * b * h >= 75 && (!c.rect || a !== b),
    )
    const base = a * b
    const answer = (base * h) / 3
    const baseText = c.rect ? `${a} ${u} by ${b} ${u}` : `${a} ${u}`
    const viaSlices = bySlices(h, (z) => a * (1 - z / h) * b * (1 - z / h))
    return {
      question: {
        type: 'numeric',
        prompt: `${c.lead(baseText, `${h} ${u}`)} What is its volume, in ${u}³?`,
        solution: `The base area is $${a} \\times ${b} = ${base}$ ${u}², so $V = \\frac{1}{3} \\times ${base} \\times ${h} = ${answer}$ ${u}³. A pyramid is a third of the prism on the same base with the same height.`,
        markScheme: scheme(slot, [`finds the base area, ${base}`, 'uses ⅓ base × height'], String(answer)),
        answer,
        tolerance: within(tol(slot), answer),
        units: `${u}³`,
      },
      check: { agrees: near(viaSlices, answer), detail: `slices: ${h}/6 × (${base} + 4 × ${show(base / 4)} + 0) = ${show(roundTo(viaSlices, 6))}` },
      values: { a, b, h, unit: u },
    }
  },
}

type Composite = 'cylinder-hemisphere' | 'cone-hemisphere' | 'cylinder-cone'

interface CompositeContext {
  shape: Composite
  /** The solid described, from its measurements. */
  text: (rad: number, h: number, H: number, u: string) => string
  unit: 'cm' | 'm' | 'mm'
  r: [number, number]
  h: [number, number]
  /** The cone's height, where it differs from the cylinder's. */
  H?: [number, number]
  /** Whether it can be asked for its surface: a pencil's sharpened tip is not a whole-number slant. */
  surface: boolean
}
const COMPOSITES: CompositeContext[] = [
  { shape: 'cylinder-hemisphere', text: (rad, h, _H, u) => `A cylinder of radius ${rad} ${u} and height ${h} ${u} has a hemisphere of the same radius on top.`, unit: 'cm', r: [2, 9], h: [3, 20], surface: true },
  { shape: 'cylinder-hemisphere', text: (rad, h, _H, u) => `A grain silo is a cylinder of radius ${rad} ${u} and height ${h} ${u} with a hemispherical roof of the same radius.`, unit: 'm', r: [2, 5], h: [6, 18], surface: true },
  { shape: 'cone-hemisphere', text: (rad, _h, H, u) => `An ice cream is a cone of radius ${rad} ${u} and vertical height ${H} ${u} with a hemisphere of ice cream of the same radius on top.`, unit: 'cm', r: [2, 4], h: [6, 14], surface: true },
  { shape: 'cone-hemisphere', text: (rad, _h, H, u) => `A spinning top is a cone of radius ${rad} ${u} and vertical height ${H} ${u} with a hemisphere of the same radius on top.`, unit: 'cm', r: [2, 6], h: [3, 12], surface: true },
  { shape: 'cylinder-cone', text: (rad, h, H, u) => `A toy rocket is a cylinder of radius ${rad} ${u} and height ${h} ${u} with a cone of the same radius and vertical height ${H} ${u} on top.`, unit: 'cm', r: [2, 6], h: [8, 30], surface: true },
  { shape: 'cylinder-cone', text: (rad, h, H, u) => `A pencil is a cylinder of radius ${rad} ${u} and length ${h} ${u}, sharpened to a cone of the same radius and length ${H} ${u} at one end.`, unit: 'mm', r: [3, 4], h: [60, 170], H: [10, 20], surface: false },
]

/** Composite volumes and surfaces in thirds of π, exact: [cylinder, top, total] numerators over 3. */
function compositeThirds(shape: Composite, rad: number, h: number, H: number) {
  const lower = shape === 'cone-hemisphere' ? rad * rad * H : 3 * rad * rad * h
  const upper = shape === 'cylinder-cone' ? rad * rad * H : 2 * rad ** 3
  return { lower, upper, total: lower + upper }
}

/** The outside surface as a whole multiple of π, the joining circle left out. */
const surfaceThirds = (shape: Composite, rad: number, h: number, l: number) =>
  shape === 'cylinder-hemisphere' ? rad * (3 * rad + 2 * h) : shape === 'cylinder-cone' ? rad * (rad + 2 * h + l) : rad * (l + 2 * rad)

const thirdsTex = (n: number) => (n % 3 === 0 ? piTex(n / 3) : `\\frac{${n}\\pi}{3}`)
/** The same as a mark scheme prints it: 160π, 128π/3. */
const thirdsPlain = (n: number) => (n % 3 === 0 ? `${n / 3}π` : `${n}π/3`)

/**
 * A solid made of two: a cylinder or cone with a hemisphere on top, or a cylinder with a
 * cone. Written as q12 (cylinder r 4, h 10 with a hemisphere, total volume 636.7), q16 (the
 * same solid's outside surface, 402.1) and q20 (its volume as one fraction of π, 608π/3), all
 * on the advanced sheet. Each slot keeps its task. Volumes are checked by slicing each part
 * (Simpson's rule, exact for these solids), surfaces by adding each face separately.
 */
export const compositeSolid: Generator = {
  id: 'composite-solid',
  subjectId: 'maths',
  topicId: SAV,
  replaces: ['q12', 'q16', 'q20'],
  build(r, slot): Draft {
    const task = slot.id === 'q16' ? 'surface' : slot.id === 'q20' ? 'exact' : 'volume'
    const c = pick(r, task === 'surface' ? COMPOSITES.filter((c) => c.surface) : COMPOSITES)
    const u = c.unit
    const s = c.shape
    // A cone's slant height must be whole for a surface, so its radius and height come from a triple.
    const drawn = draw(
      r,
      (r) => {
        if (task === 'surface' && s !== 'cylinder-hemisphere') {
          const [a, b, l] = pick(r, TRIPLES.slice(0, 3))
          const k = int(r, 1, 2)
          const flip = r() < 0.5
          return { rad: (flip ? b : a) * k, H: (flip ? a : b) * k, h: int(r, c.h[0], c.h[1]), l: l * k }
        }
        const Hr = c.H ?? c.h
        return { rad: int(r, c.r[0], c.r[1]), h: int(r, c.h[0], c.h[1]), H: int(r, Hr[0], Hr[1]), l: 0 }
      },
      ({ rad, h, H, l }) => {
        if (rad > 2 * c.r[1]) return false
        const { total } = compositeThirds(s, rad, h, H)
        if (task === 'exact') return total % 3 !== 0
        if (task === 'volume') return clearOfHalf((total * Math.PI) / 3, 1)
        return clearOfHalf(surfaceThirds(s, rad, h, l) * Math.PI, 1)
      },
    )
    const { rad, h, H } = drawn
    const l = drawn.l || Math.hypot(rad, H)
    const what = c.text(rad, h, H, u)
    // The parts, exactly, in thirds of π.
    const { lower, upper, total } = compositeThirds(s, rad, h, H)
    const lowerName = s === 'cone-hemisphere' ? 'Cone' : 'Cylinder'
    const upperName = s === 'cylinder-cone' ? 'Cone' : 'Hemisphere'
    const lowerWork = s === 'cone-hemisphere' ? `$\\frac{1}{3}\\pi \\times ${rad}^2 \\times ${H} = ${thirdsTex(lower)}$` : `$\\pi \\times ${rad}^2 \\times ${h} = ${thirdsTex(lower)}$`
    const upperWork = s === 'cylinder-cone' ? `$\\frac{1}{3}\\pi \\times ${rad}^2 \\times ${H} = ${thirdsTex(upper)}$` : `half of $\\frac{4}{3}\\pi \\times ${rad}^3$, which is $\\frac{2}{3} \\times ${rad ** 3}\\pi = ${thirdsTex(upper)}$`
    // Second route for a volume: each part sliced (Simpson's rule), no volume formula.
    const disc = (radius: number) => Math.PI * radius * radius
    const lowerSliced = s === 'cone-hemisphere' ? bySlices(H, (z) => disc(rad * (1 - z / H))) : bySlices(h, () => disc(rad))
    const upperSliced = s === 'cylinder-cone' ? bySlices(H, (z) => disc(rad * (1 - z / H))) : bySlices(rad, (z) => Math.PI * (rad * rad - z * z))
    const sliced = lowerSliced + upperSliced
    const volume = (total * Math.PI) / 3

    if (task === 'exact') {
      const common = lower % 3 === 0 ? `$${thirdsTex(lower)} = \\frac{${lower}\\pi}{3}$` : upper % 3 === 0 ? `$${thirdsTex(upper)} = \\frac{${upper}\\pi}{3}$` : 'both parts are already in thirds'
      const answerText = `${total}π/3`
      return {
        question: {
          type: 'short-text',
          prompt: `${what} Find the total volume. Give your answer in terms of $\\pi$, as a single fraction.`,
          solution: `${lowerName}: ${lowerWork}. ${upperName}: ${upperWork}. Adding needs a common denominator: ${common}, so the total is $\\frac{${lower}\\pi + ${upper}\\pi}{3}$ = **${answerText}** ${u}³, which is about ${fixed(volume, 1)} ${u}³. Written as (${total}/3)π it is the same answer.`,
          markScheme: scheme(slot, [`${lowerName.toLowerCase()} ${thirdsPlain(lower)}`, `${upperName.toLowerCase()} ${thirdsPlain(upper)}`, 'common denominator'], answerText),
          accepted: [answerText, `(${total}/3)π`],
        },
        check: { agrees: near(sliced, volume) && total % 3 !== 0, detail: `sliced: ${show(roundTo(lowerSliced, 4))} + ${show(roundTo(upperSliced, 4))} = ${show(roundTo(sliced, 4))}` },
        values: { task, shape: s, r: rad, h, H, unit: u },
      }
    }

    if (task === 'volume') {
      const answer = roundTo(volume, 1)
      return {
        question: {
          type: 'numeric',
          prompt: `${what} What is the total volume, in ${u}³ to 1 decimal place?`,
          solution: `${lowerName}: ${lowerWork}. ${upperName}: ${upperWork}. Total $${thirdsTex(lower)} + ${thirdsTex(upper)} = ${thirdsTex(total)} \\approx ${fixed(volume, 1)}$ ${u}³.`,
          markScheme: scheme(slot, [`${lowerName.toLowerCase()} volume`, s === 'cylinder-cone' ? 'a third of the cylinder on the same base' : 'half a sphere'], fixed(volume, 1)),
          answer,
          tolerance: within(tol(slot), answer),
          units: `${u}³`,
        },
        check: { agrees: near(sliced, volume) && roundTo(sliced, 1) === answer, detail: `sliced: ${show(roundTo(lowerSliced, 4))} + ${show(roundTo(upperSliced, 4))} = ${show(roundTo(sliced, 4))}` },
        values: { task, shape: s, r: rad, h, H, unit: u },
      }
    }

    // The outside surface, in whole multiples of π: no joining circle.
    let faces: { name: string; coef: number; tex: string }[]
    if (s === 'cylinder-hemisphere') {
      faces = [
        { name: 'curved cylinder', coef: 2 * rad * h, tex: `2\\pi \\times ${rad} \\times ${h}` },
        { name: 'base', coef: rad * rad, tex: `\\pi \\times ${rad}^2` },
        { name: 'hemisphere', coef: 2 * rad * rad, tex: `2\\pi \\times ${rad}^2` },
      ]
    } else if (s === 'cylinder-cone') {
      faces = [
        { name: 'curved cylinder', coef: 2 * rad * h, tex: `2\\pi \\times ${rad} \\times ${h}` },
        { name: 'base', coef: rad * rad, tex: `\\pi \\times ${rad}^2` },
        { name: `curved cone (slant height $\\sqrt{${rad}^2 + ${H}^2} = ${l}$)`, coef: rad * l, tex: `\\pi \\times ${rad} \\times ${l}` },
      ]
    } else {
      faces = [
        { name: `curved cone (slant height $\\sqrt{${rad}^2 + ${H}^2} = ${l}$)`, coef: rad * l, tex: `\\pi \\times ${rad} \\times ${l}` },
        { name: 'hemisphere', coef: 2 * rad * rad, tex: `2\\pi \\times ${rad}^2` },
      ]
    }
    const coef = faces.reduce((t, f) => t + f.coef, 0)
    const exact = coef * Math.PI
    const answer = roundTo(exact, 1)
    const okRound = clearOfHalf(exact, 1)
    // Second route: each face in square units on its own, added, with the factorised formula
    // for the whole as the other side.
    const byFaces = faces.reduce((t, f) => t + f.coef * Math.PI, 0)
    const formula = s === 'cylinder-hemisphere' ? Math.PI * rad * (3 * rad + 2 * h) : s === 'cylinder-cone' ? Math.PI * rad * (rad + 2 * h + l) : Math.PI * rad * (l + 2 * rad)
    const count = faces.length === 3 ? 'three' : 'two'
    return {
      question: {
        type: 'numeric',
        prompt: `${what} What is the total surface area, in ${u}² to 1 decimal place?`,
        solution: `${faces.map((f, i) => `${i === 0 ? f.name[0]!.toUpperCase() + f.name.slice(1) : f.name} $${f.tex} = ${piTex(f.coef)}$`).join(', ')}, and no joining circle: it is inside the solid. Total $${piTex(coef)} \\approx ${fixed(exact, 1)}$ ${u}².`,
        markScheme: scheme(slot, [`adds the ${count} outside surfaces`, 'omits the joining circle'], fixed(exact, 1)),
        answer,
        tolerance: within(tol(slot), answer),
        units: `${u}²`,
      },
      check: { agrees: okRound && near(byFaces, formula) && near(formula, exact), detail: `face by face ${show(roundTo(byFaces, 4))}, factorised ${show(roundTo(formula, 4))}` },
      values: { task, shape: s, r: rad, h, H, unit: u },
    }
  },
}

// ---------------------------------------------------------------- 3D shapes

const SOLIDS = '3d-shapes-plans-and-elevations'

/** A polyhedron as its faces, each a list of vertex labels; edges and vertices are counted from them. */
type Faces = string[][]

const ring = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`)

/** Built face by face, so the counts come from the faces and not from a formula. */
export function polyhedron(kind: 'prism' | 'pyramid' | 'bipyramid', n: number): Faces {
  const top = ring('t', n)
  const bottom = ring('b', n)
  const sides = Array.from({ length: n }, (_, i) => i)
  if (kind === 'prism') return [top, bottom, ...sides.map((i) => [top[i]!, top[(i + 1) % n]!, bottom[(i + 1) % n]!, bottom[i]!])]
  if (kind === 'pyramid') return [bottom, ...sides.map((i) => [bottom[i]!, bottom[(i + 1) % n]!, 'apex'])]
  return [...sides.map((i) => [bottom[i]!, bottom[(i + 1) % n]!, 'up']), ...sides.map((i) => [bottom[i]!, bottom[(i + 1) % n]!, 'down'])]
}

/** Faces, edges and vertices counted from a list of faces. */
export function countFaces(faces: Faces) {
  const edges = new Set<string>()
  const vertices = new Set<string>()
  for (const f of faces) {
    f.forEach((v, i) => {
      vertices.add(v)
      const w = f[(i + 1) % f.length]!
      edges.add([v, w].sort().join('-'))
    })
  }
  return { faces: faces.length, edges: edges.size, vertices: vertices.size }
}

const POLYGON: Record<number, string> = { 3: 'triangle', 4: 'square', 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon', 9: 'nonagon', 10: 'decagon', 12: 'dodecagon' }
const ADJ: Record<number, string> = { 3: 'triangular', 4: 'square', 5: 'pentagonal', 6: 'hexagonal', 7: 'heptagonal', 8: 'octagonal', 9: 'nonagonal', 10: 'decagonal', 12: 'dodecagonal' }

function solidName(kind: 'prism' | 'pyramid', n: number): string {
  if (kind === 'prism') return n === 4 ? 'cuboid' : ADJ[n] ? `${ADJ[n]} prism` : `prism with ${n}-sided ends`
  return n === 3 ? 'triangular-based pyramid' : n === 4 ? 'square-based pyramid' : ADJ[n] ? `${ADJ[n]} pyramid` : `pyramid on a ${n}-sided base`
}
const article = (word: string) => (/^[aeiou]/.test(word) ? 'an' : 'a')

type Count = 'faces' | 'edges' | 'vertices'
const COUNTS: Count[] = ['faces', 'edges', 'vertices']

const PRISM_THINGS = ['A paperweight', 'A gift box', 'A chocolate box', 'A candle', 'A glass ornament', 'A wooden block', 'A pencil case', 'A storage box', 'A crystal', 'A doorstop']
const PYRAMID_THINGS = ['A paperweight', 'A roof', 'A tent', 'A glass ornament', 'A sculpture', 'A crystal', 'A spire', 'A candle', 'A chocolate', 'A wooden block']

/** Each written slot's solid and the sizes of base it uses. */
const COUNT_SLOT: Record<string, { kind: 'prism' | 'pyramid'; n: number[] }> = {
  q4: { kind: 'prism', n: [3, 4, 5, 6] },
  q6: { kind: 'pyramid', n: [3, 4, 5, 6] },
  q7: { kind: 'prism', n: [5, 6, 7, 8, 9, 10, 12] },
  q8: { kind: 'pyramid', n: [5, 6, 7, 8, 9, 10, 12] },
}

/**
 * Faces, edges or vertices of a prism or a pyramid: written as q4 (triangular prism, faces)
 * and q6 (square-based pyramid, edges) on the core sheet, q7 (hexagonal prism, edges, 2
 * marks) and q8 (pentagonal pyramid, vertices) on the higher one. Each slot keeps its solid;
 * which count is asked turns with `turn`, so the two on one sheet ask different things. The
 * second route builds the solid face by face and counts what it has, and checks Euler.
 */
export const solidCounts: Generator = {
  id: 'solid-counts',
  subjectId: 'maths',
  topicId: SOLIDS,
  replaces: ['q4', 'q6', 'q7', 'q8'],
  build(r, slot, turn): Draft {
    const { kind, n: sizes } = COUNT_SLOT[slot.id] ?? COUNT_SLOT.q4!
    const count = COUNTS[turn % 3]!
    const n = pick(r, sizes)
    const name = solidName(kind, n)
    const poly = POLYGON[n]!
    const paren = n >= 5 ? ` (Its ${kind === 'prism' ? 'end' : 'base'} is ${article(poly)} ${poly}, with ${n} sides.)` : ''
    const thing = r() < 0.35 ? null : pick(r, kind === 'prism' ? PRISM_THINGS : PYRAMID_THINGS)
    const prompt = thing
      ? `${thing} is shaped like ${article(name)} ${name}.${paren} How many ${count} does it have?`
      : `How many ${count} does ${article(name)} ${name} have?${paren}`
    const end = kind === 'prism' ? (n === 4 ? 'rectangular' : ADJ[n]!) : ''
    let answer: number, solution: string, method: string
    if (kind === 'prism') {
      if (count === 'faces') {
        answer = n + 2
        solution = `2 ${end} ends and ${n} rectangles joining them: $2 + ${n} = ${answer}$, so **${answer}** faces.`
        method = `counts the 2 ends and the ${n} rectangles`
      } else if (count === 'edges') {
        answer = 3 * n
        solution = `${n} edges round each ${end} end and ${n} running along the prism: $${n} + ${n} + ${n} = ${answer}$ edges, which is $3n$ with $n = ${n}$.`
        method = 'counts the edges round both ends and along the length'
      } else {
        answer = 2 * n
        solution = `${n} corners at each end: $2 \\times ${n} = ${answer}$, so **${answer}** vertices.`
        method = `counts ${n} vertices at each end`
      }
    } else if (count === 'faces') {
      answer = n + 1
      solution = `The base and ${n} triangles meeting at the apex: $1 + ${n} = ${answer}$, so **${answer}** faces.`
      method = `counts the base and the ${n} triangles`
    } else if (count === 'edges') {
      answer = 2 * n
      solution = `${n} edges round the base and ${n} sloping up to the apex: $${n} + ${n} = ${answer}$, so **${answer}** edges.`
      method = 'counts the edges round the base and up to the apex'
    } else {
      answer = n + 1
      solution = `${n} corners round the base and 1 apex: $${n} + 1 = ${answer}$, so **${answer}** vertices.`
      method = 'counts the corners of the base and the apex'
    }
    const built = countFaces(polyhedron(kind, n))
    return {
      question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [method], String(answer)), answer, tolerance: 0 },
      check: {
        agrees: built[count] === answer && built.faces + built.vertices - built.edges === 2,
        detail: `built face by face: ${built.faces} faces, ${built.edges} edges, ${built.vertices} vertices`,
      },
      values: { kind, n, count },
    }
  },
}

interface Solid {
  name: string
  kind: 'prism' | 'pyramid' | 'bipyramid'
  n: number
}
const EULER_SOLIDS: Solid[] = [
  ...Array.from({ length: 18 }, (_, i) => ({ name: solidName('prism', i + 3), kind: 'prism' as const, n: i + 3 })),
  ...Array.from({ length: 18 }, (_, i) => ({ name: solidName('pyramid', i + 3), kind: 'pyramid' as const, n: i + 3 })),
  ...Array.from({ length: 10 }, (_, i) => ({ name: `pair of ${ADJ[i + 3] ?? `${i + 3}-sided`}${i + 3 === 4 ? '-based' : ''} pyramids joined base to base`, kind: 'bipyramid' as const, n: i + 3 })),
]
const LETTER: Record<Count, string> = { faces: 'F', vertices: 'V', edges: 'E' }

/**
 * Euler's formula, F + V − E = 2, with one count unknown: written as q15 (V 12, E 18, find F,
 * grade 8-9). Any of the three can be the unknown. The second route builds a solid with the
 * two given counts face by face and counts the third.
 */
export const eulerFormula: Generator = {
  id: 'euler-formula',
  subjectId: 'maths',
  topicId: SOLIDS,
  replaces: ['q15'],
  build(r, slot): Draft {
    const solid = pick(r, EULER_SOLIDS)
    const unknown = pick(r, COUNTS)
    const built = countFaces(polyhedron(solid.kind, solid.n))
    // The counts from the solid's formulas; the build checks them.
    const F = solid.kind === 'prism' ? solid.n + 2 : solid.kind === 'pyramid' ? solid.n + 1 : 2 * solid.n
    const V = solid.kind === 'prism' ? 2 * solid.n : solid.kind === 'pyramid' ? solid.n + 1 : solid.n + 2
    const E = solid.kind === 'pyramid' ? 2 * solid.n : 3 * solid.n
    const given = COUNTS.filter((c) => c !== unknown)
    const val: Record<Count, number> = { faces: F, vertices: V, edges: E }
    const answer = unknown === 'faces' ? 2 - V + E : unknown === 'vertices' ? 2 - F + E : F + V - 2
    const sum = unknown === 'faces' ? `F = 2 - V + E = 2 - ${V} + ${E}` : unknown === 'vertices' ? `V = 2 - F + E = 2 - ${F} + ${E}` : `E = F + V - 2 = ${F} + ${V} - 2`
    const lead = r() < 0.5 ? 'A polyhedron without holes' : 'A solid with flat faces and no holes'
    return {
      question: {
        type: 'numeric',
        prompt: `For a polyhedron without holes, such as every prism and pyramid, Euler's formula says $F + V - E = 2$, where $F$ is the number of faces, $V$ the vertices and $E$ the edges. ${lead} has ${val[given[0]!]} ${given[0]} and ${val[given[1]!]} ${given[1]}. How many ${unknown} does it have?`,
        solution: `$${sum} = ${answer}$. (${article(solid.name).replace(/^a/, 'A')} ${solid.name} fits: ${F} faces, ${E} edges and ${V} vertices.)`,
        markScheme: scheme(slot, [sum.split(' = ').slice(0, 1).concat(sum.split(' = ').slice(-1)).join(' = ')], String(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: built[unknown] === answer && built.faces === F && built.edges === E && built.vertices === V, detail: `${solid.name} built face by face: ${built.faces} F, ${built.vertices} V, ${built.edges} E` },
      values: { solid: solid.name, unknown, [LETTER[given[0]!]]: val[given[0]!], [LETTER[given[1]!]]: val[given[1]!] },
    }
  },
}

const PAIRS: Record<'prism' | 'pyramid', [Count, Count][]> = {
  pyramid: [['edges', 'faces'], ['edges', 'vertices'], ['faces', 'edges'], ['vertices', 'edges']],
  prism: [['edges', 'vertices'], ['edges', 'faces'], ['vertices', 'edges'], ['vertices', 'faces'], ['faces', 'edges'], ['faces', 'vertices']],
}
const REVERSE_LEAD: Record<'prism' | 'pyramid', string[]> = {
  pyramid: ['A pyramid', 'A pyramid', 'A glass ornament shaped like a pyramid', 'A pyramid-shaped roof', 'A crystal shaped like a pyramid', 'A pyramid-shaped tent'],
  prism: ['A prism', 'A prism', 'A glass ornament shaped like a prism', 'A gift box shaped like a prism', 'A crystal shaped like a prism', 'A prism-shaped tower'],
}
/** n from a count, for a prism or a pyramid on an n-sided base. */
const RULE: Record<'prism' | 'pyramid', Record<Count, { expr: string; of: (n: number) => number; what: string }>> = {
  prism: {
    faces: { expr: 'n + 2', of: (n) => n + 2, what: 'the 2 ends and $n$ rectangles' },
    edges: { expr: '3n', of: (n) => 3 * n, what: '$n$ round each end and $n$ along the length' },
    vertices: { expr: '2n', of: (n) => 2 * n, what: '$n$ at each end' },
  },
  pyramid: {
    faces: { expr: 'n + 1', of: (n) => n + 1, what: 'the base and $n$ triangles' },
    edges: { expr: '2n', of: (n) => 2 * n, what: '$n$ round the base and $n$ up to the apex' },
    vertices: { expr: 'n + 1', of: (n) => n + 1, what: '$n$ round the base and the apex' },
  },
}

/**
 * One count of a prism or pyramid from another: written as q16 (a pyramid with 10 edges, how
 * many faces) and q17 (a prism with 24 edges, how many vertices), both grade 8-9. Each slot
 * keeps its solid; which count is given and which asked varies. The second route builds the
 * solid with that base face by face.
 */
export const reverseCounts: Generator = {
  id: 'reverse-counts',
  subjectId: 'maths',
  topicId: SOLIDS,
  replaces: ['q16', 'q17'],
  build(r, slot): Draft {
    const kind = slot.id === 'q17' ? 'prism' : 'pyramid'
    const [given, wanted] = pick(r, PAIRS[kind])
    const n = int(r, 3, 20)
    const g = RULE[kind][given]
    const w = RULE[kind][wanted]
    const value = g.of(n)
    const answer = w.of(n)
    // A 20-sided tent is not a thing: past a decagon it is just a prism or a pyramid.
    const lead = n <= 10 ? pick(r, REVERSE_LEAD[kind]) : REVERSE_LEAD[kind][0]!
    const name = solidName(kind, n)
    const solveN = g.expr === 'n + 2' ? `$n = ${value} - 2 = ${n}$` : g.expr === 'n + 1' ? `$n = ${value} - 1 = ${n}$` : `$n = ${n}$`
    const solution = `A ${kind === 'prism' ? 'prism with $n$-sided ends' : 'pyramid on an $n$-sided base'} has $${g.expr}$ ${given} (${g.what}), so $${g.expr} = ${value}$ and ${solveN}: it is ${article(name)} ${name}. It has $${w.expr} = ${answer}$ ${wanted}.`
    const built = countFaces(polyhedron(kind, n))
    return {
      question: {
        type: 'numeric',
        prompt: `${lead} has ${value} ${given}. How many ${wanted} does it have?`,
        solution,
        markScheme: scheme(slot, [`${g.expr} = ${value}, so the ${kind === 'prism' ? 'end' : 'base'} has ${n} sides`], String(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: built[given] === value && built[wanted] === answer, detail: `${name} built face by face: ${built.faces} F, ${built.edges} E, ${built.vertices} V` },
      values: { kind, n, given, wanted },
    }
  },
}

/**
 * A prism's volume from its plan and front elevation: written as q13 (an L-shaped front
 * elevation, 6 by 2 with 2 by 3 on its end, 4 deep, 72 cm³). The upright part stands on the
 * left or the right. The second route cuts the L the other way, into two upright pieces.
 */
export const prismFromViews: Generator = {
  id: 'prism-from-views',
  subjectId: 'maths',
  topicId: SOLIDS,
  replaces: ['q13'],
  build(r, slot): Draft {
    const side = r() < 0.5 ? 'left' : 'right'
    const { W, a, w, b, D } = draw(r, (r) => ({ W: int(r, 4, 12), a: int(r, 1, 5), w: int(r, 1, 6), b: int(r, 1, 6), D: int(r, 2, 10) }), ({ W, w }) => w <= W - 2)
    const area = W * a + w * b
    const answer = area * D
    // Second route: cut upright instead, a column w wide and (a + b) tall beside a slab.
    const upright = (w * (a + b) + (W - w) * a) * D
    return {
      question: {
        type: 'numeric',
        prompt: `A prism has a front elevation that is an L-shape: a rectangle ${W} cm wide and ${a} cm tall along the bottom, with a rectangle ${w} cm wide and ${b} cm tall standing on its ${side}-hand end. Its plan is a rectangle ${W} cm by ${D} cm, with a line across it ${w} cm from the ${side}-hand end. Work out the volume of the prism, in cm³.`,
        solution: `The front elevation is the cross-section. Its area is $${W} \\times ${a} + ${w} \\times ${b} = ${W * a} + ${w * b} = ${area}$ cm². The plan shows the prism is ${D} cm deep. Volume $= ${area} \\times ${D} = ${answer}$ cm³. (Multiplying $${W} \\times ${a + b} \\times ${D}$ would count the empty space above the step.)`,
        markScheme: scheme(slot, [`area of the L cross-section: ${W * a} + ${w * b}`, `multiplies the area by the depth ${D} from the plan`], String(answer)),
        answer,
        tolerance: 0,
        units: 'cm³',
      },
      check: { agrees: upright === answer && W * (a + b) * D !== answer, detail: `cut upright: (${w} × ${a + b} + ${W - w} × ${a}) × ${D} = ${upright}` },
      values: { side, W, a, w, b, D },
    }
  },
}

/**
 * A cylinder's volume from its elevations: written as q23 (standing on its end, front
 * elevation 6 wide and 10 tall, 90π, 282.7). It stands on its end or lies on its side, so
 * the diameter is the rectangle's width or its height. The second route is half the curved
 * surface times the radius.
 */
export const cylinderFromViews: Generator = {
  id: 'cylinder-from-views',
  subjectId: 'maths',
  topicId: SOLIDS,
  replaces: ['q23'],
  build(r, slot): Draft {
    const standing = r() < 0.55
    const { d, h } = draw(r, (r) => ({ d: int(r, 2, 20), h: int(r, 3, 30) }), ({ d, h }) => d !== h && clearOfHalf(Math.PI * (d / 2) ** 2 * h, 1) && Math.PI * (d / 2) ** 2 * h >= 10)
    const rad = d / 2
    const exact = Math.PI * rad * rad * h
    const answer = roundTo(exact, 1)
    const wrong = Math.PI * d * d * h
    const prompt = standing
      ? `A cylinder stands on its end. Its plan is a circle, and its front elevation is a rectangle ${d} cm wide and ${h} cm tall. Work out the volume of the cylinder, in cm³, to 1 decimal place.`
      : `A cylinder lies on its side. Its side elevation is a circle, and its front elevation is a rectangle ${h} cm wide and ${d} cm tall. Work out the volume of the cylinder, in cm³, to 1 decimal place.`
    const where = standing ? 'width' : 'height'
    const length = standing ? 'height' : 'length'
    const solution = `The ${where} of the front elevation is the **diameter**, so the radius is $${d} \\div 2 = ${show(rad)}$ cm. The ${length} is ${h} cm. Volume $= \\pi r^2 h = \\pi \\times ${sq(rad)} \\times ${h} = ${show(rad * rad * h)}\\pi \\approx ${fixed(exact, 1)}$ cm³. (Using ${d} as the radius gives about ${Math.round(wrong)} cm³, four times too much.)`
    const viaCurved = (2 * Math.PI * rad * h * rad) / 2
    return {
      question: {
        type: 'numeric',
        prompt,
        solution,
        markScheme: scheme(slot, [`radius ${show(rad)} from the ${where} of ${d}`, `π × ${show(rad)}² × ${h}`], fixed(exact, 1)),
        answer,
        tolerance: within(tol(slot), answer),
        units: 'cm³',
      },
      check: { agrees: near(viaCurved, exact) && roundTo(viaCurved, 1) === answer, detail: `half the curved surface times the radius: ${show(roundTo(viaCurved, 4))}` },
      values: { standing: standing ? 'end' : 'side', d, h },
    }
  },
}

export const mensurationGenerators: Generator[] = [
  sectorMeasures,
  roundPerimeter,
  sectorAngleFromPi,
  sectorAreaExact,
  cylinderMeasures,
  cylinderVolumeExact,
  sphereVolume,
  coneSlantHeight,
  coneCurvedSurface,
  pyramidVolume,
  compositeSolid,
  solidCounts,
  eulerFormula,
  reverseCounts,
  prismFromViews,
  cylinderFromViews,
]
