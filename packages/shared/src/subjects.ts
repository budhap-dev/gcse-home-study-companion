/** Subjects from PRD section 4. Phase 1 ships Maths and Physics. */
export type SubjectId =
  | 'maths' | 'physics' | 'chemistry' | 'biology'
  | 'computer-science' | 'business' | 'french' | 'music'

export interface Subject {
  id: SubjectId
  name: string
  board: string
  /** Delivery phase from PRD section 10. */
  phase: 1 | 2 | 3
  /** Subject accent colour used for chrome inside that subject's screens. */
  colour: string
  units: string[]
}

export const SUBJECTS: Subject[] = [
  { id: 'maths', name: 'Mathematics', board: 'Edexcel 1MA1', phase: 1, colour: '#0E7A86',
    units: ['Number', 'Algebra', 'Ratio, proportion and rates of change', 'Geometry and measures', 'Probability', 'Statistics'] },
  { id: 'physics', name: 'Physics', board: 'AQA 8463', phase: 1, colour: '#5A4BD1',
    units: ['Energy', 'Electricity', 'Particle model of matter', 'Atomic structure', 'Forces', 'Waves', 'Magnetism and electromagnetism', 'Space physics'] },
  { id: 'chemistry', name: 'Chemistry', board: 'AQA 8462', phase: 2, colour: '#B5451B',
    units: ['Atomic structure and the periodic table', 'Bonding, structure and properties', 'Quantitative chemistry', 'Chemical changes', 'Energy changes', 'Rate and extent of change', 'Organic chemistry', 'Chemical analysis', 'Chemistry of the atmosphere', 'Using resources'] },
  { id: 'biology', name: 'Biology', board: 'Edexcel 1BI0', phase: 2, colour: '#2E8B57',
    units: ['Key concepts', 'Cells and control', 'Genetics', 'Natural selection and genetic modification', 'Health, disease and medicine', 'Plant structures', 'Animal coordination and homeostasis', 'Exchange and transport', 'Ecosystems and material cycles'] },
  { id: 'computer-science', name: 'Computer Science', board: 'AQA 8525', phase: 3, colour: '#1F3A93',
    units: ['Fundamentals of algorithms', 'Programming', 'Data representation', 'Computer systems', 'Networks', 'Cyber security', 'Relational databases and SQL', 'Ethical, legal and environmental impacts'] },
  { id: 'business', name: 'Business', board: 'Edexcel 1BS0', phase: 3, colour: '#8A6D1D',
    units: ['Theme 1: Investigating small business', 'Theme 2: Building a business'] },
  { id: 'french', name: 'French', board: 'Edexcel 1FR1', phase: 3, colour: '#A83E6B',
    units: ['My personal world', 'Lifestyle and wellbeing', 'My neighbourhood', 'Media and technology', 'Studying and my future', 'Travel and tourism'] },
  { id: 'music', name: 'Music', board: 'Board to confirm', phase: 3, colour: '#6B4E9B',
    units: ['Musical elements', 'Set works or areas of study', 'Listening and appraising'] },
]

export function getSubject(id: string): Subject | undefined {
  return SUBJECTS.find((s) => s.id === id)
}
