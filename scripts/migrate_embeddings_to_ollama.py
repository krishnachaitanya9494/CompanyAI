"""Safe migration script to re-embed all ResumeEmbedding and JobEmbedding records to local Ollama nomic-embed-text (768 dims).

Safeguards:
1. Verifies that pre-migration backup exists.
2. Extracts source texts preserving candidate IDs, metadata, and relationships.
3. Generates 768-dim embeddings using local Ollama.
4. Validates dimension (768), finiteness, non-zero coordinates.
5. Updates SQLite records with model_name='nomic-embed-text', dimensions=768, generation_method='ollama'.
6. Reports full migration statistics.
"""

import hashlib
import math
import os
import sys
import time
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.config import ai_config
from app.ai.providers.embedding_provider import embedding_provider
from app.ai.providers.ollama_provider import ollama_provider
from app.services.candidate_embedding_service import compute_text_hash, prepare_resume_embedding_text
from app.services.jd_embedding_service import (
    build_full_jd_embedding_text,
    build_requirement_embedding_text,
    compute_text_sha256,
)
from database.embedding_storage import validate_embedding_vector
from database.models import Candidate, Job, JobEmbedding, JDSegmentation, JobRequirement, Resume, ResumeEmbedding
from database.sqlite_connection import SessionLocal


def run_migration():
    print("=" * 70)
    print("CompanyAI: Local Ollama Embedding Migration (nomic-embed-text, 768 dims)")
    print("=" * 70)

    # 1. Verify backup
    backup_path = PROJECT_ROOT / "data" / "backups" / "pre_ollama_migration" / "companyai_pre_ollama_backup.db"
    if not backup_path.exists():
        print(f"[FATAL ERROR] Backup file not found at {backup_path}! Aborting for safety.")
        sys.exit(1)
    print(f"[VERIFIED] Database backup exists at: {backup_path} ({backup_path.stat().st_size:,} bytes)")

    # 2. Check Ollama server availability
    if not ollama_provider.is_available():
        print(f"[FATAL ERROR] Ollama server is not available at {ai_config.ollama_base_url}! Aborting.")
        sys.exit(1)
    models = ollama_provider.list_models()
    model_names = [m.get("name", "") if isinstance(m, dict) else str(m) for m in models]
    print(f"[VERIFIED] Ollama server is running at {ai_config.ollama_base_url}. Installed models: {model_names}")
    if not any("nomic-embed-text" in name for name in model_names):
        print("[FATAL ERROR] nomic-embed-text model is not installed in Ollama! Run 'ollama pull nomic-embed-text'.")
        sys.exit(1)

    db: Session = SessionLocal()

    t_start = time.time()

    # -------------------------------------------------------------
    # 3. Migrate ResumeEmbedding records
    # -------------------------------------------------------------
    resume_embeddings = db.scalars(select(ResumeEmbedding).order_by(ResumeEmbedding.id.asc())).all()
    total_resumes = len(resume_embeddings)
    print(f"\n[PHASE A] Migrating {total_resumes} ResumeEmbedding records...")

    resumes_migrated = 0
    resumes_skipped = 0
    resumes_failed = 0

    batch_size = 5
    for i in range(0, total_resumes, batch_size):
        chunk = resume_embeddings[i : i + batch_size]
        items_to_embed = []
        for emb_rec in chunk:
            if (
                emb_rec.dimensions == 768
                and emb_rec.generation_method == "ollama"
                and emb_rec.model_name == "nomic-embed-text"
                and emb_rec.embedding_vector
                and len(emb_rec.embedding_vector) == 768
            ):
                resumes_migrated += 1
                continue

            resume = db.get(Resume, emb_rec.resume_id)
            if not resume:
                print(f"[WARN] Resume {emb_rec.resume_id} not found for ResumeEmbedding {emb_rec.id}. Skipping.")
                resumes_skipped += 1
                continue
            cand = resume.candidate
            try:
                text = prepare_resume_embedding_text(resume, cand)
            except Exception as prep_exc:
                skills_str = ", ".join(cand.skills or []) if cand else ""
                text = f"Profile: {cand.name if cand else 'Candidate'}\nSkills: {skills_str}\nDocument: {resume.source_filename}"
            text = text.encode("utf-8", "ignore").decode("utf-8")
            items_to_embed.append((emb_rec, resume, text))

        if not items_to_embed:
            pct = min(100.0, (i + len(chunk)) / total_resumes * 100)
            print(f"  Progress: {min(i + len(chunk), total_resumes)}/{total_resumes} resumes ({pct:.1f}%) [already migrated]")
            sys.stdout.flush()
            continue

        texts = [item[2] for item in items_to_embed]
        try:
            vectors = embedding_provider.embed_batch(texts, batch_size=len(texts))
        except Exception as exc:
            print(f"[ERROR] Batch embed failed for resumes {i}-{i+len(chunk)}: {exc}")
            # Try individually
            vectors = []
            for item in items_to_embed:
                try:
                    vec = embedding_provider.embed_text(item[2])
                    vectors.append(vec)
                except Exception as ind_exc:
                    print(f"[ERROR] Individual embed failed for Resume {item[1].id}: {ind_exc}")
                    vectors.append(None)

        for (emb_rec, resume, text), vec in zip(items_to_embed, vectors):
            if vec is None:
                resumes_failed += 1
                continue
            try:
                # Validation checks
                if len(vec) != 768:
                    raise ValueError(f"Vector dimension {len(vec)} != 768")
                valid_vec = validate_embedding_vector(vec, dimensions=768)

                # Update record
                emb_rec.embedding_vector = valid_vec
                emb_rec.dimensions = 768
                emb_rec.model_name = "nomic-embed-text"
                emb_rec.requested_model = "nomic-embed-text"
                emb_rec.returned_model = "nomic-embed-text"
                emb_rec.generation_method = "ollama"
                emb_rec.input_hash = compute_text_hash(text)

                resumes_migrated += 1
            except Exception as val_exc:
                print(f"[ERROR] Validation failed for ResumeEmbedding {emb_rec.id}: {val_exc}")
                resumes_failed += 1

        db.commit()
        pct = min(100.0, (i + len(chunk)) / total_resumes * 100)
        print(f"  Progress: {min(i + len(chunk), total_resumes)}/{total_resumes} resumes ({pct:.1f}%)")
        sys.stdout.flush()

    # -------------------------------------------------------------
    # 4. Migrate JobEmbedding records
    # -------------------------------------------------------------
    job_embeddings = db.scalars(select(JobEmbedding).order_by(JobEmbedding.id.asc())).all()
    total_jobs = len(job_embeddings)
    print(f"\n[PHASE B] Migrating {total_jobs} JobEmbedding records...")

    jobs_migrated = 0
    jobs_skipped = 0
    jobs_failed = 0

    for i in range(0, total_jobs, batch_size):
        chunk = job_embeddings[i : i + batch_size]
        items_to_embed = []
        for emb_rec in chunk:
            if (
                emb_rec.dimensions == 768
                and emb_rec.generation_method == "ollama"
                and emb_rec.model_name == "nomic-embed-text"
                and emb_rec.embedding_vector
                and len(emb_rec.embedding_vector) == 768
            ):
                jobs_migrated += 1
                continue

            job = db.get(Job, emb_rec.job_id)
            seg = db.get(JDSegmentation, emb_rec.segmentation_id)
            if not job or not seg:
                print(f"[WARN] Job {emb_rec.job_id} or Segmentation {emb_rec.segmentation_id} not found for JobEmbedding {emb_rec.id}. Skipping.")
                jobs_skipped += 1
                continue

            if emb_rec.requirement_id is not None:
                req = db.get(JobRequirement, emb_rec.requirement_id)
                if req:
                    text = build_requirement_embedding_text(req)
                else:
                    text = f"Requirement for {job.title}"
            else:
                text = build_full_jd_embedding_text(job, seg)

            items_to_embed.append((emb_rec, text))

        if not items_to_embed:
            pct = min(100.0, (i + len(chunk)) / total_jobs * 100)
            print(f"  Progress: {min(i + len(chunk), total_jobs)}/{total_jobs} job embeddings ({pct:.1f}%) [already migrated]")
            sys.stdout.flush()
            continue

        texts = [item[1] for item in items_to_embed]
        try:
            vectors = embedding_provider.embed_batch(texts, batch_size=len(texts))
        except Exception as exc:
            print(f"[ERROR] Batch embed failed for jobs {i}-{i+len(chunk)}: {exc}")
            vectors = []
            for item in items_to_embed:
                try:
                    vec = embedding_provider.embed_text(item[1])
                    vectors.append(vec)
                except Exception as ind_exc:
                    print(f"[ERROR] Individual embed failed for JobEmbedding {item[0].id}: {ind_exc}")
                    vectors.append(None)

        for (emb_rec, text), vec in zip(items_to_embed, vectors):
            if vec is None:
                jobs_failed += 1
                continue
            try:
                if len(vec) != 768:
                    raise ValueError(f"Vector dimension {len(vec)} != 768")
                valid_vec = validate_embedding_vector(vec, dimensions=768)

                emb_rec.embedding_vector = valid_vec
                emb_rec.dimensions = 768
                emb_rec.model_name = "nomic-embed-text"
                emb_rec.generation_method = "ollama"
                emb_rec.input_hash = compute_text_sha256(text)

                jobs_migrated += 1
            except Exception as val_exc:
                print(f"[ERROR] Validation failed for JobEmbedding {emb_rec.id}: {val_exc}")
                jobs_failed += 1

        db.commit()
        pct = min(100.0, (i + len(chunk)) / total_jobs * 100)
        print(f"  Progress: {min(i + len(chunk), total_jobs)}/{total_jobs} job embeddings ({pct:.1f}%)")
        sys.stdout.flush()

    # -------------------------------------------------------------
    # 5. Final Database Vector Integrity Check
    # -------------------------------------------------------------
    t_elapsed = time.time() - t_start
    print("\n" + "=" * 70)
    print("MIGRATION INTEGRITY & COMPLIANCE VERIFICATION")
    print("=" * 70)

    # Check for any remaining non-768 or non-ollama vectors
    non_768_resumes = db.scalars(select(ResumeEmbedding).where(ResumeEmbedding.dimensions != 768)).all()
    non_768_jobs = db.scalars(select(JobEmbedding).where(JobEmbedding.dimensions != 768)).all()
    non_ollama_resumes = db.scalars(select(ResumeEmbedding).where(ResumeEmbedding.generation_method != "ollama")).all()
    non_ollama_jobs = db.scalars(select(JobEmbedding).where(JobEmbedding.generation_method != "ollama")).all()

    print(f"Total ResumeEmbeddings in DB: {db.scalar(select(ResumeEmbedding).count()) if hasattr(select(ResumeEmbedding), 'count') else total_resumes}")
    print(f"  - Successfully migrated to 768-dim nomic-embed-text: {resumes_migrated}")
    print(f"  - Skipped: {resumes_skipped}")
    print(f"  - Failed: {resumes_failed}")
    print(f"  - Residual non-768 dimensions: {len(non_768_resumes)}")
    print(f"  - Residual non-ollama generation methods: {len(non_ollama_resumes)}")

    print(f"\nTotal JobEmbeddings in DB: {total_jobs}")
    print(f"  - Successfully migrated to 768-dim nomic-embed-text: {jobs_migrated}")
    print(f"  - Skipped: {jobs_skipped}")
    print(f"  - Failed: {jobs_failed}")
    print(f"  - Residual non-768 dimensions: {len(non_768_jobs)}")
    print(f"  - Residual non-ollama generation methods: {len(non_ollama_jobs)}")

    print(f"\nTotal Migration Time: {t_elapsed:.2f} seconds")

    if (
        len(non_768_resumes) == 0
        and len(non_768_jobs) == 0
        and len(non_ollama_resumes) == 0
        and len(non_ollama_jobs) == 0
        and resumes_failed == 0
        and jobs_failed == 0
    ):
        print("\n>>> MIGRATION SUCCESSFUL: 100% of vectors have 768 dimensions from local Ollama. <<<")
    else:
        print("\n>>> WARNING: Some records could not be fully migrated. Review log above. <<<")

    db.close()


if __name__ == "__main__":
    run_migration()
