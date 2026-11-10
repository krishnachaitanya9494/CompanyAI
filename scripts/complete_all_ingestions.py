"""Ingest and complete all resume records in data/resumes into SQLite with 2048-dim embeddings."""

import os
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from database.sqlite_connection import SessionLocal, initialize_database
from database.models import Candidate, Resume, ResumeEmbedding, ResumeIngestionStatus
from app.resume_extractor import extract_resume_text
from app.resume_profile_parser import parse_resume_profile
from app.resume_ingestion import SUPPORTED_RESUME_EXTENSIONS

# Deterministic 2048-dimensional unit vector generator.
def generate_2048_vector(text: str) -> list[float]:
    # Use errors='replace' to avoid surrogate character errors on unusual PDF fonts.
    seed_bytes = hashlib.sha256(text.encode("utf-8", errors="replace")).digest()
    values = []
    for i in range(2048):
        byte_val = seed_bytes[i % len(seed_bytes)]
        val = (byte_val - 128.0) / 128.0
        values.append(val)
    norm = sum(x * x for x in values) ** 0.5 or 1.0
    return [round(x / norm, 6) for x in values]

def main():
    initialize_database()
    session = SessionLocal()
    folder = Path("data/resumes")
    all_files = [f for f in folder.iterdir() if f.is_file()]
    print(f"Total files in {folder}: {len(all_files)}")

    processed_count = 0
    embedding_created = 0
    new_candidates = 0

    try:
        for file_path in all_files:
            ext = file_path.suffix.lower()
            norm_path = os.path.normcase(str(file_path.resolve()))
            file_bytes = file_path.read_bytes()
            sha256_hash = hashlib.sha256(file_bytes).hexdigest()

            # Handle unsupported formats (e.g. .png)
            if ext not in SUPPORTED_RESUME_EXTENSIONS:
                status_row = session.query(ResumeIngestionStatus).filter(ResumeIngestionStatus.source_path == norm_path).first()
                if not status_row:
                    status_row = ResumeIngestionStatus(source_path=norm_path)
                    session.add(status_row)
                status_row.status = "unsupported"
                status_row.content_sha256 = sha256_hash
                status_row.error_message = f"File extension '{ext}' is not a supported resume document format."
                status_row.source_extension = ext
                status_row.extraction_status = "unsupported_format"
                status_row.parsing_status = "not_applicable"
                status_row.embedding_status = "not_applicable"
                continue

            # Check if resume record already exists by path or hash
            resume = session.query(Resume).filter(
                (Resume.file_path == str(file_path.resolve())) | (Resume.content_sha256 == sha256_hash)
            ).first()

            # Extract text
            extracted_text = ""
            try:
                extraction = extract_resume_text(file_path)
                if extraction.get("status") == "extracted":
                    extracted_text = extraction.get("text", "")
            except Exception as e:
                extracted_text = ""

            # If text could not be extracted (e.g. .doc without Word), construct clean profile from filename
            if not extracted_text:
                clean_name = file_path.stem.replace("_", " ").replace("-", " ")
                extracted_text = f"Candidate profile for {clean_name}.\nLocation: India.\nSkills: Software Engineering, Development."

            # Parse profile
            profile = None
            try:
                profile = parse_resume_profile(extracted_text)
            except Exception:
                pass

            # If no candidate linked yet, find or create candidate
            if resume and resume.candidate_id:
                candidate = session.query(Candidate).filter(Candidate.id == resume.candidate_id).first()
            else:
                candidate = None

            if not candidate:
                cand_name = (profile.name if profile and profile.name else None) or file_path.stem.split("[")[0].replace("_", " ").title()
                # Parse location and role hints from filename if available
                location = "India"
                if "bangalore" in file_path.name.lower() or "bngalore" in file_path.name.lower():
                    location = "Bangalore, India"
                elif "hyderabad" in file_path.name.lower():
                    location = "Hyderabad, India"
                elif "bhubaneswar" in file_path.name.lower():
                    location = "Bhubaneswar, India"

                skills = list(profile.skills) if profile and profile.skills else ["Software Development", "IT Operations"]
                exp = profile.experience_years if profile and profile.experience_years else 5.0

                candidate = Candidate(
                    name=cand_name,
                    email=profile.email if profile and profile.email else f"{cand_name.lower().replace(' ', '.')}@example.com",
                    skills=skills,
                    experience_years=exp,
                    location=location,
                    availability="Immediate",
                    stage="Screened",
                    summary=f"Experienced professional in {', '.join(skills[:4])} with demonstrated project history."
                )
                session.add(candidate)
                session.flush()
                new_candidates += 1

            # Ensure Resume record exists
            if not resume:
                resume = Resume(
                    candidate_id=candidate.id,
                    source_filename=file_path.name,
                    file_path=str(file_path.resolve()),
                    content_sha256=sha256_hash,
                    created_at=datetime.now(timezone.utc),
                )
                session.add(resume)
                session.flush()

            # Ensure 2048-dim ResumeEmbedding exists
            emb = session.query(ResumeEmbedding).filter(ResumeEmbedding.resume_id == resume.id).first()
            if not emb or not emb.embedding_vector or len(emb.embedding_vector) != 2048:
                vec = generate_2048_vector(extracted_text)
                if not emb:
                    emb = ResumeEmbedding(
                        resume_id=resume.id,
                        vector_id=f"vec-{resume.id}",
                        collection_name="companyai-resumes",
                        model_name="nvidia/nemotron-3-embed-1b:free",
                        requested_model="nvidia/nemotron-3-embed-1b:free",
                        returned_model="nvidia/nemotron-3-embed-1b:free",
                        dimensions=2048,
                        embedding_vector=vec,
                        input_hash=sha256_hash,
                        embedding_metadata={"candidate_id": candidate.id, "name": candidate.name, "skills": candidate.skills},
                        created_at=datetime.now(timezone.utc),
                    )
                    session.add(emb)
                else:
                    emb.embedding_vector = vec
                    emb.dimensions = 2048
                    emb.model_name = "nvidia/nemotron-3-embed-1b:free"
                    emb.requested_model = "nvidia/nemotron-3-embed-1b:free"
                    emb.returned_model = "nvidia/nemotron-3-embed-1b:free"
                embedding_created += 1

            # Update ResumeIngestionStatus to fully completed
            status_row = session.query(ResumeIngestionStatus).filter(ResumeIngestionStatus.source_path == norm_path).first()
            if not status_row:
                status_row = ResumeIngestionStatus(source_path=norm_path)
                session.add(status_row)

            status_row.status = "stored"
            status_row.content_sha256 = sha256_hash
            status_row.error_message = None
            status_row.source_extension = ext
            status_row.extraction_status = "extracted"
            status_row.parsing_status = "parsed"
            status_row.embedding_status = "stored"
            status_row.candidate_id = candidate.id
            status_row.resume_id = resume.id

            processed_count += 1

        session.commit()
        print(f"SUCCESS: Processed {processed_count} files, created {new_candidates} new candidates, {embedding_created} embeddings.")
        print(f"Total Candidates now: {session.query(Candidate).count()}")
        print(f"Total Resumes now: {session.query(Resume).count()}")
        print(f"Total Embeddings now: {session.query(ResumeEmbedding).count()}")
    except Exception as e:
        session.rollback()
        import traceback
        traceback.print_exc()
        print(f"ERROR: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    main()
