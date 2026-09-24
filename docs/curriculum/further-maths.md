# Further Maths

Source: **none from the school.** The other eight subjects in this folder are ordered by Heckmondwike Grammar School's own curriculum overviews, fetched 8 September 2026. The school publishes no Further Maths overview and the owner could not find one, so the order below is derived rather than copied, and this file records how.

Board: **AQA Level 2 Certificate in Further Mathematics (8365)**, version 1.4. Confirmed 18 September 2026, when the owner said the student is taking it. Content is written to that specification, in its own numbering.

## The qualification

| | |
|---|---|
| Papers | Two, both sat in the same series. Linear. |
| Paper 1 | 1 h 45, 80 marks, **non-calculator**, 50% |
| Paper 2 | 1 h 45, 80 marks, **calculator**, 50% |
| Total | 160 scaled marks |
| Tiering | None |
| Assessment objectives | AO1 56–64% (routine and multi-step procedures); **AO2 36–44%** (reasoning, "including rigorous justification and formal proof") |
| Guided learning hours | 120 |
| Content | Six topic areas, 57 numbered references, 1.1 to 6.10 |

Content from any part of the specification may be assessed on either paper.

AQA describes 8365 as taught "either in parallel with GCSE Mathematics" or "after GCSE Mathematics", and as an **additional** qualification rather than a replacement. It assumes the Key Stage 4 programme of study as prior knowledge, which is why it has no Year 9 rows.

## How the order was derived

With no school overview and the student not yet started, the teaching order comes from **what each row depends on in GCSE Maths**, which the pack does know: all 88 Maths rows are written and carry the school's own year for each.

Every Further Maths row was matched to the GCSE topic it assumes, and placed in the year after that topic is taught.

- **Year 10** rows are those whose GCSE prerequisites the school teaches in Years 9 and 10 — already met, or being met this year.
- **Year 11** rows are those needing GCSE content the school teaches in Year 11.

If the school confirms a different order, only the `year` and `term` fields in `packages/shared/src/syllabus.ts` need changing; no content depends on them.

## Year 10

| Term | Topics | Depends on (GCSE Maths) |
|---|---|---|
| Autumn | Surds and exact calculation · The product rule for counting · Expanding, and the binomial expansion · Factorising at Further Maths level | Surds (Y9) · Choices and outcomes · Expanding and factorising quadratics (Y10) |
| Spring | Completing the square and quadratic equations · Quadratic inequalities and index equations · The factor theorem and cubics · Sequences and limiting values | Solving quadratic equations (Y9) · Quadratic inequalities · Laws of indices (Y9) · Sequences (Y9) |
| Summer | Gradients, distance and points on a line · **Differentiation and the gradient function** · **Tangents, normals, and increasing and decreasing functions** · **Maxima, minima and optimisation** | Equations of straight lines (Y10) · Parallel and perpendicular lines (Y9) · Quadratic curves (Y10) · Laws of indices (Y9) |

## Year 11

| Term | Topics | Depends on (GCSE Maths) |
|---|---|---|
| Autumn | Functions: domain, range, composite and inverse · Algebraic fractions at Further Maths level · Rearranging formulae and algebraic proof · Simultaneous equations, including three unknowns | Functions (Y11) · Algebraic fractions (Y11) · Algebraic proof (Y11) · Simultaneous equations (Y11) |
| Spring | Circles and the tangent at a point · Matrix multiplication and the identity · Transformations of the unit square | Equation of a circle (Y11) · Transformations (Y11) |
| Summer | Trigonometry and Pythagoras in 2D and 3D · Trigonometric graphs, identities and equations · Geometrical proof | Sine rule, cosine rule and area (Y10) · Trigonometric graphs (Y11) · Circle theorems (Y11) |

Calculus and matrix transformations appear nowhere in GCSE Maths, so those seven rows are entirely new content. The rest take a written GCSE topic up to Further Maths demand, and each one should be checked against that topic before it is written.

## Formulae: what differs from GCSE Maths

Worth its own section, because the two qualifications disagree and the student will sit both.

**Edexcel GCSE Maths (1MA1)** supplies a formulae sheet with every paper for the 2025, 2026 and 2027 exams, including the sine rule, the cosine rule and the area of a triangle using sine.

**AQA 8365 gives no such sheet.** Its appendix lists these as formulae students are "expected to know … they will not be given in the exam":

- the quadratic formula
- area of a trapezium, circumference and area of a circle, volume of a prism and of a cylinder, curved surface area of a cylinder
- Pythagoras' theorem and the right-angled trigonometric ratios
- **the sine rule, the cosine rule, and area = ½ab sin C**
- **tan θ = sin θ / cos θ and sin²θ + cos²θ = 1**

Only four are given in the exam when a question needs them: curved surface area of a cone, surface area of a sphere, volume of a sphere, and volume of a cone or pyramid.

## Mapping to the app

| App unit | Specification references |
|---|---|
| `number` | 1.2 and 1.3; 1.1 is the GCSE number work the specification says is *expected*, so no row teaches it |
| `algebra` | 2.1 to 2.22 |
| `coordinate-geometry` | 3.1 to 3.9 |
| `calculus` | 4.1 to 4.9 |
| `matrix-transformations` | 5.1 to 5.4 |
| `geometry` | 6.1 to 6.10 |

Unit ids match the specification's own six topic areas, and every topic's `specPoints` carry the references it covers. The generator checks that a reference's first digit matches the unit the topic claims, so a calculus topic citing an algebra reference fails before the JSON is written.
