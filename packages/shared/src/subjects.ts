/** Subjects from PRD section 4. Phase 1 ships Maths and Physics. */
export type SubjectId =
  | 'maths' | 'further-maths' | 'physics' | 'chemistry' | 'biology'
  | 'computer-science' | 'business' | 'french' | 'music'

export interface Unit {
  id: string
  name: string
}

export interface Subject {
  id: SubjectId
  name: string
  board: string
  /** Delivery phase from PRD section 10. */
  phase: 1 | 2 | 3
  /** Subject accent colour used for chrome inside that subject's screens. */
  colour: string
  units: Unit[]
}

export const SUBJECTS: Subject[] = [
  { id: 'maths', name: 'Mathematics', board: 'Edexcel 1MA1', phase: 1, colour: '#0E7A86',
    units: [{ id: 'number', name: 'Number' }, { id: 'algebra', name: 'Algebra' }, { id: 'ratio-proportion-and-rates-of-change', name: 'Ratio, proportion and rates of change' }, { id: 'geometry-and-measures', name: 'Geometry and measures' }, { id: 'probability', name: 'Probability' }, { id: 'statistics', name: 'Statistics' }] },
  // Sits next to Mathematics rather than replacing it: AQA describes 8365 as an additional
  // qualification taken alongside or after GCSE Maths, so its accent shifts from the Maths
  // teal towards blue — related, and never mistakable for it at a glance.
  { id: 'further-maths', name: 'Further Maths', board: 'AQA Level 2 (8365)', phase: 2, colour: '#0F5E9C',
    units: [{ id: 'number', name: 'Number' }, { id: 'algebra', name: 'Algebra' }, { id: 'coordinate-geometry', name: 'Coordinate geometry' }, { id: 'calculus', name: 'Calculus' }, { id: 'matrix-transformations', name: 'Matrix transformations' }, { id: 'geometry', name: 'Geometry' }] },
  { id: 'physics', name: 'Physics', board: 'AQA 8463', phase: 1, colour: '#5A4BD1',
    units: [{ id: 'energy', name: 'Energy' }, { id: 'electricity', name: 'Electricity' }, { id: 'particle-model-of-matter', name: 'Particle model of matter' }, { id: 'atomic-structure', name: 'Atomic structure' }, { id: 'forces', name: 'Forces' }, { id: 'waves', name: 'Waves' }, { id: 'magnetism-and-electromagnetism', name: 'Magnetism and electromagnetism' }, { id: 'space-physics', name: 'Space physics' }] },
  { id: 'chemistry', name: 'Chemistry', board: 'AQA 8462', phase: 2, colour: '#B5451B',
    units: [{ id: 'atomic-structure-and-the-periodic-table', name: 'Atomic structure and the periodic table' }, { id: 'bonding-structure-and-properties', name: 'Bonding, structure and properties' }, { id: 'quantitative-chemistry', name: 'Quantitative chemistry' }, { id: 'chemical-changes', name: 'Chemical changes' }, { id: 'energy-changes', name: 'Energy changes' }, { id: 'rate-and-extent-of-change', name: 'Rate and extent of change' }, { id: 'organic-chemistry', name: 'Organic chemistry' }, { id: 'chemical-analysis', name: 'Chemical analysis' }, { id: 'chemistry-of-the-atmosphere', name: 'Chemistry of the atmosphere' }, { id: 'using-resources', name: 'Using resources' }] },
  { id: 'biology', name: 'Biology', board: 'Edexcel 1BI0', phase: 2, colour: '#2E8B57',
    units: [{ id: 'key-concepts', name: 'Key concepts' }, { id: 'cells-and-control', name: 'Cells and control' }, { id: 'genetics', name: 'Genetics' }, { id: 'natural-selection-and-genetic-modification', name: 'Natural selection and genetic modification' }, { id: 'health-disease-and-medicine', name: 'Health, disease and medicine' }, { id: 'plant-structures', name: 'Plant structures' }, { id: 'animal-coordination-and-homeostasis', name: 'Animal coordination and homeostasis' }, { id: 'exchange-and-transport', name: 'Exchange and transport' }, { id: 'ecosystems-and-material-cycles', name: 'Ecosystems and material cycles' }] },
  { id: 'computer-science', name: 'Computer Science', board: 'AQA 8525', phase: 3, colour: '#1F3A93',
    units: [{ id: 'fundamentals-of-algorithms', name: 'Fundamentals of algorithms' }, { id: 'programming', name: 'Programming' }, { id: 'data-representation', name: 'Data representation' }, { id: 'computer-systems', name: 'Computer systems' }, { id: 'networks', name: 'Networks' }, { id: 'cyber-security', name: 'Cyber security' }, { id: 'relational-databases-and-sql', name: 'Relational databases and SQL' }, { id: 'ethical-legal-and-environmental-impacts', name: 'Ethical, legal and environmental impacts' }] },
  { id: 'business', name: 'Business', board: 'Edexcel 1BS0', phase: 3, colour: '#8A6D1D',
    units: [{ id: 'theme-1-investigating-small-business', name: 'Theme 1: Investigating small business' }, { id: 'theme-2-building-a-business', name: 'Theme 2: Building a business' }] },
  { id: 'french', name: 'French', board: 'Edexcel 1FR1', phase: 3, colour: '#A83E6B',
    units: [{ id: 'my-personal-world', name: 'My personal world' }, { id: 'lifestyle-and-wellbeing', name: 'Lifestyle and wellbeing' }, { id: 'my-neighbourhood', name: 'My neighbourhood' }, { id: 'media-and-technology', name: 'Media and technology' }, { id: 'studying-and-my-future', name: 'Studying and my future' }, { id: 'travel-and-tourism', name: 'Travel and tourism' }] },
  // Units are Edexcel's four areas of study, confirmed with the school on 11 September
  // 2026, with musical elements first because every set work is described through them.
  { id: 'music', name: 'Music', board: 'Edexcel 1MU0', phase: 3, colour: '#6B4E9B',
    units: [{ id: 'musical-elements', name: 'Musical elements and language' }, { id: 'instrumental-music-1700-1820', name: 'Instrumental music 1700 to 1820' }, { id: 'vocal-music', name: 'Vocal music' }, { id: 'music-for-stage-and-screen', name: 'Music for stage and screen' }, { id: 'fusions', name: 'Fusions' }] },
]

export function getSubject(id: string): Subject | undefined {
  return SUBJECTS.find((s) => s.id === id)
}

export const PHASE_1_SUBJECT_IDS: SubjectId[] = ['maths', 'physics']
