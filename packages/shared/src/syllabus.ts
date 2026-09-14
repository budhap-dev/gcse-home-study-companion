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
 * Year 9 lists only what the app keeps as recap: the rest was taught before the app
 * existed. Pure revision and coursework blocks are left out, because there is no topic
 * to write for them.
 */
export const SYLLABUS: Record<SubjectId, SyllabusBlock[]> = {
  'maths': [
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
      { title: 'Combined events and tree diagrams' },
      { title: 'Sample space diagrams' },
      { title: 'Venn diagrams' },
      { title: 'Choices and outcomes' },
      { title: 'Sets and set notation' },
      { title: 'Histograms' },
      { title: 'Linear, quadratic and geometric sequences' },
      { title: 'Iteration' },
    ] },
    { year: 10, term: 'Spring 2', topics: [
      { title: 'Ratio and proportion' },
      { title: 'Similarity and linear scale factors' },
      { title: 'Exact trigonometric values' },
      { title: 'Sine rule, cosine rule and area of a triangle' },
      { title: 'Scale drawings and bearings' },
    ] },
    { year: 10, term: 'Summer 1', topics: [
      { title: 'Quadratic curves: turning points and intercepts' },
      { title: 'Inequalities on a number line' },
      { title: 'Inequality regions' },
      { title: 'Quadratic inequalities' },
      { title: 'Area and volume scale factors' },
      { title: 'Pythagoras in 3D' },
      { title: 'Trigonometry in 3D' },
    ] },
    { year: 10, term: 'Summer 2', topics: [
      { title: 'Limits of accuracy and bounds' },
      { title: 'Surface areas and volumes' },
      { title: 'Vector arithmetic' },
      { title: 'Vector geometry' },
      { title: 'Compound measures' },
      { title: 'Compound interest, growth and decay' },
      { title: 'Rate of change and real-life graphs' },
    ] },
    { year: 11, term: 'Autumn', topics: [
      { title: 'Algebraic fractions' },
      { title: 'Cumulative frequency curves and box plots' },
      { title: 'Simultaneous equations' },
      { title: 'Equation of a circle' },
      { title: 'Trigonometric graphs' },
      { title: 'Functions' },
    ] },
    { year: 11, term: 'Spring', topics: [
      { title: 'Direct and inverse proportion' },
      { title: 'Non-linear graphs' },
      { title: 'Transformations of graphs' },
      { title: 'Algebraic proof' },
    ] },
    { year: 11, term: 'Summer', topics: [
      { title: 'Enlargements, reflections, rotations and translations' },
      { title: 'Properties of angles' },
      { title: 'Constructions and loci' },
    ] },
  ],
  'physics': [
    { year: 9, term: 'Taught in Year 9, kept for recap', topics: [
      { title: 'Kinetic and gravitational potential energy', topicId: 'kinetic-and-gravitational-potential-energy' },
      { title: 'Describing motion: speed, velocity and acceleration', topicId: 'describing-motion' },
      { title: 'Forces, weight and resultant forces', topicId: 'resultant-forces' },
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
      { title: 'The gas laws and the behaviour of gases' },
      { title: 'Internal energy and specific heat capacity' },
      { title: 'Specific latent heat and changes of state' },
    ] },
    { year: 10, term: 'Spring 2', topics: [
      { title: 'Electromagnetic waves' },
      { title: 'Light: reflection and refraction' },
    ] },
    { year: 10, term: 'Summer 1', topics: [
      { title: 'Static electricity and electric fields' },
    ] },
    { year: 10, term: 'Summer 2', topics: [
      { title: 'Current, potential difference and resistance' },
      { title: 'Series and parallel circuits' },
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
    { year: 10, term: 'Autumn 1 and 2', topics: [
      { title: 'Ionic bonding and ionic compounds', topicId: 'ionic-bonding' },
      { title: 'Covalent bonding: molecules, polymers and giant structures', topicId: 'covalent-bonding' },
      { title: 'Metallic bonding and alloys', topicId: 'metallic-bonding-and-alloys' },
      { title: 'Diamond, graphite, graphene, fullerenes and nanoparticles', topicId: 'carbon-structures-and-nanoparticles' },
      { title: 'Electrolysis of molten compounds', topicId: 'electrolysis-of-molten-compounds' },
      { title: 'Electrolysis of aqueous solutions', topicId: 'electrolysis-of-aqueous-solutions' },
    ] },
    { year: 10, term: 'Spring', topics: [
      { title: 'Exothermic and endothermic reactions' },
      { title: 'Energy profiles and bond energies' },
      { title: 'Cells, batteries and fuel cells' },
      { title: 'Crude oil and fractional distillation' },
      { title: 'Alkanes, combustion and cracking' },
    ] },
    { year: 10, term: 'Summer', topics: [
      { title: 'Alkenes and their reactions' },
      { title: 'Alcohols' },
      { title: 'Carboxylic acids and esters' },
      { title: 'Addition and condensation polymers' },
      { title: 'Proteins, carbohydrates and DNA' },
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
      { title: 'Ceramics, polymers and composites' },
      { title: 'The Haber process and fertilisers' },
      { title: 'Equilibria and Le Chatelier\'s principle' },
    ] },
  ],
  'biology': [
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
      { title: 'Hormones and the endocrine system' },
      { title: 'Blood glucose control and diabetes' },
      { title: 'Thermoregulation' },
      { title: 'Osmoregulation and the kidneys' },
    ] },
    { year: 10, term: 'Summer', topics: [
      { title: 'Ecosystems and interdependence' },
      { title: 'Material cycles' },
      { title: 'Cells, mitosis and growth' },
      { title: 'The nervous system and the brain' },
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
    { year: 9, term: 'Taught in Year 9, kept for recap', topics: [
      { title: 'Data types and operators', topicId: 'data-types-and-operators' },
      { title: 'Selection, iteration and tracing', topicId: 'selection-iteration-and-tracing' },
    ] },
    { year: 10, term: 'Autumn 1', topics: [
      { title: 'Subroutines: procedures and functions', topicId: 'subroutines-procedures-and-functions' },
      { title: 'Arrays and records', topicId: 'arrays-and-records' },
      { title: 'String handling, conversions, and files for your project', topicId: 'strings-and-file-handling' },
      { title: 'Robust and secure programming: validation, authentication and testing', topicId: 'robust-and-secure-programming' },
    ] },
    { year: 10, term: 'Spring', topics: [
      { title: 'Bubble sort' },
      { title: 'Merge sort' },
      { title: 'Working out what an algorithm does by tracing it' },
      { title: 'Compression: lossy, lossless and run length encoding' },
    ] },
    { year: 10, term: 'Summer', topics: [
      { title: 'Boolean logic and truth tables' },
      { title: 'Logic circuits' },
      { title: 'Application and system software' },
    ] },
    { year: 11, term: 'Autumn', topics: [
      { title: 'Classification of programming languages' },
      { title: 'The CPU and memory' },
      { title: 'Secondary storage' },
      { title: 'Databases and SQL' },
    ] },
    { year: 11, term: 'Spring', topics: [
      { title: 'Networks and topologies' },
      { title: 'Cyber security threats' },
      { title: 'Social engineering and prevention' },
      { title: 'Ethical, legal and environmental issues' },
    ] },
  ],
  'business': [
    { year: 9, term: 'Taught in Year 9, kept for recap', topics: [
      { title: 'Enterprise and entrepreneurship', topicId: 'enterprise-and-entrepreneurship' },
      { title: 'Spotting a business opportunity', topicId: 'spotting-a-business-opportunity' },
      { title: 'Putting a business idea into practice', topicId: 'putting-a-business-idea-into-practice' },
    ] },
    { year: 10, term: 'Autumn 1 and 2', topics: [
      { title: 'Making the business effective', topicId: 'making-the-business-effective' },
      { title: 'Understanding external influences', topicId: 'understanding-external-influences' },
    ] },
    { year: 10, term: 'Spring', topics: [
      { title: 'Growing the business' },
    ] },
    { year: 10, term: 'Summer', topics: [
      { title: 'Making marketing decisions' },
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
      { title: 'Infographics about the environment' },
      { title: 'Geography and climate' },
      { title: 'Environmental problems' },
      { title: 'The passive voice' },
      { title: 'Working together to protect the environment' },
      { title: 'Day-to-day environmental actions' },
      { title: 'New technologies' },
      { title: 'Understanding adverts' },
    ] },
    { year: 10, term: 'Summer', topics: [
      { title: 'Your town or village' },
      { title: 'Asking for and understanding directions' },
      { title: 'Shopping for clothes' },
      { title: 'Role plays' },
      { title: 'Your ideal home' },
      { title: 'Visiting a town or city' },
    ] },
    { year: 11, term: 'Autumn', topics: [
      { title: 'Exam skills: translation both ways' },
      { title: 'Exam skills: the photo card and conversation' },
    ] },
  ],
  'music': [
    { year: 9, term: 'Taught in Year 9, kept for recap', topics: [
      { title: 'Musical elements and language' },
    ] },
    { year: 10, term: 'Autumn 1 and 2', topics: [
      { title: 'Killer Queen', topicId: 'killer-queen' },
      { title: 'Star Wars main title', topicId: 'star-wars' },
    ] },
    { year: 10, term: 'Spring', topics: [
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
  ],
}
