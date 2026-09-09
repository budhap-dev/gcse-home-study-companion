import { useEffect, useState } from 'react'
import { supabase } from './client.ts'
import { useAuth } from './useAuth.ts'

interface Row { email: string; role: 'parent' | 'student'; note: string | null; added_at: string }

/** Parents manage who can sign in. Students see only that they are on the list. */
export function FamilyPanel() {
  const auth = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'parent' | 'student'>('student')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const parent = auth.role === 'parent'

  const load = async () => {
    if (!supabase) return
    const { data, error } = await supabase.from('allowed_emails').select('email, role, note, added_at').order('added_at')
    if (error) setMessage(error.message)
    else setRows((data ?? []) as Row[])
  }
  useEffect(() => { if (auth.status === 'allowed') void load() }, [auth.status])

  if (auth.status !== 'allowed') return null
  if (!parent) return <p className="text-sm text-ink-2">You are signed in as a student. A parent can add or remove family accounts here.</p>

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    const clean = email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) { setMessage('That does not look like an email address.'); return }
    const { error } = await supabase.from('allowed_emails').insert({ email: clean, role, note: note.trim() || null })
    if (error) setMessage(error.code === '23505' ? `${clean} is already on the list.` : error.message)
    else { setMessage(`${clean} can now sign in as a ${role}.`); setEmail(''); setNote(''); void load() }
  }
  const remove = async (target: string) => {
    if (!supabase || target === auth.email) return
    if (!window.confirm(`Remove ${target}? They will be signed out on their next visit.`)) return
    const { error } = await supabase.from('allowed_emails').delete().eq('email', target)
    if (error) setMessage(error.message)
    else void load()
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-rule">
        {rows.map((r) => (
          <li key={r.email} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-bold">{r.email}{r.email === auth.email && <span className="ml-2 text-xs font-normal text-ink-2">(you)</span>}</span>
              <span className="text-xs text-ink-2">{r.role}{r.note ? ` · ${r.note}` : ''}</span>
            </span>
            {r.email !== auth.email && (
              <button type="button" onClick={() => void remove(r.email)} className="shrink-0 rounded-lg border border-rule px-3 py-1 text-xs font-bold text-status-not-secure">Remove</button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => void add(e)} className="flex flex-col gap-2 rounded-xl bg-panel p-3">
        <p className="text-sm font-bold">Add a Google account</p>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="name@gmail.com" autoComplete="off" className="h-11 rounded-lg border border-rule bg-surface px-3" />
        <div className="flex flex-col gap-2 sm:flex-row">
          <select value={role} onChange={(e) => setRole(e.target.value as 'parent' | 'student')} className="h-11 rounded-lg border border-rule bg-surface px-3">
            <option value="student">Student</option>
            <option value="parent">Parent</option>
          </select>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Name or note (optional)" className="h-11 flex-grow rounded-lg border border-rule bg-surface px-3" />
          <button type="submit" className="h-11 rounded-lg bg-[color:var(--subject,#1f3a93)] px-4 font-bold text-white">Add</button>
        </div>
        <p className="text-xs text-ink-2">Students see their own progress and lessons. Parents can also manage this list.</p>
      </form>
      {message && <p className="text-sm" role="status">{message}</p>}
    </div>
  )
}
