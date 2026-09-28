/**
 * The elements on AQA's periodic table insert for GCSE Chemistry (AQA-8462-8464-8465-INS-PT),
 * read from the PDF cell by cell: 90 elements, the lanthanides (58 to 71) and actinides (90
 * to 103) left out as the insert leaves them out, and relative atomic masses rounded to
 * whole numbers except copper (63.5) and chlorine (35.5), as the insert says. A mass in
 * brackets is the insert's own: the mass number of the most stable isotope of an element
 * with no stable one.
 *
 * The insert prints flerovium's symbol as "FI"; it is Fl.
 *
 * Group and period place each element in the main table, with lanthanum and actinium in
 * group 3 where the insert puts them. Groups are numbered 1 to 18 here for layout; the
 * specification calls 13 to 18 Groups 3 to 7 and Group 0, and `groupName` gives those.
 */
export type ElementFamily =
  | 'alkali-metal' | 'alkaline-earth-metal' | 'transition-metal' | 'other-metal'
  | 'metalloid' | 'non-metal' | 'halogen' | 'noble-gas'

export interface Element {
  z: number
  symbol: string
  name: string
  /** As printed: '56', '63.5', '[223]'. */
  mass: string
  group: number
  period: number
  family: ElementFamily
}

type Row = [number, string, string, string, number, number, ElementFamily]
const ROWS: Row[] = [
  [1, 'H', 'hydrogen', '1', 1, 1, 'non-metal'],
  [2, 'He', 'helium', '4', 18, 1, 'noble-gas'],
  [3, 'Li', 'lithium', '7', 1, 2, 'alkali-metal'],
  [4, 'Be', 'beryllium', '9', 2, 2, 'alkaline-earth-metal'],
  [5, 'B', 'boron', '11', 13, 2, 'metalloid'],
  [6, 'C', 'carbon', '12', 14, 2, 'non-metal'],
  [7, 'N', 'nitrogen', '14', 15, 2, 'non-metal'],
  [8, 'O', 'oxygen', '16', 16, 2, 'non-metal'],
  [9, 'F', 'fluorine', '19', 17, 2, 'halogen'],
  [10, 'Ne', 'neon', '20', 18, 2, 'noble-gas'],
  [11, 'Na', 'sodium', '23', 1, 3, 'alkali-metal'],
  [12, 'Mg', 'magnesium', '24', 2, 3, 'alkaline-earth-metal'],
  [13, 'Al', 'aluminium', '27', 13, 3, 'other-metal'],
  [14, 'Si', 'silicon', '28', 14, 3, 'metalloid'],
  [15, 'P', 'phosphorus', '31', 15, 3, 'non-metal'],
  [16, 'S', 'sulfur', '32', 16, 3, 'non-metal'],
  [17, 'Cl', 'chlorine', '35.5', 17, 3, 'halogen'],
  [18, 'Ar', 'argon', '40', 18, 3, 'noble-gas'],
  [19, 'K', 'potassium', '39', 1, 4, 'alkali-metal'],
  [20, 'Ca', 'calcium', '40', 2, 4, 'alkaline-earth-metal'],
  [21, 'Sc', 'scandium', '45', 3, 4, 'transition-metal'],
  [22, 'Ti', 'titanium', '48', 4, 4, 'transition-metal'],
  [23, 'V', 'vanadium', '51', 5, 4, 'transition-metal'],
  [24, 'Cr', 'chromium', '52', 6, 4, 'transition-metal'],
  [25, 'Mn', 'manganese', '55', 7, 4, 'transition-metal'],
  [26, 'Fe', 'iron', '56', 8, 4, 'transition-metal'],
  [27, 'Co', 'cobalt', '59', 9, 4, 'transition-metal'],
  [28, 'Ni', 'nickel', '59', 10, 4, 'transition-metal'],
  [29, 'Cu', 'copper', '63.5', 11, 4, 'transition-metal'],
  [30, 'Zn', 'zinc', '65', 12, 4, 'transition-metal'],
  [31, 'Ga', 'gallium', '70', 13, 4, 'other-metal'],
  [32, 'Ge', 'germanium', '73', 14, 4, 'metalloid'],
  [33, 'As', 'arsenic', '75', 15, 4, 'metalloid'],
  [34, 'Se', 'selenium', '79', 16, 4, 'non-metal'],
  [35, 'Br', 'bromine', '80', 17, 4, 'halogen'],
  [36, 'Kr', 'krypton', '84', 18, 4, 'noble-gas'],
  [37, 'Rb', 'rubidium', '85', 1, 5, 'alkali-metal'],
  [38, 'Sr', 'strontium', '88', 2, 5, 'alkaline-earth-metal'],
  [39, 'Y', 'yttrium', '89', 3, 5, 'transition-metal'],
  [40, 'Zr', 'zirconium', '91', 4, 5, 'transition-metal'],
  [41, 'Nb', 'niobium', '93', 5, 5, 'transition-metal'],
  [42, 'Mo', 'molybdenum', '96', 6, 5, 'transition-metal'],
  [43, 'Tc', 'technetium', '[98]', 7, 5, 'transition-metal'],
  [44, 'Ru', 'ruthenium', '101', 8, 5, 'transition-metal'],
  [45, 'Rh', 'rhodium', '103', 9, 5, 'transition-metal'],
  [46, 'Pd', 'palladium', '106', 10, 5, 'transition-metal'],
  [47, 'Ag', 'silver', '108', 11, 5, 'transition-metal'],
  [48, 'Cd', 'cadmium', '112', 12, 5, 'transition-metal'],
  [49, 'In', 'indium', '115', 13, 5, 'other-metal'],
  [50, 'Sn', 'tin', '119', 14, 5, 'other-metal'],
  [51, 'Sb', 'antimony', '122', 15, 5, 'metalloid'],
  [52, 'Te', 'tellurium', '128', 16, 5, 'metalloid'],
  [53, 'I', 'iodine', '127', 17, 5, 'halogen'],
  [54, 'Xe', 'xenon', '131', 18, 5, 'noble-gas'],
  [55, 'Cs', 'caesium', '133', 1, 6, 'alkali-metal'],
  [56, 'Ba', 'barium', '137', 2, 6, 'alkaline-earth-metal'],
  [57, 'La', 'lanthanum', '139', 3, 6, 'transition-metal'],
  [72, 'Hf', 'hafnium', '178', 4, 6, 'transition-metal'],
  [73, 'Ta', 'tantalum', '181', 5, 6, 'transition-metal'],
  [74, 'W', 'tungsten', '184', 6, 6, 'transition-metal'],
  [75, 'Re', 'rhenium', '186', 7, 6, 'transition-metal'],
  [76, 'Os', 'osmium', '190', 8, 6, 'transition-metal'],
  [77, 'Ir', 'iridium', '192', 9, 6, 'transition-metal'],
  [78, 'Pt', 'platinum', '195', 10, 6, 'transition-metal'],
  [79, 'Au', 'gold', '197', 11, 6, 'transition-metal'],
  [80, 'Hg', 'mercury', '201', 12, 6, 'transition-metal'],
  [81, 'Tl', 'thallium', '204', 13, 6, 'other-metal'],
  [82, 'Pb', 'lead', '207', 14, 6, 'other-metal'],
  [83, 'Bi', 'bismuth', '209', 15, 6, 'other-metal'],
  [84, 'Po', 'polonium', '[209]', 16, 6, 'other-metal'],
  [85, 'At', 'astatine', '[210]', 17, 6, 'halogen'],
  [86, 'Rn', 'radon', '[222]', 18, 6, 'noble-gas'],
  [87, 'Fr', 'francium', '[223]', 1, 7, 'alkali-metal'],
  [88, 'Ra', 'radium', '[226]', 2, 7, 'alkaline-earth-metal'],
  [89, 'Ac', 'actinium', '[227]', 3, 7, 'transition-metal'],
  [104, 'Rf', 'rutherfordium', '[261]', 4, 7, 'transition-metal'],
  [105, 'Db', 'dubnium', '[262]', 5, 7, 'transition-metal'],
  [106, 'Sg', 'seaborgium', '[266]', 6, 7, 'transition-metal'],
  [107, 'Bh', 'bohrium', '[264]', 7, 7, 'transition-metal'],
  [108, 'Hs', 'hassium', '[277]', 8, 7, 'transition-metal'],
  [109, 'Mt', 'meitnerium', '[268]', 9, 7, 'transition-metal'],
  [110, 'Ds', 'darmstadtium', '[271]', 10, 7, 'transition-metal'],
  [111, 'Rg', 'roentgenium', '[272]', 11, 7, 'transition-metal'],
  [112, 'Cn', 'copernicium', '[285]', 12, 7, 'transition-metal'],
  [113, 'Nh', 'nihonium', '[286]', 13, 7, 'other-metal'],
  [114, 'Fl', 'flerovium', '[289]', 14, 7, 'other-metal'],
  [115, 'Mc', 'moscovium', '[289]', 15, 7, 'other-metal'],
  [116, 'Lv', 'livermorium', '[293]', 16, 7, 'other-metal'],
  [117, 'Ts', 'tennessine', '[294]', 17, 7, 'halogen'],
  [118, 'Og', 'oganesson', '[294]', 18, 7, 'noble-gas'],
]

export const ELEMENTS: Element[] = ROWS.map(([z, symbol, name, mass, group, period, family]) => ({ z, symbol, name, mass, group, period, family }))

export const FAMILY_LABEL: Record<ElementFamily, string> = {
  'alkali-metal': 'Group 1: alkali metals',
  'alkaline-earth-metal': 'Group 2',
  'transition-metal': 'Transition metals',
  'other-metal': 'Other metals',
  'metalloid': 'Metalloids',
  'non-metal': 'Other non-metals',
  'halogen': 'Group 7: halogens',
  'noble-gas': 'Group 0: noble gases',
}

/**
 * What the specification says about each family (AQA 8462 4.1.2.3 to 4.1.3.2), in a line.
 * Metalloids are not named in the specification; the line says so rather than inventing.
 */
export const FAMILY_FACT: Record<ElementFamily, string> = {
  'alkali-metal': 'One electron in the outer shell. They react with oxygen, chlorine and water, and get more reactive going down the group.',
  'alkaline-earth-metal': 'Two electrons in the outer shell. Metals, so they react to form positive ions, here with a charge of 2+.',
  'transition-metal': 'Harder, stronger and denser than Group 1, with higher melting points and slower reactions. Many form ions with different charges, coloured compounds, and are useful catalysts.',
  'other-metal': 'Metals: they react to form positive ions. Found towards the bottom and the right of the metals.',
  'metalloid': 'On the border between metals and non-metals, with some properties of each. The specification does not name this group.',
  'non-metal': 'Non-metals do not form positive ions. They are found towards the right and the top of the table.',
  'halogen': 'Seven electrons in the outer shell, and molecules of two atoms. Melting and boiling points rise going down; reactivity falls, so a more reactive halogen displaces a less reactive one from a solution of its salt.',
  'noble-gas': 'A full outer shell, eight electrons (two for helium), so they are unreactive. Boiling points rise going down the group.',
}

/** The specification's name for a column: Groups 1 and 2, then 3 to 7 and 0 for columns 13 to 18. */
export function groupName(group: number): string {
  if (group <= 2) return `Group ${group}`
  if (group >= 13) return group === 18 ? 'Group 0' : `Group ${group - 10}`
  return 'Transition metals'
}

/** Electronic structure for the first 20 elements, the ones AQA asks for: 2, then 8, then 8, then 2. */
export function electronShells(z: number): number[] | undefined {
  if (z < 1 || z > 20) return undefined
  const out: number[] = []
  let left = z
  for (const cap of [2, 8, 8, 2]) { const n = Math.min(cap, left); if (n > 0) out.push(n); left -= n }
  return out
}

/** Neutrons in the usual atom, where the insert gives a whole-number mass for a stable element. */
export function neutrons(el: Pick<Element, 'z' | 'mass'>): number | undefined {
  if (!/^\d+$/.test(el.mass)) return undefined
  return Number(el.mass) - el.z
}
