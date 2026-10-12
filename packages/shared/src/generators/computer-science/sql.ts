import type { Question } from '../../content/questions.ts'
import { draw, int, pick, shuffle, weighted, type Rng } from '../random.ts'
import type { Draft, Generator } from '../types.ts'
import { an, andList, csBySlot, fence, numericDraft, printedCode } from './build.ts'

/**
 * Computer Science (AQA 8525) generators for 3.7.2, structured query language: "be able to use
 * SQL to retrieve data from a relational database, using the commands SELECT, FROM, WHERE,
 * ORDER BY … ASC | DESC", from no more than two tables, and 3.7.1's foreign key, which links
 * them. A two-table query states its link in WHERE (Student.ClubID = Club.ClubID), as the lesson
 * writes it; without it the tables are paired every way, the cross product the lesson warns of.
 *
 * Tables print as the written questions print them: the table's name in bold, then a Markdown
 * table, the primary key first and numbered from 1, the foreign key last. Three databases: the
 * pack's Student and Club, a junior sports club's Player and Team, and a film library's Film and
 * Genre, each with its own value ranges. The rows, the condition and the query vary; every count
 * is worked a second way by `evaluate`, which reads the printed tables and query back from the
 * prompt text and runs the query (the cross product of the FROM tables, then every condition).
 *
 * - q7 (higher): how many records a one-table query returns: a field equal to a value, above or
 *   below one (a row sits on the value, so reading > as ≥ changes the count), a foreign key equal
 *   to a value, or two conditions with AND; sometimes ORDER BY, which changes nothing. Every row,
 *   the number of distinct values, and either AND condition alone never pay.
 * - q21 (higher): the lesson's two-table query, the join then a club (team, genre) by name and,
 *   in four builds in five, a condition on the first table. Leaving out either condition, or the
 *   join, never pays.
 * - q22 (advanced): the same query with the join left out: the k rows the condition keeps, each
 *   paired with all m rows of the second table, k × m as the written solution counts. k, m,
 *   every row, n × m, n + m and k + m never pay.
 *
 * q7 and q21 share the higher sheet and take consecutive turns, so they always print different
 * databases. A Student query never asks for Year 10 alone, which is q5's written answer on that sheet.
 */

const TOPIC = 'databases-and-sql'

export interface Schema {
  key: string
  table: string
  id: string
  name: string
  num: string
  fk: string
  table2: string
  id2: string
  name2: string
  /** The values the numeric field takes. */
  nums: number[]
  rowNames: readonly string[]
  groups: readonly string[]
  /** One row in words: "student", "player", "film". */
  row: string
  /** One row of the second table: "club", "team", "genre". */
  row2: string
  /** "their" for people, "its" for a film. */
  their: string
  /** The rows a condition keeps, in words: "Year 11 students", "players older than 12". */
  kept: (op: Op, v: number) => string
  /** "are in Year 11", "are older than 12", for one or more names. */
  verb: (op: Op, v: number, many: boolean) => string
}

export type Op = '=' | '>' | '<'

const PEOPLE = ['Amara', 'Ben', 'Chloe', 'Dev', 'Elif', 'Farah', 'George', 'Hana', 'Isaac', 'Jas', 'Kemi', 'Luca', 'Mia', 'Nico', 'Olu', 'Priya', 'Quinn', 'Rhys', 'Sana', 'Tariq', 'Wren', 'Yara', 'Zoe', 'Callum', 'Leah', 'Rory'] as const

export const SCHEMAS: Schema[] = [
  {
    key: 'student', table: 'Student', id: 'StudentID', name: 'Name', num: 'YearGroup', fk: 'ClubID', table2: 'Club', id2: 'ClubID', name2: 'ClubName',
    nums: [7, 8, 9, 10, 11], rowNames: PEOPLE,
    groups: ['Chess', 'Drama', 'Robotics', 'Choir', 'Coding', 'Football', 'Art', 'Netball', 'Orchestra', 'Gardening'],
    row: 'student', row2: 'club', their: 'their',
    kept: (op, v) => (op === '=' ? `Year ${v} students` : `students in a year group ${op === '>' ? 'above' : 'below'} ${v}`),
    verb: (op, v, many) => (op === '=' ? `${many ? 'are' : 'is'} in Year ${v}` : `${many ? 'are' : 'is'} in a year group ${op === '>' ? 'above' : 'below'} ${v}`),
  },
  {
    key: 'player', table: 'Player', id: 'PlayerID', name: 'Name', num: 'Age', fk: 'TeamID', table2: 'Team', id2: 'TeamID', name2: 'TeamName',
    nums: [9, 10, 11, 12, 13, 14], rowNames: PEOPLE,
    groups: ['Lions', 'Tigers', 'Eagles', 'Falcons', 'Wolves', 'Hawks', 'Otters', 'Foxes'],
    row: 'player', row2: 'team', their: 'their',
    kept: (op, v) => (op === '=' ? `players aged ${v}` : `players ${op === '>' ? 'older' : 'younger'} than ${v}`),
    verb: (op, v, many) => (op === '=' ? `${many ? 'are' : 'is'} aged ${v}` : `${many ? 'are' : 'is'} ${op === '>' ? 'older' : 'younger'} than ${v}`),
  },
  {
    key: 'film', table: 'Film', id: 'FilmID', name: 'Title', num: 'Year', fk: 'GenreID', table2: 'Genre', id2: 'GenreID', name2: 'GenreName',
    nums: [2018, 2019, 2020, 2021, 2022, 2023],
    rowNames: ['Night Train', 'Blue River', 'Lost Island', 'Star Hunter', 'Cold Harbour', 'Hidden Valley', 'Robot Summer', 'Ghost Lake', 'Desert Run', 'Silver Fox', 'Deep Orbit', 'Iron Garden', 'Last Lighthouse', 'Paper Kites', 'Storm Road', 'Quiet Planet'],
    groups: ['Comedy', 'Horror', 'Drama', 'Animation', 'Thriller', 'Musical', 'Western', 'Adventure'],
    row: 'film', row2: 'genre', their: 'its',
    kept: (op, v) => (op === '=' ? `films from ${v}` : `films from ${op === '>' ? 'after' : 'before'} ${v}`),
    verb: (op, v, many) => (op === '=' ? `${many ? 'are' : 'is'} from ${v}` : `${many ? 'are' : 'is'} from ${op === '>' ? 'after' : 'before'} ${v}`),
  },
]

export interface Row {
  id: number
  name: string
  num: number
  fk: number
}

/** "**Student**" and its rows as a Markdown table, exactly as the written questions print it. */
export function mainTable(s: Schema, rows: Row[]): string {
  return `**${s.table}**\n\n| ${s.id} | ${s.name} | ${s.num} | ${s.fk} |\n|---|---|---|---|\n${rows.map((r) => `| ${r.id} | ${r.name} | ${r.num} | ${r.fk} |`).join('\n')}`
}

export function groupTable(s: Schema, groups: string[]): string {
  return `**${s.table2}**\n\n| ${s.id2} | ${s.name2} |\n|---|---|\n${groups.map((g, i) => `| ${i + 1} | ${g} |`).join('\n')}`
}

/** "Amara, Chloe and Elif". */
const and = andList
const records = (n: number) => `**${n}** record${n === 1 ? '' : 's'}`
const holds = (op: Op, x: number, v: number) => (op === '=' ? x === v : op === '>' ? x > v : x < v)

// ---------------------------------------------------------------------------------------------
// The second route: run the query on the tables as printed.
// ---------------------------------------------------------------------------------------------

type Cell = string | number
type Table = { name: string; columns: string[]; rows: Cell[][] }

/** Every bold-named Markdown table in a text. */
export function readTables(text: string): Table[] {
  const out: Table[] = []
  const re = /\*\*(\w+)\*\*\n\n((?:\|.*\|\n?)+)/g
  for (const m of text.matchAll(re)) {
    const lines = m[2]!.trim().split('\n').filter((l) => !/^\|[-| ]+\|$/.test(l))
    const cells = lines.map((l) => l.slice(1, -1).split('|').map((c) => c.trim()))
    out.push({ name: m[1]!, columns: cells[0]!, rows: cells.slice(1).map((r) => r.map((c) => (/^\d+$/.test(c) ? Number(c) : c))) })
  }
  return out
}

/**
 * How many records a SELECT returns: the FROM tables' cross product, kept where every AND-ed
 * WHERE condition holds (a field compared with a field, a number or a quoted text). ORDER BY
 * sorts and changes no count.
 */
export function evaluate(sql: string, tables: Table[]): number {
  const flat = sql.replace(/\s+/g, ' ').trim()
  const m = /^SELECT (.+?) FROM (.+?)(?: WHERE (.+?))?(?: ORDER BY .+)?$/.exec(flat)
  if (!m) throw new Error(`cannot read ${sql}`)
  const from = m[2]!.split(',').map((t) => tables.find((x) => x.name === t.trim())!)
  if (from.some((t) => !t)) throw new Error(`a table in ${m[2]} is not printed`)
  let combos: Map<string, Cell>[] = [new Map()]
  for (const t of from) {
    const next: Map<string, Cell>[] = []
    for (const c of combos)
      for (const row of t.rows) {
        const n = new Map(c)
        t.columns.forEach((col, i) => {
          n.set(`${t.name}.${col}`, row[i]!)
          if (from.length === 1) n.set(col, row[i]!)
        })
        next.push(n)
      }
    combos = next
  }
  const conds = m[3] ? m[3].split(/ AND /) : []
  const value = (c: Map<string, Cell>, term: string): Cell => {
    const t = term.trim()
    if (/^\d+$/.test(t)) return Number(t)
    if (/^'.*'$/.test(t)) return t.slice(1, -1)
    if (!c.has(t)) throw new Error(`no field ${t}`)
    return c.get(t)!
  }
  return combos.filter((c) =>
    conds.every((cond) => {
      const k = /^(.+?) (=|>|<) (.+)$/.exec(cond)
      if (!k) throw new Error(`cannot read ${cond}`)
      const [a, b] = [value(c, k[1]!), value(c, k[3]!)]
      return k[2] === '=' ? a === b : k[2] === '>' ? a > b : a < b
    }),
  ).length
}

/** The query in a prompt: inline code (q7) or a fenced block (q21, q22). */
export const queryIn = (prompt: string) => (prompt.includes('```') ? printedCode(prompt) : /`(SELECT [^`]+)`/.exec(prompt)![1]!)

// ---------------------------------------------------------------------------------------------
// Drawing rows
// ---------------------------------------------------------------------------------------------

/** Rows 1 to n, distinct names, each value from `num` and `fk` as given per row. */
function rowsOf(r: Rng, s: Schema, nums: number[], fks: number[]): Row[] {
  const names = shuffle(r, s.rowNames).slice(0, nums.length)
  return nums.map((num, i) => ({ id: i + 1, name: names[i]!, num, fk: fks[i]! }))
}

/** A value of the schema's numeric field that `op v` keeps, or one it does not. */
const valuesThat = (s: Schema, op: Op, v: number, keep: boolean) => s.nums.filter((x) => holds(op, x, v) === keep)

/** A condition the answer can be drawn for: `op v` with values on both sides. */
function condition(r: Rng, s: Schema, op: Op, avoid = -1): number {
  const ok = s.nums.filter((v) => v !== avoid && valuesThat(s, op, v, true).length && valuesThat(s, op, v, false).length && !(s.key === 'student' && op === '=' && v === 10))
  return pick(r, ok)
}

// ---------------------------------------------------------------------------------------------
// q7: one table
// ---------------------------------------------------------------------------------------------

export type OneKind = 'eq' | 'cmp' | 'fk' | 'and'

function oneTable(r: Rng, slot: Question, turn: number): Draft {
  const s = SCHEMAS[((turn % 3) + 3) % 3]!
  const kind = weighted<OneKind>(r, [['eq', 40], ['cmp', 25], ['fk', 15], ['and', 20]])
  const n = int(r, 5, 8)
  const m = int(r, 3, 4)
  // Up to 4 (5 only for > and <, where the kept rows still differ); AND keeps at most 3, with a row for each condition alone.
  const answer = weighted(r, [[1, 2], [2, 3], [3, 3], [4, 2], [5, 1]].filter(([a]) => a! <= (kind === 'and' ? 3 : kind === 'cmp' ? 5 : 4) && a! < n - (kind === 'and' ? 1 : 0)) as [number, number][])
  const op: Op = kind === 'cmp' ? pick(r, ['>', '<'] as const) : '='
  const v = condition(r, s, op)
  const c = pick(r, Array.from({ length: m }, (_, i) => i + 1).filter((x) => x !== answer))
  const otherFk = () => pick(r, Array.from({ length: m }, (_, j) => j + 1).filter((x) => x !== c))
  const { nums, fks } = draw(
    r,
    (r) => {
      const at = shuffle(r, Array.from({ length: n }, (_, i) => i))
      const keep = new Set(at.slice(0, answer))
      // AND: one row that meets only the first condition and one that meets only the second, so neither alone pays.
      const onlyNum = kind === 'and' ? at[answer] : undefined
      const onlyFk = kind === 'and' ? at[answer + 1] : undefined
      const nums: number[] = []
      const fks: number[] = []
      for (let i = 0; i < n; i++) {
        if (kind === 'fk') {
          nums.push(pick(r, s.nums))
          fks.push(keep.has(i) ? c : otherFk())
        } else {
          nums.push(pick(r, valuesThat(s, op, v, keep.has(i) || i === onlyNum)))
          fks.push(kind === 'and' ? (keep.has(i) || i === onlyFk ? c : otherFk()) : int(r, 1, m))
        }
      }
      return { nums, fks }
    },
    // A row on the value itself when the condition is > or <, so reading it as ≥ or ≤ changes the
    // count; and the number of distinct values in the field never the answer.
    ({ nums, fks }) => (kind !== 'cmp' || nums.includes(v)) && (kind === 'and' || new Set(kind === 'fk' ? fks : nums).size !== answer),
  )
  const rows = rowsOf(r, s, nums, fks)
  const where =
    kind === 'fk' ? `${s.fk} = ${c}` : kind === 'and' ? `${s.num} = ${v} AND ${s.fk} = ${c}` : `${s.num} ${op} ${v}`
  const order = r() < 0.2 ? ` ORDER BY ${s.name} ${pick(r, ['ASC', 'DESC'])}` : ''
  const sql = `SELECT ${s.name} FROM ${s.table} WHERE ${where}${order}`
  const prompt = `${mainTable(s, rows)}\n\nHow many records does \`${sql}\` return from this ${s.table} table?`
  const kept = rows.filter((x) => (kind === 'fk' ? x.fk === c : holds(op, x.num, v) && (kind !== 'and' || x.fk === c)))
  const names = kept.map((x) => x.name)
  const many = names.length > 1
  let because: string
  if (kind === 'fk') because = `${and(names)} ${many ? 'have' : 'has'} ${s.fk} ${c}`
  else if (kind === 'and') because = `${and(names)} ${many ? 'meet' : 'meets'} both conditions, ${s.num} ${v} and ${s.fk} ${c}`
  else because = `${and(names)} ${s.verb(op, v, many)}`
  const edge = kind === 'cmp' ? ` ${an(s.num) === 'an' ? 'An' : 'A'} ${s.num} of exactly ${v} is not ${op === '>' ? 'above' : 'below'} ${v}, so ${and(rows.filter((x) => x.num === v).map((x) => x.name))} ${rows.filter((x) => x.num === v).length > 1 ? 'are' : 'is'} left out.` : ''
  const sorted = order ? ' ORDER BY only sorts the records; it does not change how many there are.' : ''
  const solution = `${because}, so the query returns ${records(answer)}.${edge}${sorted}`
  const counted = evaluate(queryIn(prompt), readTables(prompt))
  return numericDraft(
    slot,
    { prompt, solution, method: [`identifies the records where ${where.replace(/ AND /, ' and ')}`], answer },
    { agrees: counted === answer && kept.length === answer, detail: `evaluator on the printed table: ${counted} records` },
    { schema: s.key, kind, where, n, answer },
  )
}

// ---------------------------------------------------------------------------------------------
// q21 and q22: two tables
// ---------------------------------------------------------------------------------------------

function twoTables(r: Rng, slot: Question, turn: number): Draft {
  const s = SCHEMAS[((turn % 3) + 3) % 3]!
  const withNum = r() < 0.8
  const answer = weighted(r, [[1, 35], [2, 35], [3, 22], [4, 8]] as const)
  const n = int(r, Math.max(5, answer + (withNum ? 3 : 1)), 8)
  const m = int(r, 3, 4)
  const groups = shuffle(r, s.groups).slice(0, m)
  const g = int(r, 1, m)
  const op: Op = withNum ? weighted<Op>(r, [['=', 60], ['>', 20], ['<', 20]]) : '='
  const v = condition(r, s, op)
  const otherGroup = () => pick(r, Array.from({ length: m }, (_, j) => j + 1).filter((x) => x !== g))
  // Rows: the answer (in the group, meeting the condition); with a condition, at least one in the
  // group that fails it and one outside the group that meets it, so dropping either condition changes the count.
  const roles = Array.from({ length: n }, (_, i) => (i < answer ? 'both' : withNum && i === answer ? 'group' : withNum && i === answer + 1 ? 'num' : 'free'))
  const placed = shuffle(r, roles)
  const nums: number[] = []
  const fks: number[] = []
  for (const role of placed) {
    if (role === 'both') { nums.push(pick(r, valuesThat(s, op, v, true))); fks.push(g) }
    else if (role === 'group') { nums.push(pick(r, valuesThat(s, op, v, false))); fks.push(g) }
    else if (role === 'num') { nums.push(pick(r, valuesThat(s, op, v, true))); fks.push(otherGroup()) }
    else { fks.push(otherGroup()); nums.push(pick(r, withNum ? valuesThat(s, op, v, false) : s.nums)) }
  }
  const rows = rowsOf(r, s, nums, fks)
  const T = s.table, U = s.table2
  const join = `${T}.${s.fk} = ${U}.${s.id2}`
  const byName = `${U}.${s.name2} = '${groups[g - 1]}'`
  const byNum = `${T}.${s.num} ${op} ${v}`
  const filters = withNum ? (r() < 0.75 ? [byName, byNum] : [byNum, byName]) : [byName]
  const select = r() < 0.7 ? `${T}.${s.name}` : `${T}.${s.name}, ${U}.${s.name2}`
  const sql = `SELECT ${select}\nFROM ${T}, ${U}\nWHERE ${join}\n${filters.map((f) => `AND ${f}`).join('\n')}`
  const prompt = `${mainTable(s, rows)}\n\n${groupTable(s, groups)}\n\nHow many records does this query return?\n\n${fence(sql)}`
  const pairs = rows.map((x) => `${x.name}–${groups[x.fk - 1]}`)
  const inGroup = rows.filter((x) => x.fk === g)
  const kept = inGroup.filter((x) => !withNum || holds(op, x.num, v))
  const gname = groups[g - 1]!
  const keptNames = kept.map((x) => x.name)
  const step2 = withNum
    ? `Keeping only ${gname} leaves ${and(inGroup.map((x) => x.name))}, and keeping only the ${s.kept(op, v)} from those leaves **${and(keptNames)}**`
    : `Keeping only ${gname} leaves **${and(keptNames)}**`
  const solution = `The join pairs each ${s.row} with **${s.their} own** ${s.row2}: ${pairs.join(', ')}. ${step2}, so the query returns ${records(answer)}.`
  const counted = evaluate(queryIn(prompt), readTables(prompt))
  return numericDraft(
    slot,
    {
      prompt,
      solution,
      method: [`joins each ${s.row} to ${s.their} ${s.row2}, then applies ${withNum ? 'both conditions' : 'the condition'}`],
      answer,
    },
    { agrees: counted === answer && kept.length === answer, detail: `evaluator on the printed tables: ${counted} records` },
    { schema: s.key, n, m, op: withNum ? op : 'none', answer },
  )
}

export type MissingKind = 'eq' | 'cmp' | 'fk'

const TIMES = ['', 'once', 'twice', 'three times', 'four times']

function missingJoin(r: Rng, slot: Question, turn: number): Draft {
  const s = SCHEMAS[((turn % 3) + 3) % 3]!
  const kind = weighted<MissingKind>(r, [['eq', 55], ['cmp', 25], ['fk', 20]])
  // Draw k × m first from the products that a small table makes, then the tables around it.
  const triples = [2, 3, 4, 5, 6].flatMap((k) => [2, 3, 4].flatMap((m) => [5, 6, 7, 8].filter((n) => n > k && !(k === 2 && m === 2) && k * m !== n + m && k * m !== n).map((n) => [k, m, n] as const)))
  // k = m (a square, 3 × 3 as written) in about one build in ten, so k² is not the usual shape.
  const square = r() < 0.1
  const [k, m, n] = pick(r, triples.filter(([k, m]) => (k === m) === square))
  const groups = shuffle(r, s.groups).slice(0, m)
  const op: Op = kind === 'cmp' ? pick(r, ['>', '<'] as const) : '='
  // The value in the query is never the count: WHERE YearGroup = 9 returning 9 records would read as a copy.
  const v = condition(r, s, op, k * m)
  const c = int(r, 1, m)
  const at = new Set(shuffle(r, Array.from({ length: n }, (_, i) => i)).slice(0, k))
  const nums: number[] = []
  const fks: number[] = []
  for (let i = 0; i < n; i++) {
    if (kind === 'fk') {
      nums.push(pick(r, s.nums))
      fks.push(at.has(i) ? c : pick(r, Array.from({ length: m }, (_, j) => j + 1).filter((x) => x !== c)))
    } else {
      nums.push(pick(r, valuesThat(s, op, v, at.has(i))))
      fks.push(int(r, 1, m))
    }
  }
  const rows = rowsOf(r, s, nums, fks)
  const T = s.table, U = s.table2
  const where = kind === 'fk' ? `${T}.${s.fk} = ${c}` : `${T}.${s.num} ${op} ${v}`
  const withName = r() < 0.4
  const select = withName ? `${T}.${s.name}, ${U}.${s.name2}` : `${T}.${s.name}`
  const sql = `SELECT ${select}\nFROM ${T}, ${U}\nWHERE ${where}`
  const keptWords = kind === 'fk' ? `${s.row}s with ${s.fk} ${c}` : s.kept(op, v)
  const meant = withName ? `each of the ${keptWords} with the name of ${s.their} ${s.row2}` : `the ${keptWords}`
  const prompt = `${mainTable(s, rows)}\n\n${groupTable(s, groups)}\n\nThis query was meant to list ${meant}, but the join condition was left out. How many records does it return?\n\n${fence(sql)}`
  const kept = rows.filter((x) => (kind === 'fk' ? x.fk === c : holds(op, x.num, v)))
  const answer = k * m
  const each = TIMES[m]!
  const solution =
    `With no join condition, every ${s.row} is paired with **every** ${s.row2}: ${n} × ${m} = ${n * m} pairs. ` +
    `The WHERE clause keeps the pairs for the **${k}** ${keptWords}, and each of them appears once per ${s.row2}, so the query returns ${k} × ${m} = **${answer}** records — ${and(kept.map((x) => x.name))} ${each} each. ` +
    `It runs without an error, which is what makes the mistake easy to miss.`
  const counted = evaluate(queryIn(prompt), readTables(prompt))
  return numericDraft(
    slot,
    { prompt, solution, method: [`each of the ${keptWords} is paired with ${m === 2 ? 'both' : `all ${m}`} ${s.row2}s`], answer },
    { agrees: counted === answer && kept.length === k, detail: `evaluator on the printed tables: ${counted} records` },
    { schema: s.key, kind, k, m, n, answer },
  )
}

export const sqlGenerator: Generator = csBySlot('cs-sql', TOPIC, { q7: oneTable, q21: twoTables, q22: missingJoin })

export const sqlGenerators: Generator[] = [sqlGenerator]
