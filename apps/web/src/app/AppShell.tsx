import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { navFor } from './nav.ts'
import { Logo } from '../components/Logo.tsx'
import { SearchBox } from '../components/SearchBox.tsx'
import { useAuth } from '../auth/useAuth.ts'
import { ScrollToTop } from './ScrollToTop.tsx'
import { useNewBuild } from './useNewBuild.ts'

/**
 * Layout: a band of the theme's banner colours across the top, carrying the app's name, the
 * menu and the search box on a laptop. Below laptop width the menu moves to a dock floating
 * over the foot of the screen, since six items, the name and a usable search box will not
 * share a tablet's width. The version and the signed-in line, which used to sit under a
 * sidebar, are on Settings.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const auth = useAuth()
  const newBuild = useNewBuild()
  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollToTop />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>

      {/* Offered, never forced: a student mid-quiz should not be reloaded out of it. */}
      {newBuild && (
        <div role="status" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-rule bg-[#fff4cc] px-4 py-2 text-sm text-[#6b4d00]">
          <span>A newer version of the app is available.</span>
          <button type="button" onClick={() => window.location.reload()} className="min-h-8 rounded-lg bg-[#6b4d00] px-3 py-1 font-bold text-[#fff4cc]">Reload</button>
        </div>
      )}

      <header className="hero-gradient sticky top-0 z-30 shadow-[0_6px_20px_rgb(16_24_40/0.12)]">
        {/* One row from tablet width: name left, search pushed right and bounded, the menu
            between them on a laptop. Two rows on a phone, because the name and a usable
            search box will not share 390px. */}
        <div className="flex flex-col gap-2 px-4 py-2.5 md:h-16 md:flex-row md:items-center md:gap-3 md:px-6 md:py-0 lg:gap-5">
          {/* Between laptop and wide screens the name gives its room to the menu, since a
              parent's six items and the search box will not fit beside it at 1024px. The
              mark stays, and the link's label still names the app. */}
          <NavLink to="/" aria-label="Home Study Companion, home" className="menu-home w-fit shrink-0 rounded-lg lg:max-xl:[&>span>span]:hidden">
            <Logo inline size={30} />
          </NavLink>
          <nav aria-label="Primary" className="hidden lg:block">
            <Menu variant="band" role={auth.role} />
          </nav>
          {/* The search box and its results are ordinary page surfaces, so they take the
              page's ink back from the band's white. */}
          <div className="w-full text-ink md:ml-auto md:max-w-md lg:max-w-64">
            <SearchBox />
          </div>
        </div>
      </header>

      <main id="main" className="min-w-0 flex-1 px-4 pb-32 pt-6 md:px-10 lg:pb-10" key={pathname}>
        <div className="anim-fade-up">
          <Outlet />
        </div>
      </main>

      <nav aria-label="Primary" className="hero-gradient fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 rounded-[1.75rem] shadow-[0_12px_30px_rgb(16_24_40/0.28)] lg:hidden">
        <Menu variant="dock" role={auth.role} />
      </nav>
    </div>
  )
}

/**
 * The menu. A white pill slides to the page you are on, and that item's label and icon take
 * its own colour on it. The pill is measured rather than laid out, because it has to move
 * between items: it covers the whole item on the band and just the icon in the dock.
 */
function Menu({ variant, role }: { variant: 'band' | 'dock'; role?: 'parent' | 'student' }) {
  const items = navFor(role)
  const { pathname } = useLocation()
  const ref = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const box = ref.current
    if (!box) return
    const place = () => {
      const on = box.querySelector<HTMLElement>('a[aria-current="page"]')
      const target = on && (variant === 'dock' ? on.querySelector<HTMLElement>('.menu-ic') : on)
      // Hidden at this width, or on a page the menu does not list (a topic, a lesson).
      if (!on || !target || target.offsetWidth === 0) return box.style.setProperty('--pill-o', '0')
      const outer = box.getBoundingClientRect()
      const r = target.getBoundingClientRect()
      box.style.setProperty('--pill-x', `${r.left - outer.left}px`)
      box.style.setProperty('--pill-y', `${r.top - outer.top}px`)
      box.style.setProperty('--pill-w', `${r.width}px`)
      box.style.setProperty('--pill-h', `${r.height}px`)
      box.style.setProperty('--pill-o', '1')
    }
    place()
    // Webfonts change the labels' widths after the first paint, and crossing the laptop
    // breakpoint takes a menu from hidden to shown; both resize the box.
    const watch = new ResizeObserver(place)
    watch.observe(box)
    void document.fonts?.ready.then(place)
    return () => watch.disconnect()
  }, [pathname, variant, items.length])

  // Only slide once the pill has a place: from the first paint it would fly in from a corner.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div ref={ref} className={`menu menu-${variant}`} data-ready={ready || undefined}>
      <span aria-hidden className="menu-pill" />
      <ul style={variant === 'dock' ? { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` } : undefined}>
        {items.map(({ to, label, icon: Icon, colour, end }) => (
          <li key={to}>
            <NavLink to={to} end={end} className="menu-item" style={{ '--item': colour } as CSSProperties}>
              <span className="menu-ic"><Icon /></span>
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
