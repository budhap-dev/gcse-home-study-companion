/**
 * A thought for the day and a good deed for the day, shown on Home.
 *
 * The thoughts are sayings on dedication, determination, discipline and their relatives.
 * Each carries who said it and where, and only sayings that can be traced to a work, a
 * letter or a speech are here: the internet is full of lines pinned to famous names that
 * never said them, and a student should not learn one from this app. A proverb is given
 * as a proverb.
 *
 * The deeds are the owner's own list of thirty small acts of character, one a day in
 * order, the same one for everyone on a given day so a family can talk about it. Each has
 * an icon, drawn in apps/web/src/components/characterIcons.tsx.
 */

export type ThemeId = 'dedication' | 'determination' | 'discipline' | 'perseverance' | 'courage' | 'kindness' | 'honesty' | 'learning' | 'patience' | 'gratitude'

export interface Theme {
  label: string
  /** An icon name from the character icon set. */
  icon: string
  /** A fixed accent, clamped by the chip for contrast like every other chip colour. */
  colour: string
}

export const THEMES: Record<ThemeId, Theme> = {
  dedication: { label: 'Dedication', icon: 'flame', colour: '#c8501f' },
  determination: { label: 'Determination', icon: 'mountain', colour: '#b3261e' },
  discipline: { label: 'Discipline', icon: 'clock', colour: '#1f3a93' },
  perseverance: { label: 'Perseverance', icon: 'sprout', colour: '#2e7d4f' },
  courage: { label: 'Courage', icon: 'bolt', colour: '#a83e6b' },
  kindness: { label: 'Kindness', icon: 'heart', colour: '#d1436b' },
  honesty: { label: 'Honesty', icon: 'scales', colour: '#0b6e78' },
  learning: { label: 'Learning', icon: 'book-open', colour: '#5a4bd1' },
  patience: { label: 'Patience', icon: 'hourglass', colour: '#b35c00' },
  gratitude: { label: 'Gratitude', icon: 'gift', colour: '#6B4E9B' },
}

export interface Quote {
  text: string
  /** Who said or wrote it, or "Proverb" with its origin. */
  by: string
  /** The work, letter or speech it comes from, with a date where one is known. */
  source: string
  theme: ThemeId
}

export const QUOTES: Quote[] = [
  // Dedication
  { text: 'Whatever I have tried to do in life, I have tried with all my heart to do well.', by: 'Charles Dickens', source: 'David Copperfield, 1850', theme: 'dedication' },
  { text: 'Great things are not done by impulse, but by a series of small things brought together.', by: 'Vincent van Gogh', source: 'Letter to his brother Theo, 1882', theme: 'dedication' },
  { text: 'Genius is one per cent inspiration and ninety-nine per cent perspiration.', by: 'Thomas Edison', source: 'Said in 1903, reported in Harper’s Monthly, 1932', theme: 'dedication' },
  { text: 'Well done is better than well said.', by: 'Benjamin Franklin', source: 'Poor Richard’s Almanack, 1737', theme: 'dedication' },
  { text: 'Deeds, not words.', by: 'Emmeline Pankhurst', source: 'Motto of the Women’s Social and Political Union, 1903', theme: 'dedication' },
  { text: 'Nothing ever comes to one, that is worth having, except as a result of hard work.', by: 'Booker T. Washington', source: 'Up from Slavery, 1901', theme: 'dedication' },
  { text: 'Success is the sum of small efforts, repeated day in and day out.', by: 'Robert Collier', source: 'The Secret of the Ages, 1926', theme: 'dedication' },

  // Determination
  { text: 'It is hard to fail, but it is worse never to have tried to succeed.', by: 'Theodore Roosevelt', source: 'The Strenuous Life, 1899', theme: 'determination' },
  { text: 'Do what you can, with what you have, where you are.', by: 'Squire Bill Widener', source: 'Quoted by Theodore Roosevelt in his Autobiography, 1913', theme: 'determination' },
  { text: 'If there is no struggle, there is no progress.', by: 'Frederick Douglass', source: 'Speech on West India Emancipation, 1857', theme: 'determination' },
  { text: 'They can because they think they can.', by: 'Virgil', source: 'Aeneid, book 5', theme: 'determination' },
  { text: 'Arise, awake, and stop not till the goal is reached.', by: 'Swami Vivekananda', source: 'Lectures, after the Katha Upanishad', theme: 'determination' },
  { text: 'Never give in, never give in, never, never, never, never, in nothing, great or small, large or petty, never give in except to convictions of honour and good sense.', by: 'Winston Churchill', source: 'Speech at Harrow School, 1941', theme: 'determination' },
  { text: 'If you can’t fly then run, if you can’t run then walk, if you can’t walk then crawl, but whatever you do you have to keep moving forward.', by: 'Martin Luther King Jr.', source: 'Speech at Spelman College, 1960', theme: 'determination' },
  { text: 'I’ve failed over and over and over again in my life. And that is why I succeed.', by: 'Michael Jordan', source: 'Nike advertisement, 1997', theme: 'determination' },
  { text: 'Where there’s a will, there’s a way.', by: 'Proverb', source: 'English, recorded from the 1600s', theme: 'determination' },

  // Discipline
  { text: 'Perhaps the most valuable result of all education is the ability to make yourself do the thing you have to do, when it ought to be done, whether you like it or not.', by: 'Thomas Henry Huxley', source: 'Technical Education, 1877', theme: 'discipline' },
  { text: 'Rule your mind, or it will rule you.', by: 'Horace', source: 'Epistles, book 1, letter 2', theme: 'discipline' },
  { text: 'Those who have begun have half done. Dare to be wise: begin.', by: 'Horace', source: 'Epistles, book 1, letter 2', theme: 'discipline' },
  { text: 'Never put off till tomorrow what you can do today.', by: 'Thomas Jefferson', source: 'Letter to Thomas Jefferson Smith, 1825', theme: 'discipline' },
  { text: 'Procrastination is the thief of time.', by: 'Edward Young', source: 'Night Thoughts, 1742', theme: 'discipline' },
  { text: 'Lost time is never found again.', by: 'Benjamin Franklin', source: 'Poor Richard’s Almanack, 1748', theme: 'discipline' },
  { text: 'Be tolerant with others and strict with yourself.', by: 'Marcus Aurelius', source: 'Meditations, book 5', theme: 'discipline' },
  { text: 'Those who overcome others are strong; those who overcome themselves are mighty.', by: 'Laozi', source: 'Tao Te Ching, chapter 33', theme: 'discipline' },
  { text: 'You have a right to your work, but never to the fruits of your work.', by: 'The Bhagavad Gita', source: 'Chapter 2, verse 47', theme: 'discipline' },
  { text: 'Character is simply habit long continued.', by: 'Plutarch', source: 'On the Education of Children', theme: 'discipline' },
  { text: 'We are what we repeatedly do. Excellence, then, is not an act but a habit.', by: 'Will Durant', source: 'The Story of Philosophy, 1926, summing up Aristotle', theme: 'discipline' },
  { text: 'Tomorrow is often the busiest day of the week.', by: 'Proverb', source: 'Spanish', theme: 'discipline' },

  // Perseverance
  { text: 'Great works are performed not by strength but by perseverance.', by: 'Samuel Johnson', source: 'Rasselas, 1759', theme: 'perseverance' },
  { text: 'Dripping water hollows out stone, not by force but by falling often.', by: 'Ovid', source: 'Letters from Pontus, book 4', theme: 'perseverance' },
  { text: 'Little strokes fell great oaks.', by: 'Benjamin Franklin', source: 'Poor Richard’s Almanack, 1750', theme: 'perseverance' },
  { text: 'Fall seven times, stand up eight.', by: 'Proverb', source: 'Japanese', theme: 'perseverance' },
  { text: 'A journey of a thousand miles begins with a single step.', by: 'Laozi', source: 'Tao Te Ching, chapter 64', theme: 'perseverance' },
  { text: 'Our greatest glory consists not in never falling, but in rising every time we fall.', by: 'Oliver Goldsmith', source: 'The Citizen of the World, 1760', theme: 'perseverance' },
  { text: 'Slow and steady wins the race.', by: 'Aesop', source: 'The Tortoise and the Hare', theme: 'perseverance' },
  { text: 'I was taught that the way of progress was neither swift nor easy.', by: 'Marie Curie', source: 'Pierre Curie, 1923', theme: 'perseverance' },
  { text: 'Be not afraid of going slowly; be afraid only of standing still.', by: 'Proverb', source: 'Chinese', theme: 'perseverance' },
  { text: 'The best time to plant a tree was twenty years ago. The second best time is now.', by: 'Proverb', source: 'Often given as Chinese', theme: 'perseverance' },

  // Courage
  { text: 'Courage is resistance to fear, mastery of fear, not absence of fear.', by: 'Mark Twain', source: 'Pudd’nhead Wilson, 1894', theme: 'courage' },
  { text: 'I learned that courage was not the absence of fear, but the triumph over it.', by: 'Nelson Mandela', source: 'Long Walk to Freedom, 1994', theme: 'courage' },
  { text: 'It is not because things are difficult that we do not dare; it is because we do not dare that things are difficult.', by: 'Seneca', source: 'Letters to Lucilius, letter 104', theme: 'courage' },
  { text: 'Let me not pray to be sheltered from dangers but to be fearless in facing them.', by: 'Rabindranath Tagore', source: 'Fruit-Gathering, 1916', theme: 'courage' },
  { text: 'You gain strength, courage, and confidence by every experience in which you really stop to look fear in the face.', by: 'Eleanor Roosevelt', source: 'You Learn by Living, 1960', theme: 'courage' },
  { text: 'Nothing will ever be attempted if all possible objections must be first overcome.', by: 'Samuel Johnson', source: 'Rasselas, 1759', theme: 'courage' },
  { text: 'Do not be too timid and squeamish about your actions. All life is an experiment.', by: 'Ralph Waldo Emerson', source: 'Journals, 1842', theme: 'courage' },

  // Kindness
  { text: 'No act of kindness, no matter how small, is ever wasted.', by: 'Aesop', source: 'The Lion and the Mouse, the moral as usually given', theme: 'kindness' },
  { text: 'Waste no more time arguing about what a good person should be. Be one.', by: 'Marcus Aurelius', source: 'Meditations, book 10', theme: 'kindness' },
  { text: 'How wonderful it is that nobody need wait a single moment before starting to improve the world.', by: 'Anne Frank', source: 'Her diary, 26 March 1944', theme: 'kindness' },
  { text: 'The time is always right to do what is right.', by: 'Martin Luther King Jr.', source: 'Speech at Oberlin College, 1964', theme: 'kindness' },
  { text: 'Nothing is so contagious as example.', by: 'François de La Rochefoucauld', source: 'Maxims, 1665', theme: 'kindness' },
  { text: 'One kind word can warm three winter months.', by: 'Proverb', source: 'Japanese', theme: 'kindness' },
  { text: 'Manners maketh man.', by: 'William of Wykeham', source: 'Motto of Winchester College, 1300s', theme: 'kindness' },
  { text: 'Better to light a candle than to curse the darkness.', by: 'Proverb', source: 'Often given as Chinese', theme: 'kindness' },
  { text: 'Many hands make light work.', by: 'Proverb', source: 'English, recorded by John Heywood, 1546', theme: 'kindness' },

  // Honesty
  { text: 'Honesty is the first chapter in the book of wisdom.', by: 'Thomas Jefferson', source: 'Letter to Nathaniel Macon, 1819', theme: 'honesty' },
  { text: 'If it is not right, do not do it; if it is not true, do not say it.', by: 'Marcus Aurelius', source: 'Meditations, book 12', theme: 'honesty' },
  { text: 'To make a mistake and not correct it: this is a real mistake.', by: 'Confucius', source: 'Analects, book 15', theme: 'honesty' },
  { text: 'The wise are modest in speech and generous in action.', by: 'Confucius', source: 'Analects, book 14', theme: 'honesty' },
  { text: 'To know what you know and what you do not know: that is true knowledge.', by: 'Confucius', source: 'Analects, book 2', theme: 'honesty' },

  // Learning
  { text: 'If I have seen further it is by standing on the shoulders of giants.', by: 'Isaac Newton', source: 'Letter to Robert Hooke, 1675', theme: 'learning' },
  { text: 'The important thing is not to stop questioning.', by: 'Albert Einstein', source: 'Life magazine, 1955', theme: 'learning' },
  { text: 'Learning without thought is labour lost; thought without learning is perilous.', by: 'Confucius', source: 'Analects, book 2', theme: 'learning' },
  { text: 'As long as you live, keep learning how to live.', by: 'Seneca', source: 'Letters to Lucilius, letter 76', theme: 'learning' },
  { text: 'Only the educated are free.', by: 'Epictetus', source: 'Discourses, book 2', theme: 'learning' },
  { text: 'If you would improve, be content to be thought foolish and stupid.', by: 'Epictetus', source: 'Enchiridion, chapter 13', theme: 'learning' },
  { text: 'The roots of education are bitter, but the fruit is sweet.', by: 'Aristotle', source: 'As reported by Diogenes Laërtius', theme: 'learning' },
  { text: 'Practice is the best of all instructors.', by: 'Publilius Syrus', source: 'Sentences, first century BC', theme: 'learning' },
  { text: 'No one knows what they can do till they try.', by: 'Publilius Syrus', source: 'Sentences, first century BC', theme: 'learning' },
  { text: 'We can only see a short distance ahead, but we can see plenty there that needs to be done.', by: 'Alan Turing', source: 'Computing Machinery and Intelligence, 1950', theme: 'learning' },
  { text: 'One child, one teacher, one book, one pen can change the world.', by: 'Malala Yousafzai', source: 'Speech at the United Nations, 2013', theme: 'learning' },
  { text: 'Well begun is half done.', by: 'Proverb', source: 'Greek, quoted by Aristotle in the Politics', theme: 'learning' },

  // Patience
  { text: 'Patience and diligence, like faith, remove mountains.', by: 'William Penn', source: 'Some Fruits of Solitude, 1693', theme: 'patience' },
  { text: 'People are disturbed not by things, but by the view they take of them.', by: 'Epictetus', source: 'Enchiridion, chapter 5', theme: 'patience' },
  { text: 'Confine yourself to the present.', by: 'Marcus Aurelius', source: 'Meditations, book 7', theme: 'patience' },
  { text: 'It is not that we have a short time to live, but that we waste a lot of it.', by: 'Seneca', source: 'On the Shortness of Life', theme: 'patience' },
  { text: 'A man who dares to waste one hour of time has not discovered the value of life.', by: 'Charles Darwin', source: 'Letter to his sister Susan, 1836', theme: 'patience' },
  { text: 'Optimism is the faith that leads to achievement. Nothing can be done without hope and confidence.', by: 'Helen Keller', source: 'Optimism, 1903', theme: 'patience' },

  // Gratitude
  { text: 'Gratitude is not only the greatest of virtues, but the parent of all the others.', by: 'Cicero', source: 'Pro Plancio, 54 BC', theme: 'gratitude' },
  { text: 'Look within. Within is the fountain of good, and it will ever bubble up, if you will ever dig.', by: 'Marcus Aurelius', source: 'Meditations, book 7', theme: 'gratitude' },
  { text: 'The reward of a thing well done is to have done it.', by: 'Ralph Waldo Emerson', source: 'New England Reformers, 1844', theme: 'gratitude' },
]

export interface Deed {
  id: string
  text: string
  /** An icon name from the character icon set. */
  icon: string
}

/** The owner's thirty deeds, in the order they come round. */
export const DEEDS: Deed[] = [
  { id: 'greet-with-a-smile', text: 'Greet everyone you meet with a smile.', icon: 'smile' },
  { id: 'help-with-a-chore', text: 'Help a family member with a household chore.', icon: 'broom' },
  { id: 'say-thank-you', text: 'Say "thank you" to at least three people.', icon: 'bubble-heart' },
  { id: 'give-a-compliment', text: 'Give a genuine compliment to someone.', icon: 'star' },
  { id: 'share-something', text: 'Share your lunch, snack, or something useful.', icon: 'gift' },
  { id: 'pick-up-litter', text: 'Pick up litter and dispose of it properly.', icon: 'bin' },
  { id: 'listen-carefully', text: 'Spend 10 minutes listening carefully to someone.', icon: 'ear' },
  { id: 'help-someone-near', text: 'Help a classmate, colleague, or neighbour.', icon: 'hand' },
  { id: 'call-an-elderly-relative', text: 'Call or visit an elderly relative.', icon: 'phone' },
  { id: 'donate-an-item', text: 'Donate one item you no longer need.', icon: 'box' },
  { id: 'no-complaining', text: 'Avoid complaining for an entire day.', icon: 'sun' },
  { id: 'admit-a-mistake', text: 'Admit a mistake honestly.', icon: 'undo' },
  { id: 'forgive-someone', text: 'Forgive someone for a small offence.', icon: 'heart' },
  { id: 'let-someone-go-ahead', text: 'Let someone go ahead of you in a queue.', icon: 'person-arrow' },
  { id: 'three-gratitudes', text: 'Write down three things you are grateful for.', icon: 'notebook' },
  { id: 'encourage-someone', text: 'Encourage someone who is feeling discouraged.', icon: 'thumbs-up' },
  { id: 'no-gossip', text: 'Spend a day without gossiping.', icon: 'bubble-x' },
  { id: 'offer-help-unasked', text: 'Offer to help without being asked.', icon: 'lifebuoy' },
  { id: 'show-patience', text: 'Show patience during a frustrating situation.', icon: 'hourglass' },
  { id: 'thank-a-worker', text: 'Thank a service worker such as a cleaner or cashier.', icon: 'badge' },
  { id: 'return-what-you-borrowed', text: 'Return something you borrowed.', icon: 'return' },
  { id: 'include-someone', text: 'Include someone who is alone or left out.', icon: 'person-plus' },
  { id: 'speak-respectfully', text: 'Speak respectfully to everyone throughout the day.', icon: 'bubbles' },
  { id: 'keep-a-promise', text: 'Keep a promise you made, no matter how small.', icon: 'link' },
  { id: 'teach-a-younger-person', text: 'Spend 15 minutes helping a younger person learn something.', icon: 'cap' },
  { id: 'share-a-treat', text: 'Give up a comfort or treat and share it with someone else.', icon: 'cookie' },
  { id: 'stand-up-for-someone', text: 'Stand up kindly for someone being treated unfairly.', icon: 'shield' },
  { id: 'reflect-on-a-good-deed', text: 'Reflect on one good deed you performed today.', icon: 'moon' },
  { id: 'anonymous-kindness', text: 'Perform an anonymous act of kindness.', icon: 'envelope' },
  { id: 'work-on-a-weakness', text: 'Set a goal to improve one personal weakness and work on it.', icon: 'target' },
]

/** The day the deeds started coming round: the first deed on this day, the second the next. */
export const DEEDS_FROM = '2026-09-01'

/** Whole local days from `from` to `date`; negative before it. */
export function daysSince(date: Date, from = DEEDS_FROM): number {
  const start = new Date(from + 'T12:00:00')
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)
  return Math.round((noon.getTime() - start.getTime()) / 86400000)
}

const wrap = (n: number, length: number) => ((n % length) + length) % length

/** The deed that comes round on this day, the same for everyone. */
export function deedOfTheDay(date = new Date()): Deed {
  return DEEDS[wrap(daysSince(date), DEEDS.length)]!
}

export function deedById(id: string): Deed | undefined {
  return DEEDS.find((d) => d.id === id)
}

/**
 * The day's thought, or the one `offset` steps on when the reader asks for another. The
 * step is coprime with the list's length, so consecutive days visit every theme in turn
 * rather than reading the list down one theme at a time.
 */
export function quoteOfTheDay(date = new Date(), offset = 0): Quote {
  return QUOTES[wrap((daysSince(date) + offset) * QUOTE_STEP, QUOTES.length)]!
}

/** A stride through the list that lands on every entry once before repeating. */
export const QUOTE_STEP = 7
