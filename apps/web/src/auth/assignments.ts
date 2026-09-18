import { useEffect, useState } from 'react'
import { supabase } from './client.ts'
import { useAuth } from './useAuth.ts'
import type { Assignment } from '../progress/assignments.ts'

interface Row {
  id: string
  student_email: string
  set_by: string
  topic_id: string
  kind: string
  level: string | null
  starts_on: string | null
  due_on: string | null
  note: string | null
  created_at: string
}

const fromRow = (r: Row): Assignment => ({
  id: r.id,
  studentEmail: r.student_email,
  setBy: r.set_by,
  topicId: r.topic_id,
  kind: r.kind as Assignment['kind'],
  level: (r.level ?? undefined) as Assignment['level'],
  startsOn: r.starts_on ?? undefined,
  dueOn: r.due_on ?? undefined,
  note: r.note ?? undefined,
  createdAt: r.created_at,
})

const COLUMNS = 'id, student_email, set_by, topic_id, kind, level, starts_on, due_on, note, created_at'

/**
 * Every assignment the signed-in account may see. A student gets their own and a parent
 * gets their children's; the database decides which, so this function is the same either
 * way and the screen cannot widen it by asking differently.
 */
export async function listAssignments(): Promise<Assignment[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('assignments').select(COLUMNS).order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => fromRow(r as Row))
}

export interface NewAssignment {
  studentEmail: string
  topicId: string
  kind: Assignment['kind']
  level?: Assignment['level']
  startsOn?: string
  dueOn?: string
  note?: string
}

/** Returns an error message, or null when the task was set. */
export async function createAssignment(input: NewAssignment, setBy: string): Promise<string | null> {
  if (!supabase) return 'Sign-in is not set up on this build.'
  const { error } = await supabase.from('assignments').insert({
    student_email: input.studentEmail.toLowerCase(),
    set_by: setBy.toLowerCase(),
    topic_id: input.topicId,
    kind: input.kind,
    level: input.kind === 'worksheet' ? (input.level ?? 'core') : null,
    starts_on: input.startsOn || null,
    due_on: input.dueOn || null,
    note: input.note?.trim() || null,
  })
  return error ? error.message : null
}

export async function deleteAssignment(id: string): Promise<string | null> {
  if (!supabase) return 'Sign-in is not set up on this build.'
  const { error } = await supabase.from('assignments').delete().eq('id', id)
  return error ? error.message : null
}

/**
 * The signed-in student's own assignments, for their home screen.
 *
 * Loaded only for a student account. A parent is allowed to read their children's rows,
 * and showing those under "Set for you" on the parent's own home screen would be wrong.
 */
export function useMyAssignments(): { list: Assignment[]; loading: boolean; reload: () => void } {
  const auth = useAuth()
  const [list, setList] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  const mine = auth.status === 'allowed' && auth.role === 'student' ? auth.email : undefined

  useEffect(() => {
    if (!mine) { setList([]); return }
    let live = true
    setLoading(true)
    listAssignments()
      .then((rows) => { if (live) setList(rows.filter((r) => r.studentEmail === mine)) })
      .catch(() => { if (live) setList([]) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [mine, tick])

  return { list, loading, reload: () => setTick((n) => n + 1) }
}
