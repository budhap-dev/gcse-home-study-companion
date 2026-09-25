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
    // The groundwork Pearson 1MA1 assumes and the school teaches before Year 9, so its
    // overview does not list it. Written from the specification (docs/curriculum/maths.md).
    { year: 9, term: 'Groundwork from Years 7 and 8', topics: [
      { title: 'Factors, multiples and primes', topicId: 'factors-multiples-and-primes' },
      { title: 'Calculating with fractions and negative numbers', topicId: 'calculating-with-fractions-and-negatives' },
      { title: 'Ratio notation, simplifying and sharing', topicId: 'ratio-notation-and-sharing' },
      { title: 'Converting units and estimating', topicId: 'units-conversion-and-estimation' },
      { title: 'Properties of triangles and quadrilaterals', topicId: 'properties-of-2d-shapes' },
      { title: 'Averages and range', topicId: 'averages-and-range' },
      { title: 'Charts and diagrams for data', topicId: 'charts-and-diagrams-for-data' },
    ] },
    { year: 9, term: 'Autumn', topics: [
      { title: 'Arithmetic and quadratic sequences', topicId: 'linear-quadratic-and-geometric-sequences' },
      { title: 'Graphs of rates of change', topicId: 'rate-of-change-and-real-life-graphs' },
      { title: 'Compound units: speed and density', topicId: 'compound-measures' },
      // Cylinders and spheres are taught by Surface areas and volumes (G16, G17).
      // The uncovered half of this row was G18, arcs and sectors, so it links there.
      { title: 'Sectors, cylinders and spheres', topicId: 'arc-length-and-sector-area' },
      { title: 'Limits of accuracy and bounds', topicId: 'limits-of-accuracy-and-bounds' },
      { title: 'Fractions, decimals and percentages', topicId: 'fractions-decimals-and-percentages' },
      // Successive change, the multiplier and reverse percentages are all taught by the
      // Compound interest topic, so the Year 9 row points there rather than duplicating it.
      { title: 'Successive percentage change', topicId: 'compound-interest-growth-and-decay' },
      { title: 'Direct and inverse proportion', topicId: 'ratio-and-proportion' },
      { title: 'Parallel and perpendicular lines', topicId: 'parallel-and-perpendicular-lines' },
      // Quadratic graphs are taught by Quadratic curves (A11, A12). The half of this row
      // nothing covered was the cubic and reciprocal graphs of A12, so it links there.
      { title: 'Graphs of quadratic and cubic functions', topicId: 'cubic-and-reciprocal-graphs' },
    ] },
    { year: 9, term: 'Spring', topics: [
      { title: 'Standard form', topicId: 'standard-form' },
      { title: 'Laws of indices', topicId: 'laws-of-indices' },
      { title: 'Surds', topicId: 'surds' },
      { title: 'Grouped and cumulative frequency', topicId: 'grouped-and-cumulative-frequency' },
      { title: 'Box plots', topicId: 'box-plots' },
      { title: 'Simultaneous equations', topicId: 'simultaneous-equations' },
      { title: 'Inequalities', topicId: 'inequalities-on-a-number-line' },
      { title: 'Frequency trees', topicId: 'frequency-trees' },
      { title: 'Relative frequency and expected outcomes', topicId: 'relative-frequency-and-expected-outcomes' },
      { title: 'Tree diagrams', topicId: 'combined-events-and-tree-diagrams' },
    ] },
    { year: 9, term: 'Summer', topics: [
      { title: 'Congruent triangles', topicId: 'congruency' },
      { title: 'Similarity', topicId: 'similarity-and-linear-scale-factors' },
      { title: 'Pythagoras', topicId: 'pythagoras-in-2d' },
      { title: 'Trigonometric ratios', topicId: 'trigonometric-ratios' },
      { title: 'Simplifying and expanding expressions', topicId: 'simplifying-and-expanding-expressions' },
      { title: 'Solving quadratics by factorising', topicId: 'solving-quadratic-equations' },
      { title: 'Changing the subject of a formula', topicId: 'identities-and-rearranging-formulae' },
      // The school's wording is the old one. "Trial and improvement" appears nowhere in
      // Edexcel 1MA1; the spec asks for A20, solving numerically by iteration, which is the
      // same method and is what the Iteration topic teaches.
      { title: 'Trial and improvement', topicId: 'iteration' },
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
      { title: 'Scatter graphs and correlation', topicId: 'scatter-graphs-and-correlation' },
      { title: 'Sampling and populations', topicId: 'sampling-and-populations' },
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
      { title: '3D shapes: faces, edges, plans and elevations', topicId: '3d-shapes-plans-and-elevations' },
      { title: 'Vector arithmetic', topicId: 'vector-arithmetic' },
      { title: 'Vector geometry', topicId: 'vector-geometry' },
      { title: 'Compound measures', topicId: 'compound-measures' },
      { title: 'Compound interest, growth and decay', topicId: 'compound-interest-growth-and-decay' },
      { title: 'Rate of change and real-life graphs', topicId: 'rate-of-change-and-real-life-graphs' },
    ] },
    { year: 11, term: 'Autumn', topics: [
      { title: 'Algebraic fractions', topicId: 'algebraic-fractions' },
      { title: 'Rearranging formulae', topicId: 'identities-and-rearranging-formulae' },
      // Box plots are a topic of their own; this row links to the curve topic, which
      // teaches reading the five-number summary off a cumulative frequency graph.
      { title: 'Cumulative frequency curves and box plots', topicId: 'grouped-and-cumulative-frequency' },
      { title: 'Simultaneous equations', topicId: 'simultaneous-equations' },
      { title: 'Surds', topicId: 'surds' },
      { title: 'Equation of a circle', topicId: 'equation-of-a-circle' },
      { title: 'Exact trigonometric values', topicId: 'exact-trigonometric-values' },
      { title: 'Trigonometric graphs', topicId: 'trigonometric-graphs' },
      { title: 'Functions', topicId: 'functions' },
    ] },
    { year: 11, term: 'Spring', topics: [
      // Its own topic rather than a link to ratio-and-proportion: R13 is the formal
      // notation, y = kx^n and y = k/x^n, which that Year 10 topic does not reach.
      { title: 'Direct and inverse proportion', topicId: 'direct-and-inverse-proportion' },
      { title: 'Non-linear graphs', topicId: 'non-linear-graphs' },
      { title: 'Transformations of graphs', topicId: 'transformations-of-graphs' },
      { title: 'Algebraic proof', topicId: 'algebraic-proof' },
      { title: 'Sequences', topicId: 'linear-quadratic-and-geometric-sequences' },
      { title: 'Iteration: approximating solutions', topicId: 'iteration' },
    ] },
    { year: 11, term: 'Summer', topics: [
      // Revision rows, linked to where each was taught rather than rewritten. Percentages
      // points at the growth-and-decay topic instead of fractions-decimals-and-percentages
      // so the Summer card does not list the same topic twice.
      { title: 'Fractions', topicId: 'fractions-decimals-and-percentages' },
      { title: 'Ratio and proportion', topicId: 'ratio-and-proportion' },
      { title: 'Percentages', topicId: 'compound-interest-growth-and-decay' },
      { title: 'Enlargements, reflections, rotations and translations', topicId: 'transformations' },
      { title: 'Standard form', topicId: 'standard-form' },
      { title: 'Index form', topicId: 'laws-of-indices' },
      { title: 'Properties of angles', topicId: 'properties-of-angles' },
      { title: 'Constructions and loci', topicId: 'constructions-and-loci' },
    ] },
  ],
  'physics': [
    { year: 9, term: 'Autumn', topics: [
      { title: 'Wave properties', topicId: 'wave-properties' },
      // The school teaches light in Year 9 term 1 and re-tests it in the Year 10 term 4
      // milestone, so both rows point at the one topic, as the Maths recap rows do.
      { title: 'Light waves: reflection and refraction', topicId: 'light-reflection-and-refraction' },
      { title: 'Sound waves', topicId: 'sound-waves' },
      { title: 'Kinetic and gravitational potential energy', topicId: 'kinetic-and-gravitational-potential-energy' },
      { title: 'Energy transfers and dissipation', topicId: 'energy-transfers-and-dissipation' },
    ] },
    { year: 9, term: 'Spring', topics: [
      { title: 'Power and efficiency', topicId: 'power-and-efficiency' },
      { title: 'Generating power', topicId: 'generating-power' },
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
      { title: 'Resistance and Ohm\'s law', topicId: 'resistance-and-ohms-law' },
      { title: 'Circuit rules', topicId: 'circuit-rules' },
      { title: 'Mains electricity', topicId: 'mains-electricity' },
      { title: 'The model of the atom', topicId: 'the-model-of-the-atom' },
      { title: 'Radiation and nuclear power', topicId: 'radiation-and-nuclear-power' },
    ] },
    { year: 11, term: 'Spring', topics: [
      { title: 'Magnets and magnetic fields', topicId: 'magnets-and-magnetic-fields' },
      { title: 'Electromagnetic devices', topicId: 'electromagnetic-devices' },
      { title: 'Stars and galaxies', topicId: 'stars-and-galaxies' },
      { title: 'The Big Bang', topicId: 'the-big-bang' },
    ] },
  ],
  'chemistry': [
    { year: 9, term: 'Autumn', topics: [
      { title: 'States of matter', topicId: 'states-of-matter' },
      { title: 'Atoms, ions and isotopes', topicId: 'atoms-ions-and-isotopes' },
      { title: 'Formulae and balancing equations', topicId: 'formulae-and-balancing-equations' },
      { title: 'The periodic table and its history', topicId: 'the-periodic-table-and-its-history' },
      { title: 'Groups 1, 7 and 0', topicId: 'groups-1-7-and-0' },
      { title: 'Transition metals', topicId: 'transition-metals' },
      { title: 'Pure substances and formulations', topicId: 'pure-substances-and-formulations' },
      { title: 'Tests for ions and gases', topicId: 'tests-for-ions-and-gases' },
      { title: 'Instrumental methods', topicId: 'instrumental-methods' },
    ] },
    { year: 9, term: 'Spring', topics: [
      { title: 'Reactions of acids with bases', topicId: 'reactions-of-acids-with-bases' },
      // Required practical 1, making a soluble salt from an insoluble oxide or carbonate
      // (4.4.2.3), is covered by neither of the school's two acid rows, so this was added.
      { title: 'Making soluble salts', topicId: 'making-soluble-salts' },
      { title: 'Strong and weak acids', topicId: 'strong-and-weak-acids' },
      { title: 'Reactivity of metals and displacement', topicId: 'reactivity-of-metals-and-displacement' },
      { title: 'Oxidation and reduction', topicId: 'oxidation-and-reduction' },
      { title: 'Measuring rates of reaction', topicId: 'measuring-rates-of-reaction' },
      { title: 'Collision theory and the effect of conditions', topicId: 'collision-theory-and-catalysts' },
    ] },
    { year: 9, term: 'Summer', topics: [
      { title: 'Development of the atmosphere', topicId: 'development-of-the-atmosphere' },
      { title: 'Greenhouse gases and climate change', topicId: 'greenhouse-gases-and-climate-change' },
      { title: 'Atmospheric pollutants from combustion', topicId: 'atmospheric-pollutants-from-combustion' },
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
      { title: 'Conservation of mass and moles', topicId: 'conservation-of-mass-and-moles' },
      { title: 'Reacting masses and limiting reactants', topicId: 'reacting-masses-and-limiting-reactants' },
      { title: 'Yield and atom economy', topicId: 'yield-and-atom-economy' },
      { title: 'Concentrations and titrations', topicId: 'concentrations-and-titrations' },
      { title: 'Gas volumes', topicId: 'gas-volumes' },
    ] },
    { year: 11, term: 'Spring', topics: [
      { title: 'Potable and waste water', topicId: 'potable-and-waste-water' },
      { title: 'Alternative extraction of metals', topicId: 'alternative-extraction-of-metals' },
      { title: 'Life cycle assessment and recycling', topicId: 'life-cycle-assessment-and-recycling' },
      { title: 'Corrosion and its prevention', topicId: 'corrosion-and-its-prevention' },
      { title: 'Alloys, ceramics, polymers and composites', topicId: 'alloys-ceramics-polymers-and-composites' },
      { title: 'The Haber process and fertilisers', topicId: 'the-haber-process-and-fertilisers' },
      { title: 'Equilibria and Le Chatelier\'s principle', topicId: 'equilibria-and-le-chateliers-principle' },
    ] },
  ],
  'biology': [
    // The school's pre-GCSE bridging unit, written 24 September 2026 on the owner's
    // decision. Each sits first in the Edexcel unit it leads into, so a student meets the
    // groundwork before the topic that assumes it.
    { year: 9, term: 'Autumn and Spring', topics: [
      { title: 'Microbes and microscopy', topicId: 'microbes-and-microscopy' },
      { title: 'The immune system', topicId: 'how-the-body-fights-infection' },
      { title: 'The nervous system', topicId: 'senses-nerves-and-reaction-time' },
      { title: 'The genetic code', topicId: 'dna-chromosomes-and-genes' },
      { title: 'Classification and evolution', topicId: 'classification-adaptation-and-evolution' },
    ] },
    { year: 9, term: 'Spring and Summer', topics: [
      { title: 'Unit 1: cells and specialisation', topicId: 'cells-and-how-they-are-specialised' },
      // Spec points 1.3 to 1.6 — microscope technology, size and scale, the units, and
      // the magnification core practical — were covered by none of the five rows the
      // school's plan lists, so this row was added.
      { title: 'Unit 1: microscopes, magnification and scale', topicId: 'microscopes-magnification-and-scale' },
      { title: 'Unit 1: enzymes', topicId: 'enzymes-and-how-they-work' },
      // The same for 1.13B and 1.14B, the food tests core practical and calorimetry.
      { title: 'Unit 1: food tests and calorimetry', topicId: 'food-tests-and-calorimetry' },
      { title: 'Unit 1: diffusion, osmosis and active transport', topicId: 'diffusion-osmosis-and-active-transport' },
      { title: 'Unit 8: the breathing system and gas exchange', topicId: 'exchange-surfaces-and-gas-exchange' },
      { title: 'Unit 8: the circulatory system and blood', topicId: 'the-heart-blood-vessels-and-blood' },
      // And for 8.9 to 8.11: respiration and its core practical belong to neither of the
      // two Unit 8 rows above, which are about gas exchange and about transport.
      { title: 'Unit 8: aerobic and anaerobic respiration', topicId: 'aerobic-and-anaerobic-respiration' },
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
      { title: 'Meiosis and sexual reproduction', topicId: 'meiosis-and-sexual-reproduction' },
      { title: 'DNA, genes and protein synthesis', topicId: 'dna-genes-and-protein-synthesis' },
      { title: 'Inheritance and genetic diagrams', topicId: 'inheritance-and-genetic-diagrams' },
      { title: 'Genetic disorders and screening', topicId: 'genetic-disorders-and-screening' },
    ] },
    { year: 11, term: 'Spring', topics: [
      { title: 'Variation and natural selection', topicId: 'variation-and-natural-selection' },
      { title: 'Evidence for evolution and classification', topicId: 'evidence-for-evolution-and-classification' },
      { title: 'Selective breeding and genetic engineering', topicId: 'selective-breeding-and-genetic-engineering' },
    ] },
  ],
  'computer-science': [
    { year: 9, term: 'Autumn', topics: [
      { title: 'Problem solving', topicId: 'problem-solving-and-algorithms' },
      { title: 'Decomposition and abstraction', topicId: 'decomposition-and-abstraction' },
      { title: 'Flow charts and pseudo-code', topicId: 'flow-charts-and-pseudo-code' },
      { title: 'Linear and binary search', topicId: 'linear-and-binary-search' },
    ] },
    { year: 9, term: 'Spring', topics: [
      { title: 'Data types and operators', topicId: 'data-types-and-operators' },
      { title: 'Selection, iteration and tracing', topicId: 'selection-iteration-and-tracing' },
      { title: 'Arrays', topicId: 'arrays-and-records' },
    ] },
    { year: 9, term: 'Summer', topics: [
      { title: 'Storage units and binary', topicId: 'storage-units-and-binary' },
      { title: 'Binary arithmetic', topicId: 'binary-arithmetic' },
      { title: 'ASCII and Unicode', topicId: 'ascii-and-unicode' },
      { title: 'Representing images and sound', topicId: 'representing-images-and-sound' },
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
      { title: 'Classification of programming languages', topicId: 'classification-of-programming-languages' },
      { title: 'The CPU and memory', topicId: 'the-cpu-and-memory' },
      { title: 'Secondary storage', topicId: 'secondary-storage' },
      { title: 'Databases and SQL', topicId: 'databases-and-sql' },
    ] },
    { year: 11, term: 'Spring', topics: [
      { title: 'Networking', topicId: 'networking' },
      { title: 'Cyber security threats', topicId: 'cyber-security-threats' },
      { title: 'Social engineering and prevention', topicId: 'social-engineering-and-prevention' },
      { title: 'Ethical, legal and environmental issues', topicId: 'ethical-legal-and-environmental-issues' },
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
      { title: 'Making operational decisions', topicId: 'making-operational-decisions' },
      { title: 'Making financial decisions', topicId: 'making-financial-decisions' },
    ] },
    { year: 11, term: 'Spring', topics: [
      { title: 'Making human resource decisions', topicId: 'making-human-resource-decisions' },
    ] },
  ],
  'french': [
    { year: 9, term: 'Autumn', topics: [
      { title: 'Events in the Francophone world', topicId: 'events-in-the-francophone-world' },
      { title: 'Opinions with nouns and infinitives', topicId: 'opinions-with-nouns-and-infinitives' },
      { title: 'Life online', topicId: 'life-online' },
      { title: 'Staying active', topicId: 'staying-active' },
      { title: 'The present tense, regular and irregular', topicId: 'the-present-tense-regular-and-irregular' },
      { title: 'What you watch', topicId: 'what-you-watch' },
      { title: 'Plans to go out, with the near future', topicId: 'plans-to-go-out-with-the-near-future' },
      { title: 'Last weekend, with the perfect tense', topicId: 'last-weekend-with-the-perfect-tense' },
      { title: 'Forming and answering questions', topicId: 'forming-and-answering-questions' },
    ] },
    { year: 9, term: 'Spring', topics: [
      { title: 'Identity', topicId: 'identity' },
      { title: 'Weekend routine, with reflexive verbs', topicId: 'weekend-routine-with-reflexive-verbs' },
      { title: 'Friends and friendship', topicId: 'friends-and-friendship' },
      { title: 'Describing people', topicId: 'describing-people' },
      { title: 'Position of adjectives', topicId: 'position-of-adjectives' },
      { title: 'Positive role models', topicId: 'positive-role-models' },
      { title: 'Direct object pronouns', topicId: 'direct-object-pronouns' },
      { title: 'Celebrations', topicId: 'celebrations' },
      { title: 'Combining present, perfect and near future', topicId: 'combining-present-perfect-and-near-future' },
    ] },
    { year: 9, term: 'Summer', topics: [
      { title: 'School life in Francophone countries', topicId: 'school-life-in-francophone-countries' },
      { title: 'Subjects and school life', topicId: 'subjects-and-school-life' },
      { title: 'School rules', topicId: 'school-rules' },
      { title: 'Progress at school', topicId: 'progress-at-school' },
      { title: 'What school used to be like, with the imperfect', topicId: 'what-school-used-to-be-like-with-the-imperfect' },
      { title: 'Learning languages', topicId: 'learning-languages' },
      { title: 'Combining present, near future and imperfect', topicId: 'combining-present-near-future-and-imperfect' },
      { title: 'Meals and mealtimes', topicId: 'meals-and-mealtimes' },
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
      { title: 'Exam skills practice', topicId: 'exam-skills-practice' },
    ] },
    { year: 11, term: 'Spring', topics: [
      { title: 'Exam skills: listening, reading, writing, speaking and translation', topicId: 'exam-skills-listening-reading-writing-speaking-and-translation' },
    ] },
  ],
  /**
   * Further Maths has no school curriculum overview — the other eight subjects are ordered
   * by one, and the school publishes none for this qualification. The order here is derived
   * instead from the GCSE topic each row depends on: Year 10 rows are the ones whose Maths
   * prerequisites the school teaches in Years 9 and 10, and Year 11 rows are the ones that
   * need Maths content taught in Year 11. See docs/curriculum/further-maths.md.
   */
  'further-maths': [
    { year: 10, term: 'Autumn', topics: [
      { title: 'Surds and exact calculation', topicId: 'surds-and-exact-calculation' },
      { title: 'The product rule for counting', topicId: 'the-product-rule-for-counting' },
      { title: 'Expanding, and the binomial expansion', topicId: 'expanding-and-the-binomial-expansion' },
      { title: 'Factorising at Further Maths level', topicId: 'factorising-at-further-maths-level' },
    ] },
    { year: 10, term: 'Spring', topics: [
      { title: 'Completing the square and quadratic equations', topicId: 'completing-the-square-and-quadratic-equations' },
      { title: 'Quadratic inequalities and index equations', topicId: 'quadratic-inequalities-and-index-equations' },
      { title: 'The factor theorem and cubics', topicId: 'the-factor-theorem-and-cubics' },
      { title: 'Sequences and limiting values', topicId: 'sequences-and-limiting-values' },
    ] },
    { year: 10, term: 'Summer', topics: [
      { title: 'Gradients, distance and points on a line', topicId: 'gradients-distance-and-points-on-a-line' },
      { title: 'Differentiation and the gradient function', topicId: 'differentiation-and-the-gradient-function' },
      { title: 'Tangents, normals, and increasing and decreasing functions', topicId: 'tangents-normals-and-increasing-functions' },
      { title: 'Maxima, minima and optimisation', topicId: 'maxima-minima-and-optimisation' },
    ] },
    { year: 11, term: 'Autumn', topics: [
      { title: 'Functions: domain, range, composite and inverse', topicId: 'functions-domain-range-composite-and-inverse' },
      { title: 'Algebraic fractions at Further Maths level', topicId: 'algebraic-fractions-at-further-maths-level' },
      { title: 'Rearranging formulae and algebraic proof', topicId: 'rearranging-formulae-and-algebraic-proof' },
      { title: 'Simultaneous equations, including three unknowns', topicId: 'simultaneous-equations-including-three-unknowns' },
    ] },
    { year: 11, term: 'Spring', topics: [
      { title: 'Circles and the tangent at a point', topicId: 'circles-and-the-tangent-at-a-point' },
      { title: 'Matrix multiplication and the identity', topicId: 'matrix-multiplication-and-the-identity' },
      { title: 'Transformations of the unit square', topicId: 'transformations-of-the-unit-square' },
    ] },
    { year: 11, term: 'Summer', topics: [
      { title: 'Trigonometry and Pythagoras in 2D and 3D', topicId: 'trigonometry-and-pythagoras-in-2d-and-3d' },
      { title: 'Trigonometric graphs, identities and equations', topicId: 'trigonometric-graphs-identities-and-equations' },
      { title: 'Geometrical proof', topicId: 'geometrical-proof' },
    ] },
  ],
  'music': [
    { year: 9, term: 'Autumn', topics: [
      { title: 'Pop music through the decades', topicId: 'pop-music-through-the-decades' },
      { title: 'Fusion music, including bhangra and reggaeton', topicId: 'fusion-music-bhangra-and-reggaeton' },
    ] },
    { year: 9, term: 'Spring', topics: [
      { title: 'Classical history', topicId: 'classical-history' },
      { title: 'Theme and variations', topicId: 'theme-and-variations' },
    ] },
    { year: 9, term: 'Summer', topics: [
      { title: 'Film composition and developing motifs', topicId: 'film-composition-and-motifs' },
      { title: 'Vocal music', topicId: 'singing-and-word-setting' },
      { title: 'Analysis of an exemplar set work', topicId: 'analysing-a-set-work' },
    ] },
    { year: 10, term: 'Autumn 1 and 2', topics: [
      { title: 'Killer Queen', topicId: 'killer-queen' },
      { title: 'Star Wars main title', topicId: 'star-wars' },
    ] },
    { year: 10, term: 'Spring', topics: [
      { title: 'History of instrumental music', topicId: 'history-of-instrumental-music' },
      { title: 'Bach: Brandenburg Concerto No. 5, third movement', topicId: 'bach-brandenburg-5' },
      { title: 'Afro Celt Sound System: Release', topicId: 'afro-celt-release' },
    ] },
    { year: 10, term: 'Summer', topics: [
      { title: 'Esperanza Spalding: Samba Em Preludio', topicId: 'samba-em-preludio' },
      { title: 'Defying Gravity from Wicked', topicId: 'defying-gravity' },
    ] },
    { year: 11, term: 'Autumn', topics: [
      { title: 'Beethoven: Pathétique, first movement', topicId: 'beethoven-pathetique' },
      { title: 'Purcell: Music for a While', topicId: 'purcell-music-for-a-while' },
    ] },
    { year: 11, term: 'Spring', topics: [
      { title: 'Musical dictation', topicId: 'musical-dictation' },
      { title: 'Analysing unfamiliar music', topicId: 'analysing-unfamiliar-music' },
      { title: 'Short analysis essays', topicId: 'short-analysis-essays' },
    ] },
  ],
  /**
   * English is two subjects here, both ordered by the school's one English overview
   * (docs/curriculum/english.md), which teaches the two qualifications as a single course
   * and names its units by the exam's own papers and sections. The Language rows are those
   * sections, question by question. Year 9's Romeo and Juliet and Of Mice and Men are not
   * examined, so their rows point at the skill each was chosen to teach. Language in Year 11
   * is revision of both papers, listed so the student can see what the class revisits.
   */
  'english-language': [
    { year: 9, term: 'Autumn 2', topics: [
      { title: 'Letter writing: letters, speeches and articles', topicId: 'letters-speeches-and-articles' },
    ] },
    { year: 9, term: 'Spring 1', topics: [
      { title: 'Of Mice and Men: language techniques and their effect', topicId: 'paper-1-finding-and-analysing-language' },
    ] },
    { year: 9, term: 'Spring 2', topics: [
      { title: 'Narrative writing', topicId: 'narrative-writing' },
    ] },
    { year: 9, term: 'Summer 1', topics: [
      { title: 'Descriptive writing', topicId: 'descriptive-writing' },
    ] },
    { year: 9, term: 'Summer 2', topics: [
      { title: 'Paper 2 writing: a letter, speech or article from a prompt', topicId: 'arguing-a-point-of-view' },
      { title: 'Social change: reading 19th-century non-fiction', topicId: 'reading-nineteenth-century-non-fiction' },
    ] },
    { year: 10, term: 'Autumn 2', topics: [
      { title: 'Paper 1 Questions 1 and 2: finding information and analysing language', topicId: 'paper-1-finding-and-analysing-language' },
      { title: 'Paper 1 Question 3: how the writer structures the text', topicId: 'paper-1-structure' },
      { title: 'Paper 1 Question 4: evaluating a statement', topicId: 'paper-1-evaluation' },
      { title: 'Paper 1 Question 5: descriptive writing', topicId: 'descriptive-writing' },
      { title: 'Paper 1 Question 5: narrative writing', topicId: 'narrative-writing' },
      { title: 'Technical accuracy: sentences, punctuation and spelling', topicId: 'technical-accuracy' },
    ] },
    { year: 10, term: 'Spring 1', topics: [
      { title: 'Paper 2 Questions 1 and 2: true statements and the summary', topicId: 'paper-2-true-statements-and-summary' },
      { title: 'Paper 2 Question 3: language in non-fiction', topicId: 'paper-2-language-in-non-fiction' },
      { title: 'Paper 2 Question 4: comparing viewpoints and perspectives', topicId: 'paper-2-comparing-viewpoints' },
      { title: 'Reading 19th-century non-fiction', topicId: 'reading-nineteenth-century-non-fiction' },
      { title: 'Paper 2 Question 5: arguing a point of view', topicId: 'arguing-a-point-of-view' },
      { title: 'Paper 2 Question 5: letters, speeches and articles', topicId: 'letters-speeches-and-articles' },
    ] },
    { year: 10, term: 'Summer 2', topics: [
      { title: 'Speaking and Listening: the spoken language endorsement', topicId: 'spoken-language-endorsement' },
    ] },
    { year: 11, term: 'Autumn 1', topics: [
      { title: 'Paper 1 revision: finding information and analysing language', topicId: 'paper-1-finding-and-analysing-language' },
      { title: 'Paper 1 revision: structure', topicId: 'paper-1-structure' },
      { title: 'Paper 1 revision: evaluating a statement', topicId: 'paper-1-evaluation' },
      { title: 'Paper 1 revision: descriptive and narrative writing', topicId: 'descriptive-writing' },
      { title: 'Paper 1 revision: technical accuracy', topicId: 'technical-accuracy' },
    ] },
    { year: 11, term: 'Autumn 2 and Spring 1', topics: [
      { title: 'Paper 2 revision: true statements and the summary', topicId: 'paper-2-true-statements-and-summary' },
      { title: 'Paper 2 revision: language in non-fiction', topicId: 'paper-2-language-in-non-fiction' },
      { title: 'Paper 2 revision: comparing viewpoints and perspectives', topicId: 'paper-2-comparing-viewpoints' },
      { title: 'Paper 2 revision: 19th-century non-fiction', topicId: 'reading-nineteenth-century-non-fiction' },
      { title: 'Paper 2 revision: arguing a point of view in a letter, speech or article', topicId: 'arguing-a-point-of-view' },
    ] },
  ],
  'english-literature': [
    { year: 9, term: 'Autumn 1', topics: [
      { title: 'Romeo and Juliet: analysing an extract', topicId: 'answering-an-extract-question' },
    ] },
    { year: 9, term: 'Summer 1', topics: [
      { title: 'Introduction to conflict poetry', topicId: 'power-and-conflict-cluster-and-comparison' },
    ] },
    { year: 9, term: 'Summer 2', topics: [
      { title: 'Social change and links to An Inspector Calls', topicId: 'an-inspector-calls-context-and-the-essay-question' },
    ] },
    { year: 10, term: 'Autumn 1', topics: [
      { title: 'An Inspector Calls: plot and structure', topicId: 'an-inspector-calls-plot-and-structure' },
      { title: 'An Inspector Calls: the Birlings and Gerald', topicId: 'the-birlings-and-gerald' },
      { title: 'An Inspector Calls: the Inspector and Eva Smith', topicId: 'the-inspector-and-eva-smith' },
      { title: 'An Inspector Calls: responsibility, class, age and gender', topicId: 'an-inspector-calls-themes' },
      { title: 'An Inspector Calls: context and the essay question', topicId: 'an-inspector-calls-context-and-the-essay-question' },
    ] },
    { year: 10, term: 'Spring 2', topics: [
      { title: 'Macbeth: plot and structure', topicId: 'macbeth-plot-and-structure' },
      { title: 'Macbeth: Macbeth and Lady Macbeth', topicId: 'macbeth-and-lady-macbeth' },
      { title: 'Macbeth: Banquo, Macduff, Duncan and the witches', topicId: 'banquo-macduff-duncan-and-the-witches' },
    ] },
    { year: 10, term: 'Summer 1', topics: [
      { title: 'Macbeth: ambition, power, guilt and the supernatural', topicId: 'macbeth-themes' },
      { title: 'Macbeth: context and the extract question', topicId: 'macbeth-context-and-the-extract-question' },
    ] },
    { year: 11, term: 'Autumn 1', topics: [
      { title: 'Jekyll and Hyde: plot and structure', topicId: 'jekyll-and-hyde-plot-and-structure' },
      { title: 'Jekyll and Hyde: Jekyll, Hyde, Utterson and Lanyon', topicId: 'jekyll-hyde-utterson-and-lanyon' },
    ] },
    { year: 11, term: 'Autumn 2', topics: [
      { title: 'Jekyll and Hyde: duality, secrecy, science and reputation', topicId: 'jekyll-and-hyde-themes' },
      { title: 'Jekyll and Hyde: context and the extract question', topicId: 'jekyll-and-hyde-context-and-the-extract-question' },
    ] },
    { year: 11, term: 'Spring 1', topics: [
      { title: 'Power and Conflict: the cluster and the comparison question', topicId: 'power-and-conflict-cluster-and-comparison' },
      { title: 'The power of humans: Ozymandias, London, My Last Duchess and Tissue', topicId: 'the-power-of-humans' },
      { title: 'The power of nature: The Prelude, Storm on the Island and Exposure', topicId: 'the-power-of-nature' },
      { title: 'The reality of war: The Charge of the Light Brigade, Bayonet Charge, Remains and Kamikaze', topicId: 'the-reality-of-war' },
      { title: 'Memory, identity and loss: Poppies, War Photographer, The Emigrée and Checking Out Me History', topicId: 'memory-identity-and-loss' },
    ] },
    { year: 11, term: 'Spring 2', topics: [
      { title: 'An Inspector Calls revision: plot, characters, themes and context', topicId: 'an-inspector-calls-plot-and-structure' },
      { title: 'Unseen poetry: analysing one poem' },
      { title: 'Unseen poetry: comparing two poems' },
    ] },
  ],
}
