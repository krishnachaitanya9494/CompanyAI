# Matching engine correction plan

1. Replace pasted-text line scoring with a deterministic requirement/evidence evaluator that excludes headings, respects preferred sections, deduplicates requirements, handles exact evidence, and does not infer experience from arbitrary “N years” text.
2. Apply the same requirement-level score contract to persisted candidate comparisons while retaining existing response fields and history snapshots.
3. Correct comparison status rendering, contribution display, insufficient-evidence handling, and the undefined ad-hoc UI variable.
4. Add focused synthetic regression tests, update the scoring documentation, then run matching/backend regressions and the frontend production build.

No candidate-specific fixture, score, paid service, model dependency, or destructive database migration is in scope. Mohd’s complete resume is unavailable, so no score will be asserted or reported for him.
