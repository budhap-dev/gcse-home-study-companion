import { NavLink, Outlet } from 'react-router'

const NAV = [
  { to: '/', label: 'Topics', end: true },
  { to: '/draft', label: 'Draft with AI' },
  { to: '/questions', label: 'Question bank' },
  { to: '/import', label: 'Import' },
  { to: '/reports', label: 'Reports' },
]

export function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-6 border-b border-rule bg-surface px-6 py-3">
        <span className="font-display text-base font-bold">Authoring</span>
        <nav aria-label="Primary">
          <ul className="flex gap-1">
            {NAV.map(({ to, label, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-2 text-sm font-bold ${isActive ? 'bg-panel text-ink' : 'text-ink-2 hover:bg-panel'}`
                  }
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="flex-1 px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
