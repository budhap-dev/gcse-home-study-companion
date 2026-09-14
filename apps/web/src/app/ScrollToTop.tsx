import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router'

/**
 * Puts a new screen at the top. Following a link deep down a long topic map used to
 * open the topic page already scrolled halfway down, because the browser keeps the
 * window's scroll position across a client-side navigation.
 *
 * Going **back** is left alone: the browser restores the old position on a POP, and a
 * student returning to a subject expects to land where they were, not at the top.
 */
export function ScrollToTop() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  useEffect(() => {
    if (navigationType === 'POP') return
    window.scrollTo({ top: 0, left: 0 })
  }, [pathname, navigationType])
  return null
}
