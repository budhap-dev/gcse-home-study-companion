# Why it exists, and where you meet it

**Status: draft, not built.** Requested 18 September 2026. This records the design so it can be executed later without re-deciding anything.

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
  })).max(3).default([]),
}).optional()
```

**Optional, so the 315 existing topics keep working** while it is rolled out.

**Rendered on the topic page**, above the activities rather than inside the lesson. That is the moment a student asks "what is this for", and a lesson step can be skipped or buried. It should also reach search, so "why do we need calculus" finds something.

**Length:** `matters` around 60 to 100 words; each example 30 to 50. A card, not an essay. If it needs more than that it is probably a lesson step.

## Verifying it

This is the highest-risk content in the pack, and it is worth being explicit about why.

Everything else here is **derivable**: a derivative is checked against a numerical gradient, a chord progression is built from a scale, a mark scheme is checked to add up. A claim about the world is not derivable. It is exactly the kind of statement that sounds right and is wrong, and the existing machinery cannot catch it.

So:

- **Numbers in examples are asserted in the generator**, like every other number in the pack. A melting point goes in as a constant with a comment naming where it came from.
- **Prefer mechanisms to facts.** "A long spanner gives more turning effect because the moment is force times distance" cannot be wrong in the way "the Forth Bridge weighs 53,000 tonnes" can.
- **No unverifiable specifics.** No dates, no company claims, no "the first person to...", no statistics without a source already in the repo.
- **A lint for the generic-application smell.** Reject `used in`, `important for`, `many careers`, `all around us`, `in the real world`, `plays a vital role`. If a sentence survives with those words removed, it was not an example.
- **Cross-check against the subject's own content.** An example that contradicts a set work, a spec point or another topic is the same defect as any other contradiction.

## Coverage

"Wherever possible" is the instruction, and some topics genuinely have no everyday application.

- **`matters` should be near-universal.** Even a topic with no application has a reason to exist. Algebraic proof: *checking a few cases is not the same as knowing, and the difference matters when the thing you are wrong about is a bridge.* Musical dictation: *writing down what you hear is how anything gets from a performance to a page.*
- **`examples` is genuinely optional.** Exam-technique topics, dictation, and some pure-algebra rows will have none, and forcing them produces exactly the filler this design is trying to avoid.
- **A test reports coverage per subject** so gaps are visible rather than silent — the same argument as showing unwritten rows as *Coming soon* instead of hiding them.

## Four worked samples

Written out in full, so the standard is set by example rather than by adjective.

### Differentiation and the gradient function — Further Maths

**Why it exists.** You can find the gradient of a straight line by picking two points and dividing. Almost nothing real is a straight line: a falling ball, a cooling cup of tea, a growing population, the balance in an account. Calculus is what lets you ask *how fast is this changing right now* about anything that curves, and answer it exactly rather than by estimating from a graph.

**The speedometer.** A car's odometer measures distance travelled. The speedometer shows how fast that distance is changing — the derivative of what the odometer says. The push you feel into the seat when accelerating is the derivative of *that*.

**Packaging.** A drinks can holds a fixed volume and the manufacturer wants the least aluminium. That is a stationary point question: write the surface area in terms of one dimension, differentiate, set it to zero. The answer for a plain cylinder is a height equal to the diameter — and real cans are taller and thinner, because the ends are thicker metal than the sides, which changes what is being minimised.

**Anything that peaks.** A drug's concentration in the blood rises after a dose and then falls. Choosing how often to take it is choosing where the troughs and peaks of that curve land.

### Bonding — Chemistry

**Why it exists.** An atom with an incomplete outer shell is unstable, and bonding is what atoms do about it. But the useful part is not the electron bookkeeping — it is that *which kind* of bond forms decides every property you can actually measure: melting point, whether it conducts, whether it dissolves, whether it is hard or soft. Bonding is not a separate topic from properties. It is the explanation of them.

**Salt and sugar.** Both are white crystals on the same shelf. Salt is an ionic lattice held by strong forces in every direction, so it melts at 801 °C. Sugar is molecules with weak forces between them, so it caramelises in a pan at around 160 °C. The difference you can see in a kitchen is the difference in the bonding.

**The saucepan.** Metal base, plastic handle. Metals have delocalised electrons free to move, so they carry heat and electricity; the handle is covalent molecules with no free electrons, so it does neither. The pan is a bonding decision made twice.

**Pencil and diamond.** The same element. Graphite is layers held to each other by weak forces, so they slide off onto paper. Diamond is a rigid three-dimensional covalent network, which is why it is the hardest natural substance. Carbon, arranged two ways.

### Moments — Physics

**Why it exists.** How much a force turns something depends on *where* you apply it, not only how hard you push. That single fact is why levers work, and it is the reason a person can lift something they could not possibly lift directly.

**The door handle.** Always on the edge furthest from the hinges. Push near the hinge and the door barely moves; push at the handle and the same force turns it easily, because the moment is the force multiplied by the distance from the pivot.

**The spanner.** A long spanner shifts a bolt that a short one cannot, with the same hand doing the pushing. Double the handle length and you double the moment for no extra effort.

**The wheelbarrow.** The load sits close to the wheel and your hands are far from it. The wheel is the pivot, so a small lift at the handles balances a heavy load near the front — which is why the same barrow is unmanageable if you load it at the back.

### Representing data in binary — Computer Science

**Why it exists.** A computer has no way to store a letter, a colour or a sound. It has switches that are on or off. Everything else is a *decision about how to encode something real as those switches*, and every one of those decisions has consequences you can see.

**Why a photo is bigger than a message.** A text message stores one number per character. A photo stores three numbers per pixel, and there are millions of pixels. The file sizes are not arbitrary; they follow from what is being written down.

**Why a scan of a page is bigger than the typed page.** Typed, it is a few thousand characters. Scanned, the computer has no idea there are letters in the image — it is storing colours, and so it stores the white paper as carefully as the ink.

**Why sound files vary.** A recording is a number for the air pressure, taken tens of thousands of times a second. Take more samples or store each one more precisely and the file grows. That trade is what the quality setting on a download is choosing.

## Rolling it out

There are 315 rows. Retrofitting all of them at once would produce filler, which is the failure this design is most concerned about.

1. **New topics carry it from the start.** The next Further Maths rows should include it, so the standard is set while the volume is small.
2. **Then the subjects where the gap is worst.** Maths and Further Maths first — they are the subjects a student is most likely to find pointless, and the ones where the answer is most satisfying. Then the sciences, where the "what is actually happening" version matters more than the application.
3. **Languages and Music last**, and expect lower coverage. "Where you meet it" is a strange question to ask of a set work; "why does this exist" is not.
4. **Write them in the topic's own generator**, with the numbers asserted, exactly like the rest of the content. Not as a separate pass over finished JSON, which is how filler gets written.

A reasonable target is `matters` on every topic and `examples` on perhaps two thirds. Missing is better than padded.
