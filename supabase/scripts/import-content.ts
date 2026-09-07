/**
 * Loads the content pack in supabase/seed/content into the database.
 *
 *   node supabase/scripts/import-content.ts [--publish] [--check]
 *
 * Environment: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Locally,
 * `pnpm exec supabase status -o env` prints them as API_URL and SERVICE_ROLE_KEY.
 *
 * Every file is validated against the shared schema and the publish rules first.
 * A file with schema errors stops the run. Publish-rule errors are reported and the
 * version is still stored as a draft, because that is what drafts are for.
 *
 * --check   validate only, write nothing; exit 1 on any schema error
 * --publish publish versions that pass every publish rule, including review.
 *           Unreviewed AI drafts are never published, whatever flags are given.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { Topic, canPublish, validateTopicForPublish } from '@study/shared'

const ROOT = join(import.meta.dirname, '../seed/content')
const args = new Set(process.argv.slice(2))
const checkOnly = args.has('--check')
const publish = args.has('--publish')

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return jsonFiles(full)
    return name.endsWith('.json') ? [full] : []
  })
}

interface Loaded {
  file: string
  topic: Topic
  issues: ReturnType<typeof validateTopicForPublish>
}

function load(): Loaded[] {
  const loaded: Loaded[] = []
  let schemaErrors = 0
  for (const file of jsonFiles(ROOT).sort()) {
    const rel = relative(ROOT, file)
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    const parsed = Topic.safeParse(raw)
    if (!parsed.success) {
      schemaErrors++
      console.error(`✗ ${rel}: does not match the content schema`)
      for (const issue of parsed.error.issues.slice(0, 10)) console.error(`    ${issue.path.join('.')}: ${issue.message}`)
      continue
    }
    const issues = validateTopicForPublish(parsed.data)
    const errors = issues.filter((i) => i.severity === 'error')
    const state = canPublish(issues) ? 'publishable' : `draft (${errors.map((e) => e.path).join(', ')})`
    console.log(`✓ ${rel}: ${parsed.data.questions.length} questions, ${parsed.data.lesson.steps.length} steps, ${state}`)
    loaded.push({ file: rel, topic: parsed.data, issues })
  }
  if (schemaErrors > 0) {
    console.error(`${schemaErrors} file(s) failed the schema`)
    process.exit(1)
  }
  return loaded
}

async function main() {
  const loaded = load()
  if (checkOnly) return

  const url = process.env.SUPABASE_URL ?? process.env.API_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or run `supabase status -o env`).')
    process.exit(1)
  }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  let inserted = 0
  let unchanged = 0
  let published = 0
  for (const [index, { file, topic, issues }] of loaded.entries()) {
    // The topic row: keep an existing sort order, otherwise use file order.
    const { data: existingTopic } = await db.from('topics').select('sort').eq('id', topic.id).maybeSingle()
    const { error: topicError } = await db.from('topics').upsert(
      {
        id: topic.id,
        subject_id: topic.subjectId,
        unit_id: topic.unitId,
        title: topic.title,
        sort: existingTopic?.sort ?? index + 1,
        boards: topic.boards ?? null,
      },
      { onConflict: 'id' },
    )
    if (topicError) throw new Error(`${file}: topic upsert failed: ${topicError.message}`)

    // A new version only when the content changed.
    const { data: latest } = await db
      .from('topic_versions')
      .select('id, version, content, published_at')
      .eq('topic_id', topic.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    let versionId = latest?.id as string | undefined
    if (latest && JSON.stringify(latest.content) === JSON.stringify(topic)) {
      unchanged++
    } else {
      const { data: row, error } = await db
        .from('topic_versions')
        .insert({
          topic_id: topic.id,
          version: (latest?.version ?? 0) + 1,
          content: topic,
          drafted_by: topic.provenance.draftedBy,
          reviewed_by: topic.provenance.reviewedBy ?? null,
          reviewed_at: topic.provenance.reviewedAt ?? null,
        })
        .select('id')
        .single()
      if (error) throw new Error(`${file}: version insert failed: ${error.message}`)
      versionId = row.id
      inserted++
    }

    if (publish && versionId && canPublish(issues) && !latest?.published_at) {
      const { error } = await db.from('topic_versions').update({ published_at: new Date().toISOString() }).eq('id', versionId).is('published_at', null)
      if (error) throw new Error(`${file}: publish failed: ${error.message}`)
      published++
    } else if (publish && !canPublish(issues)) {
      console.log(`  not published: ${file} has publish-rule errors (${issues.filter((i) => i.severity === 'error').map((i) => i.path).join(', ')})`)
    }
  }
  console.log(`Imported ${loaded.length} topic(s): ${inserted} new version(s), ${unchanged} unchanged, ${published} published.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
