"""Comprehensive Section 5 Production Validation & Quality Assurance Runner."""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import re
from typing import Dict, Any, List

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
    INTERNAL_METADATA_PATTERNS,
    sanitize_internal_metadata,
    remove_duplicate_title_headings,
    normalize_markdown_content,
    find_incomplete_statements,
)
from app.services.advertisement_validation_service import validate_advertisement_quality


TEST_JOB_IDS = [37, 39, 35, 34, 36]
PLATFORMS = ["linkedin", "naukri", "indeed", "careers", "referral"]


def run_validation():
    db = SessionLocal()
    report: Dict[str, Any] = {
        "jobs_tested": [],
        "domain_results": {},
        "sanitization_results": {},
        "skills_coverage": {},
        "quality_checks": {},
        "export_checks": {},
        "recruiter_edit_checks": {},
        "provenance_checks": {},
    }

    try:
        for job_id in TEST_JOB_IDS:
            job = db.query(Job).filter(Job.id == job_id).first()
            assert job is not None, f"Job {job_id} must exist"
            
            # Original source check
            source_doc = db.query(JobDescription).filter(JobDescription.id == job.job_description_id).first()
            orig_text = source_doc.original_text if source_doc and source_doc.original_text else (job.description or "")
            orig_hash_before = hash(orig_text)

            ctx = build_job_generation_context(db, job.id)
            domain_info = {
                "id": job.id,
                "title": ctx.title,
                "department": ctx.department,
                "domain": ctx.role_domain,
                "experience": ctx.experience_display,
                "location": ctx.location,
                "mandatory_skills_count": len(ctx.mandatory_skills),
                "preferred_skills_count": len(ctx.preferred_skills),
                "technical_skills_count": len(ctx.technical_skills),
                "functional_skills_count": len(ctx.functional_skills),
                "professional_skills_count": len(ctx.professional_skills),
                "platforms_verified": {},
            }
            report["jobs_tested"].append(domain_info)

            # 1. Generate & Validate Platform Advertisements
            for plat in PLATFORMS:
                ad_content, model_name, gen_method = generate_platform_advertisement(ctx, plat)
                
                # Check 1: Single Title Heading
                title_clean = ctx.title.strip().lower()
                headings = [
                    re.sub(r"^#{1,6}\s*", "", h).strip().lower()
                    for h in ad_content.splitlines()
                    if h.strip().startswith("#")
                ]
                # Filter out platform prefixes like "we're hiring:"
                exact_title_headings = [
                    h for h in headings
                    if h == title_clean or h.startswith(f"we're hiring: {title_clean}") or h.startswith(f"{title_clean} -")
                ]
                single_title = len(exact_title_headings) <= 1

                # Check 2: Required Skills Immediately Below Key Responsibilities
                has_responsibilities = "## key responsibilities" in ad_content.lower()
                has_skills = "## required skills & competencies" in ad_content.lower()
                skills_below_resp = True
                if has_responsibilities and has_skills:
                    resp_idx = ad_content.lower().find("## key responsibilities")
                    skills_idx = ad_content.lower().find("## required skills & competencies")
                    skills_below_resp = skills_idx > resp_idx

                # Check 3: Internal Metadata Leakage
                leaks = []
                for line in ad_content.splitlines():
                    core = re.sub(r"^[-•·*+\s]+", "", line.strip())
                    if INTERNAL_METADATA_REGEX.search(core) or "[section=" in line:
                        leaks.append(line.strip())

                # Check 4: Stray Asterisks (orphan **)
                stray_stars = re.findall(r"(?<!\*)\*(?!\*)|\b\w+:\*\*", ad_content)

                # Check 5: Incomplete Sentences
                incompletes = find_incomplete_statements(ad_content)

                val_res = validate_advertisement_quality(ctx, plat, ctx.title, ad_content)

                domain_info["platforms_verified"][plat] = {
                    "ad_length": len(ad_content),
                    "model_name": model_name,
                    "generation_method": gen_method,
                    "single_title_heading": single_title,
                    "skills_below_responsibilities": skills_below_resp,
                    "internal_metadata_leaks_count": len(leaks),
                    "stray_asterisks_count": len(stray_stars),
                    "incomplete_sentences_count": len(incompletes),
                    "validation_passed": val_res["passed"],
                    "blocking_errors": val_res["blocking_errors"],
                    "warnings": val_res["warnings"],
                }

            # Verify original JD unchanged
            orig_hash_after = hash(source_doc.original_text if source_doc and source_doc.original_text else (job.description or ""))
            assert orig_hash_before == orig_hash_after, f"Original JD {job_id} was modified!"

            # 2. Skills Accuracy & Domain Isolation
            all_skills = ctx.mandatory_skills + ctx.preferred_skills
            # Check domain contamination
            if job_id == 37: # Accountant
                assert not any(s.lower() in ["autocad", "microstation", "systemverilog", "uvm"] for s in all_skills)
            elif job_id == 39: # CAD
                assert not any(s.lower() in ["income tax", "tds", "gst", "sut", "systemverilog"] for s in all_skills)
            elif job_id == 35: # Verification
                assert not any(s.lower() in ["tax reconciliation", "general ledger", "revit"] for s in all_skills)

            # Check duplicate skills
            duplicates = [s for s in all_skills if all_skills.count(s) > 1]
            assert len(duplicates) == 0, f"Job {job_id} has duplicate skills: {duplicates}"

            report["skills_coverage"][job.title] = {
                "technical": ctx.technical_skills,
                "functional": ctx.functional_skills,
                "professional": ctx.professional_skills,
                "preferred": ctx.preferred_skills,
            }

        # 3. Export Verification (DOCX and PDF bytes generation)
        sample_ctx = build_job_generation_context(db, 37)
        sample_ad, _, _ = generate_platform_advertisement(sample_ctx, "naukri")
        
        docx_bytes = export_advertisement_docx(sample_ctx.title, sample_ad)
        pdf_bytes = export_advertisement_pdf(sample_ctx.title, sample_ad)
        txt_content = sample_ad

        assert len(docx_bytes) > 2000, "DOCX export failed or too small"
        assert len(pdf_bytes) > 1000, "PDF export failed or too small"
        assert pdf_bytes.startswith(b"%PDF"), "PDF export missing valid PDF header"
        assert not re.search(r"\*\*(.+?)\*\*", txt_content), "TXT export should have clean markdown formatting"
        report["export_checks"] = {
            "docx_bytes": len(docx_bytes),
            "pdf_bytes": len(pdf_bytes),
            "pdf_valid_header": pdf_bytes.startswith(b"%PDF"),
            "txt_clean": True,
        }

        # 4. Recruiter Edit & Granular Regeneration Verification
        initial_content, _, _ = generate_platform_advertisement(sample_ctx, "linkedin")
        
        # Test Granular Overview Regeneration
        regen_overview = regenerate_advertisement_section(sample_ctx, "linkedin", initial_content, "overview")
        assert "## About the Role" in regen_overview
        assert "## Key Responsibilities" in regen_overview
        assert "## Required Skills & Competencies" in regen_overview

        # Test Granular Skills Regeneration with Recruiter Custom Skills
        custom_supp = {"custom_skills": {"mandatory": ["SAP ECC", "US GAAP Compliance"], "preferred": ["Big 4 Audit Experience"]}}
        custom_ctx = build_job_generation_context(db, 37, custom_supp)
        assert "SAP ECC" in custom_ctx.mandatory_skills
        assert "Big 4 Audit Experience" in custom_ctx.preferred_skills

        regen_skills = regenerate_advertisement_section(custom_ctx, "linkedin", regen_overview, "skills")
        assert "SAP ECC" in regen_skills
        assert "Big 4 Audit Experience" in regen_skills
        assert "## Required Skills & Competencies" in regen_skills

        report["recruiter_edit_checks"] = {
            "custom_skill_injection": True,
            "regenerate_overview_preserves_skills": "## Required Skills & Competencies" in regen_overview,
            "regenerate_skills_preserves_overview": "## About the Role" in regen_skills,
            "custom_skills_reflected": "SAP ECC" in regen_skills and "Big 4 Audit Experience" in regen_skills,
        }

        print("ALL VERIFICATIONS COMPLETED SUCCESSFULLY!")
        print(json.dumps(report, indent=2))
        return 0

    except Exception as e:
        print(f"VERIFICATION FAILED: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(run_validation())
