import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate, sheetQuestions } from '../index.ts'
import type { Generated } from '../types.ts'
import { evaluate, queryIn, readTables, sqlGenerators } from './sql.ts'

/**
 * Structural tests for the SQL generators (AQA 8525 3.7.2). Each reads the printed tables and
 * query back out of the prompt with a parser written here (line by line, not the generator's
 * reader) and counts the records again by hand: rows kept by the condition, the join as each
 * row's own group, the missing join as kept rows × groups. It checks the solution's figures and
 * some lines literally, that the named slips never score (every row, the distinct values, either
 * condition alone, ≥ for >, n × m, n + m, k + m, k, m), the spread, and the higher sheet.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/computer-science')
const TOPIC = 'databases-and-sql'
const data = JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8')) as { questions: unknown[]; worksheets: Record<string, { questionIds: string[] }> }
const bank = Question.array().parse(data.questions)
const written = (id: string) => bank.find((q) => q.id === id)!
const sheet = (level: string) => data.worksheets[level]!.questionIds.map(written)
const g = GENERATORS.find((x) => x.id === 'cs-sql')!

const build = (id: string, count = 300, prefix = 'structure') => Array.from({ length: count }, (_, i) => generate(g, written(id), `${prefix}-${i}`))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
function share<T>(items: T[], key: (x: T) => unknown) {
  const counts = new Map<unknown, number>()
  for (const x of items) counts.set(key(x), (counts.get(key(x)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / items.length, distinct: counts.size }
}

function marksTyped(b: Generated) {
  const a = answer(b)
  for (const t of [String(a), ` ${a} `, a.toLocaleString('en-GB')]) expect(mark(b.question, t).correct, `${b.seed}: ${t}`).toBe(true)
  expect(mark(b.question, String(a + 1)).correct).toBe(false)
}

/** The prompt's tables, read here line by line: name → rows of [id, name, value, link] (or [id, name]). */
function tables(prompt: string): Map<string, string[][]> {
  const out = new Map<string, string[][]>()
  let current: string | null = null
  for (const line of prompt.split('\n')) {
    const name = /^\*\*(\w+)\*\*$/.exec(line)
    if (name) { current = name[1]!; out.set(current, []); continue }
    if (current && line.startsWith('| ') && !/^\| \w+ID \|/.test(line)) out.get(current)!.push(line.split('|').slice(1, -1).map((c) => c.trim()))
    if (current && !line.startsWith('|') && line.trim() && !name) current = null
  }
  return out
}
const test = (x: number, op: string, v: number) => (op === '=' ? x === v : op === '>' ? x > v : x < v)

describe('cs-sql', () => {
  it('covers every numeric written slot', () => {
    expect([...g.replaces].sort()).toEqual(['q21', 'q22', 'q7'])
    expect(bank.filter((q) => q.type === 'numeric').map((q) => q.id).sort()).toEqual(['q21', 'q22', 'q7'])
    expect(sqlGenerators).toEqual([g])
  })

  it('the evaluator reaches every written answer from the written prompt', () => {
    for (const id of ['q7', 'q21', 'q22']) {
      const q = written(id)
      expect(evaluate(queryIn(q.prompt), readTables(q.prompt)), id).toBe(q.type === 'numeric' ? q.answer : NaN)
    }
    // ORDER BY sorts and changes no count; a missing join pairs every row with every row.
    const t = readTables(written('q22').prompt)
    expect(evaluate('SELECT Name FROM Student WHERE YearGroup = 11 ORDER BY Name DESC', t)).toBe(3)
    expect(evaluate('SELECT Student.Name FROM Student, Club', t)).toBe(15)
    expect(evaluate("SELECT Student.Name FROM Student, Club WHERE Student.ClubID = Club.ClubID AND Club.ClubName = 'Drama'", t)).toBe(2)
  })

  it("keeps each slot's marks, units and exact tolerance, agrees with the evaluator, and never fails to draw over 3000 seeds", () => {
    for (const id of g.replaces) {
      const slot = written(id)
      for (let i = 0; i < 3000; i++) {
        const b = generate(g, slot, `throw-${i}`)
        expect(b.check.agrees, `${id} ${b.seed}: ${b.check.detail}`).toBe(true)
        if (i >= 300) continue
        const q = b.question
        if (q.type !== 'numeric' || slot.type !== 'numeric') throw new Error('not numeric')
        expect(q.units).toBe(slot.units)
        expect(q.tolerance).toBe(0)
        expect(q.markScheme.reduce((s, l) => s + l.marks, 0)).toBe(slot.marks)
        if (i < 60) marksTyped(b)
      }
    }
  })

  it('repeats no prompt in a twentieth of 1000 builds, and never the written one', () => {
    for (const id of g.replaces) {
      const built = build(id, 1000, 'share')
      expect(share(built, (b) => b.question.prompt).worst, id).toBeLessThanOrEqual(0.05)
      expect(built.filter((b) => b.question.prompt === written(id).prompt).length, id).toBeLessThanOrEqual(50)
    }
  })

  it('prints tables as the written questions do: bold name, header, rule, ids from 1', () => {
    for (const id of g.replaces) {
      for (const b of build(id, 50, 'layout')) {
        const p = b.question.prompt
        expect(p).toMatch(/^\*\*(Student|Player|Film)\*\*\n\n\| (StudentID|PlayerID|FilmID) \| (Name|Title) \| (YearGroup|Age|Year) \| (ClubID|TeamID|GenreID) \|\n\|---\|---\|---\|---\|\n\| 1 \| /)
        for (const [, rows] of tables(p)) expect(rows.map((r) => r[0])).toEqual(rows.map((_, i) => String(i + 1)))
      }
    }
  })

  it('q7: the kept rows counted by hand; every row, the distinct values, ≥ for > and either AND condition alone never score', () => {
    const built = build('q7', 600)
    const kinds = new Map<string, number>()
    for (const b of built) {
      const [rows] = [...tables(b.question.prompt).values()]
      const sql = /`(SELECT [^`]+)`/.exec(b.question.prompt)![1]!
      const conds = /WHERE (.+?)(?: ORDER BY .+)?$/.exec(sql)![1]!.split(' AND ').map((c) => /^(\w+) (=|>|<) (\d+)$/.exec(c)!)
      const col = (f: string) => (/ID$/.test(f) ? 3 : 2)
      const keep = (r: string[], cs = conds) => cs.every((c) => test(Number(r[col(c[1]!)]), c[2]!, Number(c[3])))
      const n = rows!.filter((r) => keep(r)).length
      expect(answer(b), b.seed).toBe(n)
      expect(answer(b)).toBeGreaterThanOrEqual(1)
      expect(rows!.length).not.toBe(answer(b))
      if (conds.length === 1) {
        const c = conds[0]!
        expect(new Set(rows!.map((r) => r[col(c[1]!)])).size, b.seed).not.toBe(answer(b))
        if (c[2] !== '=') {
          const ge = rows!.filter((r) => (c[2] === '>' ? Number(r[2]) >= Number(c[3]) : Number(r[2]) <= Number(c[3]))).length
          expect(ge, b.seed).not.toBe(answer(b))
        }
      } else {
        for (const c of conds) expect(rows!.filter((r) => keep(r, [c])).length, b.seed).not.toBe(answer(b))
      }
      for (const c of conds) expect(Number(c[3])).not.toBe(answer(b))
      expect(sql).not.toMatch(/^SELECT Name FROM Student WHERE YearGroup = 10$/)
      const names = rows!.filter((r) => keep(r)).map((r) => r[1]!)
      for (const name of names) expect(b.question.solution).toContain(name)
      expect(b.question.solution).toContain(`so the query returns **${n}** record${n === 1 ? '' : 's'}.`)
      if (/ORDER BY/.test(sql)) expect(b.question.solution).toContain('ORDER BY only sorts the records')
      kinds.set(String(b.values.kind), (kinds.get(String(b.values.kind)) ?? 0) + 1)
    }
    expect([...kinds.keys()].sort()).toEqual(['and', 'cmp', 'eq', 'fk'])
    const answers = share(built, answer)
    expect(answers.worst).toBeLessThanOrEqual(0.4)
    expect(answers.distinct).toBeGreaterThanOrEqual(4)
    expect(share(built, (b) => b.values.schema).worst).toBeLessThan(0.45)
  })

  it('q21: the join pairs each row with its own group; dropping either condition or the join never scores', () => {
    const built = build('q21', 600)
    for (const b of built) {
      const t = tables(b.question.prompt)
      const [main, groups] = [...t.values()] as [string[][], string[][]]
      const sql = queryIn(b.question.prompt)
      const name = /\.\w+Name = '([^']+)'/.exec(sql)![1]!
      const gid = groups.find((x) => x[1] === name)![0]!
      const num = /\.(?:YearGroup|Age|Year) (=|>|<) (\d+)/.exec(sql)
      const byGroup = main.filter((r) => r[3] === gid)
      const byNum = num ? main.filter((r) => test(Number(r[2]), num[1]!, Number(num[2]))) : main
      const both = byGroup.filter((r) => byNum.includes(r))
      expect(answer(b), b.seed).toBe(both.length)
      expect(sql.split('\n')[2]).toMatch(/^WHERE (Student|Player|Film)\.(Club|Team|Genre)ID = (Club|Team|Genre)\.(Club|Team|Genre)ID$/)
      if (num) expect(byGroup.length).not.toBe(answer(b))
      expect(byNum.length).not.toBe(answer(b)) // the join left out: every kept row paired with the one named group
      expect(main.length * groups.length).not.toBe(answer(b))
      expect(main.length).not.toBe(answer(b))
      expect(b.question.solution).toContain(`so the query returns **${both.length}** record${both.length === 1 ? '' : 's'}.`)
      // Every row's own pairing is listed.
      for (const r of main) expect(b.question.solution).toContain(`${r[1]}–${groups.find((x) => x[0] === r[3])![1]}`)
      expect(sql).not.toMatch(/YearGroup = 10\b/)
    }
    const answers = share(built, answer)
    expect(answers.worst).toBeLessThanOrEqual(0.4)
    expect(answers.distinct).toBe(4)
    expect(built.filter((b) => b.values.op !== 'none').length / built.length).toBeGreaterThan(0.7)
  })

  it('q22: kept rows × groups, as the written solution counts; k, m, every row, n × m, n + m and k + m never score', () => {
    const built = build('q22', 600)
    for (const b of built) {
      const [main, groups] = [...tables(b.question.prompt).values()] as [string[][], string[][]]
      const sql = queryIn(b.question.prompt)
      expect(sql).not.toMatch(/= (Club|Team|Genre)\./)
      const c = /WHERE \w+\.(\w+) (=|>|<) (\d+)$/.exec(sql)!
      const k = main.filter((r) => test(Number(r[/ID$/.test(c[1]!) ? 3 : 2]), c[2]!, Number(c[3]))).length
      const [n, m] = [main.length, groups.length]
      expect(answer(b), b.seed).toBe(k * m)
      for (const wrong of [k, m, n, n * m, n + m, k + m]) expect(wrong, b.seed).not.toBe(answer(b))
      expect(Number(c[3])).not.toBe(answer(b))
      expect(b.question.solution).toContain(`${n} × ${m} = ${n * m} pairs`)
      expect(b.question.solution).toContain(`returns ${k} × ${m} = **${k * m}** records`)
      expect(b.question.solution).toContain('It runs without an error, which is what makes the mistake easy to miss.')
    }
    const answers = share(built, answer)
    expect(answers.worst).toBeLessThanOrEqual(0.4)
    expect(answers.distinct).toBeGreaterThanOrEqual(10)
    const squares = built.filter((b) => b.values.k === b.values.m).length / built.length
    expect(squares).toBeGreaterThan(0.04)
    expect(squares).toBeLessThanOrEqual(0.15)
    const student = built.find((b) => b.values.schema === 'student' && b.values.kind === 'eq' && b.values.m === 3)!
    expect(student.question.solution).toMatch(/^With no join condition, every student is paired with \*\*every\*\* club: \d × 3 = \d+ pairs\. The WHERE clause keeps the pairs for the \*\*\d\*\* Year \d+ students, and each of them appears once per club/)
    expect(student.question.solution).toContain('three times each')
  })

  it('higher sheet: q7 and q21 always print different databases', () => {
    for (let i = 0; i < 300; i++) {
      const h = sheetQuestions('computer-science', TOPIC, sheet('higher'), `higher-${i}`)
      const first = (id: string) => /^\*\*(\w+)\*\*/.exec(h.find((x) => x.question.id === id)!.question.prompt)![1]
      expect(first('q7')).not.toBe(first('q21'))
    }
  })
})
