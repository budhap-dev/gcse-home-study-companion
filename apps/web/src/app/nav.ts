import type { ComponentType, SVGProps } from 'react'
import { BookIcon, BookmarkIcon, ChartIcon, CogIcon, HomeIcon, ParentIcon, SheetsIcon } from '../components/icons.tsx'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /**
   * The item's own colour. The pill under the page you are on is white in every theme, and
   * this is the label painted on it, so it is fixed rather than themed and must hold AA
   * against white (nav.test.ts checks).
   */
  colour: string
  /** Matches nested routes when true. */
  end?: boolean
  /**
   * A shorter label for a crowded dock. A parent's dock has seven items, which leaves about
   * 47px each on a 360px phone, and "Resources" is 54px at the dock's 11px: it ran into its
   * neighbours. Six items leave 55px, so a student's dock keeps the full word.
   */
  short?: string
}

/** More than this many items in the dock and each one takes its `short` label. */
export const DOCK_FULL_LABELS = 6

/** The menu. Every area is for the student on this device. */
export const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: HomeIcon, colour: '#0b6e78', end: true },
  { to: '/subjects', label: 'Subjects', icon: BookIcon, colour: '#5a4bd1' },
  { to: '/resources', label: 'Resources', short: 'Sheets', icon: SheetsIcon, colour: '#b3261e' },
  { to: '/glossary', label: 'Glossary', icon: BookmarkIcon, colour: '#b35c00' },
  { to: '/progress', label: 'Progress', icon: ChartIcon, colour: '#2e7d4f' },
  { to: '/settings', label: 'Settings', icon: CogIcon, colour: '#a83e6b' },
]

/**
 * Family sits between Progress and Settings, and only for a parent: it is the one screen
 * that is about somebody else, so a student never sees a menu item leading to a page that
 * would tell them nothing. The route itself still checks the role, since a menu is not a
 * permission and the database is what actually decides.
 */
export function navFor(role: 'parent' | 'student' | undefined): NavItem[] {
  if (role !== 'parent') return NAV
  const at = NAV.findIndex((n) => n.to === '/settings')
  return [...NAV.slice(0, at), { to: '/family', label: 'Family', icon: ParentIcon, colour: '#1f5fbf' }, ...NAV.slice(at)]
}

/**
 * Screens where the student is working through something one item at a time: a lesson, a
 * quiz, a worksheet, flashcards, mistakes. Below laptop width the band and the dock took
 * about a third of a phone screen on these, so they step aside while the student scrolls
 * down (useChromeHidden). A worksheet's print view is not one: it has no chrome to hide.
 */
export function isFocusRoute(pathname: string): boolean {
  if (pathname === '/mistakes') return true
  return /^\/subjects\/[^/]+\/topics\/[^/]+\/(lesson|quiz|flashcards|worksheet\/[^/]+)\/?$/.test(pathname)
}
