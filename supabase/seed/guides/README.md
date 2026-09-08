# Subject exam technique guides

One JSON file per subject, named by subject id, validated against `SubjectGuide` in `packages/shared/src/content/topic.ts`. Each holds the papers, command words, assessment objective weights, and what a grade 9 answer looks like per question type. The app renders them on the subject's exam technique screen alongside every topic's own note.

Like the topics, guides carry provenance and are AI-drafted until a person reviews them.
