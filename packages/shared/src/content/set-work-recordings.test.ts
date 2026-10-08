import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Music listening (8 October 2026): each of the eight Edexcel 1MU0 set works names the
 * recording it is studied from, and the topic page searches for it. The owner had asked for
 * no audio; on 8 October they asked for this item to be finished, and a search link keeps the
 * reasons behind that decision: nothing in copyright is shipped, and nothing can rot.
 *
 * The facts are Pearson's "GCSE Music – Set works information" sheet (© Pearson 2015),
 * qualifications.pearson.com/content/dam/pdf/GCSE/Music/2016/teaching-and-learning-materials/
 * gcse-music-set-works-information.pdf, columns Work and Recording. Its durations are left
 * out, as every timing is (docs/content-order.md).
 */
const DIR = join(import.meta.dirname, '../../../../supabase/seed/content/music')
interface Listen { work: string; performers: string; album: string; track: string; search: string; stepId?: string }
interface Step { id: string; kind: string; body: string }
const topics = readdirSync(DIR).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as { id: string; listen?: Listen; lesson: { steps: Step[] } })

const SHEET: Record<string, Pick<Listen, 'performers' | 'track'> & { album: RegExp; work: RegExp }> = {
  'bach-brandenburg-5': { work: /Brandenburg Concerto No\. 5 in D, 3rd movement/, performers: 'European Brandenburg Ensemble, Trevor Pinnock', album: /Six Concertos for the Margrave of Brandenburg/, track: 'CD 1, track 10' },
  'beethoven-pathetique': { work: /Piano Sonata No\. 8 in C minor .*1st movement/, performers: 'Alfred Brendel (piano)', album: /Pathétique, Moonlight and Appassionata/, track: 'track 4' },
  'purcell-music-for-a-while': { work: /^Music for a While$/, performers: 'Carolyn Sampson (soprano), Laurence Cummings (harpsichord), Anne-Marie Lasla (bass viol)', album: /Victorious Love/, track: 'track 8' },
  'killer-queen': { work: /^Killer Queen \(album version\)$/, performers: 'Queen', album: /^Sheer Heart Attack$/, track: 'track 2' },
  'defying-gravity': { work: /Defying Gravity/, performers: 'Kristin Chenoweth and Idina Menzel', album: /Wicked, Original Cast Recording \(2003\)/, track: 'track 11' },
  'star-wars': { work: /Main Title\/Rebel Blockade Runner/, performers: 'London Symphony Orchestra, John Williams', album: /Star Wars/, track: 'track 2' },
  'afro-celt-release': { work: /^Release$/, performers: 'Afro Celt Sound System', album: /^Volume 2: Release$/, track: 'track 1' },
  'samba-em-preludio': { work: /^Samba Em Prelúdio$/, performers: 'Esperanza Spalding', album: /^Esperanza$/, track: 'track 12' },
}

/** Asks the student to play the recording: "Play the studio recording", "Play a recording", "Play the track". */
const ASKS_TO_PLAY = /\bplay (the|a) (\w+ )?(recording|track)\b/i

describe('set-work recordings', () => {
  it('are named on the eight set works and nowhere else', () => {
    expect(topics.filter((t) => t.listen).map((t) => t.id).sort()).toEqual(Object.keys(SHEET).sort())
  })

  for (const [id, want] of Object.entries(SHEET)) {
    const t = topics.find((x) => x.id === id)!
    it(`${id} names the recording on Pearson's sheet`, () => {
      const l = t.listen!
      expect(l.work).toMatch(want.work)
      expect(l.performers).toBe(want.performers)
      expect(l.album).toMatch(want.album)
      expect(l.track).toBe(want.track)
      // No duration: a "05:15" or "9:07" here is a timing by another name.
      expect(JSON.stringify(l)).not.toMatch(/\b\d{1,2}:\d{2}\b/)
    })

    it(`${id} searches for that recording, not just the piece`, () => {
      const { search, performers } = t.listen!
      // A performer's name is what tells the right result from a cover or a live take.
      const names = performers.replace(/\([^)]*\)/g, '').split(/,| and /).flatMap((p) => p.trim().split(/\s+/)).filter((w) => w.length > 3)
      expect(names.some((n) => search.includes(n)), `${search} names none of ${performers}`).toBe(true)
      expect(search.length).toBeLessThanOrEqual(90)
    })

    it(`${id} offers the links on the step that says to play it, and only there`, () => {
      const asks = t.lesson.steps.filter((s) => ASKS_TO_PLAY.test(s.body)).map((s) => s.id)
      const stepId = t.listen!.stepId
      if (stepId) {
        expect(asks).toContain(stepId)
        expect(t.lesson.steps.find((s) => s.id === stepId)!.kind).toBe('your-turn')
      } else {
        // Samba em Prelúdio and Defying Gravity set their maps from memory; a link would spoil it.
        expect(t.lesson.steps.filter((s) => s.kind === 'your-turn' && ASKS_TO_PLAY.test(s.body))).toEqual([])
      }
    })
  }
})
