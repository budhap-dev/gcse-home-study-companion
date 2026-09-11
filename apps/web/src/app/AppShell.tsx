import { NavLink, Outlet, useLocation } from 'react-router'
import { NAV } from './nav.ts'
import { APP_BUILT, VERSION_LABEL } from './version.ts'
import { Logo } from '../components/Logo.tsx'
import { SearchBox } from '../components/SearchBox.tsx'
import { useAuth } from '../auth/useAuth.ts'

/**
 * Layout: an app header across the top, a sidebar on wide screens, a bottom bar on
 * phones. The header carries the app's identity and the search box, so the name is
 * visible on a phone too, where the sidebar is hidden and nothing else shows it.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const auth = useAuth()
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-rule bg-paper">
        <div className="flex h-16 items-center gap-3 px-4 md:px-6">
          <NavLink to="/" aria-label="Home Study Companion, home" className="shrink-0">
            <Logo inline />
          </NavLink>
          {/* Pushed right on desktop and bounded, so it reads as a tool rather than
              a field spanning the whole window. */}
          <div className="ml-auto w-full max-w-sm md:max-w-md">
            <SearchBox />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 md:flex-row">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-60 shrink-0 flex-col gap-4 border-r border-rule bg-surface px-4 py-5 md:flex">
          <Menu orientation="vertical" />
          <div className="mt-auto flex flex-col gap-0.5 px-2 text-xs text-ink-3">
            <span>{auth.status === 'allowed' ? `Signed in as ${auth.name ?? auth.email}. Progress is saved to your account.` : 'Progress is saved on this device.'}</span>
            <span title={`Built ${APP_BUILT}`}>{VERSION_LABEL}</span>
          </div>
        </aside>

        <main id="main" className="min-w-0 flex-1 px-4 pb-24 pt-6 md:px-10 md:pb-10" key={pathname}>
          <div className="anim-fade-up">
            <Outlet />
          </div>
        </main>
      </div>

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        <Menu orientation="horizontal" />
      </nav>
    </div>
  )
}

function Menu({ orientation }: { orientation: 'vertical' | 'horizontal' }) {
  const vertical = orientation === 'vertical'
  return (
    <ul
      className={vertical ? 'flex flex-col gap-1' : 'grid'}
      // Tailwind cannot see a class name built at runtime, so the column count is a style.
      style={vertical ? undefined : { gridTemplateColumns: `repeat(${NAV.length}, minmax(0, 1fr))` }}
    >
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
