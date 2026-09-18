import type { ComponentType, SVGProps } from 'react'
import { BookIcon, BookmarkIcon, ChartIcon, CogIcon, HomeIcon, ParentIcon } from '../components/icons.tsx'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Matches nested routes when true. */
  end?: boolean
}

/** The menu. Every area is for the student on this device. */
export const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/subjects', label: 'Subjects', icon: BookIcon },
  { to: '/glossary', label: 'Glossary', icon: BookmarkIcon },
  { to: '/progress', label: 'Progress', icon: ChartIcon },
  { to: '/settings', label: 'Settings', icon: CogIcon },
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
  return [...NAV.slice(0, at), { to: '/family', label: 'Family', icon: ParentIcon }, ...NAV.slice(at)]
}
