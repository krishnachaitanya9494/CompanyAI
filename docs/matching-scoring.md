# Candidate to JD matching

## Canonical flow

Pasted text and persisted comparisons call `evaluate_requirements` in `app/services/canonical_matching_service.py`. Persisted callers in `matching_engine_service.py` adapt candidate and resume records to this service; ranking, single and bulk comparison, workspace, recommendation, and explicit-job assistant lookups consume those results. The raw JD body is the scoring source for both paths. Segmentation and compatible Nemotron embeddings remain provenance/context only and cannot award qualification credit.

JD extraction splits supported compound bullets, applies section context for required/preferred classification, removes headings, deduplicates normalized requirements, and retains the original text and line locations. It is deterministic and intentionally conservative: unsupported prose patterns may remain bundled or be omitted for recruiter review.

## Formula and metrics

Each mandatory requirement has weight `1.0`; each preferred requirement has weight `0.5`. Credits are `1.0` for direct evidence, `0.9` for an explicitly recognized equivalent, up to `0.8` for partial evidence, and `0` for missing evidence. Unverified requirements are excluded from the denominator and have no contribution.

`Overall Match = 100 × Σ(requirement weight × evidence credit) / Σ(weight for evaluated requirements)`

The API retains the unrounded result and per-requirement contributions; the displayed integer is rounded once from that value. If no requirement is evaluable, the score is `null` (`Insufficient Evidence`). Evidence coverage is evaluated requirements divided by extracted requirements. Score confidence is a separate conservative label, capped by evidence coverage. Category scores use the same credits and weights within their category.

`DIRECT_MATCH` requires all specific terms together in verbatim resume evidence. `EQUIVALENT_MATCH` uses a small explicit terminology map. `PARTIAL_MATCH` records only partial terms or a profile-listed skill and caps its credit. A complete reviewed resume with no evidence yields `MISSING`; incomplete or ambiguous material yields `UNVERIFIED`, never a confirmed gap.

## Experience and provenance

Experience is calculated only from explicit month/year employment intervals. Overlaps are merged; internship intervals are reported separately and excluded from professional tenure. Year-only or ambiguous timelines yield `UNVERIFIED`. Relevant experience counts dated professional intervals whose source text supports at least two specific role/JD terms. Stated years claims are retained separately and do not replace date calculations. Experience ranges are evaluated against both bounds.

Persisted snapshots store job ID/version and JD hash, candidate ID/profile hash, resume ID/content hash, scoring engine/configuration versions, requirement evidence and contributions, model provenance, and calculation timestamp. Recalculations preserve historical rows and mark earlier snapshots non-current. Existing records are preserved; the SQLite migration adds a score-availability flag so the internal placeholder for an unscorable historical row is not exposed as a score.

## Limitations

This is a deterministic text evidence score, not an ATS prediction or hiring outcome. Text co-occurrence cannot establish proficiency. Relevance detection, atomic splitting, and the explicitly recognized equivalence list are intentionally limited and require recruiter review for ambiguous language. Candidate profile data is partial evidence only. Mohd Mateen Ahmed's full resume is not available in this workspace, so no candidate-specific score is asserted.
