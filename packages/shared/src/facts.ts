import type { SubjectId } from './subjects.ts'

/** One fun fact a day per subject, shown on the home screen. Short, true, and checkable. */
export const FUN_FACTS: Record<SubjectId, string[]> = {
  maths: [
    'There are more ways to shuffle a deck of 52 cards than there are atoms on Earth: 52 factorial is about 8 followed by 67 zeros.',
    'The equals sign was invented in 1557 by a Welsh mathematician, Robert Recorde, because he was tired of writing "is equal to".',
    'A pizza with radius z and height a has volume pi × z × z × a.',
    'Every even number tested so far is the sum of two primes, but nobody has proved it always works. That is the Goldbach conjecture.',
    'In any group of 23 people, there is a better than even chance that two share a birthday.',
    'Zero was treated as a number in India around 1,500 years ago. Roman numerals never had one.',
    'If you fold a sheet of paper 42 times, the stack would reach the Moon. You cannot, but the maths says so.',
    'The square root of 2 cannot be written as a fraction. The Greeks who found this out are said to have kept it secret.',
    '111,111,111 × 111,111,111 = 12,345,678,987,654,321.',
    'A googol is 1 followed by 100 zeros. The search engine misspelled it.',
  ],
  physics: [
    'Light from the Sun takes about eight minutes to reach you. You are always seeing the Sun as it was.',
    'A teaspoon of neutron star would weigh about a billion tonnes.',
    'Hot water can freeze faster than cold water in some conditions. Nobody fully agrees why. It is called the Mpemba effect.',
    'There is no sound in space: sound needs particles to travel through, and space has almost none.',
    'The Eiffel Tower is about 15 centimetres taller in summer because the iron expands in the heat.',
    'If the Sun were the size of a football, the nearest star would be about 6,000 kilometres away.',
    'A bolt of lightning is about five times hotter than the surface of the Sun.',
    'Your phone uses Einstein: GPS satellites have to correct for time running faster in weaker gravity, or maps would drift by kilometres a day.',
    'The spring in a car suspension obeys the same law as the one in a retractable pen.',
    'On the Moon you would weigh about a sixth of what you weigh here, but your mass would be exactly the same.',
  ],
  chemistry: ['Every atom in your body apart from hydrogen was made inside a star.', 'Glass is not a slow-flowing liquid. Old windows are thicker at the bottom because of how they were made.', 'Helium is the only element discovered in space before it was found on Earth.'],
  biology: ['You share about half your genes with a banana.', 'There are more bacterial cells in and on you than human cells.', 'Your body replaces its red blood cells every four months.'],
  'computer-science': ['The first computer bug was a real moth, found in a relay in 1947.', 'A modern phone has more computing power than all of NASA had for the Moon landings.', 'The word "byte" was chosen in 1956 and deliberately misspelled from "bite" so it would not be confused with "bit".'],
  business: ['Nintendo started in 1889 making playing cards.', 'Amazon was almost called Cadabra.', 'The first product barcode was scanned on a packet of chewing gum in 1974.'],
  french: ['About 300 million people speak French, on five continents.', 'Around a third of English words come from French, thanks to 1066.', 'The French Academy has decided what counts as correct French since 1635.'],
  music: ['The loudest sound ever recorded was the eruption of Krakatoa in 1883, heard 5,000 kilometres away.', 'Mozart wrote his first symphony at eight years old.', 'A piano has about 230 strings under a combined tension of around 20 tonnes.'],
}

export function factOfTheDay(subjectIds: SubjectId[], date = new Date()): { subjectId: SubjectId; text: string } | null {
  const pool = subjectIds.flatMap((s) => (FUN_FACTS[s] ?? []).map((text) => ({ subjectId: s, text })))
  if (pool.length === 0) return null
  const start = new Date(date.getFullYear(), 0, 0)
  const day = Math.floor((date.getTime() - start.getTime()) / 86400000)
  return pool[day % pool.length]!
}
