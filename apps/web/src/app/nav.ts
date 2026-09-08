import type { ComponentType, SVGProps } from 'react'
import { BookIcon, ChartIcon, CogIcon, HomeIcon } from '../components/icons.tsx'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Matches nested routes when true. */
  end?: boolean
}

/** The menu. No accounts for now; every area is for the student on this device. */
export const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/subjects', label: 'Subjects', icon: BookIcon },
  { to: '/progress', label: 'Progress', icon: ChartIcon },
  { to: '/settings', label: 'Settings', icon: CogIcon },
]
