/** Topic status from PRD section 6. Order matters: later is better. */
export const TOPIC_STATUSES = ['not-secure', 'developing', 'secure', 'grade-9-ready'] as const
export type TopicStatus = (typeof TOPIC_STATUSES)[number]

export const STATUS_LABEL: Record<TopicStatus, string> = {
  'not-secure': 'Not secure',
  developing: 'Developing',
  secure: 'Secure',
  'grade-9-ready': 'Grade 9 ready',
}

/** Colour is never the only carrier of meaning; each status also has a shape in the UI. */
export const STATUS_COLOUR: Record<TopicStatus, string> = {
  'not-secure': '#D25B3B',
  developing: '#D9A21B',
  secure: '#2E8B57',
  'grade-9-ready': '#1F3A93',
}

/**
 * Default thresholds per PRD section 6. These are configurable per subject in the
 * database; this copy exists for tests and for rendering explanations in the UI.
 * The database function compute_topic_status is the source of truth.
 */
export const DEFAULT_THRESHOLDS = {
  developingQuizMin: 50,
  secureQuizMin: 80,
  secureHigherWorksheetMin: 70,
  grade9QuizMin: 90,
  grade9AdvancedWorksheetMin: 75,
  decayAfterWeeks: 6,
} as const
