# Sample content pack

Two complete topics, one per Phase 1 subject, written against the content schema in `packages/shared/src/content`. Used by local development, tests, and the walking skeleton. Content in production lives in Postgres, not here.

| File | Subject | Unit | Board reference |
|---|---|---|---|
| `maths/laws-of-indices.json` | Mathematics | Number | Edexcel 1MA1 N6, N7, A4 |
| `physics/kinetic-and-gravitational-potential-energy.json` | Physics | Energy | AQA 8463 4.1.1.1, 4.1.1.2 |

Both are marked as AI-drafted and unreviewed in their `provenance`, so the validator refuses to publish them until a person sets `reviewedBy`. That is deliberate: it exercises the review gate. Review the questions and solutions, correct anything wrong, then add your name.

Diagram visuals name components in the web app's SVG library, `apps/web/src/components/diagrams/index.tsx`. A test fails if content names a component that is not registered. Each diagram also carries alt text describing what it shows, which is what a screen reader gets. Components and their props:

| Component | Props | Used for |
|---|---|---|
| `repeated-multiplication`, `index-ladder`, `power-of-power`, `index-laws-card` | see the component | Laws of indices |
| `line-graph` | `xRange`, `yRange`, `lines [{m, c, label}]`, `points [{x, y, label}]`, `xLabel`, `yLabel`, `xStep`, `yStep` | Straight lines, force against extension |
| `triangle-construction` | `sides [AB, AC, BC]`, `angles` | Constructions |
| `triangle-pair` | two triangles with `sides [AB, BC, CA]` | Congruence |
| `spring-load`, `beam-moments`, `energy-stores`, `energy-transfer-bars`, `equation-card` | see the component | Physics |
| `motion-graph` | `kind: distance-time, velocity-time`, `points [{t, y}]` or `series`, `gradient {from, to, label}`, `shade [{from, to, label}]`, `markers`, `labels` | Motion graphs |
| `free-body` | `object`, `forces [{direction, size, label}]`, `resultant` | Resultant forces, Newton's laws |
| `vector-triangle` | `vectors [{x, y, label}]` added head to tail, `resultant` | Adding forces at an angle |
| `dot-and-cross` | `kind: ionic` with `transfer`; `kind: covalent` with two atoms and `shared` pairs, or a central atom plus any number of single-bonded atoms | Bonding |
| `trace-table` | `columns`, `rows` (strings, blank for unchanged), `title`, `highlight` row index | Tracing code |
| `lattice` | `kind: ionic, metallic, alloy, giant-covalent, simple-molecules, polymer, graphite, graphene, fullerene, nanotube` | Structures |

Interactive visuals: `slider-graph`, `equation-entry` (a worked example revealed one line at a time) and `vocab-list` are built; the other kinds render their `fallback` text.
