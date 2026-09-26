/**
 * Two algebraic answers written in a different order: (x + 1)(x − 2) and (x − 2)(x + 1),
 * x ⩾ 3 and 3 ⩽ x, 3 − x/2 and −x/2 + 3. Before this, each order had to be listed by hand
 * (one Further Maths list needed six bracket orders), and an order nobody listed was marked
 * wrong.
 *
 * This is deliberately not a test of algebraic equality. "Factorise x² + 7x + 12" must not
 * accept x² + 7x + 12, and "simplify 2 × 3x" must not accept 2 × 3x, so nothing is
 * expanded, collected or multiplied out. The only freedoms are the ones that leave the
 * form alone: the order of the terms in a sum, the order of the factors in a product, the
 * sides of an equation, and which way round an inequality is written.
 *
 * It reads the output of `normaliseText` (lower case, no spaces, sqrt3, pi, ^) and returns
 * a canonical string, or null when the text is not plainly algebra. Null is common and
 * safe: the caller then relies on the ordinary text match. Anything ambiguous returns null
 * rather than a guess, above all 1/2x, which the content uses to mean both ½x and 1/(2x).
 */

type Node =
  | { k: 'num'; v: string }
  | { k: 'var'; v: string }
  | { k: 'sum'; terms: Node[] }
  | { k: 'prod'; neg: boolean; factors: Node[] }
  | { k: 'inv'; of: Node }
  | { k: 'pow'; base: Node; exp: Node }
  | { k: 'sqrt'; of: Node }

class NotAlgebra extends Error {}

const RELATIONS: Record<string, { op: string; flip: boolean }> = {
  '=': { op: '=', flip: false },
  '≠': { op: '≠', flip: false },
  '<': { op: '<', flip: false },
  '>': { op: '<', flip: true },
  '≤': { op: '≤', flip: false },
  '⩽': { op: '≤', flip: false },
  '<=': { op: '≤', flip: false },
  '≥': { op: '≤', flip: true },
  '⩾': { op: '≤', flip: true },
  '>=': { op: '≤', flip: true },
}

/** Whether the text is worth parsing at all: some operator, and no words. */
function looksAlgebraic(s: string): boolean {
  if (!/[-+*/^=<>≤≥⩽⩾≠(]|sqrt/.test(s)) return false // 4a3b1c, a run length code, is not algebra
  if (/->|<-/.test(s)) return false // a reaction, or a pseudo-code assignment (n <- 1)
  const letters = s.replace(/sqrt|pi/g, '#')
  if (/[a-z]{3,}/.test(letters)) return false // words: French, SQL, "and", "or"
  if (/[a-z]\d/.test(letters)) return false // C2H4, Fe3: a formula, not a product
  if (!/[a-z#]/.test(letters)) return false // 80-90 and 4/4 are numbers, with no order to forgive
  return /^[-+*/^=<>≤≥⩽⩾≠()#.\da-z]+$/.test(letters)
}

function parse(src: string): Node | { rel: string; flip: boolean; l: Node; r: Node } {
  let i = 0
  const peek = () => src[i] ?? ''
  const eat = (t: string) => (src.startsWith(t, i) ? ((i += t.length), true) : false)

  const atom = (): Node => {
    if (eat('(')) {
      const e = sum()
      if (!eat(')')) throw new NotAlgebra()
      return e
    }
    if (eat('sqrt')) {
      const m = /^[\d.]+|^[a-z]/.exec(src.slice(i))
      if (src[i] === '(') return { k: 'sqrt', of: atom() }
      if (!m) throw new NotAlgebra()
      i += m[0].length
      // √3x could be √3·x or √(3x).
      if (/^\d/.test(m[0]) && /[a-z(]/.test(peek())) throw new NotAlgebra()
      return { k: 'sqrt', of: /^\d/.test(m[0]) ? { k: 'num', v: m[0] } : { k: 'var', v: m[0] } }
    }
    if (eat('pi')) return { k: 'var', v: 'pi' }
    const num = /^\d+(\.\d+)?/.exec(src.slice(i))
    if (num) {
      i += num[0].length
      return { k: 'num', v: String(Number(num[0])) }
    }
    if (/[a-z]/.test(peek())) return { k: 'var', v: src[i++]! }
    throw new NotAlgebra()
  }

  const power = (): Node => {
    const base = atom()
    if (!eat('^')) return base
    const neg = eat('-')
    const exp = atom()
    return { k: 'pow', base, exp: neg ? { k: 'prod', neg: true, factors: [exp] } : exp }
  }

  const startsFactor = () => /[\d(a-z]/.test(peek())

  const product = (): Node => {
    let neg = false
    while (peek() === '-' || peek() === '+') if (src[i++] === '-') neg = !neg
    const factors: Node[] = [power()]
    for (;;) {
      if (eat('*')) factors.push(power())
      else if (eat('/')) {
        factors.push({ k: 'inv', of: power() })
        // 1/2x: a half of x, or one over 2x? The content means both in different places.
        if (startsFactor()) throw new NotAlgebra()
      } else if (startsFactor()) factors.push(power())
      else break
    }
    return { k: 'prod', neg, factors }
  }

  const sum = (): Node => {
    const terms: Node[] = [product()]
    while (peek() === '+' || peek() === '-') {
      const minus = src[i++] === '-'
      const t = product() as Extract<Node, { k: 'prod' }>
      terms.push(minus ? { ...t, neg: !t.neg } : t)
    }
    return { k: 'sum', terms }
  }

  const left = sum()
  const rel = Object.keys(RELATIONS).sort((a, b) => b.length - a.length).find((r) => src.startsWith(r, i))
  if (!rel) {
    if (i !== src.length) throw new NotAlgebra()
    return left
  }
  i += rel.length
  const right = sum()
  if (i !== src.length) throw new NotAlgebra()
  return { rel: RELATIONS[rel]!.op, flip: RELATIONS[rel]!.flip, l: left, r: right }
}

/** The canonical string of a node: sums and products sorted, nesting flattened. */
function canon(n: Node): string {
  switch (n.k) {
    case 'num':
    case 'var':
      return n.v
    case 'sqrt':
      return `√[${canon(n.of)}]`
    case 'inv':
      return `/[${canon(n.of)}]`
    case 'pow':
      return `^[${canon(n.base)},${canon(n.exp)}]`
    case 'sum': {
      const terms = n.terms.flatMap((t) => {
        // (a + b) + c is a + b + c: a bracket round part of a sum changes nothing.
        if (t.k === 'prod' && !t.neg && t.factors.length === 1 && t.factors[0]!.k === 'sum') return t.factors[0].terms
        return [t]
      })
      if (terms.length === 1) return canon(terms[0]!)
      return `+[${terms.map(canon).sort().join(',')}]`
    }
    case 'prod': {
      let neg = n.neg
      const factors: Node[] = []
      const add = (f: Node) => {
        if (f.k === 'prod') {
          if (f.neg) neg = !neg
          f.factors.forEach(add)
        } else if (f.k === 'sum' && f.terms.length === 1) add(f.terms[0]!)
        else if (!(f.k === 'num' && f.v === '1')) factors.push(f)
      }
      n.factors.forEach(add)
      const body = factors.length === 0 ? '1' : factors.length === 1 ? canon(factors[0]!) : `*[${factors.map(canon).sort().join(',')}]`
      return neg ? `-${body}` : body
    }
  }
}

export function algebraicForm(normalised: string): string | null {
  if (!looksAlgebraic(normalised)) return null
  try {
    const tree = parse(normalised)
    if ('rel' in tree) {
      const l = canon(tree.l)
      const r = canon(tree.r)
      if (tree.rel === '=' || tree.rel === '≠') return `${tree.rel}{${[l, r].sort().join('|')}}`
      return tree.flip ? `${tree.rel}{${r}|${l}}` : `${tree.rel}{${l}|${r}}`
    }
    return canon(tree)
  } catch (e) {
    if (e instanceof NotAlgebra) return null
    throw e
  }
}

/**
 * Whether two normalised answers are the same algebra written in a different order.
 * `rawAccepted`, before normalising, shows chemical formulae by their capitals (Al^2O^3,
 * Ca(NO^3)^2): an element symbol is a capital followed by a small letter or a count.
 */
export function sameAlgebra(given: string, accepted: string, rawAccepted = accepted): boolean {
  if (/[A-Z](?:[a-z]|\^?\d)/.test(rawAccepted)) return false
  const a = algebraicForm(accepted)
  return a !== null && a === algebraicForm(given)
}
