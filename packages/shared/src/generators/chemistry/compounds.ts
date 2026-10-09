/**
 * The name of every substance the Chemistry generators print, one table for all four
 * generator files, so a formula is called the same thing in every question: FeCO3 is always
 * iron(II) carbonate, CuO always copper(II) oxide. Transition-metal compounds carry their
 * Roman numeral; HCl is hydrochloric acid, the form every question meets it in. Elements
 * stand under the formula they react as (O2 oxygen, Mg magnesium).
 *
 * A fact, where there is one, is a true sentence said after the name and formula in a prompt:
 * "Calcium carbonate, CaCO3, is the main compound in limestone." build.test.ts checks every
 * formula parses and that no name is used twice.
 */
import { mr } from './build.ts'

export interface Compound {
  name: string
  /** A true sentence about it, said after its name and formula: "is the main compound in limestone". */
  fact?: string
}

export const COMPOUNDS: Record<string, Compound> = {
  H2O: { name: 'water', fact: 'forms when hydrogen burns in oxygen' },
  CO2: { name: 'carbon dioxide', fact: 'is made when a fuel containing carbon burns completely' },
  NH3: { name: 'ammonia', fact: 'is made from nitrogen and hydrogen in the Haber process' },
  CH4: { name: 'methane', fact: 'is the main gas in natural gas' },
  SO2: { name: 'sulfur dioxide', fact: 'forms when fuels containing sulfur burn, and causes acid rain' },
  SO3: { name: 'sulfur trioxide', fact: 'reacts with water to make sulfuric acid' },
  NO2: { name: 'nitrogen dioxide', fact: 'is one of the oxides of nitrogen that cause acid rain' },
  H2S: { name: 'hydrogen sulfide', fact: 'is the gas that smells of bad eggs' },
  C2H6: { name: 'ethane', fact: 'is the alkane with two carbon atoms' },
  C3H8: { name: 'propane', fact: 'is used as a fuel in gas cylinders' },
  C4H10: { name: 'butane', fact: 'is the fuel in many lighters' },
  C5H12: { name: 'pentane', fact: 'is the alkane with five carbon atoms' },
  C8H18: { name: 'octane', fact: 'is one of the alkanes in petrol' },
  C2H4: { name: 'ethene', fact: 'is made by cracking larger alkanes' },
  C3H6: { name: 'propene', fact: 'is the monomer that makes poly(propene)' },
  MgCl2: { name: 'magnesium chloride', fact: 'forms when magnesium reacts with hydrochloric acid' },
  CaCl2: { name: 'calcium chloride', fact: 'forms when calcium carbonate reacts with hydrochloric acid' },
  CuCl2: { name: 'copper(II) chloride', fact: 'forms when copper(II) oxide reacts with hydrochloric acid' },
  ZnCl2: { name: 'zinc chloride', fact: 'forms when zinc reacts with hydrochloric acid' },
  FeCl3: { name: 'iron(III) chloride', fact: 'forms when iron burns in chlorine' },
  AlCl3: { name: 'aluminium chloride', fact: 'forms when aluminium is heated in chlorine' },
  Na2O: { name: 'sodium oxide', fact: 'forms when sodium reacts with oxygen' },
  Li2O: { name: 'lithium oxide', fact: 'forms when lithium burns in oxygen' },
  Al2O3: { name: 'aluminium oxide', fact: 'is electrolysed to extract aluminium' },
  Fe2O3: { name: 'iron(III) oxide', fact: 'is the main compound in haematite, an iron ore' },
  CaF2: { name: 'calcium fluoride', fact: 'is the compound in the mineral fluorite' },
  SiO2: { name: 'silicon dioxide', fact: 'is the main compound in sand' },
  CaCO3: { name: 'calcium carbonate', fact: 'is the main compound in limestone' },
  Na2CO3: { name: 'sodium carbonate', fact: 'reacts with acids to give carbon dioxide' },
  MgCO3: { name: 'magnesium carbonate', fact: 'breaks down on heating to give magnesium oxide and carbon dioxide' },
  CuCO3: { name: 'copper(II) carbonate', fact: 'is a green solid that turns black on heating' },
  ZnCO3: { name: 'zinc carbonate', fact: 'breaks down on heating to give zinc oxide and carbon dioxide' },
  CuSO4: { name: 'copper(II) sulfate', fact: 'forms when copper(II) oxide reacts with sulfuric acid' },
  K2SO4: { name: 'potassium sulfate', fact: 'is used as a fertiliser' },
  MgSO4: { name: 'magnesium sulfate', fact: 'forms when magnesium reacts with sulfuric acid' },
  ZnSO4: { name: 'zinc sulfate', fact: 'forms when zinc reacts with sulfuric acid' },
  Na2SO4: { name: 'sodium sulfate', fact: 'forms when sodium hydroxide neutralises sulfuric acid' },
  FeSO4: { name: 'iron(II) sulfate', fact: 'forms when iron reacts with dilute sulfuric acid' },
  BaSO4: { name: 'barium sulfate', fact: 'is the white precipitate in the test for sulfate ions' },
  H2SO4: { name: 'sulfuric acid', fact: 'is the acid in car batteries' },
  HNO3: { name: 'nitric acid', fact: 'is made from ammonia and used to make fertilisers' },
  H3PO4: { name: 'phosphoric acid', fact: 'is used to make phosphate fertilisers' },
  KNO3: { name: 'potassium nitrate', fact: 'is a fertiliser that supplies both potassium and nitrogen' },
  Li2CO3: { name: 'lithium carbonate', fact: 'is used to make the lithium compounds in rechargeable batteries' },
  AgNO3: { name: 'silver nitrate', fact: 'is used in the test for halide ions' },
  NH4Cl: { name: 'ammonium chloride', fact: 'forms when ammonia reacts with hydrochloric acid' },
  C6H12O6: { name: 'glucose', fact: 'is made by plants in photosynthesis' },
  KMnO4: { name: 'potassium manganate(VII)', fact: 'dissolves in water to give a purple solution' },
  'Mg(OH)2': { name: 'magnesium hydroxide', fact: 'is used in indigestion remedies to neutralise stomach acid' },
  'Ca(OH)2': { name: 'calcium hydroxide', fact: 'dissolves in water to make limewater' },
  'Al(OH)3': { name: 'aluminium hydroxide', fact: 'is used in some indigestion remedies' },
  'Fe(OH)2': { name: 'iron(II) hydroxide', fact: 'is the green precipitate in the test for iron(II) ions' },
  'Fe(OH)3': { name: 'iron(III) hydroxide', fact: 'is the brown precipitate in the test for iron(III) ions' },
  'Cu(OH)2': { name: 'copper(II) hydroxide', fact: 'is the blue precipitate in the test for copper(II) ions' },
  'Zn(OH)2': { name: 'zinc hydroxide', fact: 'forms as a white precipitate when sodium hydroxide solution is added to a solution of a zinc salt' },
  'Ba(OH)2': { name: 'barium hydroxide', fact: 'dissolves in water to give an alkaline solution' },
  'Ca(NO3)2': { name: 'calcium nitrate', fact: 'is used as a fertiliser' },
  'Mg(NO3)2': { name: 'magnesium nitrate', fact: 'forms when magnesium oxide reacts with nitric acid' },
  'Cu(NO3)2': { name: 'copper(II) nitrate', fact: 'forms when copper(II) oxide reacts with nitric acid' },
  'Zn(NO3)2': { name: 'zinc nitrate', fact: 'forms when zinc oxide reacts with nitric acid' },
  'Pb(NO3)2': { name: 'lead(II) nitrate', fact: 'gives a yellow precipitate with potassium iodide solution' },
  'Al2(SO4)3': { name: 'aluminium sulfate', fact: 'is used in treating drinking water' },
  'Fe2(SO4)3': { name: 'iron(III) sulfate', fact: 'forms when iron(III) oxide reacts with sulfuric acid' },
  '(NH4)2SO4': { name: 'ammonium sulfate', fact: 'is a fertiliser made from ammonia and sulfuric acid' },
  '(NH4)3PO4': { name: 'ammonium phosphate', fact: 'is a fertiliser made from ammonia and phosphoric acid' },
  '(NH4)2CO3': { name: 'ammonium carbonate', fact: 'breaks down on warming to give ammonia' },
  MgO: { name: 'magnesium oxide', fact: 'forms when magnesium burns in air' },
  NaOH: { name: 'sodium hydroxide', fact: 'dissolves in water to give an alkaline solution' },
  NH4NO3: { name: 'ammonium nitrate', fact: 'is a fertiliser made from ammonia and nitric acid' },
  TiO2: { name: 'titanium dioxide', fact: 'is the white pigment in most white paints' },
  HF: { name: 'hydrogen fluoride', fact: 'dissolves in water to give hydrofluoric acid' },
  CaC2: { name: 'calcium carbide', fact: 'reacts with water to give the gas ethyne' },
  CH3OH: { name: 'methanol', fact: 'is the alcohol with one carbon atom' },
  CH3COOH: { name: 'ethanoic acid', fact: 'is the acid in vinegar' },
  C2H5OH: { name: 'ethanol', fact: 'is the alcohol in alcoholic drinks' },
  Li3N: { name: 'lithium nitride', fact: 'forms when lithium reacts with nitrogen' },
  SiC: { name: 'silicon carbide', fact: 'is a very hard solid used in cutting tools' },
  N2H4: { name: 'hydrazine', fact: 'is used as a rocket fuel' },
  PH3: { name: 'phosphine', fact: 'is a poisonous gas' },
  KCl: { name: 'potassium chloride', fact: 'is used as a potassium fertiliser' },
  'CO(NH2)2': { name: 'urea', fact: 'is a fertiliser made from ammonia and carbon dioxide' },
  FeCO3: { name: 'iron(II) carbonate', fact: 'is the main compound in the iron ore siderite' },
  K2CO3: { name: 'potassium carbonate', fact: 'dissolves in water to give an alkaline solution' },
  BaCO3: { name: 'barium carbonate', fact: 'is a white solid that does not dissolve in water' },
  'Ba(NO3)2': { name: 'barium nitrate', fact: 'forms when barium carbonate reacts with nitric acid' },
  'Fe(NO3)3': { name: 'iron(III) nitrate', fact: 'forms when iron(III) oxide reacts with nitric acid' },
  'Al(NO3)3': { name: 'aluminium nitrate', fact: 'forms when aluminium oxide reacts with nitric acid' },
  'Ca3(PO4)2': { name: 'calcium phosphate', fact: 'is the main compound in phosphate rock, which is mined to make fertilisers' },
  'Mg3(PO4)2': { name: 'magnesium phosphate', fact: 'is a white solid that does not dissolve in water' },
  O2: { name: 'oxygen' },
  N2: { name: 'nitrogen' },
  H2: { name: 'hydrogen' },
  Cl2: { name: 'chlorine' },
  CaO: { name: 'calcium oxide' },
  CuO: { name: 'copper(II) oxide' },
  ZnO: { name: 'zinc oxide' },
  NaCl: { name: 'sodium chloride' },
  HCl: { name: 'hydrochloric acid' },
  C6H14: { name: 'hexane' },
  NaHCO3: { name: 'sodium hydrogencarbonate' },
  Mg: { name: 'magnesium' },
  Fe: { name: 'iron' },
  Cu: { name: 'copper' },
  Zn: { name: 'zinc' },
  Al: { name: 'aluminium' },
  Na: { name: 'sodium' },
  Ca: { name: 'calcium' },
  Li: { name: 'lithium' },
  S: { name: 'sulfur' },
  FeS: { name: 'iron sulfide' },
  ZnS: { name: 'zinc sulfide' },
  C: { name: 'carbon' },
  CO: { name: 'carbon monoxide' },
  Cr: { name: 'chromium' },
  Cr2O3: { name: 'chromium oxide' },
  Pb: { name: 'lead' },
  PbO: { name: 'lead oxide' },
  W: { name: 'tungsten' },
  WO3: { name: 'tungsten oxide' },
  Ti: { name: 'titanium' },
  TiCl4: { name: 'titanium chloride' },
  C10H22: { name: 'decane' },
  KBr: { name: 'potassium bromide' },
  KOH: { name: 'potassium hydroxide' },
  AgCl: { name: 'silver chloride' },
  AgBr: { name: 'silver bromide' },
  AgI: { name: 'silver iodide' },
  NaBr: { name: 'sodium bromide' },
  BaCl2: { name: 'barium chloride' },
  H2O2: { name: 'hydrogen peroxide' },
  KI: { name: 'potassium iodide' },
  I2: { name: 'iodine' },
  Br2: { name: 'bromine' },
  PbI2: { name: 'lead iodide' },
}

/**
 * Ores by the formula of the compound they are mostly made of, named by the mineral. A
 * mineral is a rock, not a compound, so these names live apart from COMPOUNDS: ZnS is zinc
 * sulfide in an equation and zinc blende only when the question is about the ore.
 */
export const ORES: Record<string, Required<Compound>> = {
  Fe3O4: { name: 'magnetite', fact: 'is an iron ore' },
  FeCO3: { name: 'siderite', fact: 'is an iron ore' },
  Cu2S: { name: 'chalcocite', fact: 'is a copper ore' },
  CuFeS2: { name: 'chalcopyrite', fact: 'is the commonest copper ore' },
  ZnS: { name: 'zinc blende', fact: 'is a zinc ore' },
  PbS: { name: 'galena', fact: 'is a lead ore' },
  Cu2O: { name: 'cuprite', fact: 'is a copper ore' },
  SnO2: { name: 'cassiterite', fact: 'is a tin ore' },
  MnO2: { name: 'pyrolusite', fact: 'is a manganese ore' },
}

/** The substance's name, which the table must hold. */
export function nameOf(formula: string): string {
  const c = COMPOUNDS[formula]
  if (!c) throw new Error(`No name for ${formula}`)
  return c.name
}

/** The compound with its fact, for a prompt that says one: the table must hold both. */
export function factual(formula: string): Required<Compound> {
  const c = COMPOUNDS[formula]
  if (!c?.fact) throw new Error(`No fact for ${formula}`)
  return { name: c.name, fact: c.fact }
}

for (const f of [...Object.keys(COMPOUNDS), ...Object.keys(ORES)]) mr(f)
