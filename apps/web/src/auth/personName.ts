/**
 * What to call a person on screen.
 *
 * The Family screen used to show whatever was typed in the optional note when the account
 * was added, and otherwise the part of the email before the @, so a parent read
 * "abhigyan.pandit1" where the sentence meant a person. Three sources, in order:
 *
 *   1. `note`    a name a parent typed by hand. It wins: a family that says Abhi should
 *                not be overruled by what Google has on file.
 *   2. `profile` the display name from the account's own Google profile, written to their
 *                progress row when they sign in. Nobody has to type it.
 *   3. the email, tidied into something that reads like a name.
 *
 * The email is a last resort and a guess, so it is kept conservative: separators become
 * spaces, trailing digits go, and each word is capitalised. Nothing is invented.
 */
export function personName({ note, profile, email }: { note?: string | null; profile?: string | null; email: string }): string {
  const typed = (note ?? '').trim()
  if (typed && !isRoleLabel(typed)) return typed
  const fromProfile = (profile ?? '').trim()
  // A Supabase profile with no name falls back to the email, so a profile that is just
  // the address is no better than no profile at all.
  if (fromProfile && !fromProfile.includes('@') && fromProfile.toLowerCase() !== localPart(email) && !isRoleLabel(fromProfile)) return fromProfile
  return fromEmail(email)
}

const localPart = (email: string) => email.split('@')[0]!.toLowerCase()

/**
 * Words that say what an account is, not who. Until 18 September 2026 the note beside an
 * address was labelled "Name or note" and shown as a tag after the role, so a family could
 * reasonably have typed "Student" there. When the note became the name, that tag became
 * what the parent's screen called the child. A Google profile set up for a child can carry
 * the same kind of placeholder. Neither is a name, so both fall through to the next source.
 */
const ROLE_LABELS = new Set(['student', 'parent', 'pupil', 'child', 'user', 'account'])
export const isRoleLabel = (s: string) => ROLE_LABELS.has(s.trim().toLowerCase().replace(/[^a-z]/g, ''))

/** "abhigyan.pandit1@gmail.com" to "Abhigyan Pandit". */
export function fromEmail(email: string): string {
  const words = localPart(email)
    .split(/[._\-+]+/)
    .map((w) => w.replace(/\d+$/, ''))
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
  // An address with nothing name-like left in it keeps the part before the @ as written,
  // which is at least honest; "u1234567@school.uk" should not become an empty string.
  return words.length ? words.join(' ') : email.split('@')[0]!
}

/** The name to use in a sentence: "Abhigyan has not signed in yet." */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name
}
