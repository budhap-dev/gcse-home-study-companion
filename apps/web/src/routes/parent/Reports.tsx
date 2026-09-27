import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { listReports, setReportStatus, type ContentReport } from '../../auth/reports.ts'
import { getTopic } from '../../content/index.ts'
import { RichText } from '../../components/RichText.tsx'

const STATUS_LABEL: Record<ContentReport['status'], string> = { open: 'Open', fixed: 'Fixed', 'not-a-fault': 'Not a fault' }

/** What a report points at, read from the bundled content: a step's title and address, or a question's prompt. */
export function describeItem(r: Pick<ContentReport, 'subject_id' | 'topic_id' | 'item_kind' | 'item_id'>) {
  const topic = getTopic(r.subject_id, r.topic_id)
  if (!topic) return { topicTitle: r.topic_id, text: undefined, href: undefined }
  if (r.item_kind === 'step') {
    const i = topic.lesson.steps.findIndex((s) => s.id === r.item_id)
    const step = topic.lesson.steps[i]
    return { topicTitle: topic.title, text: step ? `Lesson step ${i + 1}: ${step.title}` : undefined, href: step ? `/subjects/${r.subject_id}/topics/${r.topic_id}/lesson?step=${i + 1}` : undefined }
  }
  const q = topic.questions.find((x) => x.id === r.item_id)
  return { topicTitle: topic.title, text: q?.prompt, href: undefined }
}

/**
 * The family's "Report a mistake" notes, for a parent to check and mark. Open ones come
 * first. Each names the exact step or question, so it can be looked at straight away.
 */
export function ReportsPanel() {
  const [reports, setReports] = useState<ContentReport[] | null>(null)
  useEffect(() => {
    let live = true
    void listReports().then((r) => { if (live) setReports(r) })
    return () => { live = false }
  }, [])
  if (reports === null) return <p className="text-ink-2">Loading…</p>
  if (reports.length === 0) {
    return <p className="rounded-2xl border border-rule bg-surface p-4 text-ink-2">No mistakes reported yet. Anyone signed in can tap <strong className="text-ink">Report a mistake</strong> under a question or a lesson step.</p>
  }
  const mark = async (id: string, status: ContentReport['status']) => {
    if (await setReportStatus(id, status)) setReports((rs) => rs!.map((r) => (r.id === id ? { ...r, status } : r)))
  }
  const sorted = [...reports].sort((a, b) => Number(a.status !== 'open') - Number(b.status !== 'open'))
  const open = reports.filter((r) => r.status === 'open').length
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-2">{open} open of {reports.length} reported.</p>
      <ul className="flex flex-col gap-3">
        {sorted.map((r) => {
          const item = describeItem(r)
          return (
            <li key={r.id} className="flex flex-col gap-2 rounded-2xl border border-rule bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2">
                <span><strong className="text-ink">{item.topicTitle}</strong> · {r.item_kind === 'step' ? 'lesson step' : `${r.seen_in} question`} {r.item_id}</span>
                <span>{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {r.reporter_email} · v{r.app_version}</span>
              </div>
              {item.text && (item.href
                ? <Link to={item.href} className="text-sm font-bold text-ink underline">{item.text}</Link>
                : <div className="rounded-lg bg-panel p-2 text-sm"><RichText source={item.text} /></div>)}
              <p className="text-[15px]">“{r.note}”</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">{STATUS_LABEL[r.status]}</span>
                {r.status !== 'fixed' && <button type="button" onClick={() => void mark(r.id, 'fixed')} className="h-9 rounded-lg border border-rule px-3 text-sm font-bold">Mark fixed</button>}
                {r.status !== 'not-a-fault' && <button type="button" onClick={() => void mark(r.id, 'not-a-fault')} className="h-9 rounded-lg border border-rule px-3 text-sm font-bold">Not a fault</button>}
                {r.status !== 'open' && <button type="button" onClick={() => void mark(r.id, 'open')} className="h-9 rounded-lg border border-rule px-3 text-sm font-bold">Reopen</button>}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
