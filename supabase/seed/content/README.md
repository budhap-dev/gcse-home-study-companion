# Sample content pack

Two complete topics, one per Phase 1 subject, written against the content schema in `packages/shared/src/content`. Used by local development, tests, and the walking skeleton. Content in production lives in Postgres, not here.

| File | Subject | Unit | Board reference |
|---|---|---|---|
| `maths/laws-of-indices.json` | Mathematics | Number | Edexcel 1MA1 N6, N7, A4 |
| `physics/kinetic-and-gravitational-potential-energy.json` | Physics | Energy | AQA 8463 4.1.1.1, 4.1.1.2 |

Both are marked as AI-drafted and unreviewed in their `provenance`, so the validator refuses to publish them until a person sets `reviewedBy`. That is deliberate: it exercises the review gate. Review the questions and solutions, correct anything wrong, then add your name.

Diagram visuals name components in the shared SVG library (`repeated-multiplication`, `energy-stores`, and so on). The library does not exist yet; each diagram carries alt text describing what it must show.
