# Resume ingestion workflow

## Candidate identity policy

The importer links a new resume to an existing candidate only when the parsed resume contains an email address that matches an existing candidate email after lowercase normalization. It never merges candidates by name alone. If no email is available, each distinct resume content hash creates a separate candidate; a later human review can link those records if needed.

The resume content SHA-256 digest is the idempotency key. Reimporting identical content records a duplicate status and does not create another resume or request another embedding. A changed file at the same path can create a new resume version while retaining the old record.

## Workflow and data handling

The CLI discovers local PDF, DOCX, DOC, and TXT files. Unsupported files are included in the preview as skipped items. Text extraction uses the existing PDF, DOCX, and TXT extractor. Legacy DOC files are converted into a temporary directory through Microsoft Word automation; the original document is never modified. Image-only PDFs are reported as requiring OCR because OCR is not implemented.

Candidate parsing is deterministic and local. It extracts a labeled name when available, the first valid email address, and skills from a curated vocabulary. It does not use a language model to parse candidate data. Before an embedding request, the pipeline redacts detected direct identifiers and the parsed name/email, then validates that the outbound text is still sanitized. It stores the requested embedding model, actual vector dimension, redacted-input hash, and preprocessing version.

Each imported file uses one SQLite transaction for its candidate, resume, embedding, and successful status. A failed transaction rolls back canonical records and then records a safe failure code separately so the file can be retried. The status table stores the latest source path, content hash, state, attempt count, error code, and linked record IDs.

## Commands

Initialize a new schema or add missing tables without deleting existing records:

```powershell
python -m scripts.ingest_resumes --initialize-db
```

Preview the configured `data/resumes` folder without database writes or embedding API calls:

```powershell
python -m scripts.ingest_resumes
```

Preview another directory:

```powershell
python -m scripts.ingest_resumes C:\path\to\resumes
```

Perform database writes only after reviewing the preview, passing `--apply`, and typing the exact confirmation word requested by the CLI:

```powershell
python -m scripts.ingest_resumes --apply
```

The CLI prints file indexes, extensions, statuses, safe reason codes, and skills only. It does not print resume filenames, candidate names, email addresses, phone numbers, or extracted resume text.

## Current limitations

Name and skill extraction are heuristic, and the skill vocabulary is intentionally explicit. Files with no email are kept as separate candidates rather than risk false merges. PDF OCR and DOC conversion require local Windows/Word support respectively. Embedding requests send the sanitized resume text to the configured OpenRouter provider; dry runs never make those requests.
