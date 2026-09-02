import type { ComponentType, SVGProps } from 'react'
import { BookIcon, ChartIcon, CogIcon, HomeIcon, ParentIcon, TutorIcon } from '../components/icons.tsx'

export type Area = 'student' | 'parent' | 'tutor'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  area: Area
  /** Matches nested routes when true. */
  end?: boolean
}

/**
 * The menu. Until sign-in exists every area is visible so the structure can be
 * walked; once roles exist, filter by the signed-in account's area.
 */
export const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: HomeIcon, area: 'student', end: true },
  { to: '/subjects', label: 'Subjects', icon: BookIcon, area: 'student' },
  { to: '/progress', label: 'Progress', icon: ChartIcon, area: 'student' },
  { to: '/parent', label: 'Parent', icon: ParentIcon, area: 'parent' },
  { to: '/tutor', label: 'Tutor', icon: TutorIcon, area: 'tutor' },
  { to: '/settings', label: 'Settings', icon: CogIcon, area: 'student' },
]
