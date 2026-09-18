import type { SubjectId } from './subjects.ts'

/**
 * One fun fact a day per subject, shown on the home screen. Each fact must
 * stand on its own: say what the reader might already think or need to know,
 * then the surprising part, then why it is true or what it connects to.
 * Short, true, and checkable.
 */
export const FUN_FACTS: Record<SubjectId, string[]> = {
  maths: [
    'Shuffle a deck of 52 cards properly and the order you get has almost certainly never existed before. The number of possible orders is 52 factorial, 52 × 51 × 50 × … × 1, which is about 8 followed by 67 zeros. That is more than the number of atoms on Earth.',
    'The equals sign is younger than you might think. A Welsh mathematician, Robert Recorde, invented it in 1557 because he was tired of writing "is equal to" over and over. He chose two parallel lines because, he said, no two things can be more equal.',
    'The formula for the volume of a cylinder is pi × radius² × height. So a pizza with radius z and height a has a volume of pi × z × z × a. Say it out loud.',
    'Pick any even number bigger than 2 and you can write it as two primes added together: 10 = 3 + 7, 100 = 47 + 53. Computers have checked this for every even number up to 4 million million million, but no one has ever proved it always works. It is called the Goldbach conjecture, and it has been open since 1742.',
    'How many people do you need in a room before it is more likely than not that two share a birthday? With 365 days to go round, you would expect to need a crowd. The answer is 23. It feels wrong because you are not comparing one person with the rest, you are comparing every possible pair, and 23 people make 253 pairs.',
    'Roman numerals have no zero: there is no symbol for "nothing", which is one reason long division in Roman numerals is close to impossible. Zero as a number in its own right, with rules like 0 + n = n, was written down in India by Brahmagupta around 628 AD. Our whole place-value system depends on it.',
    'Fold a sheet of paper in half and it is twice as thick. Fold it again, four times. Each fold doubles the thickness, so after 42 folds the stack would be 2⁴² × 0.1 mm, about 440,000 km, further than the Moon. In practice the record is 13 folds, and that took a strip of toilet paper about 16 km long, but the powers of 2 are real.',
    'The square root of 2, the length of the diagonal of a 1 by 1 square, cannot be written as any fraction of whole numbers. The Greek followers of Pythagoras believed every number was a ratio, so this discovery around 500 BC shook them. Legend says the person who leaked it was drowned at sea. Numbers like this are called irrational, and surds are how we write them exactly.',
    'Try this on a calculator: 111,111,111 × 111,111,111. The answer is 12,345,678,987,654,321, counting up to 9 and back down. It works because each digit of the answer is the number of ways the ones can line up in long multiplication.',
    'A googol is the number 1 followed by 100 zeros. It was named in 1920 by a nine-year-old, Milton Sirotta, when his mathematician uncle asked him what to call it. Google is named after it: a student checking whether the web address was free typed google.com instead of googol.com, the founders liked the look of it, and the misspelling stuck.',
  ],
  'further-maths': [
    'Calculus was worked out twice, independently, in the 1660s to 1680s: by Isaac Newton in England and Gottfried Leibniz in Germany. They argued bitterly about who was first. Leibniz lost the argument and won the notation \u2014 the dy/dx you will write is his, because it is far easier to manipulate than Newton\u2019s dots.',
    'The rule that the gradient function of x\u207f is nx\u207f\u207b\u00b9 can be checked against something you already know. Put n = 1: the gradient function of y = x is 1 \u00d7 x\u2070, which is 1. And y = x is a straight line of gradient 1. Any rule worth trusting agrees with the case you can see.',
    'Pascal\u2019s triangle is not Pascal\u2019s. The same triangle of numbers appears in Chinese mathematics as Yang Hui\u2019s triangle, and in Persian work by al-Karaji, centuries before Blaise Pascal wrote about it in 1653. He gets the name in Europe because he was the first there to set out systematically what it is for.',
    'Order matters when you multiply matrices: AB is usually not BA. You can test it without any algebra. Take a book, rotate it a quarter turn, then flip it over. Now start again and flip it first, then rotate. The book ends up facing a different way, and that is exactly what non-commutative means.',
    'Use calculus to design a tin can of a fixed volume with the least metal, and the answer is that its height should equal its diameter. Real drinks cans are taller and thinner than that, because the ends are made of thicker metal than the sides and because cylinders that shape pack and hold better \u2014 the mathematics gives the ideal, and then the world argues with it.',
    'The identity sin\u00b2\u03b8 + cos\u00b2\u03b8 = 1 is Pythagoras in disguise. Draw a right-angled triangle inside a circle of radius 1: the two shorter sides have lengths sin \u03b8 and cos \u03b8, and the hypotenuse is the radius, 1. So sin\u00b2\u03b8 + cos\u00b2\u03b8 = 1\u00b2. One of the most useful identities in the subject is a theorem you met years ago.',
    'The matrix that rotates the plane by 90\u00b0 has a satisfying property: multiply it by itself four times and you get the identity matrix, the one that leaves everything exactly where it was. That is the algebra agreeing with the obvious \u2014 four quarter turns is a full turn, and a full turn changes nothing.',
    'The factor theorem turns guessing into proof. If you substitute x = 2 into a cubic and get zero, then (x \u2212 2) is definitely a factor of it \u2014 not probably, definitely. That single fact is what makes cubics solvable by hand: find one root by trial, divide it out, and what is left is a quadratic you already know how to finish.',
  ],
  physics: [
    'Light is fast but not instant: it travels at about 300,000 km every second, and the Sun is about 150 million km away. So sunlight takes just over eight minutes to reach you. If the Sun vanished, you would keep seeing it for eight minutes.',
    'A neutron star is what is left when a big star collapses: the whole mass of a star squashed into a ball about 20 km across. Its density is so high that a teaspoon of it would have a mass of about a billion tonnes. Density is mass divided by volume, and here the volume is tiny.',
    'Put a cup of hot water and a cup of cold water in a freezer, and in some conditions the hot one freezes first. This is the Mpemba effect, named after a Tanzanian student who noticed it while making ice cream in 1963. Physicists still argue about exactly why it happens.',
    'Films show explosions in space with a boom, but you would hear nothing. Sound is a vibration passed from particle to particle, and space is almost empty, so there is nothing to carry it. Light, which does not need particles, gets through fine.',
    'Most materials expand when heated because their particles vibrate more and take up more room. The Eiffel Tower is made of iron, and on a hot summer day it stands about 15 cm taller than in winter. Bridges have expansion joints for the same reason.',
    'Space is mostly empty. If the Sun were shrunk to the size of a football, the Earth would be a grain of sand about 24 m away. The nearest other star, Proxima Centauri, is a red dwarf only a seventh of the Sun\'s width, so it would be a ping-pong ball about 6,000 km away, roughly London to New York.',
    'The surface of the Sun is about 5,500 °C. A bolt of lightning heats the air around it to about 30,000 °C, five times hotter, for less than a thousandth of a second. That sudden heating makes the air expand violently, and the expansion is the thunder you hear.',
    'Einstein showed that clocks run slightly faster where gravity is weaker. GPS satellites orbit 20,000 km up, where gravity is weaker, so their clocks gain about 38 millionths of a second a day. Engineers build the satellite clocks to tick slightly slow, so that in orbit they keep the right time. Without that correction, map positions would drift by about 10 km every day.',
    'Hooke\'s law says the extension of a spring is proportional to the force on it, as long as you do not stretch it too far. The tiny spring in a clicky pen and the coil springs holding up a car obey exactly the same rule. The only difference is the spring constant.',
    'Mass is how much matter is in you; weight is the force of gravity pulling on that mass. On the Moon gravity is about a sixth of Earth\'s, so your weight would be a sixth of what it is here, but your mass would be exactly the same. The bathroom scales would read low, but you would not be any thinner.',
  ],
  chemistry: [
    'Hydrogen was made in the Big Bang, but every heavier element in your body, the carbon, oxygen, nitrogen, calcium and iron, was made by nuclear fusion inside stars and scattered when those stars died. The atoms in you are recycled from stars older than the Sun.',
    'You may have heard that glass is really a very slow-flowing liquid, and that old church windows are thicker at the bottom because the glass has crept down over the centuries. It is a myth. Glass at room temperature is a rigid solid. Old panes are uneven because they were made by spinning molten glass into a disc, and glaziers usually set the thick edge at the bottom.',
    'Helium was discovered on the Sun before it was found on Earth. In 1868 astronomers saw a yellow line in the spectrum of sunlight that matched no known element, and named it after helios, the Greek word for Sun. It was not found on Earth until 1895, in a uranium mineral.',
    'Diamond and the graphite in a pencil are both pure carbon. The only difference is how the atoms are joined: in diamond every carbon is bonded to four others in a rigid 3D lattice; in graphite each carbon bonds to three, in flat layers that slide over each other. That is why one cuts glass and the other leaves marks on paper.',
    'Sodium is a soft metal that fizzes across water and can catch fire. Chlorine is a poisonous green gas. Bond them together with ionic bonds and you get sodium chloride, table salt, which you sprinkle on chips. Compounds do not keep the properties of their elements.',
  ],
  biology: [
    'About 60 per cent of your genes have a recognisable counterpart in a banana. That does not make you part banana, and it is not the same as sharing 60 per cent of your DNA. It is because the basic machinery of a living cell, such as copying DNA and releasing energy from sugar, evolved once and has been inherited by every living thing since.',
    'Your body is made of around 30 trillion human cells. Living in and on it, mostly in your gut, are around 38 trillion bacterial cells. By cell count you are slightly more bacteria than human, though the bacteria are much smaller, so they weigh only about 200 g in total.',
    'Red blood cells have no nucleus, so they cannot repair themselves and last only about 120 days. Your bone marrow makes about 2 million new ones every second to keep up. Over four months, your entire supply is replaced.',
  ],
  'computer-science': [
    'In 1947 engineers working on the Harvard Mark II computer found it giving wrong answers. The cause was a moth trapped in one of the relays. They taped it into the logbook with the note "first actual case of bug being found". The word bug for a fault was already in use, but this is the most famous one.',
    'The Apollo Guidance Computer that took astronauts to the Moon in 1969 had about 4 KB of memory and ran at around 1 MHz. A modern phone has millions of times more memory and thousands of times more processing speed. The Apollo software still had to land a spacecraft, though, so it was written very carefully.',
    'A bit is a single 0 or 1. When engineers at IBM needed a word for a group of bits in 1956, they chose "byte", a deliberate misspelling of "bite", so that a typo could never turn it into "bit". Eight bits to a byte became the standard later.',
  ],
  business: [
    'Nintendo was founded in Kyoto in 1889 to make hanafuda playing cards. In the 1960s it tried taxis, instant rice, and love hotels, and all of them failed. Toys did not, and by the 1970s it was making video games. Businesses that survive for a century usually do so by changing what they sell.',
    'Jeff Bezos originally registered his online bookshop as Cadabra, as in abracadabra. His lawyer misheard it as "cadaver", so he changed it to Amazon, partly because names starting with A appeared first in alphabetical listings. A name is part of a product\'s branding.',
    'The first product ever scanned with a barcode was a packet of Wrigley\'s chewing gum, in a supermarket in Ohio in June 1974. Barcodes cut the time and errors of typing prices at the till and let shops track stock automatically, which changed how retail businesses manage inventory.',
  ],
  french: [
    'French is an official language in 29 countries across Europe, Africa, the Caribbean, and the Pacific. About 300 million people speak it, and more than half of them live in Africa, so most French speakers are not in France.',
    'When William of Normandy conquered England in 1066, French became the language of the court and the law for about 300 years. That is why English has pairs like cow and beef, or house and mansion: the plain word is Old English, the fancier one is French. Around a third of English words come from French.',
    'The Académie française was set up in 1635 to decide what counts as correct French. Its 40 members, known as "the immortals", still meet to rule on new words. They pushed "fin de semaine" instead of "le week-end" and, in 2003, "courriel" instead of "e-mail". It rarely works: in France most people still say "le week-end" and "un mail", though "courriel" is normal in Canada and in official documents.',
  ],
  music: [
    'In 1721 the harpsichord was the instrument that played the background chords while others took the tune. Bach\'s Brandenburg Concerto No. 5, one of your set works, was the first concerto to hand the harpsichord a long solo with everyone else dropping out. He had just collected a new harpsichord from Berlin for the court at Köthen, and most likely wrote the piece to show it off.',
    'Mozart wrote his first symphony at eight years old, in 1764, while staying in London. His father was ill and had asked for quiet, so the boy wrote music instead of playing it. He had already been performing for royalty for two years.',
    'A modern piano has around 230 strings, not 88, because most notes use two or three strings struck together. Each string is pulled to a tension of about 70 to 90 kg, so the total pull on the iron frame is around 20 tonnes. That is why pianos are so heavy.',
  ],
}

export interface Fact { subjectId: SubjectId; text: string }

/** The pool of facts for the given subjects, in a fixed order. */
export function factPool(subjectIds: SubjectId[]): Fact[] {
  return subjectIds.flatMap((s) => (FUN_FACTS[s] ?? []).map((text) => ({ subjectId: s, text })))
}

/** Today's fact, or the one `offset` steps after it when the reader asks for another. */
export function factOfTheDay(subjectIds: SubjectId[], date = new Date(), offset = 0): Fact | null {
  const pool = factPool(subjectIds)
  if (pool.length === 0) return null
  const start = new Date(date.getFullYear(), 0, 0)
  const day = Math.floor((date.getTime() - start.getTime()) / 86400000)
  return pool[(day + offset) % pool.length]!
}
