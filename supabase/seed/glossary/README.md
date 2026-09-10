# Glossary

One JSON file per subject, named by subject id, validated against `GlossaryFile` in
`packages/shared/src/glossary.ts`. The app bundles them at build time, the same way it
bundles topics, and both the glossary page and the header search read them directly.

Each entry is:

| Field | Meaning |
|---|---|
| `term` | The name as the student would look it up. |
| `aliases` | Other names they might type: plurals, symbols, the school's wording, mnemonics. |
| `definition` | What it means, at the student's reading level. Markdown with `$maths$`. |
| `example` | **Required.** A concrete instance: a number worked through, a formula applied, the real thing named. |
| `topics` | Topic ids that teach it, most relevant first. |
| `related` | Terms worth reading next, by name. |

The subject is named once at the top of the file and stamped onto every entry when it is
parsed, so the two can never disagree.

## Why the example is required

A definition on its own rarely settles what a term means. *Upthrust is the resultant
upward force on a submerged object* is correct and nearly useless; seeing 9.8 N come out
of a 0.1 m cube is what makes it land. The schema requires an example for that reason,
and a test fails the build if one is missing.

## Homonyms

The same word can mean different things in different subjects: **index** is an exponent
in Maths and a position in an array in Computer Science. Both get their own entry, in
their own subject's file. Deep-link ids are therefore qualified by subject —
`?term=maths-index` and `?term=computer-science-index` — so adding a colliding term later
never changes an existing link.

## Rules the tests enforce

- Every entry has a definition and an example.
- No term is repeated within a subject; every slug is unique across all of them.
- Every `topics` id is a real topic, and it belongs to the entry's subject.
- Every `related` name resolves to an entry that exists.
