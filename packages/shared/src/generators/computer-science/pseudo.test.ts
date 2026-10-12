import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse, run } from './pseudo.ts'

const DIR = join(import.meta.dirname, '../../../../../supabase/seed/content/computer-science')
const question = (topic: string, id: string) =>
  JSON.parse(readFileSync(join(DIR, `${topic}.json`), 'utf8')).questions.find((q: { id: string }) => q.id === id)
const code = (topic: string, id: string) => /```\n([\s\S]*?)```/.exec(question(topic, id).prompt)![1]!
const last = (topic: string, id: string, opts = {}) => run(code(topic, id), opts).outputs.at(-1)

// Every written trace question in the pack, run as printed: the interpreter reaches each answer.
describe('the pseudo-code interpreter on the written questions', () => {
  it.each([
    ['data-types-and-operators', 'q8'], ['data-types-and-operators', 'q11'], ['data-types-and-operators', 'q14'], ['data-types-and-operators', 'q20'],
    ['selection-iteration-and-tracing', 'q1'], ['selection-iteration-and-tracing', 'q5'], ['selection-iteration-and-tracing', 'q6'], ['selection-iteration-and-tracing', 'q10'],
    ['selection-iteration-and-tracing', 'q11'], ['selection-iteration-and-tracing', 'q15'], ['selection-iteration-and-tracing', 'q18'],
    ['subroutines-procedures-and-functions', 'q9'], ['subroutines-procedures-and-functions', 'q11'], ['subroutines-procedures-and-functions', 'q14'], ['subroutines-procedures-and-functions', 'q17'],
    ['arrays-and-records', 'q5'], ['arrays-and-records', 'q9'], ['arrays-and-records', 'q11'], ['arrays-and-records', 'q17'],
    ['strings-and-file-handling', 'q6'], ['strings-and-file-handling', 'q9'], ['strings-and-file-handling', 'q19'],
  ])('%s %s outputs its answer last', (topic, id) => {
    expect(last(topic, id)).toBe(question(topic, id).answer)
  })

  it('counts how often a line runs (nested loops)', () => {
    expect(run(code('selection-iteration-and-tracing', 'q7')).hits.get(4)).toBe(6)
  })

  it('keeps a subroutine result in the program variable', () => {
    expect(run(code('subroutines-procedures-and-functions', 'q5')).vars.get('room')).toBe(20)
  })

  it('reads USERINPUT in order and stops the loops as the written questions say', () => {
    const asked = run(code('robust-and-secure-programming', 'q11'), { inputs: ['a', 'b', 'c'], vars: { stored: 'secret' } })
    expect(asked.inputsRead).toBe(3)
    expect(asked.outputs.at(-1)).toBe('Locked out')
    const short = run(code('robust-and-secure-programming', 'q18'), { inputs: ['cat', 'letmein', 'letmein1'] })
    expect(short.outputs.filter((o) => o === 'Too short').length).toBe(2)
  })
})

describe('the pseudo-code interpreter', () => {
  it('follows AQA DIV and MOD, and FOR ends inclusive', () => {
    expect(run('OUTPUT 17 DIV 5\nOUTPUT 17 MOD 5\nOUTPUT -7 DIV 2').outputs).toEqual([3, 2, -4])
    expect(run('c ← 0\nFOR i ← 2 TO 5\n   c ← c + 1\nENDFOR\nOUTPUT c').outputs).toEqual([4])
    expect(run('c ← 0\nFOR i ← 10 TO 1 STEP -3\n   c ← c + i\nENDFOR\nOUTPUT c').outputs).toEqual([22])
  })

  it('keeps subroutine variables local', () => {
    const r = run('t ← 5\nSUBROUTINE f(n)\n   t ← n * 2\n   RETURN t\nENDSUBROUTINE\nOUTPUT f(3)\nOUTPUT t')
    expect(r.outputs).toEqual([6, 5])
  })

  it('runs REPEAT at least once and IF … ELSE IF … ELSE', () => {
    expect(run('n ← 10\nREPEAT\n   n ← n + 1\nUNTIL n > 3\nOUTPUT n').outputs).toEqual([11])
    const grade = (m: number) => run(`m ← ${m}\nIF m ≥ 70 THEN\n   OUTPUT 'A'\nELSE IF m ≥ 50 THEN\n   OUTPUT 'B'\nELSE\n   OUTPUT 'C'\nENDIF`).outputs[0]
    expect([grade(80), grade(60), grade(10)]).toEqual(['A', 'B', 'C'])
  })

  it('handles strings with SUBSTRING, POSITION, LEN and joins', () => {
    expect(run("s ← 'keyboard'\nOUTPUT SUBSTRING(3, 5, s)\nOUTPUT POSITION(s, 'b')\nOUTPUT LEN(s + '!')").outputs).toEqual(['boa', 3, 9])
  })

  it('refuses what AQA pseudo-code does not have, rather than guessing', () => {
    expect(() => run("s ← 'cat'\nOUTPUT s[0]")).toThrow(/SUBSTRING/)
    expect(() => run('RETURN 3')).toThrow(/outside a subroutine/)
    expect(() => run('OUTPUT x')).toThrow(/before it is set/)
    expect(() => run('a ← [1, 2]\nOUTPUT a[2]')).toThrow(/outside the array/)
    expect(() => run('WHILE True\n   x ← 1\nENDWHILE')).toThrow(/too many steps/)
    expect(() => parse('FOR i ← 1 TO 3\n   OUTPUT i')).toThrow(/missing/)
    expect(() => run("OUTPUT POSITION('cat', 'z')")).toThrow(/undefined/)
  })

  it('copies an array on assignment and changes 2D elements in place', () => {
    expect(run('a ← [1, 2]\nb ← a\nb[0] ← 9\nOUTPUT a[0]').outputs).toEqual([1])
    expect(run('g ← [[1, 2], [3, 4]]\ng[1][0] ← 7\nOUTPUT g[1][0] + g[0][1]').outputs).toEqual([9])
  })
})
