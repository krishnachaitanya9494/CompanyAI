"""Generate 2048-dim embeddings for all jobs using nvidia/nemotron-3-embed-1b:free."""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from database.sqlite_connection import get_db
from database.models import Job, JobEmbedding
from app.embedding_service import generate_embedding, OPENROUTER_EMBEDDING_MODEL
from database.embedding_storage import store_job_embedding

def main():
    db = next(get_db())
    jobs = db.query(Job).all()
    print(f"Auditing {len(jobs)} jobs for embeddings...")

    for job in jobs:
        existing = db.query(JobEmbedding).filter(
            JobEmbedding.job_id == job.id,
            JobEmbedding.embedding_type == "full_jd"
        ).first()

        if existing and existing.embedding_vector and len(existing.embedding_vector) == 2048:
            print(f"✓ Job {job.id} ('{job.title}'): Already has 2048-dim vector.")
            continue

        print(f"→ Generating embedding for Job {job.id} ('{job.title}')...")
        desc = job.description or ""
        skills_list = (job.required_skills or []) + (job.preferred_skills or [])
        skills_str = ", ".join(skills_list)
        text = f"Job Title: {job.title}\nDepartment: {job.department or ''}\nSkills: {skills_str}\n\n{desc}".strip()

        try:
            vector = generate_embedding(text)
            print(f"   Generated {len(vector)}-dim vector with {OPENROUTER_EMBEDDING_MODEL}")
            stored = store_job_embedding(
                db=db,
                job_id=job.id,
                embedding_type="full_jd",
                embedding_vector=vector,
                model_name=OPENROUTER_EMBEDDING_MODEL,
                input_text=text,
            )
            print(f"   Saved JobEmbedding id={stored.id}")
        except Exception as e:
            print(f"   ERROR embedding Job {job.id}: {e}")

    print("\nAll job embeddings audit & generation complete!")

if __name__ == "__main__":
    main()
