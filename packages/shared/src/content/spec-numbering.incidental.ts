/**
 * Points a topic lists that no lesson step carries, so the "every point is taught" check
 * in spec-numbering.test.ts lets them through. Each says where the lesson meets the point,
 * so the exception can be checked by reading that step. The test fails when an entry goes
 * stale: when a step does come to carry the point, the entry must go.
 */

/** Points the lesson uses rather than teaches as a step's main content. */
export const INCIDENTAL_POINTS: Record<string, Record<string, string>> = {
  'covalent-bonding': {
    '4.2.2.5': 's5 gives polymers one sentence (long chains, so solids at room temperature); addition-and-condensation-polymers teaches the molecules',
  },
  'arrays-and-records': {
    '3.1.1': 'the trace tables in s3 and the grade 9 step use tracing as a tool on arrays',
  },
  'expanding-and-the-binomial-expansion': {
    '2.1': 'the basic laws of algebra are used, not taught, when a minus is spread over a bracket in s1 and s6; 8365 lists them as expected background',
  },
  'equation-of-a-circle': {
    A9: 'a perpendicular gradient and a line through a point are the method for the A16 tangent in s3 and s4',
  },
  'properties-of-angles': {
    G1: 'one sentence of s3: the arrows on a diagram are what mark lines as parallel',
  },
  'simplifying-and-expanding-expressions': {
    A3: 's1 names terms and expressions in passing; identities-and-rearranging-formulae teaches the vocabulary',
  },
  'solving-quadratic-equations': {
    A4: 'factorising, taught in its own topic, is the tool in s1, s3 and the grade 9 step',
  },
  'vector-arithmetic': {
    G24: 's1 reads a column vector as a movement across and up, without naming it a translation',
  },
}

/**
 * Points a topic lists that nothing in the pack yet teaches: content still to write. They
 * are kept on the topic, because the topic is where the board expects them, and named
 * here so the gap is visible rather than hidden behind a number.
 */
export const UNTAUGHT_POINTS: Record<string, Record<string, string>> = {
  'ratio-and-proportion': {
    R7: 'proportion as equality of ratios: no step, and no other Maths topic, teaches it',
  },
}
