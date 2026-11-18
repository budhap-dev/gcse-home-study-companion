/** One numbered content point of a board's specification, in the board's words. */
export interface SpecPoint {
  code: string
  text: string
}

/** A run of points under one heading of the specification ("Number", "4.1 Atomic structure"). */
export interface SpecSection {
  id: string
  name: string
  points: SpecPoint[]
}
