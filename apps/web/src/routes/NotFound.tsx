import { useEffect } from 'react'
import { Link, useRouteError } from 'react-router'
import { reportError } from '../auth/reports.ts'

/**
 * The router shows this for an address that matches nothing, and also for a page that
 * threw while rendering. Those are different: the second is a fault in the app, and it
 * never reaches the window's error handler because the router has already caught it. So
 * it is reported from here, and the page says something went wrong rather than that the
 * page does not exist.
 */
export function NotFound() {
  const error = useRouteError()
  // An address that matches nothing arrives as a 404 response, not an Error; only a thrown
  // Error is a fault in the app.
  const crashed = error instanceof Error
  useEffect(() => {
    if (crashed) reportError(error)
  }, [crashed, error])
  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 py-12 text-center">
      <h1 className="text-2xl font-bold">{crashed ? 'Something went wrong on this page' : 'There is nothing here'}</h1>
      <p className="text-ink-2">
        {crashed
          ? 'The app hit a fault. Go back home and carry on from there; if it happens again, tell a parent which page it was.'
          : 'The page may have moved. Go back home and the app will suggest a next step.'}
      </p>
      <Link to="/" className="mx-auto mt-2 rounded-lg bg-ink px-4 py-2 font-bold text-surface">Home</Link>
    </div>
  )
}
