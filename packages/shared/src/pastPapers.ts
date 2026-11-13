import { z } from 'zod'

/**
 * Past papers (backlog section 14, 13 November 2026): an index of each board's own Higher-tier
 * papers by subject and series. The app holds no question text, only links to the board's PDFs
 * and, from box 2 on, which topic each question tests: the papers belong to AQA and Pearson,
 * and the app and its repository are public.
 */

/** Only the boards' own sites, never a mirror. */
export const BOARD_HOSTS = ['www.aqa.org.uk', 'qualifications.pearson.com'] as const

const BoardUrl = z
  .string()
  .url()
  .refine((u) => {
    const url = new URL(u)
    return url.protocol === 'https:' && (BOARD_HOSTS as readonly string[]).includes(url.hostname)
  }, 'an https link on the board’s own site')

export const PastPaperLinkKind = z.enum(['question-paper', 'mark-scheme', 'examiner-report', 'insert', 'answers', 'audio'])
export type PastPaperLinkKind = z.infer<typeof PastPaperLinkKind>

export const PastPaperLink = z.object({
  kind: PastPaperLinkKind,
  /** As the board names it, shortened: "Equation sheet", "Source booklet". */
  label: z.string().min(1).optional(),
  url: BoardUrl,
})
export type PastPaperLink = z.infer<typeof PastPaperLink>

/**
 * One question of a paper and what it tests (section 14, boxes 2 to 5): its number, the marks
 * the paper prints for it, and the app's topics it draws on, the main one first. Read from the
 * board's own PDF; an empty list means no topic in the app teaches it yet.
 */
export const PastQuestion = z.object({
  n: z.number().int().positive(),
  marks: z.number().int().positive(),
  topics: z.array(z.string().regex(/^[a-z0-9-]+$/)),
})
export type PastQuestion = z.infer<typeof PastQuestion>

export const PastPaper = z
  .object({
    /** The board's paper code: "1H", "2", "1A", "3". */
    id: z.string().regex(/^[0-9A-Z]{1,3}$/),
    /** "Paper 1 · Non-calculator", "Paper 2 · Computing concepts". */
    name: z.string().min(1),
    links: z.array(PastPaperLink).min(1),
    /** The paper's total, as its cover prints it. Required once its questions are tagged. */
    marks: z.number().int().positive().optional(),
    /** Every question in order, once the paper is tagged. */
    questions: z.array(PastQuestion).optional(),
  })
  .superRefine((p, ctx) => {
    if (!p.questions) return
    if (p.marks === undefined) ctx.addIssue({ code: 'custom', message: `paper ${p.id}: a tagged paper needs its total marks` })
    p.questions.forEach((q, i) => {
      if (q.n !== i + 1) ctx.addIssue({ code: 'custom', message: `paper ${p.id}: question ${i + 1} is numbered ${q.n}` })
      if (new Set(q.topics).size !== q.topics.length) ctx.addIssue({ code: 'custom', message: `paper ${p.id} Q${q.n}: a topic twice` })
    })
    const sum = p.questions.reduce((t, q) => t + q.marks, 0)
    if (p.marks !== undefined && sum !== p.marks) ctx.addIssue({ code: 'custom', message: `paper ${p.id}: questions add up to ${sum}, not ${p.marks}` })
  })
export type PastPaper = z.infer<typeof PastPaper>

export const PastSeries = z.object({
  /** "2024-06" for an exam series; "sample" for the board's sample set. */
  id: z.string().regex(/^(20\d\d-(01|06|11)|sample)$/),
  /** "June 2024", "Sample papers". */
  label: z.string().min(1),
  /** Said once above the series' papers, when something about it needs saying. */
  note: z.string().min(1).optional(),
  papers: z.array(PastPaper).min(1),
  /** Sheets for the whole series rather than one paper: an equation sheet, a periodic table. */
  sheets: z.array(PastPaperLink).default([]),
})
export type PastSeries = z.infer<typeof PastSeries>

export const PastPaperIndex = z.object({
  subjectId: z.string().regex(/^[a-z0-9-]+$/),
  /** "AQA 8463", "Pearson Edexcel 1MA1". */
  board: z.string().min(1),
  /** Where the board lists them, for anything not linked here. */
  finder: BoardUrl,
  /** Said once at the top of the subject's list. */
  note: z.string().min(1).optional(),
  /**
   * Somewhere to practise what the papers ask, outside the board: Computer Science links the
   * family's own Learn C# app for Paper 1's programming (owner's choice, 13 November 2026).
   */
  practice: z.object({ label: z.string().min(1), url: z.string().url().startsWith('https://') }).optional(),
  /** Newest first, the sample set last. */
  series: z.array(PastSeries),
  /** When the links were last read from the board's finder, YYYY-MM-DD. */
  checked: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})
export type PastPaperIndex = z.infer<typeof PastPaperIndex>
