# Why it exists, and where you meet it

**Status: rolled out to seven of nine subjects.** Requested 18 September 2026 and proved first on Physics *Moments, levers and gears*. As of 24 September 2026 every Maths, Physics, Chemistry, Biology, Computer Science, Business and Music topic carries the block; French and Further Maths are still to be written. Music, expected to be thin, was not: every one of its 19 topics carries examples, because *why does this form exist* and *what is the exam actually paying for* turned out to be the questions a set work most needs answered. The rest of this document is the design, corrected where building it showed the design was wrong.

## The gap

The pack is good at *how* and nearly silent on *why*.

A student can finish the differentiation topic able to turn $5x^4$ into $20x^3$ and still not know what a derivative is **for**. They can learn that ionic bonding transfers electrons and never find out that this is the reason a saucepan has a metal base and a plastic handle. The procedure is taught; the point is left implicit, and "implicit" means most students never get it.

That is not a presentational problem. A student who knows why a technique exists chooses it correctly in an unfamiliar question, and one who has only drilled the procedure does not. It is also most of the difference between finding a subject pointless and finding it interesting.

## Two separate things

They are often confused and they do different jobs, so the design keeps them apart.

**1. Why it exists** — one per topic. What question does this answer that nothing else does? What was impossible before it?

> You can find the gradient of a straight line by picking two points. Almost nothing real is a straight line — a falling ball, a cooling cup of tea, the money in an account. Calculus is what lets you ask *how fast is this changing right now* about anything that curves, and get an exact answer rather than an estimate.

**2. Where you meet it** — two or three per topic. Concrete, specific, ideally surprising.

> A door handle is always on the edge furthest from the hinges. Push near the hinge and the door barely moves; push at the handle and the same force has several times the turning effect, because a moment is force multiplied by distance from the pivot. The handle position is not a decision about looks.

The first makes the topic make sense. The second makes it stick.

## What makes a good one

This is the part that decides whether the feature is worth having, because bad examples are worse than none — they teach a student that the "real world" section is filler to be skipped.

| Bad | Good | Why |
|---|---|---|
| "Calculus is used in engineering and medicine." | "A speedometer shows the derivative of what the odometer shows." | The first names a field; the second uses the idea. |
| "Bonding is important in everyday life." | "Salt melts at 801 °C and sugar caramelises at about 160 °C, because one is an ionic lattice and the other is molecules with weak forces between them." | A checkable contrast beats an assertion. |
| "Many careers use trigonometry." | "A roof pitch is quoted as a ratio because that is what decides whether snow slides off it." | Careers talk is not an example. |
| "Moments are used in construction." | "A long spanner undoes a bolt a short one cannot, with the same hand." | Everyday beats impressive. |
| "This appears throughout science." | *(omit it)* | Nothing is better than filler. |

**The five rules.**

1. **It must use the idea, not name the field.** The commonest failure of this genre is an application that name-drops a subject without the concept doing any work in it.
2. **Everyday beats impressive.** A door handle beats a spacecraft. The student has touched a door handle.
3. **Checkable beats vivid.** Prefer a mechanism or a number over an anecdote, for the same reason the rest of the pack does.
4. **Surprising beats worthy.** "Graphite and diamond are the same element" earns its place. "Chemistry is all around us" does not.
5. **No careers section.** If a student wants to know what chemists do, that is a different feature.

## Where it goes

A new optional field on `Topic`, alongside `tips` and `examTechnique`:

```ts
why: z.object({
  /** What this answers that nothing else does. One short paragraph. */
  matters: RichText,
  /** Two or three places the idea shows up. Optional: some topics have none. */
  examples: z.array(z.object({
    title: z.string().min(1),
    body: RichText,
    /** A picture of the situation. The existing Visual union, so no new machinery. */
    visual: Visual.optional(),
  })).max(3).default([]),
}).optional()
```

**Optional, so the 315 existing topics keep working** while it is rolled out.

**Split across two places, along the seam between the two halves.**

`matters` renders **on the topic page**, above the activities. It is one paragraph, it is the answer to "what is this for", and a student who thinks the topic is pointless will not tap a tile to find out otherwise.

`examples` live on **their own page**, reached by a tile in the activity grid — the page's existing pattern for prose that deserves its own room.

**The tile goes first, before Lesson.** It was put beside Exam technique to begin with, and that was wrong: the grid reads as a sequence — lesson, worksheets, quiz — so seventh of eight implied you read it *last*, which is the reverse of what it is for. A returning student loses nothing by it being first, since the Lesson tile is one further down and already says *Resume*.

That split was not the first design. Everything was inline, and the measurement said no: the Lesson tile sat **2.8 screens down** a phone, against half a screen on a topic without the section. A student who came to do the lesson had to scroll past three screens of context first. Moving the examples out brought it back to **1.0 screens**.

It also made the pictures better rather than worse. Inline they were squeezed into a 256px column; on their own page the spanner comparison renders at **520px**, which is its natural width. Room was the thing the section most needed.

**Length:** `matters` around 60 to 100 words; each example 30 to 50. A card, not an essay. If it needs more than that it is probably a lesson step.

## Pictures, not just prose

A paragraph about a door handle is worth less than a picture of one. This section is as much of the design as the words are, because a wall of text is exactly what a student skips.

### Drawn, not photographed

The pack's native picture format is an **SVG component drawn from props** — 51 of them, in `apps/web/src/components/diagrams/`. Every example should use one.

The schema does have an `image` variant, which renders a plain `<img src>`. **Nothing in the pack uses it**, no media bucket is wired up, and no build step copies image files anywhere. Turning it on is not a small decision: every photograph needs a licence that permits redistribution from a public repository, the bundle is already 13 MB before any of them, a bundled photo cannot follow the dark theme, and an externally hosted one breaks offline use and can rot — which is the reason Music bundles no audio.

A drawn component has none of those problems and one further advantage that matters more here: **it is generated from the same numbers as the text**, so a diagram cannot contradict the paragraph beside it. A photograph is unverifiable in exactly the way the rest of this design is trying to avoid.

So: **drawn, not photographed** — but drawn *pictorially*. A recognisable door with a hinge and a handle, not an abstract beam with a triangle under it. That distinction is most of what makes this section attractive rather than merely present.

If a photograph is ever genuinely the only way to carry an idea, it needs its own decision about licensing, bundle size and offline behaviour. It is not a detail to settle inside a content PR.

### Most of it is already drawable

The twelve examples in this document were checked against the existing components. **Ten need no new code at all.**

| Example | Component | New? |
|---|---|---|
| Speedometer | `line-graph` — a distance-time curve with the tangent at one point | no |
| Least-metal can | `line-graph` — surface area against radius, the minimum marked | no |
| Drug concentration | `line-graph` — the curve with two horizontal threshold lines | no |
| Salt and sugar | `lattice` twice: `ionic` beside `simple-molecules` | no |
| The saucepan | `lattice` twice: `metallic` beside `polymer` | no |
| Pencil and diamond | `lattice` twice: `graphite` beside `giant-covalent` | no |
| The door handle | `beam-moments` — pivot at one end, two forces at different distances | no |
| The spanner | `beam-moments` — the same figure, longer handle | no |
| The wheelbarrow | `beam-moments` — load near the pivot, effort far from it | no |
| Sound sampling | `line-graph` — a wave with the sample points marked on it | no |
| Photo against message | a proportional bar comparison | **yes** |
| Scan against typed page | the same | **yes** |

`lattice` already takes `ionic | metallic | giant-covalent | simple-molecules | polymer | graphite | graphene | fullerene | nanotube | alloy`, which covers every bonding example here. `beam-moments` already draws a beam on a pivot with forces and their distances marked, which is what a door, a spanner and a wheelbarrow all are.

### The one thing missing

**`size-compare`** — two or three labelled bars whose lengths are proportional to their values, with the values printed on them.

It is worth building because it is not only for file sizes. Salt at 801 °C beside sugar at 160 °C is the same picture; so is a long spanner beside a short one, or one cost against another. A single small component serves examples across several subjects, which is the test of whether a new component is worth adding at all.

Optional, and only if the first few examples prove it is wanted: a **pictorial lever** that draws a recognisable door or spanner rather than a schematic beam. `beam-moments` carries the idea correctly today, and a new component is a much larger commitment than a paragraph — so this waits until the schematic version has been seen on a page and judged too dry.

### What an example diagram is for

It is a different job from a lesson diagram, and the difference is worth stating because it is easy to drift back into the familiar one.

A **lesson** diagram shows the mathematics: axes, labels, the quantities in the formula. An **example** diagram shows the **situation**, and lets the reader supply the mathematics themselves.

1. **Label the real object, not the algebra.** "Hinge" and "handle", not "pivot" and $d_1$. The whole point is that this is a door.
2. **One idea per picture.** If it needs a key, it is doing too much. Two pictures are better than one crowded one.
3. **Let the picture carry the contrast.** Where the example is a comparison — salt against sugar, long spanner against short — the two things go side by side at the same scale, so the difference is seen before it is read.
4. **No formulae in the picture.** Diagram props are drawn as plain SVG text, so LaTeX arrives as backslashes; and in any case the formula belongs in the lesson, not here.
5. **It must survive being small.** These render in a card, not full width. If it is unreadable at 220 px tall it is the wrong picture.

### Making the section attractive

The design is a strip of cards near the top of the topic page, not a wall of prose.

- **One `why` card on the topic page**, carrying the subject accent — the same treatment the content blockquote already uses, so it reads as the topic speaking rather than as another paragraph. The examples are a tile away, not below it.
- **On the examples page, one card each**, picture above the text and full width. The two-column card was tried on the topic page and is what the split replaced: it cramped the pictures to make room for prose that had nowhere to go.
- **Do not cap the picture's height in CSS.** This was tried and was worse than useless: a `max-height` on the wrapper does not shrink an SVG that sizes itself, so the picture overflowed by 20 px and the card's title rendered *underneath* it. Every automated check passed — no horizontal scroll, no text below the readable floor — and only a screenshot showed it. Each diagram component already caps its own width, which caps its height with it; the tallest of the three on Moments is 240 px, which sits in a card perfectly well.
- **Head each card with the concrete noun** — *The door handle*, *Salt and sugar*, *The speedometer*. Never *Application 1*, and never *Real-world example*. The heading is part of the hook.
- **A caption under the picture** where the picture needs one sentence to land, in the same small grey the rest of the pack uses for notes.

The measure of success is simple: a student scrolling a topic page should stop at this section because it looks like something worth reading, and the pictures are what will do that.

### What the first one cost

Moments took one component, one schema field, one card, and a generator for the content. Two defects turned up on the way and **neither was visible to any automated check** — both needed a screenshot:

- The door's two force labels printed on top of each other, because `beam-moments` centred each label on its arrow and the arrows were closer together than the labels were wide. Labels now measure themselves and a colliding one drops to its own line.
- A distance label sat on the pivot triangle. Both label rows moved down to clear it.

That is the lesson to carry into the rest: **screenshot every one**. The walk checks that a page works, the scanner checks that nothing overflows, and a diagram can pass both while being unreadable.

## Verifying it

This is the highest-risk content in the pack, and it is worth being explicit about why.

Everything else here is **derivable**: a derivative is checked against a numerical gradient, a chord progression is built from a scale, a mark scheme is checked to add up. A claim about the world is not derivable. It is exactly the kind of statement that sounds right and is wrong, and the existing machinery cannot catch it.

So:

- **Numbers in examples are asserted in the generator**, like every other number in the pack. A melting point goes in as a constant with a comment naming where it came from.
- **Prefer mechanisms to facts.** "A long spanner gives more turning effect because the moment is force times distance" cannot be wrong in the way "the Forth Bridge weighs 53,000 tonnes" can.
- **No unverifiable specifics.** No dates, no company claims, no "the first person to...", no statistics without a source already in the repo.
- **A lint for the generic-application smell.** Reject `used in`, `important for`, `many careers`, `all around us`, `in the real world`, `plays a vital role`. If a sentence survives with those words removed, it was not an example.
- **Cross-check against the subject's own content.** An example that contradicts a set work, a spec point or another topic is the same defect as any other contradiction.

And for the pictures, the checks the pack already runs on every diagram:

- **Alt text on every one**, describing what is shown rather than naming the component. The harness already rejects anything under 40 characters.
- **No LaTeX and no markdown in diagram props.** They are drawn as plain SVG text, so both arrive on the page as literal characters. A four-box label with `\frac` in it did exactly that, and only the browser walk caught it.
- **Every number in a picture comes from the same constant as the number in the prose.** A bar labelled 801 °C and a sentence saying 801 °C must not be two separate typings of it.
- **Walk it in a browser at 390 and 1280.** A diagram that looks right in the source and breaks the page is a failure this pack has had before.

## Coverage

"Wherever possible" is the instruction, and some topics genuinely have no everyday application.

- **`matters` should be near-universal.** Even a topic with no application has a reason to exist. Algebraic proof: *checking a few cases is not the same as knowing, and the difference matters when the thing you are wrong about is a bridge.* Musical dictation: *writing down what you hear is how anything gets from a performance to a page.*
- **`examples` is genuinely optional.** Exam-technique topics, dictation, and some pure-algebra rows will have none, and forcing them produces exactly the filler this design is trying to avoid.
- **A picture is wanted but not mandatory.** An example with no honest picture is better than one with a decorative box drawn next to it. The rule is the same as for the words: missing beats padded.
- **A test reports coverage per subject** — how many topics have `matters`, how many have examples, how many of those examples have a picture — so gaps are visible rather than silent. The same argument as showing unwritten rows as *Coming soon* instead of hiding them.

## Four worked samples

Written out in full, so the standard is set by example rather than by adjective.

### Differentiation and the gradient function — Further Maths

**Why it exists.** You can find the gradient of a straight line by picking two points and dividing. Almost nothing real is a straight line: a falling ball, a cooling cup of tea, a growing population, the balance in an account. Calculus is what lets you ask *how fast is this changing right now* about anything that curves, and answer it exactly rather than by estimating from a graph.

**The speedometer.** A car's odometer measures distance travelled. The speedometer shows how fast that distance is changing — the derivative of what the odometer says. The push you feel into the seat when accelerating is the derivative of *that*.

> *Picture:* `line-graph` — a distance-time curve with the tangent drawn at one point, that point labelled *this moment* and the tangent labelled *what the speedometer reads*.

**Packaging.** A drinks can holds a fixed volume and the manufacturer wants the least aluminium. That is a stationary point question: write the surface area in terms of one dimension, differentiate, set it to zero. The answer for a plain cylinder is a height equal to the diameter — and real cans are taller and thinner, because the ends are thicker metal than the sides, which changes what is being minimised.

> *Picture:* `line-graph` — metal used against radius, with the lowest point marked. The curve rising on both sides of it is the argument.

**Anything that peaks.** A drug's concentration in the blood rises after a dose and then falls. Choosing how often to take it is choosing where the troughs and peaks of that curve land.

> *Picture:* `line-graph` — the concentration curve with two horizontal lines across it, one labelled *too much* and one *not enough*, and the peaks sitting between them.

### Bonding — Chemistry

**Why it exists.** An atom with an incomplete outer shell is unstable, and bonding is what atoms do about it. But the useful part is not the electron bookkeeping — it is that *which kind* of bond forms decides every property you can actually measure: melting point, whether it conducts, whether it dissolves, whether it is hard or soft. Bonding is not a separate topic from properties. It is the explanation of them.

**Salt and sugar.** Both are white crystals on the same shelf. Salt is an ionic lattice held by strong forces in every direction, so it melts at 801 °C. Sugar is molecules with weak forces between them, so it caramelises in a pan at around 160 °C. The difference you can see in a kitchen is the difference in the bonding.

> *Picture:* `lattice` `ionic` beside `lattice` `simple-molecules`, at the same scale — then `size-compare` with the two temperatures, so the five-fold gap is seen rather than read.

**The saucepan.** Metal base, plastic handle. Metals have delocalised electrons free to move, so they carry heat and electricity; the handle is covalent molecules with no free electrons, so it does neither. The pan is a bonding decision made twice.

> *Picture:* `lattice` `metallic` labelled *the base* beside `lattice` `polymer` labelled *the handle*. The free electrons in one and their absence in the other is the entire explanation, and it is visible.

**Pencil and diamond.** The same element. Graphite is layers held to each other by weak forces, so they slide off onto paper. Diamond is a rigid three-dimensional covalent network, which is why it is the hardest natural substance. Carbon, arranged two ways.

> *Picture:* `lattice` `graphite` beside `lattice` `giant-covalent`, captioned *both of these are carbon*. The caption is doing as much work as the drawing.

### Moments — Physics

**Why it exists.** How much a force turns something depends on *where* you apply it, not only how hard you push. That single fact is why levers work, and it is the reason a person can lift something they could not possibly lift directly.

**The door handle.** Always on the edge furthest from the hinges. Push near the hinge and the door barely moves; push at the handle and the same force turns it easily, because the moment is the force multiplied by the distance from the pivot.

> *Picture:* `beam-moments` — the door seen from above, pivot at the hinge, the **same** force arrow drawn twice, once near the hinge and once at the handle, with the two distances marked. Identical arrows at different distances is the whole idea.

**The spanner.** A long spanner shifts a bolt that a short one cannot, with the same hand doing the pushing. Double the handle length and you double the moment for no extra effort.

> *Picture:* two `beam-moments` figures at the same scale, one twice the length of the other, each with the same force arrow and the resulting moment printed underneath.

**The wheelbarrow.** The load sits close to the wheel and your hands are far from it. The wheel is the pivot, so a small lift at the handles balances a heavy load near the front — which is why the same barrow is unmanageable if you load it at the back.

> *Picture:* `beam-moments` — pivot at the wheel, a long downward arrow for the load close to it, a short upward arrow for the hands far from it. Then the same figure with the load moved back, and the arrow that has to grow.

### Representing data in binary — Computer Science

**Why it exists.** A computer has no way to store a letter, a colour or a sound. It has switches that are on or off. Everything else is a *decision about how to encode something real as those switches*, and every one of those decisions has consequences you can see.

**Why a photo is bigger than a message.** A text message stores one number per character. A photo stores three numbers per pixel, and there are millions of pixels. The file sizes are not arbitrary; they follow from what is being written down.

> *Picture:* `size-compare` — two bars, the message and the photo, drawn to true proportion. The message bar will be almost invisible, and that is the point.

**Why a scan of a page is bigger than the typed page.** Typed, it is a few thousand characters. Scanned, the computer has no idea there are letters in the image — it is storing colours, and so it stores the white paper as carefully as the ink.

> *Picture:* `size-compare`, the two versions of the same page side by side, captioned *the same words, both times*.

**Why sound files vary.** A recording is a number for the air pressure, taken tens of thousands of times a second. Take more samples or store each one more precisely and the file grows. That trade is what the quality setting on a download is choosing.

> *Picture:* `line-graph` — one smooth wave with sample points marked sparsely, and the same wave with them marked densely. The second is closer to the curve, and larger.

## Rolling it out

There are 315 rows. Retrofitting all of them at once would produce filler, which is the failure this design is most concerned about.

0. ~~**Build `size-compare` first**, and prove the design on one topic end to end.~~ **Done.** `size-compare` exists, the `why` field is on `Topic`, the card renders on the topic page, and Physics *Moments, levers and gears* is written. Read that one before writing another. As of 24 September 2026 Maths, Physics, Chemistry, Biology, Computer Science, Business and Music carry the section on every topic; French and Further Maths do not yet.
1. **New topics carry it from the start.** The next Further Maths rows should include it, so the standard is set while the volume is small.
2. **Then the subjects where the gap is worst.** Maths and Further Maths first — they are the subjects a student is most likely to find pointless, and the ones where the answer is most satisfying. Then the sciences, where the "what is actually happening" version matters more than the application.
3. **Languages and Music last**, and expect lower coverage. "Where you meet it" is a strange question to ask of a set work; "why does this exist" is not.
4. **Write them in the topic's own generator**, with the numbers asserted, exactly like the rest of the content. Not as a separate pass over finished JSON, which is how filler gets written.

A reasonable target is `matters` on every topic, `examples` on perhaps two thirds, and a picture on most of those — ten of the twelve samples here need no new component, so the pictures are far cheaper than they look. Missing is better than padded, in words and in drawings alike.
