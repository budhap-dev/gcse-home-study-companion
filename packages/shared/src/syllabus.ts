import type { SubjectId } from './subjects.ts'

/** One topic the school teaches, and the app topic that covers it once written. */
export interface SyllabusEntry {
  title: string
  /** The id of the written topic. Absent means it is still to be written. */
  topicId?: string
}

/** One half term, or one block of half terms, of a subject's syllabus. */
export interface SyllabusBlock {
  year: 9 | 10 | 11
  /** The school's half term, as its curriculum overview names it. */
  term: string
  topics: SyllabusEntry[]
}

/**
 * The whole syllabus each subject teaches across Years 9 to 11, taken from the school's
 * curriculum overviews in `docs/curriculum` and the authoring queue in
 * `docs/content-order.md`. The subject page shows all of it, so what is still to be
 * written is visible rather than merely absent.
 *
 * The curriculum documents number the six half terms 1 to 6, so terms 1 and 2 are
 * Autumn, 3 and 4 Spring, 5 and 6 Summer. Pure revision, exam-skills and coursework
 * rows are left out, because there is no topic to write for them.
 *
 * A spiral curriculum teaches some things twice, so a topic may appear under two years
 * with the same `topicId`: the school covers surds, indices, congruency, parallel and
 * perpendicular lines, solving quadratics and arrays in Year 9 and again in Year 10.
 */
export const SYLLABUS: Record<SubjectId, SyllabusBlock[]> = {
  'maths': [
    { year: 9, term: 'Autumn', topics: [
      { title: 'Arithmetic and quadratic sequences' },
      { title: 'Graphs of rates of change' },
      { title: 'Compound units: speed and density' },
      { title: 'Sectors, cylinders and spheres' },
      { title: 'Limits of accuracy and bounds', topicId: 'limits-of-accuracy-and-bounds' },
      { title: 'Fractions, decimals and percentages' },
      { title: 'Successive percentage change' },
      { title: 'Direct and inverse proportion' },
      { title: 'Parallel and perpendicular lines', topicId: 'parallel-and-perpendicular-lines' },
      { title: 'Graphs of quadratic and cubic functions' },
    ] },
    { year: 9, term: 'Spring', topics: [
      { title: 'Standard form' },
      { title: 'Laws of indices', topicId: 'laws-of-indices' },
      { title: 'Surds', topicId: 'surds' },
      { title: 'Grouped and cumulative frequency' },
      { title: 'Box plots' },
      { title: 'Simultaneous equations' },
      { title: 'Inequalities' },
      { title: 'Frequency trees' },
      { title: 'Tree diagrams' },
    ] },
    { year: 9, term: 'Summer', topics: [
      { title: 'Congruent triangles', topicId: 'congruency' },
      { title: 'Similarity' },
      { title: 'Pythagoras' },
      { title: 'Trigonometric ratios' },
      { title: 'Simplifying and expanding expressions' },
      { title: 'Solving quadratics by factorising', topicId: 'solving-quadratic-equations' },
      { title: 'Changing the subject of a formula' },
      { title: 'Trial and improvement' },
    ] },
    { year: 10, term: 'Autumn 1', topics: [
      { title: 'Laws of indices', topicId: 'laws-of-indices' },
      { title: 'Powers and roots', topicId: 'powers-and-roots' },
      { title: 'Surds', topicId: 'surds' },
      { title: 'Equations of straight lines', topicId: 'equations-of-straight-lines' },
      { title: 'Parallel and perpendicular lines', topicId: 'parallel-and-perpendicular-lines' },
      { title: 'Constructing triangles', topicId: 'constructing-triangles' },
      { title: 'Congruent triangles', topicId: 'congruency' },
    ] },
    { year: 10, term: 'Autumn 2', topics: [
      { title: 'Circle theorems', topicId: 'circle-theorems' },
      { title: 'Expanding and factorising quadratics', topicId: 'expanding-and-factorising-quadratics' },
      { title: 'Identities and rearranging formulae', topicId: 'identities-and-rearranging-formulae' },
      { title: 'Solving quadratic equations', topicId: 'solving-quadratic-equations' },
    ] },
    { year: 10, term: 'Spring 1', topics: [
      { title: 'Combined events and tree diagrams', topicId: 'combined-events-and-tree-diagrams' },
      { title: 'Sample space diagrams', topicId: 'sample-space-diagrams' },
      { title: 'Venn diagrams', topicId: 'venn-diagrams' },
      { title: 'Choices and outcomes', topicId: 'choices-and-outcomes' },
      { title: 'Sets and set notation', topicId: 'sets-and-set-notation' },
      { title: 'Histograms', topicId: 'histograms' },
      { title: 'Linear, quadratic and geometric sequences', topicId: 'linear-quadratic-and-geometric-sequences' },
      { title: 'Iteration', topicId: 'iteration' },
    ] },
    { year: 10, term: 'Spring 2', topics: [
      { title: 'Ratio and proportion', topicId: 'ratio-and-proportion' },
      { title: 'Similarity and linear scale factors', topicId: 'similarity-and-linear-scale-factors' },
      { title: 'Exact trigonometric values', topicId: 'exact-trigonometric-values' },
      { title: 'Sine rule, cosine rule and area of a triangle', topicId: 'sine-rule-cosine-rule-and-area' },
      { title: 'Scale drawings and bearings', topicId: 'scale-drawings-and-bearings' },
    ] },
    { year: 10, term: 'Summer 1', topics: [
      { title: 'Quadratic curves: turning points and intercepts', topicId: 'quadratic-curves' },
      { title: 'Inequalities on a number line', topicId: 'inequalities-on-a-number-line' },
      { title: 'Inequality regions', topicId: 'inequality-regions' },
      { title: 'Quadratic inequalities', topicId: 'quadratic-inequalities' },
      { title: 'Area and volume scale factors', topicId: 'area-and-volume-scale-factors' },
      { title: 'Pythagoras in 3D', topicId: 'pythagoras-in-3d' },
      { title: 'Trigonometry in 3D', topicId: 'trigonometry-in-3d' },
    ] },
    { year: 10, term: 'Summer 2', topics: [
      { title: 'Limits of accuracy and bounds', topicId: 'limits-of-accuracy-and-bounds' },
      { title: 'Surface areas and volumes', topicId: 'surface-areas-and-volumes' },
      { title: 'Vector arithmetic', topicId: 'vector-arithmetic' },
      { title: 'Vector geometry', topicId: 'vector-geometry' },
      { title: 'Compound measures', topicId: 'compound-measures' },
      { title: 'Compound interest, growth and decay', topicId: 'compound-interest-growth-and-decay' },
      { title: 'Rate of change and real-life graphs', topicId: 'rate-of-change-and-real-life-graphs' },
    ] },
    { year: 11, term: 'Autumn', topics: [
      { title: 'Algebraic fractions' },
      { title: 'Rearranging formulae' },
      { title: 'Cumulative frequency curves and box plots' },
      { title: 'Simultaneous equations' },
      { title: 'Surds' },
      { title: 'Equation of a circle' },
      { title: 'Exact trigonometric values' },
      { title: 'Trigonometric graphs' },
      { title: 'Functions' },
    ] },
    { year: 11, term: 'Spring', topics: [
      { title: 'Direct and inverse proportion' },
      { title: 'Non-linear graphs' },
      { title: 'Transformations of graphs' },
      { title: 'Algebraic proof' },
      { title: 'Sequences' },
      { title: 'Iteration: approximating solutions' },
    ] },
    { year: 11, term: 'Summer', topics: [
      { title: 'Fractions' },
      { title: 'Ratio and proportion', topicId: 'ratio-and-proportion' },
      { title: 'Percentages' },
      { title: 'Enlargements, reflections, rotations and translations' },
      { title: 'Standard form' },
      { title: 'Index form' },
      { title: 'Properties of angles' },
      { title: 'Constructions and loci' },
    ] },
  ],
  'physics': [
    { year: 9, term: 'Autumn', topics: [
      { title: 'Wave properties' },
      { title: 'Light waves: reflection and refraction' },
      { title: 'Sound waves' },
      { title: 'Kinetic and gravitational potential energy', topicId: 'kinetic-and-gravitational-potential-energy' },
      { title: 'Energy transfers and dissipation' },
    ] },
    { year: 9, term: 'Spring', topics: [
      { title: 'Power and efficiency' },
      { title: 'Generating power' },
      { title: 'Describing motion: speed, velocity and acceleration', topicId: 'describing-motion' },
      { title: 'Forces, weight and resultant forces', topicId: 'resultant-forces' },
    ] },
    { year: 9, term: 'Summer', topics: [
      { title: 'Forces and motion: Newton\'s laws', topicId: 'newtons-laws' },
      { title: 'Stopping distances', topicId: 'stopping-distances' },
    ] },
    { year: 10, term: 'Autumn 1', topics: [
      { title: 'Hooke\'s law and elasticity', topicId: 'hookes-law' },
      { title: 'Moments, levers and gears', topicId: 'moments-levers-and-gears' },
    ] },
    { year: 10, term: 'Autumn 2', topics: [
      { title: 'Momentum', topicId: 'momentum' },
      { title: 'Pressure in fluids', topicId: 'pressure-in-fluids' },
    ] },
    { year: 10, term: 'Spring 1', topics: [
      // Checking AQA 8463 against the school's overview found 4.3.1.1 and 4.3.1.2 in
      // neither, though both are examinable and density carries required practical 5.
      { title: 'Density and changes of state', topicId: 'density-and-changes-of-state' },
      // The school teaches internal energy, specific heat capacity and latent heat as two
      // rows; one written topic covers both, so they are listed here as a single line.
      { title: 'Internal energy, specific heat capacity and latent heat', topicId: 'thermal-physics' },
      { title: 'The gas laws and the behaviour of gases', topicId: 'behaviour-of-gases' },
    ] },
    { year: 10, term: 'Spring 2', topics: [
      { title: 'Electromagnetic waves', topicId: 'electromagnetic-spectrum' },
      { title: 'Light: reflection and refraction', topicId: 'light-reflection-and-refraction' },
      // Absent from the school's overview too: lenses and black body radiation are
      // physics only, and waves for detection are physics only and Higher tier.
      { title: 'Lenses', topicId: 'lenses' },
      { title: 'Infrared radiation and black bodies', topicId: 'infrared-radiation-and-black-bodies' },
      { title: 'Waves for detection and exploration', topicId: 'waves-for-detection-and-exploration' },
    ] },
    { year: 10, term: 'Summer 1', topics: [
      { title: 'Static electricity and electric fields', topicId: 'static-electricity-and-electric-fields' },
    ] },
    { year: 10, term: 'Summer 2', topics: [
      { title: 'Current, potential difference and resistance', topicId: 'current-potential-difference-and-resistance' },
      { title: 'Series and parallel circuits', topicId: 'series-and-parallel-circuits' },
    ] },
    { year: 11, term: 'Autumn', topics: [
      { title: 'Resistance and Ohm\'s law' },
      { title: 'Circuit rules' },
      { title: 'Mains electricity' },
      { title: 'The model of the atom' },
      { title: 'Radiation and nuclear power' },
    ] },
    { year: 11, term: 'Spring', topics: [
      { title: 'Electromagnetic devices' },
      { title: 'Stars and galaxies' },
      { title: 'The Big Bang' },
    ] },
  ],
  'chemistry': [
    { year: 9, term: 'Autumn', topics: [
      { title: 'States of matter' },
      { title: 'Atoms, ions and isotopes' },
      { title: 'Formulae and balancing equations' },
      { title: 'The periodic table and its history' },
      { title: 'Groups 1, 7 and 0' },
      { title: 'Transition metals' },
      { title: 'Pure substances and formulations' },
      { title: 'Tests for ions and gases' },
      { title: 'Instrumental methods' },
    ] },
    { year: 9, term: 'Spring', topics: [
      { title: 'Reactions of acids with bases' },
      { title: 'Strong and weak acids' },
      { title: 'Reactivity of metals and displacement' },
      { title: 'Oxidation and reduction' },
      { title: 'Measuring rates of reaction' },
      { title: 'Collision theory and the effect of conditions' },
    ] },
    { year: 9, term: 'Summer', topics: [
      { title: 'Development of the atmosphere' },
      { title: 'Greenhouse gases and climate change' },
      { title: 'Atmospheric pollutants from combustion' },
    ] },
    { year: 10, term: 'Autumn 1 and 2', topics: [
      { title: 'Ionic bonding and ionic compounds', topicId: 'ionic-bonding' },
      { title: 'Covalent bonding: molecules, polymers and giant structures', topicId: 'covalent-bonding' },
      { title: 'Metallic bonding and alloys', topicId: 'metallic-bonding-and-alloys' },
      { title: 'Diamond, graphite, graphene, fullerenes and nanoparticles', topicId: 'carbon-structures-and-nanoparticles' },
      { title: 'Electrolysis of molten compounds', topicId: 'electrolysis-of-molten-compounds' },
      { title: 'Electrolysis of aqueous solutions', topicId: 'electrolysis-of-aqueous-solutions' },
    ] },
    { year: 10, term: 'Spring', topics: [
      { title: 'Exothermic and endothermic reactions', topicId: 'exothermic-and-endothermic-reactions' },
      { title: 'Energy profiles and bond energies', topicId: 'reaction-profiles-and-bond-energies' },
      { title: 'Cells, batteries and fuel cells', topicId: 'cells-batteries-and-fuel-cells' },
      // The school's last two rows are these two topics: combustion is taught with the
      // alkanes it burns, and cracking with the alkenes it produces.
      { title: 'Crude oil, hydrocarbons and alkanes', topicId: 'crude-oil-and-alkanes' },
      { title: 'Cracking and alkenes', topicId: 'cracking-and-alkenes' },
    ] },
    { year: 10, term: 'Summer', topics: [
      { title: 'Alkenes and their reactions', topicId: 'alkenes-and-their-reactions' },
      { title: 'Alcohols', topicId: 'alcohols' },
      { title: 'Carboxylic acids and esters', topicId: 'carboxylic-acids-and-esters' },
      { title: 'Addition and condensation polymers', topicId: 'addition-and-condensation-polymers' },
      { title: 'Proteins, carbohydrates and DNA', topicId: 'proteins-carbohydrates-and-dna' },
    ] },
    { year: 11, term: 'Autumn', topics: [
      { title: 'Conservation of mass and moles' },
      { title: 'Reacting masses and limiting reactants' },
      { title: 'Yield and atom economy' },
      { title: 'Concentrations and titrations' },
      { title: 'Gas volumes' },
    ] },
    { year: 11, term: 'Spring', topics: [
      { title: 'Potable and waste water' },
      { title: 'Alternative extraction of metals' },
      { title: 'Life cycle assessment and recycling' },
      { title: 'Corrosion and its prevention' },
      { title: 'Alloys, ceramics, polymers and composites' },
      { title: 'The Haber process and fertilisers' },
      { title: 'Equilibria and Le Chatelier\'s principle' },
    ] },
  ],
  'biology': [
    { year: 9, term: 'Autumn and Spring', topics: [
      { title: 'Microbes and microscopy' },
      { title: 'The immune system' },
      { title: 'The nervous system' },
      { title: 'The genetic code' },
      { title: 'Classification and evolution' },
    ] },
    { year: 9, term: 'Spring and Summer', topics: [
      { title: 'Unit 1: cells and specialisation' },
      { title: 'Unit 1: enzymes' },
      { title: 'Unit 1: diffusion, osmosis and active transport' },
      { title: 'Unit 8: the breathing system and gas exchange' },
      { title: 'Unit 8: the circulatory system and blood' },
    ] },
    { year: 10, term: 'Autumn 1', topics: [
      { title: 'Photosynthesis and limiting factors', topicId: 'photosynthesis-and-limiting-factors' },
      { title: 'The leaf, root hair cells, xylem and phloem', topicId: 'leaf-root-and-transport-tissues' },
      { title: 'Transpiration and translocation', topicId: 'transpiration-and-translocation' },
      { title: 'Plant adaptations, defences and hormones', topicId: 'plant-adaptations-defences-and-hormones' },
    ] },
    { year: 10, term: 'Autumn 1 and 2', topics: [
      { title: 'Pathogens and how disease spreads', topicId: 'pathogens-and-how-disease-spreads' },
      { title: 'The immune system and immunisation', topicId: 'the-immune-system-and-immunisation' },
      { title: 'Antibiotics, new medicines and monoclonal antibodies', topicId: 'antibiotics-medicines-and-monoclonal-antibodies' },
      { title: 'Non-communicable disease and lifestyle', topicId: 'non-communicable-disease-and-lifestyle' },
    ] },
    { year: 10, term: 'Spring', topics: [
      { title: 'Hormones and the endocrine system', topicId: 'hormones-and-the-endocrine-system' },
      // Spec points 7.4 to 7.8 — the menstrual cycle, contraception and ART — were not
      // covered by any of the four rows the school's plan lists, so this row was added.
      { title: 'The menstrual cycle and fertility', topicId: 'the-menstrual-cycle-and-fertility' },
      { title: 'Blood glucose control and diabetes', topicId: 'blood-glucose-control-and-diabetes' },
      { title: 'Thermoregulation', topicId: 'thermoregulation' },
      { title: 'Osmoregulation and the kidneys', topicId: 'osmoregulation-and-the-kidneys' },
    ] },
    { year: 10, term: 'Summer', topics: [
      { title: 'Ecosystems and interdependence', topicId: 'ecosystems-and-interdependence' },
      { title: 'Material cycles', topicId: 'material-cycles' },
      { title: 'Cells, mitosis and growth', topicId: 'cells-mitosis-and-growth' },
      { title: 'The nervous system and the brain', topicId: 'the-nervous-system-and-the-brain' },
      // Spec points 2.15B to 2.17B — the eye, its defects and their correction — appeared
      // in no row of the school's plan, so this one was added.
      { title: 'The eye and its defects', topicId: 'the-eye-and-its-defects' },
    ] },
    { year: 11, term: 'Autumn', topics: [
      { title: 'Meiosis and sexual reproduction' },
      { title: 'DNA, genes and protein synthesis' },
      { title: 'Inheritance and genetic diagrams' },
      { title: 'Genetic disorders and screening' },
    ] },
    { year: 11, term: 'Spring', topics: [
      { title: 'Variation and natural selection' },
      { title: 'Evidence for evolution and classification' },
      { title: 'Selective breeding and genetic engineering' },
    ] },
  ],
  'computer-science': [
    { year: 9, term: 'Autumn', topics: [
      { title: 'Problem solving' },
      { title: 'Decomposition and abstraction' },
      { title: 'Flow charts and pseudo-code' },
      { title: 'Linear and binary search' },
    ] },
    { year: 9, term: 'Spring', topics: [
      { title: 'Data types and operators', topicId: 'data-types-and-operators' },
      { title: 'Selection, iteration and tracing', topicId: 'selection-iteration-and-tracing' },
      { title: 'Arrays', topicId: 'arrays-and-records' },
    ] },
    { year: 9, term: 'Summer', topics: [
      { title: 'Storage units and binary' },
      { title: 'Binary arithmetic' },
      { title: 'ASCII and Unicode' },
      { title: 'Representing images and sound' },
    ] },
    { year: 10, term: 'Autumn 1', topics: [
      { title: 'Subroutines: procedures and functions', topicId: 'subroutines-procedures-and-functions' },
      { title: 'Arrays and records', topicId: 'arrays-and-records' },
      { title: 'String handling, conversions, and files for your project', topicId: 'strings-and-file-handling' },
      { title: 'Robust and secure programming: validation, authentication and testing', topicId: 'robust-and-secure-programming' },
    ] },
    { year: 10, term: 'Spring', topics: [
      { title: 'Bubble sort', topicId: 'bubble-sort' },
      { title: 'Merge sort', topicId: 'merge-sort' },
      { title: 'Working out what an algorithm does by tracing it', topicId: 'determining-the-purpose-of-an-algorithm' },
      { title: 'Data compression: Huffman coding and run length encoding', topicId: 'data-compression' },
    ] },
    { year: 10, term: 'Summer', topics: [
      { title: 'Boolean logic and truth tables', topicId: 'boolean-logic-and-truth-tables' },
      { title: 'Logic circuits', topicId: 'logic-circuits' },
      { title: 'Application and system software', topicId: 'application-and-system-software' },
    ] },
    { year: 11, term: 'Autumn', topics: [
      { title: 'Classification of programming languages' },
      { title: 'The CPU and memory' },
      { title: 'Secondary storage' },
      { title: 'Databases and SQL' },
    ] },
    { year: 11, term: 'Spring', topics: [
      { title: 'Networking' },
      { title: 'Cyber security threats' },
      { title: 'Social engineering and prevention' },
      { title: 'Ethical, legal and environmental issues' },
    ] },
  ],
  'business': [
    { year: 9, term: 'Autumn', topics: [
      { title: 'Enterprise and entrepreneurship', topicId: 'enterprise-and-entrepreneurship' },
      { title: 'Spotting a business opportunity', topicId: 'spotting-a-business-opportunity' },
    ] },
    { year: 9, term: 'Spring', topics: [
      { title: 'Putting a business idea into practice', topicId: 'putting-a-business-idea-into-practice' },
    ] },
    { year: 10, term: 'Autumn 1 and 2', topics: [
      { title: 'Making the business effective', topicId: 'making-the-business-effective' },
      { title: 'Understanding external influences', topicId: 'understanding-external-influences' },
    ] },
    { year: 10, term: 'Spring', topics: [
      { title: 'Growing the business', topicId: 'growing-the-business' },
    ] },
    { year: 10, term: 'Summer', topics: [
      { title: 'Making marketing decisions', topicId: 'making-marketing-decisions' },
    ] },
    { year: 11, term: 'Autumn', topics: [
      { title: 'Making operational decisions' },
      { title: 'Making financial decisions' },
    ] },
    { year: 11, term: 'Spring', topics: [
      { title: 'Making human resource decisions' },
    ] },
  ],
  'french': [
    { year: 9, term: 'Autumn', topics: [
      { title: 'Events in the Francophone world' },
      { title: 'Opinions with nouns and infinitives' },
      { title: 'Life online' },
      { title: 'Staying active' },
      { title: 'The present tense, regular and irregular' },
      { title: 'What you watch' },
      { title: 'Plans to go out, with the near future' },
      { title: 'Last weekend, with the perfect tense' },
      { title: 'Forming and answering questions' },
    ] },
    { year: 9, term: 'Spring', topics: [
      { title: 'Identity' },
      { title: 'Weekend routine, with reflexive verbs' },
      { title: 'Friends and friendship' },
      { title: 'Describing people' },
      { title: 'Position of adjectives' },
      { title: 'Positive role models' },
      { title: 'Direct object pronouns' },
      { title: 'Celebrations' },
      { title: 'Combining present, perfect and near future' },
    ] },
    { year: 9, term: 'Summer', topics: [
      { title: 'School life in Francophone countries' },
      { title: 'Subjects and school life' },
      { title: 'School rules' },
      { title: 'Progress at school' },
      { title: 'What school used to be like, with the imperfect' },
      { title: 'Learning languages' },
      { title: 'Combining present, near future and imperfect' },
      { title: 'Meals and mealtimes' },
    ] },
    { year: 10, term: 'Autumn 1', topics: [
      { title: 'Good mental health', topicId: 'good-mental-health' },
      { title: 'Illness and accidents', topicId: 'illness-and-accidents' },
      { title: 'Improving your life, with the simple future', topicId: 'the-simple-future' },
      { title: 'Lifestyle changes', topicId: 'lifestyle-changes' },
    ] },
    { year: 10, term: 'Autumn 2', topics: [
      { title: 'Holidays in three tenses', topicId: 'holidays-in-three-tenses' },
      { title: 'Holidays and accommodation', topicId: 'holidays-and-accommodation' },
      { title: 'My ideal holiday, with the conditional', topicId: 'ideal-holiday' },
      { title: 'Holiday activities', topicId: 'holiday-activities' },
      { title: 'Festivals and traditions', topicId: 'festivals-and-traditions' },
      { title: 'Booking and reviewing accommodation', topicId: 'booking-and-reviewing-accommodation' },
    ] },
    { year: 10, term: 'Spring', topics: [
      // The school lists infographics separately; they are taught inside the geography
      // topic, which is where the figures being read come from.
      { title: 'Geography and climate, with infographics', topicId: 'geography-and-climate' },
      { title: 'Environmental problems', topicId: 'environmental-problems' },
      { title: 'The passive voice', topicId: 'the-passive-voice' },
      // Two rows in the school's list, day-to-day actions and collective ones, taught
      // here as one topic because the French is the same and the contrast is the lesson.
      { title: 'Day-to-day and collective environmental actions', topicId: 'taking-action-for-the-environment' },
      { title: 'New technologies', topicId: 'new-technologies' },
      { title: 'Understanding adverts', topicId: 'understanding-adverts' },
    ] },
    { year: 10, term: 'Summer', topics: [
      { title: 'Your town or village', topicId: 'your-town-or-village' },
      { title: 'Asking for and understanding directions', topicId: 'asking-for-and-understanding-directions' },
      { title: 'Shopping for clothes', topicId: 'shopping-for-clothes' },
      { title: 'Role plays', topicId: 'role-plays' },
      { title: 'Your ideal home', topicId: 'your-ideal-home' },
      { title: 'Visiting a town or city', topicId: 'visiting-a-town-or-city' },
      { title: 'Exam skills practice' },
    ] },
    { year: 11, term: 'Spring', topics: [
      { title: 'Exam skills: listening, reading, writing, speaking and translation' },
    ] },
  ],
  'music': [
    { year: 9, term: 'Autumn', topics: [
      { title: 'Pop music through the decades' },
      { title: 'Fusion music, including bhangra and reggaeton' },
    ] },
    { year: 9, term: 'Spring', topics: [
      { title: 'Classical history' },
      { title: 'Theme and variations' },
    ] },
    { year: 9, term: 'Summer', topics: [
      { title: 'Film composition and developing motifs' },
      { title: 'Vocal music' },
      { title: 'Analysis of an exemplar set work' },
    ] },
    { year: 10, term: 'Autumn 1 and 2', topics: [
      { title: 'Killer Queen', topicId: 'killer-queen' },
      { title: 'Star Wars main title', topicId: 'star-wars' },
    ] },
    { year: 10, term: 'Spring', topics: [
      { title: 'History of instrumental music' },
      { title: 'Bach: Brandenburg Concerto No. 5, third movement', topicId: 'bach-brandenburg-5' },
      { title: 'Afro Celt Sound System: Release', topicId: 'afro-celt-release' },
    ] },
    { year: 10, term: 'Summer', topics: [
      { title: 'Esperanza Spalding: Samba Em Preludio' },
      { title: 'Defying Gravity from Wicked' },
    ] },
    { year: 11, term: 'Autumn', topics: [
      { title: 'Beethoven: Pathétique, first movement' },
      { title: 'Purcell: Music for a While' },
    ] },
    { year: 11, term: 'Spring', topics: [
      { title: 'Musical dictation' },
      { title: 'Analysing unfamiliar music' },
      { title: 'Short analysis essays' },
    ] },
  ],
}
