/**
 * Which units each written exam paper draws on, for the specification's order (18 November
 * 2026, step 2): a teacher's view of a subject is by paper, where the school's is by year.
 *
 * Every split here is copied from the board's own specification, read from the PDF on
 * 18 November 2026, never from memory:
 * - AQA 8463 Physics 2.1: Paper 1 "Topics 1-4", Paper 2 "Topics 5-8".
 * - AQA 8462 Chemistry 2.1: Paper 1 "Topics 1–5", Paper 2 "Topics 6–10".
 * - Edexcel 1BI0 Biology: Topic 1, Key concepts, is in the content overview of both papers;
 *   Topics 2–5 are Paper 1 and 6–9 Paper 2.
 * - AQA 8525 Computer Science 2.2: Paper 1 "subject content 3.1 and 3.2", Paper 2 "3.3 to 3.8".
 * - Edexcel 1BS0 Business: Paper 1 is Theme 1, Investigating small business; Paper 2 is
 *   Theme 2, Building a business (the papers' own titles).
 * - AQA 8700 English Language: the units are the papers' sections; spoken language is a
 *   separate endorsement, not part of either paper.
 * - AQA 8702 English Literature 2.2: Paper 1 Shakespeare and the 19th-century novel; Paper 2
 *   modern texts, the poetry anthology and unseen poetry.
 *
 * A subject missing from this list sets every topic on every paper: Maths 1MA1, Further Maths
 * 8365 and Music 1MU0 (one written component); French 1FR1 papers are skills, not themes.
 */
export interface ExamPaper {
  id: string
  /** "Paper 1": short, for a tab. */
  name: string
  /** The units the paper's questions are set on. */
  units: string[]
  /** What the board says beyond the list, in its own terms. */
  note?: string
}

export const EXAM_PAPERS: Record<string, ExamPaper[]> = {
  physics: [
    { id: 'paper-1', name: 'Paper 1', units: ['energy', 'electricity', 'particle-model-of-matter', 'atomic-structure'] },
    { id: 'paper-2', name: 'Paper 2', units: ['forces', 'waves', 'magnetism-and-electromagnetism', 'space-physics'],
      note: 'Paper 2 may also draw on energy changes and transfers, and energy conservation, from Energy and Electricity.' },
  ],
  chemistry: [
    { id: 'paper-1', name: 'Paper 1', units: ['atomic-structure-and-the-periodic-table', 'bonding-structure-and-properties', 'quantitative-chemistry', 'chemical-changes', 'energy-changes'] },
    { id: 'paper-2', name: 'Paper 2', units: ['rate-and-extent-of-change', 'organic-chemistry', 'chemical-analysis', 'chemistry-of-the-atmosphere', 'using-resources'],
      note: 'Paper 2 may also draw on the fundamental ideas of sections 4.1 to 4.3: atomic structure, bonding and quantitative chemistry.' },
  ],
  biology: [
    { id: 'paper-1', name: 'Paper 1', note: 'Key concepts in biology is set on both papers.', units: ['key-concepts', 'cells-and-control', 'genetics', 'natural-selection-and-genetic-modification', 'health-disease-and-medicine'] },
    { id: 'paper-2', name: 'Paper 2', note: 'Key concepts in biology is set on both papers.', units: ['key-concepts', 'plant-structures', 'animal-coordination-and-homeostasis', 'exchange-and-transport', 'ecosystems-and-material-cycles'] },
  ],
  'computer-science': [
    { id: 'paper-1', name: 'Paper 1', units: ['fundamentals-of-algorithms', 'programming'] },
    { id: 'paper-2', name: 'Paper 2', units: ['data-representation', 'computer-systems', 'networks', 'cyber-security', 'relational-databases-and-sql', 'ethical-legal-and-environmental-impacts'] },
  ],
  business: [
    { id: 'paper-1', name: 'Paper 1', units: ['theme-1-investigating-small-business'] },
    { id: 'paper-2', name: 'Paper 2', units: ['theme-2-building-a-business'] },
  ],
  'english-language': [
    { id: 'paper-1', name: 'Paper 1', units: ['reading-fiction', 'creative-writing'] },
    { id: 'paper-2', name: 'Paper 2', units: ['reading-non-fiction', 'writing-viewpoints'] },
    { id: 'spoken-language', name: 'Spoken language', units: ['spoken-language'],
      note: 'Spoken language is a separate endorsement, assessed by the teacher, and is not part of either exam paper.' },
  ],
  'english-literature': [
    { id: 'paper-1', name: 'Paper 1', units: ['macbeth', 'jekyll-and-hyde'] },
    { id: 'paper-2', name: 'Paper 2', units: ['an-inspector-calls', 'power-and-conflict', 'unseen-poetry'] },
  ],
}

/** Why a subject has no paper tabs, said where the tabs would be. */
export const NO_PAPER_SPLIT: Record<string, string> = {
  maths: 'Every paper can ask about any topic.',
  'further-maths': 'Both papers can ask about any topic.',
  french: 'The four papers are speaking, listening, reading and writing, and each can use any theme.',
  music: 'The written exam, Component 3, can ask about any area of study.',
}

export function examPapers(subjectId: string): ExamPaper[] {
  return EXAM_PAPERS[subjectId] ?? []
}
