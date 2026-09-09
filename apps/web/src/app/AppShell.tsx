import { NavLink, Outlet, useLocation } from 'react-router'
import { NAV } from './nav.ts'
import { APP_BUILT, VERSION_LABEL } from './version.ts'
import { Logo } from '../components/Logo.tsx'
import { useAuth } from '../auth/useAuth.ts'

/**
 * Layout: sidebar on wide screens, bottom bar on phones. Content is one column
 * with a maximum width so text stays readable on desktop.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const auth = useAuth()
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>

      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r border-rule bg-surface px-4 py-6 md:flex">
        <NavLink to="/" className="px-2" aria-label="Home Study Companion, home">
          <Logo />
        </NavLink>
        <Menu orientation="vertical" />
        <div className="mt-auto flex flex-col gap-0.5 px-2 text-xs text-ink-3">
          <span>{auth.status === 'allowed' ? `Signed in as ${auth.name ?? auth.email}. Progress is saved to your account.` : 'Progress is saved on this device.'}</span>
          <span title={`Built ${APP_BUILT}`}>{VERSION_LABEL}</span>
        </div>
      </aside>

      <main id="main" className="anim-fade-up flex-1 px-4 pb-24 pt-6 md:px-10 md:pb-10 md:pt-10" key={pathname}>
        <Outlet />
      </main>

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 border-t border-rule bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        <Menu orientation="horizontal" />
      </nav>
    </div>
  )
}

function Menu({ orientation }: { orientation: 'vertical' | 'horizontal' }) {
  const vertical = orientation === 'vertical'
  return (
    <ul className={vertical ? 'flex flex-col gap-1' : 'grid grid-cols-4'}>
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'flex min-h-11 items-center gap-3 rounded-lg text-sm font-bold transition-colors',
                vertical ? 'px-3 py-2' : 'flex-col justify-center gap-0.5 py-2 text-[11px]',
                isActive ? 'bg-panel text-ink' : 'text-ink-2 hover:bg-panel hover:text-ink',
              ].join(' ')
            }
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  )
}
