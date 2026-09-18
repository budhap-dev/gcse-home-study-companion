import { describe, expect, it } from 'vitest'
import { firstNameOf, fromEmail, personName } from './personName.ts'

describe('personName', () => {
  it('prefers the name a parent typed', () => {
    expect(personName({ note: 'Abhi', profile: 'Abhigyan Pandit', email: 'abhigyan.pandit1@gmail.com' })).toBe('Abhi')
    expect(personName({ note: '  Abhi  ', email: 'a@b.com' })).toBe('Abhi')
  })

  it('falls back to the profile name from the account', () => {
    expect(personName({ note: null, profile: 'Abhigyan Pandit', email: 'abhigyan.pandit1@gmail.com' })).toBe('Abhigyan Pandit')
    expect(personName({ note: '   ', profile: 'Abhigyan Pandit', email: 'x@y.com' })).toBe('Abhigyan Pandit')
  })

  /**
   * Supabase fills a missing profile name with the address, so a "profile" that is really
   * the email must not beat the tidied version of that same email.
   */
  it('ignores a profile name that is only the email again', () => {
    expect(personName({ profile: 'abhigyan.pandit1@gmail.com', email: 'abhigyan.pandit1@gmail.com' })).toBe('Abhigyan Pandit')
    expect(personName({ profile: 'abhigyan.pandit1', email: 'abhigyan.pandit1@gmail.com' })).toBe('Abhigyan Pandit')
  })

  it('tidies an email into something that reads like a name', () => {
    expect(fromEmail('abhigyan.pandit1@gmail.com')).toBe('Abhigyan Pandit')
    expect(fromEmail('panditbudhaditya@gmail.com')).toBe('Panditbudhaditya')
    expect(fromEmail('abhinanda07@gmail.com')).toBe('Abhinanda')
    expect(fromEmail('jo_smith@example.org')).toBe('Jo Smith')
    expect(fromEmail('mary-anne.o@example.org')).toBe('Mary Anne O')
  })

  it('keeps an address with no name in it rather than emptying it', () => {
    expect(fromEmail('12345@school.uk')).toBe('12345')
    expect(fromEmail('...@school.uk')).toBe('...')
  })

  it('gives the first name for use in a sentence', () => {
    expect(firstNameOf('Abhigyan Pandit')).toBe('Abhigyan')
    expect(firstNameOf('Abhi')).toBe('Abhi')
    expect(firstNameOf('  Mary Anne  O ')).toBe('Mary')
  })
})
