/**
 * A small interpreter for the AQA pseudo-code the pack prints (8525, "Pseudo-code notes and
 * guidance"), so a generated trace question reaches its answer by running the printed code: the
 * second route the release check asks for, which a hand-written formula cannot give.
 *
 * The subset: ← assignment (to a name or an array element), + − * / DIV MOD, = ≠ < > ≤ ≥ (and
 * the ASCII forms), AND OR NOT, True and False, 'strings' joined with +, arrays [..] and 2D
 * arrays indexed from 0, FOR … TO … [STEP …] … ENDFOR (both ends inclusive), WHILE … ENDWHILE,
 * REPEAT … UNTIL, IF … THEN … [ELSE IF … THEN …] [ELSE …] ENDIF, SUBROUTINE … ENDSUBROUTINE with
 * RETURN, OUTPUT, USERINPUT, LEN, SUBSTRING(start, end, s) (both ends inclusive), POSITION(s, c),
 * STRING_TO_INT, INT_TO_STRING, RANDOM_INT. Variables assigned in a subroutine are local to it,
 * as AQA's guidance has them; a subroutine reads but never changes the program's own variables.
 * There is deliberately no string indexing and no break: a fragment using either does not parse.
 */

export type Value = number | string | boolean | Value[]

type Expr =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'arr'; items: Expr[] }
  | { k: 'var'; name: string }
  | { k: 'index'; of: Expr; at: Expr }
  | { k: 'call'; name: string; args: Expr[] }
  | { k: 'input' }
  | { k: 'un'; op: string; e: Expr }
  | { k: 'bin'; op: string; l: Expr; r: Expr }

type Stmt = { line: number } & (
  | { k: 'assign'; target: Expr; e: Expr }
  | { k: 'output'; es: Expr[] }
  | { k: 'expr'; e: Expr }
  | { k: 'return'; e: Expr }
  | { k: 'for'; v: string; from: Expr; to: Expr; step?: Expr; body: Stmt[] }
  | { k: 'while'; cond: Expr; body: Stmt[] }
  | { k: 'repeat'; cond: Expr; body: Stmt[] }
  | { k: 'if'; arms: { cond: Expr; body: Stmt[] }[]; otherwise: Stmt[] }
  | { k: 'sub'; name: string; params: string[]; body: Stmt[] }
)

// ---------------------------------------------------------------------------------------------
// Expressions

const KEYWORDS = new Set(['DIV', 'MOD', 'AND', 'OR', 'NOT', 'True', 'False', 'USERINPUT'])

function tokenize(src: string): string[] {
  const out: string[] = []
  const re = /\s*(?:('[^']*'|"[^"]*")|(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z_0-9]*)|(<=|>=|!=|<>|[≤≥≠←+\-−*/()[\],=<>]))/y
  let m: RegExpExecArray | null
  let at = 0
  while (at < src.length) {
    if (/^\s*$/.test(src.slice(at))) break
    re.lastIndex = at
    m = re.exec(src)
    if (!m) throw new Error(`cannot read "${src.slice(at)}"`)
    out.push((m[1] ?? m[2] ?? m[3] ?? m[4])!.replace('−', '-'))
    at = re.lastIndex
  }
  return out
}

class Parser {
  private i = 0
  private readonly t: string[]
  constructor(tokens: string[]) {
    this.t = tokens
  }
  peek = () => this.t[this.i]
  next = () => this.t[this.i++]
  done = () => this.i >= this.t.length
  eat(tok: string) {
    if (this.t[this.i] !== tok) throw new Error(`expected ${tok} at "${this.t.slice(this.i).join(' ')}"`)
    this.i++
  }
  expr(): Expr {
    return this.or()
  }
  private or(): Expr {
    let l = this.and()
    while (this.peek() === 'OR') { this.next(); l = { k: 'bin', op: 'OR', l, r: this.and() } }
    return l
  }
  private and(): Expr {
    let l = this.not()
    while (this.peek() === 'AND') { this.next(); l = { k: 'bin', op: 'AND', l, r: this.not() } }
    return l
  }
  private not(): Expr {
    if (this.peek() === 'NOT') { this.next(); return { k: 'un', op: 'NOT', e: this.not() } }
    return this.compare()
  }
  private compare(): Expr {
    const l = this.add()
    const op = this.peek()
    const ops: Record<string, string> = { '=': '=', '≠': '≠', '!=': '≠', '<>': '≠', '<': '<', '>': '>', '≤': '≤', '<=': '≤', '≥': '≥', '>=': '≥' }
    if (op && ops[op]) { this.next(); return { k: 'bin', op: ops[op]!, l, r: this.add() } }
    return l
  }
  private add(): Expr {
    let l = this.mul()
    while (this.peek() === '+' || this.peek() === '-') { const op = this.next()!; l = { k: 'bin', op, l, r: this.mul() } }
    return l
  }
  private mul(): Expr {
    let l = this.unary()
    while (['*', '/', 'DIV', 'MOD'].includes(this.peek() ?? '')) { const op = this.next()!; l = { k: 'bin', op, l, r: this.unary() } }
    return l
  }
  private unary(): Expr {
    if (this.peek() === '-') { this.next(); return { k: 'un', op: '-', e: this.unary() } }
    return this.postfix()
  }
  private postfix(): Expr {
    let e = this.atom()
    while (this.peek() === '[') { this.next(); const at = this.expr(); this.eat(']'); e = { k: 'index', of: e, at } }
    return e
  }
  private atom(): Expr {
    const tok = this.next()
    if (tok === undefined) throw new Error('unexpected end of expression')
    if (tok === '(') { const e = this.expr(); this.eat(')'); return e }
    if (tok === '[') {
      const items: Expr[] = []
      if (this.peek() !== ']') { items.push(this.expr()); while (this.peek() === ',') { this.next(); items.push(this.expr()) } }
      this.eat(']')
      return { k: 'arr', items }
    }
    if (/^\d/.test(tok)) return { k: 'num', v: Number(tok) }
    if (/^['"]/.test(tok)) return { k: 'str', v: tok.slice(1, -1) }
    if (tok === 'True' || tok === 'False') return { k: 'bool', v: tok === 'True' }
    if (tok === 'USERINPUT') return { k: 'input' }
    if (/^[A-Za-z_]/.test(tok) && !KEYWORDS.has(tok)) {
      if (this.peek() === '(') {
        this.next()
        const args: Expr[] = []
        if (this.peek() !== ')') { args.push(this.expr()); while (this.peek() === ',') { this.next(); args.push(this.expr()) } }
        this.eat(')')
        return { k: 'call', name: tok, args }
      }
      return { k: 'var', name: tok }
    }
    throw new Error(`unexpected "${tok}"`)
  }
}

function parseExpr(src: string): Expr {
  const p = new Parser(tokenize(src))
  const e = p.expr()
  if (!p.done()) throw new Error(`trailing "${src}"`)
  return e
}

// ---------------------------------------------------------------------------------------------
// Statements

/** Parses a program, one statement a line; blank lines are skipped. Line numbers count from 1. */
export function parse(code: string): Stmt[] {
  // A bracketed array literal may run over several lines; join them first.
  const raw = code.replace(/\r/g, '').split('\n')
  const lines: { text: string; line: number }[] = []
  for (let n = 0; n < raw.length; n++) {
    let text = raw[n]!.trim()
    const start = n + 1
    while ((text.match(/\[/g) ?? []).length > (text.match(/\]/g) ?? []).length && n + 1 < raw.length) text += ' ' + raw[++n]!.trim()
    if (text) lines.push({ text, line: start })
  }
  let at = 0
  function block(ends: RegExp): Stmt[] {
    const out: Stmt[] = []
    while (at < lines.length && !ends.test(lines[at]!.text)) out.push(stmt())
    if (at >= lines.length) throw new Error(`missing ${ends.source}`)
    return out
  }
  function stmt(): Stmt {
    const { text, line } = lines[at++]!
    let m: RegExpExecArray | null
    if ((m = /^SUBROUTINE\s+(\w+)\s*\(([^)]*)\)$/.exec(text))) {
      const body = block(/^ENDSUBROUTINE$/); at++
      return { k: 'sub', name: m[1]!, params: m[2]!.split(',').map((s) => s.trim()).filter(Boolean), body, line }
    }
    if ((m = /^FOR\s+(\w+)\s*←\s*(.+?)\s+TO\s+(.+?)(?:\s+STEP\s+(.+))?$/.exec(text))) {
      const body = block(/^ENDFOR$/); at++
      return { k: 'for', v: m[1]!, from: parseExpr(m[2]!), to: parseExpr(m[3]!), ...(m[4] ? { step: parseExpr(m[4]) } : {}), body, line }
    }
    if ((m = /^WHILE\s+(.+)$/.exec(text))) {
      const body = block(/^ENDWHILE$/); at++
      return { k: 'while', cond: parseExpr(m[1]!), body, line }
    }
    if (text === 'REPEAT') {
      const body = block(/^UNTIL\s/)
      const cond = parseExpr(lines[at++]!.text.replace(/^UNTIL\s+/, ''))
      return { k: 'repeat', cond, body, line }
    }
    if ((m = /^IF\s+(.+)\s+THEN$/.exec(text))) {
      const arms = [{ cond: parseExpr(m[1]!), body: block(/^(ELSE|ENDIF)\b/) }]
      let otherwise: Stmt[] = []
      for (;;) {
        const t = lines[at++]!.text
        if (t === 'ENDIF') break
        const elif = /^ELSE IF\s+(.+)\s+THEN$/.exec(t)
        if (elif) { arms.push({ cond: parseExpr(elif[1]!), body: block(/^(ELSE|ENDIF)\b/) }); continue }
        if (t === 'ELSE') { otherwise = block(/^ENDIF$/); at++; break }
        throw new Error(`unexpected "${t}"`)
      }
      return { k: 'if', arms, otherwise, line }
    }
    if ((m = /^RETURN\s+(.+)$/.exec(text))) return { k: 'return', e: parseExpr(m[1]!), line }
    if ((m = /^OUTPUT\s+(.+)$/.exec(text))) {
      const p = new Parser(tokenize(m[1]!))
      const es = [p.expr()]
      while (p.peek() === ',') { p.next(); es.push(p.expr()) }
      if (!p.done()) throw new Error(`trailing output "${text}"`)
      return { k: 'output', es, line }
    }
    if ((m = /^(?:CONSTANT\s+)?(.+?)\s*←\s*(.+)$/.exec(text))) return { k: 'assign', target: parseExpr(m[1]!), e: parseExpr(m[2]!), line }
    if (/^(ENDFOR|ENDWHILE|ENDIF|ENDSUBROUTINE|ELSE|UNTIL)\b/.test(text)) throw new Error(`unmatched "${text}"`)
    return { k: 'expr', e: parseExpr(text), line }
  }
  const out: Stmt[] = []
  while (at < lines.length) out.push(stmt())
  return out
}

// ---------------------------------------------------------------------------------------------
// Running

export interface Run {
  /** Every value output, in order. */
  outputs: Value[]
  /** How many times each line ran, by line number from 1 (a loop header counts each test). */
  hits: Map<number, number>
  /** The program's own variables at the end. */
  vars: Map<string, Value>
  /** How many times USERINPUT was read. */
  inputsRead: number
}

class Returned {
  readonly value: Value
  constructor(value: Value) {
    this.value = value
  }
}

const num = (v: Value): number => {
  if (typeof v !== 'number') throw new Error(`${JSON.stringify(v)} is not a number`)
  return v
}

/**
 * Runs a program. `inputs` are what USERINPUT reads, in order; `random` what RANDOM_INT returns;
 * `vars` sets variables the fragment reads but never sets (the stored password).
 * Throws on anything outside the subset, on reading an unset variable or past an array, and after
 * `maxSteps` statements, so a generator never prints code that cannot run.
 */
export function run(code: string, opts: { inputs?: string[]; random?: number[]; vars?: Record<string, Value>; maxSteps?: number } = {}): Run {
  const program = parse(code)
  const inputs = [...(opts.inputs ?? [])]
  const random = [...(opts.random ?? [])]
  const maxSteps = opts.maxSteps ?? 10_000
  const outputs: Value[] = []
  const hits = new Map<number, number>()
  const subs = new Map<string, { params: string[]; body: Stmt[] }>()
  const globals = new Map<string, Value>(Object.entries(opts.vars ?? {}))
  let steps = 0
  let inputsRead = 0

  const hit = (line: number) => {
    hits.set(line, (hits.get(line) ?? 0) + 1)
    if (++steps > maxSteps) throw new Error('too many steps')
  }

  function get(scope: Map<string, Value>, name: string): Value {
    if (scope.has(name)) return scope.get(name)!
    if (scope !== globals && globals.has(name)) return globals.get(name)!
    throw new Error(`${name} is used before it is set`)
  }

  function evaluate(e: Expr, scope: Map<string, Value>): Value {
    switch (e.k) {
      case 'num': case 'str': case 'bool': return e.v
      case 'arr': return e.items.map((x) => evaluate(x, scope))
      case 'var': return get(scope, e.name)
      case 'input': {
        if (!inputs.length) throw new Error('USERINPUT with nothing left to read')
        inputsRead++
        return inputs.shift()!
      }
      case 'index': {
        const of = evaluate(e.of, scope)
        if (!Array.isArray(of)) throw new Error('only arrays are indexed: a character is SUBSTRING(i, i, s)')
        const at = num(evaluate(e.at, scope))
        if (!Number.isInteger(at) || at < 0 || at >= of.length) throw new Error(`index ${at} is outside the array`)
        return of[at]!
      }
      case 'un': {
        const v = evaluate(e.e, scope)
        if (e.op === 'NOT') return !v
        return -num(v)
      }
      case 'bin': {
        if (e.op === 'AND') return Boolean(evaluate(e.l, scope)) && Boolean(evaluate(e.r, scope))
        if (e.op === 'OR') return Boolean(evaluate(e.l, scope)) || Boolean(evaluate(e.r, scope))
        const l = evaluate(e.l, scope)
        const r = evaluate(e.r, scope)
        switch (e.op) {
          case '+':
            if (typeof l === 'string' && typeof r === 'string') return l + r
            return num(l) + num(r)
          case '-': return num(l) - num(r)
          case '*': return num(l) * num(r)
          case '/': return num(l) / num(r)
          case 'DIV': return Math.floor(num(l) / num(r))
          case 'MOD': { const a = num(l), b = num(r); return a - b * Math.floor(a / b) }
          case '=': return l === r
          case '≠': return l !== r
          case '<': return num(l) < num(r)
          case '>': return num(l) > num(r)
          case '≤': return num(l) <= num(r)
          case '≥': return num(l) >= num(r)
        }
        throw new Error(`operator ${e.op}`)
      }
      case 'call': return call(e.name, e.args.map((a) => evaluate(a, scope)))
    }
  }

  function call(name: string, args: Value[]): Value {
    const str = (v: Value) => { if (typeof v !== 'string') throw new Error(`${name} needs a string`); return v }
    switch (name) {
      case 'LEN': { const v = args[0]!; if (typeof v === 'string' || Array.isArray(v)) return v.length; throw new Error('LEN of a number') }
      case 'SUBSTRING': {
        const [a, b, s] = [num(args[0]!), num(args[1]!), str(args[2]!)]
        if (a < 0 || b >= s.length || a > b + 1) throw new Error(`SUBSTRING(${a}, ${b}) is outside '${s}'`)
        return s.slice(a, b + 1)
      }
      case 'POSITION': {
        const at = str(args[0]!).indexOf(str(args[1]!))
        if (at < 0) throw new Error('POSITION found nothing, which AQA pseudo-code leaves undefined')
        return at
      }
      case 'STRING_TO_INT': { const s = str(args[0]!).trim(); if (!/^-?\d+$/.test(s)) throw new Error(`'${s}' is not a whole number`); return Number(s) }
      case 'INT_TO_STRING': return String(num(args[0]!))
      case 'RANDOM_INT': {
        if (!random.length) throw new Error('RANDOM_INT with no value given')
        const v = random.shift()!
        if (v < num(args[0]!) || v > num(args[1]!)) throw new Error('RANDOM_INT value outside its range')
        return v
      }
    }
    const sub = subs.get(name)
    if (!sub) throw new Error(`no subroutine ${name}`)
    if (sub.params.length !== args.length) throw new Error(`${name} takes ${sub.params.length} arguments`)
    const local = new Map<string, Value>(sub.params.map((p, i) => [p, args[i]!]))
    try {
      exec(sub.body, local)
    } catch (r) {
      if (r instanceof Returned) return r.value
      throw r
    }
    return false
  }

  function assign(target: Expr, value: Value, scope: Map<string, Value>) {
    if (target.k === 'var') { scope.set(target.name, value); return }
    if (target.k === 'index') {
      const of = evaluate(target.of, scope)
      if (!Array.isArray(of)) throw new Error('only arrays are indexed')
      const at = num(evaluate(target.at, scope))
      if (!Number.isInteger(at) || at < 0 || at >= of.length) throw new Error(`index ${at} is outside the array`)
      of[at] = value
      return
    }
    throw new Error('cannot assign to that')
  }

  function exec(body: Stmt[], scope: Map<string, Value>) {
    for (const s of body) {
      hit(s.line)
      switch (s.k) {
        case 'sub': subs.set(s.name, { params: s.params, body: s.body }); break
        case 'assign': assign(s.target, copy(evaluate(s.e, scope)), scope); break
        case 'output': for (const e of s.es) outputs.push(evaluate(e, scope)); break
        case 'expr': evaluate(s.e, scope); break
        case 'return':
          if (scope === globals) throw new Error('RETURN outside a subroutine')
          throw new Returned(evaluate(s.e, scope))
        case 'for': {
          const from = num(evaluate(s.from, scope))
          const to = num(evaluate(s.to, scope))
          const step = s.step ? num(evaluate(s.step, scope)) : 1
          if (step === 0) throw new Error('STEP 0')
          for (let v = from; step > 0 ? v <= to : v >= to; v += step) {
            scope.set(s.v, v)
            exec(s.body, scope)
            hit(s.line)
          }
          break
        }
        case 'while':
          while (evaluate(s.cond, scope)) { exec(s.body, scope); hit(s.line) }
          break
        case 'repeat':
          for (;;) {
            exec(s.body, scope)
            if (evaluate(s.cond, scope)) break
            hit(s.line)
          }
          break
        case 'if': {
          const arm = s.arms.find((a) => evaluate(a.cond, scope))
          exec(arm ? arm.body : s.otherwise, scope)
          break
        }
      }
    }
  }

  // Subroutines are defined wherever they sit, before the main program runs.
  for (const s of program) if (s.k === 'sub') subs.set(s.name, { params: s.params, body: s.body })
  exec(program, globals)
  return { outputs, hits, vars: globals, inputsRead }
}

/** Arrays are values: assigning one copies it, so changing the copy leaves the original alone. */
function copy(v: Value): Value {
  return Array.isArray(v) ? v.map(copy) : v
}
