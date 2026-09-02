import { Link } from 'react-router'

export function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 py-12 text-center">
      <h1 className="text-2xl font-bold">There is nothing here</h1>
      <p className="text-ink-2">The page may have moved. Go back home and the app will suggest a next step.</p>
      <Link to="/" className="mx-auto mt-2 rounded-lg bg-ink px-4 py-2 font-bold text-surface">Home</Link>
    </div>
  )
}
