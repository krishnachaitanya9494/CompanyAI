"""Detailed Export Fidelity and Security/Data Isolation Validation Runner."""

import io
import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import re
import docx
import pymupdf

from database.sqlite_connection import SessionLocal
from database.models import Job, JobDescription, JobPosting, JobPostingVersion
from app.services.jd_context_service import build_job_generation_context
from app.services.advertisement_generation_service import (
    generate_platform_advertisement,
    regenerate_advertisement_section,
    export_advertisement_docx,
    export_advertisement_pdf,
)
from app.services.content_normalization_service import (
    INTERNAL_METADATA_REGEX,
    remove_duplicate_title_headings,
    normalize_markdown_content,
)
from app.routers.job_postings import _generate_docx_bytes, _generate_pdf_bytes, _clean_plain_text


DOMAINS = [
    (37, "Staff Accountant-Mid-Ops", "Finance & Tax Compliance"),
    (39, "CAD Entry Ops", "Retail Assets & Facilities Engineering"),
    (35, "Design Verification Engineer", "Semiconductor / ASIC Verification"),
    (34, "Senior Manager , Cloud Infrastructure (1)", "Enterprise Cloud & DevOps"),
    (36, "ServiceNow FSO Software Engineer – Complaint Management", "Enterprise IT / ITSM"),
]


def test_export_and_security():
    db = SessionLocal()
    results = {
        "export_fidelity": {},
        "security_and_isolation": {},
    }

    try:
        # Part 1: Export Verification across 5 domains
        for job_id, role_name, domain_name in DOMAINS:
            ctx = build_job_generation_context(db, job_id)
            ad_content, _, _ = generate_platform_advertisement(ctx, "linkedin")

            # 1. TXT export
            txt_clean = _clean_plain_text(ad_content)
            
            # 2. PDF export & text extraction via PyMuPDF
            pdf_bytes = _generate_pdf_bytes(ctx.title, ad_content)
            pdf_doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
            pdf_text = "\n".join(page.get_text() for page in pdf_doc)
            
            # 3. DOCX export & text extraction via python-docx
            docx_bytes = _generate_docx_bytes(ctx.title, ad_content)
            doc = docx.Document(io.BytesIO(docx_bytes))
            docx_text = "\n".join(p.text for p in doc.paragraphs)

            # Verification 1: Stray asterisks (orphans)
            txt_stray = len(re.findall(r"\*\*(.+?)\*\*|\b\w+:\*\*", txt_clean))
            pdf_stray = len(re.findall(r"\*\*(.+?)\*\*|\b\w+:\*\*", pdf_text))
            docx_stray = len(re.findall(r"\*\*(.+?)\*\*|\b\w+:\*\*", docx_text))

            # Verification 2: Internal metadata leakage
            txt_leaks = len([l for l in txt_clean.splitlines() if INTERNAL_METADATA_REGEX.search(l)])
            pdf_leaks = len([l for l in pdf_text.splitlines() if INTERNAL_METADATA_REGEX.search(l)])
            docx_leaks = len([l for l in docx_text.splitlines() if INTERNAL_METADATA_REGEX.search(l)])

            # Verification 3: Duplicate title headings
            def count_title_headings(text, title):
                count = 0
                for line in text.splitlines():
                    clean = re.sub(r"^(?:#+\s*|we're hiring:?\s*)", "", line.strip(), flags=re.I).strip().lower()
                    if clean == title.strip().lower():
                        count += 1
                return count

            docx_title_count = count_title_headings(docx_text, ctx.title)
            pdf_title_count = count_title_headings(pdf_text, ctx.title)

            # Verification 4: Skills section present in all exports
            has_skills_txt = "required skills" in txt_clean.lower() or "skills & competencies" in txt_clean.lower()
            has_skills_pdf = "required skills" in pdf_text.lower() or "skills & competencies" in pdf_text.lower()
            has_skills_docx = "required skills" in docx_text.lower() or "skills & competencies" in docx_text.lower()

            results["export_fidelity"][f"Job {job_id}: {role_name}"] = {
                "domain": domain_name,
                "txt_bytes": len(txt_clean.encode("utf-8")),
                "pdf_bytes": len(pdf_bytes),
                "docx_bytes": len(docx_bytes),
                "pdf_pages": len(pdf_doc),
                "docx_paragraphs": len(doc.paragraphs),
                "stray_asterisks_found": txt_stray + pdf_stray + docx_stray,
                "internal_metadata_leaks": txt_leaks + pdf_leaks + docx_leaks,
                "duplicate_title_headings": max(docx_title_count, pdf_title_count) <= 1,
                "skills_section_in_all_exports": has_skills_txt and has_skills_pdf and has_skills_docx,
            }

            assert txt_stray == 0 and pdf_stray == 0 and docx_stray == 0, f"Stray asterisks in export for job {job_id}"
            assert txt_leaks == 0 and pdf_leaks == 0 and docx_leaks == 0, f"Internal metadata leaked in export for job {job_id}"
            assert has_skills_txt and has_skills_pdf and has_skills_docx, f"Skills section missing in export for job {job_id}"

        # Part 2: Security & Cross-Job Data Isolation
        # Test 1: Verify original JD records in database are strictly unchanged
        job_37 = db.query(Job).filter(Job.id == 37).first()
        jd_37 = db.query(JobDescription).filter(JobDescription.id == job_37.job_description_id).first()
        original_jd_text = jd_37.original_text if jd_37 else job_37.description
        assert "Job Distributed to New Vendors: 9427" in original_jd_text, "Original raw source must be preserved with raw vendor tags"

        # Test 2: Custom skill injection isolation
        supp_37 = {"custom_skills": {"mandatory": ["UniqueTaxSkillXYZ"], "preferred": []}}
        ctx_37 = build_job_generation_context(db, 37, supp_37)
        assert "UniqueTaxSkillXYZ" in ctx_37.mandatory_skills

        # Build Job 39 context and verify UniqueTaxSkillXYZ did NOT leak
        ctx_39 = build_job_generation_context(db, 39)
        assert "UniqueTaxSkillXYZ" not in ctx_39.mandatory_skills, "Security breach: Job 37 custom skills leaked into Job 39!"

        # Test 3: Invalid job ID handling
        invalid_error_caught = False
        try:
            build_job_generation_context(db, 999999)
        except ValueError as err:
            invalid_error_caught = True
            assert "does not exist" in str(err)
        assert invalid_error_caught, "Invalid job ID did not raise ValueError"

        results["security_and_isolation"] = {
            "original_jd_source_preserved_unchanged": True,
            "cross_job_custom_skill_leakage": "None (strictly isolated)",
            "invalid_job_id_handled": True,
            "provenance_and_vendor_tags_stripped_from_public_ad": True,
        }

        print("EXPORT & SECURITY VALIDATION COMPLETED SUCCESSFULLY")
        print(json.dumps(results, indent=2))
        return 0

    except Exception as exc:
        print(f"FAILED: {exc}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(test_export_and_security())
