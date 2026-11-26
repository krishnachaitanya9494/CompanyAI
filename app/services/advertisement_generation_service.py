"""Dynamic Platform-Specific Advertisement Generation & Recruiter Productivity Service.

Builds genuine, platform-tailored job advertisements for LinkedIn, Naukri, Indeed, Company Careers,
and Employee Referral from verified JD context. Integrates Nemotron AI with deterministic fallbacks,
provides an AI Rewrite Assistant, advertisement comparison, and posting readiness auditing.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional, Tuple

from app.ai.config import ai_config
from app.ai.providers.chat_provider import chat_provider
from app.services.jd_context_service import (
    JobGenerationContext,
    extract_overview_from_text,
)
from app.services.content_normalization_service import (
    normalize_markdown_content,
    remove_duplicate_title_headings,
    sanitize_internal_metadata,
)
from app.services.advertisement_validation_service import validate_advertisement_quality


def _format_skills_section(context: JobGenerationContext, platform: str = "") -> List[str]:
    """Generate the standardized, structured 'Required Skills & Competencies' section.
    
    Places technical, functional, and professional competencies into concise, recruiter-friendly
    groups, followed by preferred skills when identified in the JD.
    """
    heading = "## Required Skills & Competencies (Key Skills)" if platform.lower() == "naukri" else "## Required Skills & Competencies"
    lines = [heading]

    tech = context.technical_skills or [s for s in context.mandatory_skills if s not in context.functional_skills]
    func = context.functional_skills or []
    prof = context.professional_skills or []

    if tech:
        lines.append(f"• Technical Skills & Tools: {', '.join(tech)}")
    if func:
        lines.append(f"• Functional & Operational Expertise: {', '.join(func)}")
    if prof:
        lines.append(f"• Professional & Collaborative Competencies: {', '.join(prof)}")

    if not tech and not func and not prof and context.mandatory_skills:
        for s in context.mandatory_skills:
            lines.append(f"• {s}")

    lines.append("")

    if context.preferred_skills:
        lines.append("## Preferred Skills")
        for ps in context.preferred_skills:
            lines.append(f"• {ps}")
        lines.append("")

    return lines


def generate_linkedin_ad(context: JobGenerationContext) -> str:
    """Generate an engaging, professional LinkedIn job post optimized for networking and sharing."""
    company = context.client_name if context.client_name != "Not specified" else "our growing team"
    overview = context.role_overview or f"We are seeking an accomplished {context.title} to join {company} in {context.location}."
    
    hashtags = [
        f"#{re.sub(r'[^A-Za-z0-9]', '', context.title)}",
        "#Hiring",
        "#JobOpening",
        f"#{re.sub(r'[^A-Za-z0-9]', '', context.role_domain.split('&')[0].strip())}",
        "#CareerOpportunity",
    ]
    if context.mandatory_skills:
        hashtags.extend(f"#{re.sub(r'[^A-Za-z0-9]', '', sk)}" for sk in context.mandatory_skills[:3])

    lines = [
        f"# We're Hiring: {context.title}",
        "",
        f"Are you an experienced professional looking to make a meaningful impact? {company} is expanding our operations in {context.location} ({context.work_mode}).",
        "",
        "## About the Role",
        overview,
        "",
        "## Key Responsibilities",
    ]
    for r in (context.responsibilities[:6] if context.responsibilities else ["Drive day-to-day operational execution and deliverables."]):
        lines.append(f"• {r}")
    lines.append("")

    # Required Skills & Competencies immediately below Key Responsibilities
    lines.extend(_format_skills_section(context, platform="linkedin"))

    lines.append("## Candidate Qualifications & Profile")
    lines.append(f"• Experience: {context.experience_display} in relevant domain operations")
    lines.append(f"• Work Mode / Location: {context.work_mode} in {context.location}")
    lines.append(f"• Employment Type: {context.employment_type}")
    if context.qualifications:
        for q in context.qualifications[:2]:
            lines.append(f"• {q}")
    lines.append("")

    if context.supplementary_info.get("benefits"):
        lines.append("## Why Join Us")
        for b in context.supplementary_info["benefits"][:4]:
            lines.append(f"• {b}")
        lines.append("")

    lines.append("## How to Apply")
    apply_instructions = context.supplementary_info.get("application_instructions") or "Click apply directly or reach out to our talent acquisition team with your updated profile."
    lines.append(apply_instructions)
    lines.append("")
    lines.append(" ".join(dict.fromkeys(hashtags)))

    raw_text = "\n".join(lines)
    return remove_duplicate_title_headings(context.title, normalize_markdown_content(raw_text))


def generate_naukri_ad(context: JobGenerationContext) -> str:
    """Generate a recruiter-friendly, keyword-dense Naukri advertisement optimized for active search discovery."""
    overview = context.role_overview or f"Opening for {context.title} with {context.experience_display} experience in {context.location}."

    lines = [
        f"# {context.title} - {context.location}",
        "",
        "## Position Snapshot",
        f"• Experience: {context.experience_display}",
        f"• Location: {context.location}",
        f"• Work Mode: {context.work_mode}",
        f"• Employment Type: {context.employment_type}",
        f"• Openings: {context.openings_count}",
        f"• Salary: {context.salary_range}",
        "",
        "## About the Role",
        overview,
        "",
        "## Key Responsibilities",
    ]
    if context.responsibilities:
        for r in context.responsibilities:
            lines.append(f"• {r}")
    else:
        lines.append("• Lead end-to-end domain operations and quality governance.")
    lines.append("")

    # Required Skills & Competencies immediately below Key Responsibilities
    lines.extend(_format_skills_section(context, platform="naukri"))

    lines.append("## Desired Candidate Profile")
    lines.append(f"• Required Experience: Minimum {context.experience_display} of verified hands-on industry experience.")
    if context.qualifications:
        for q in context.qualifications:
            lines.append(f"• {q}")
    lines.append("")

    lines.append("## About the Organization & Application Process")
    about = context.supplementary_info.get("company_overview") or f"{context.client_name if context.client_name != 'Not specified' else 'Our organization'} provides industry-leading solutions and professional development."
    lines.append(about)
    lines.append("Candidates meeting the mandatory requirements are invited to apply with an updated resume and notice period details.")

    raw_text = "\n".join(lines)
    return remove_duplicate_title_headings(context.title, normalize_markdown_content(raw_text))


def generate_indeed_ad(context: JobGenerationContext) -> str:
    """Generate a clear, structured, applicant-focused Indeed job post."""
    overview = context.role_overview or f"{context.client_name if context.client_name != 'Not specified' else 'Our organization'} is hiring for the position of {context.title} in {context.location}."

    lines = [
        f"# {context.title}",
        "",
        "## About the Role",
        overview,
        "",
        "## Job Details",
        f"• Job Type: {context.employment_type}",
        f"• Work Location: {context.location} ({context.work_mode})",
        f"• Experience Level: {context.experience_display}",
        f"• Number of Openings: {context.openings_count}",
    ]
    if context.salary_range != "Not disclosed":
        lines.append(f"• Compensation: {context.salary_range}")
    lines.append("")

    lines.append("## Key Responsibilities")
    if context.responsibilities:
        for r in context.responsibilities:
            lines.append(f"• {r}")
    else:
        lines.append("• Execute deliverables and support domain operations.")
    lines.append("")

    # Required Skills & Competencies immediately below Key Responsibilities
    lines.extend(_format_skills_section(context, platform="linkedin"))

    lines.append("## Qualifications")
    lines.append(f"• Experience: {context.experience_display} in relevant role or field.")
    if context.qualifications:
        for q in context.qualifications:
            lines.append(f"• {q}")
    lines.append("")

    lines.append("## Application Instructions")
    lines.append("Please submit your resume outlining your relevant experience. Shortlisted candidates will be contacted for an initial screening.")

    raw_text = "\n".join(lines)
    return remove_duplicate_title_headings(context.title, normalize_markdown_content(raw_text))


def generate_careers_ad(context: JobGenerationContext) -> str:
    """Generate a comprehensive, brand-aligned Company Careers Page advertisement."""
    company = context.client_name if context.client_name != "Not specified" else "Our Enterprise"
    overview = context.role_overview or f"As a {context.title} at {company}, you will play an integral role in driving domain excellence and operational outcomes."

    lines = [
        f"# {context.title}",
        f"**Location: {context.location} ({context.work_mode}) | Department: {context.department} | Type: {context.employment_type}**",
        "",
        "## About the Role",
        overview,
        "",
        "## Key Responsibilities",
    ]
    for r in (context.responsibilities if context.responsibilities else ["Execute deliverables and support team goals."]):
        lines.append(f"• {r}")
    lines.append("")

    # Required Skills & Competencies immediately below Key Responsibilities
    lines.extend(_format_skills_section(context, platform="linkedin"))

    lines.append("## Qualifications")
    lines.append(f"• Minimum {context.experience_display} of verified professional experience.")
    if context.qualifications:
        for q in context.qualifications:
            lines.append(f"• {q}")
    lines.append("")

    lines.append("## What We Offer")
    perks = context.supplementary_info.get("benefits") or [
        "Collaborative, high-performance work environment",
        "Opportunities for continuous professional development and learning",
        "Competitive rewards and recognition programs",
    ]
    for p in perks:
        lines.append(f"• {p}")
    lines.append("")

    lines.append("## Equal Opportunity & Application")
    lines.append(f"{company} is committed to building a diverse and inclusive workforce. All qualified applicants will receive consideration for employment without regard to demographic status.")

    raw_text = "\n".join(lines)
    return remove_duplicate_title_headings(context.title, normalize_markdown_content(raw_text))


def generate_referral_ad(context: JobGenerationContext) -> str:
    """Generate a concise, shareable internal employee referral announcement."""
    overview = context.role_overview or f"Our team is searching for a talented {context.title} to join us in {context.location}."

    lines = [
        f"# 🚀 Employee Referral Opportunity: {context.title}",
        "",
        "## Position Snapshot",
        f"• Experience Required: {context.experience_display}",
        f"• Location / Work Mode: {context.location} ({context.work_mode})",
        f"• Openings: {context.openings_count}",
        "",
        "## About the Opportunity",
        overview,
        "",
        "## Key Responsibilities",
    ]
    for r in context.responsibilities[:5]:
        lines.append(f"• {r}")
    lines.append("")

    # Required Skills & Competencies immediately below Key Responsibilities
    lines.extend(_format_skills_section(context, platform="linkedin"))

    lines.append("## How to Refer & Referral Reward")
    lines.append("Know someone who would be a great fit? Submit their resume and contact details through the internal Employee Referral portal or forward their profile to the hiring team.")
    if context.supplementary_info.get("referral_bonus"):
        lines.append(f"• Referral Reward: {context.supplementary_info['referral_bonus']}")

    raw_text = "\n".join(lines)
    return remove_duplicate_title_headings(context.title, normalize_markdown_content(raw_text))


PLATFORM_DETERMINISTIC_BUILDERS = {
    "linkedin": generate_linkedin_ad,
    "naukri": generate_naukri_ad,
    "indeed": generate_indeed_ad,
    "careers": generate_careers_ad,
    "referral": generate_referral_ad,
}


def generate_platform_advertisement(
    context: JobGenerationContext,
    platform: str,
) -> Tuple[str, str, Optional[str]]:
    """Generate an advertisement using Nemotron AI when available, with guaranteed deterministic fallback."""
    plat_key = platform.lower()
    builder = PLATFORM_DETERMINISTIC_BUILDERS.get(plat_key, generate_linkedin_ad)
    deterministic_content = builder(context)

    # If AI key is configured, invoke Nemotron LLM
    if ai_config.api_key and ai_config.api_key not in ["YOUR_OPENROUTER_API_KEY", "test_key", "none"]:
        platform_names = {
            "linkedin": "LinkedIn (engaging, professional hook, networking style)",
            "naukri": "Naukri (searchable, keyword-dense, ATS-friendly)",
            "indeed": "Indeed (transparent, applicant-focused, clear qualifications)",
            "careers": "Company Careers Page (brand-aligned, cultural values, detailed)",
            "referral": "Employee Referral (concise, internal shareable announcement)",
        }
        plat_desc = platform_names.get(plat_key, platform)

        system_prompt = (
            "You are CompanyAI's expert recruitment copywriter. Your task is to craft an exceptional, "
            f"source-grounded job advertisement tailored specifically for {plat_desc}.\n"
            "STRICT FACTUAL CONSTRAINTS:\n"
            "1. You MUST ONLY use the provided job facts (title, location, experience, skills, responsibilities).\n"
            "2. NEVER invent salary, benefits, company claims, or requirements not present in the input context.\n"
            "3. Format cleanly in Markdown with appropriate headings and bullets.\n"
            "4. NEVER leak requirements from unrelated domains or other jobs.\n"
            "5. Return ONLY the complete advertisement Markdown text."
        )

        user_prompt = (
            f"Generate an advertisement for platform: {platform.upper()}.\n"
            f"Job Context:\n{json.dumps(context.to_dict(), ensure_ascii=False, indent=2)}"
        )

        try:
            result = chat_provider.complete(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                max_tokens=2200,
            )
            ai_content = result.get("content", "").strip()
            if ai_content and len(ai_content) > 150:
                normalized_ai = remove_duplicate_title_headings(
                    context.title, normalize_markdown_content(ai_content)
                )
                validation = validate_advertisement_quality(context, plat_key, context.title, normalized_ai)
                if not validation["blocking_errors"]:
                    return normalized_ai, "nemotron_chat", result.get("model")
        except Exception:
            pass

    return deterministic_content, "deterministic_platform_builder", None


def rewrite_advertisement(
    context: JobGenerationContext,
    platform: str,
    current_content: str,
    rewrite_mode: str,
    custom_instruction: Optional[str] = None,
) -> Tuple[str, str]:
    """Execute targeted AI rewrite preserving source factual requirements."""
    instructions_map = {
        "professionalism": "Elevate tone for executive and corporate recruitment standards while maintaining exact technical facts.",
        "readability": "Simplify sentence structures, enhance visual hierarchy, and make the content effortless to scan.",
        "concise": "Trim unnecessary adjectives and fluff by 25-30%, focusing purely on core impact and qualifications.",
        "engaging": "Make the introduction and opportunity description inspiring and persuasive to attract top-tier passive candidates.",
        "optimize_keywords": "Enhance visibility for ATS algorithms and platform search by clearly featuring all mandatory and preferred skill keywords.",
        "simplify_technical": "Clarify complex jargon into clear functional outcomes suitable for cross-functional stakeholders.",
        "improve_responsibilities": "Refine all responsibilities using strong, proactive action verbs (e.g., 'Spearhead', 'Execute', 'Reconcile', 'Lead').",
        "adapt_platform": f"Re-structure the advertisement layout to conform precisely to {platform.upper()} standards.",
    }

    mode_guidance = instructions_map.get(rewrite_mode, "Refine advertisement quality.")
    if custom_instruction:
        mode_guidance += f" Additional guidance: {custom_instruction}"

    if ai_config.api_key and ai_config.api_key not in ["YOUR_OPENROUTER_API_KEY", "test_key", "none"]:
        system_prompt = (
            "You are a recruitment copy editor. Rewrite the provided advertisement following this exact goal: "
            f"'{mode_guidance}'.\n"
            "STRICT RULES: Keep every factual detail intact (title, location, experience, mandatory skills, responsibilities). "
            "Do not fabricate facts. Return ONLY the rewritten Markdown text."
        )
        user_prompt = f"Approved Job Requisition Title: {context.title}\nCurrent Content:\n{current_content}"
        try:
            result = chat_provider.complete(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                max_tokens=2200,
            )
            content = result.get("content", "").strip()
            if content and len(content) > 100:
                cleaned_rewrite = remove_duplicate_title_headings(
                    context.title, normalize_markdown_content(content)
                )
                return cleaned_rewrite, "nemotron_rewrite"
        except Exception:
            pass

    # Deterministic fallback rewrite
    normalized = normalize_markdown_content(current_content)
    if rewrite_mode == "concise":
        lines = [line for line in normalized.split("\n") if len(line.strip()) > 0][:25]
        return "\n\n".join(lines), "deterministic_concise_fallback"
    return normalized, "deterministic_rewrite_fallback"


def compare_advertisements(
    ad1_platform: str,
    ad1_content: str,
    ad2_platform: str,
    ad2_content: str,
) -> Dict[str, Any]:
    """Provide side-by-side comparison of platform advertisements highlighting structure, length, and keywords."""
    ad1_norm = normalize_markdown_content(ad1_content)
    ad2_norm = normalize_markdown_content(ad2_content)

    words1 = re.findall(r"\b[A-Za-z0-9+#./-]+\b", ad1_norm.lower())
    words2 = re.findall(r"\b[A-Za-z0-9+#./-]+\b", ad2_norm.lower())

    headings1 = re.findall(r"^#{1,6}\s*(.+)$", ad1_norm, re.MULTILINE)
    headings2 = re.findall(r"^#{1,6}\s*(.+)$", ad2_norm, re.MULTILINE)

    bullets1 = len([l for l in ad1_norm.split("\n") if l.startswith("• ")])
    bullets2 = len([l for l in ad2_norm.split("\n") if l.startswith("• ")])

    return {
        "platform_1": {
            "platform": ad1_platform,
            "word_count": len(words1),
            "character_count": len(ad1_norm),
            "heading_count": len(headings1),
            "headings": headings1,
            "bullet_count": bullets1,
        },
        "platform_2": {
            "platform": ad2_platform,
            "word_count": len(words2),
            "character_count": len(ad2_norm),
            "heading_count": len(headings2),
            "headings": headings2,
            "bullet_count": bullets2,
        },
        "content_similarity_pct": round(len(set(words1) & set(words2)) / max(len(set(words1) | set(words2)), 1) * 100, 1),
    }


def regenerate_advertisement_section(
    context: JobGenerationContext,
    platform: str,
    current_content: str,
    section: str,
) -> str:
    """Regenerate a specific section of an advertisement while preserving recruiter edits elsewhere."""
    sec = (section or "").lower().strip()
    if sec == "full" or not current_content.strip():
        ad_text, _, _ = generate_platform_advertisement(context, platform)
        return ad_text

    if sec == "overview":
        new_overview = extract_overview_from_text(context.source_text, context.title, context.role_domain, context.experience_display)
        pattern = r"(##\s*(?:About the Role|Role Overview|Position Summary)\s*\n)([\s\S]*?)(?=\n##|\Z)"
        if re.search(pattern, current_content, re.IGNORECASE):
            updated = re.sub(pattern, rf"\g<1>{new_overview}\n", current_content, count=1, flags=re.IGNORECASE)
        else:
            updated = f"{current_content}\n\n## About the Role\n{new_overview}\n"
        return remove_duplicate_title_headings(context.title, normalize_markdown_content(updated))

    if sec in ("skills", "competencies"):
        new_skills_lines = _format_skills_section(context, platform=platform)
        new_skills_block = "\n".join(new_skills_lines).strip()
        pattern = r"(##\s*(?:Required Skills & Competencies|Key Skills|Skills & Competencies|What We're Looking For)\b[^\n]*\n)([\s\S]*?)(?=\n##\s*(?!Preferred Skills)|\Z)"
        if re.search(pattern, current_content, re.IGNORECASE):
            updated = re.sub(pattern, f"{new_skills_block}\n\n", current_content, count=1, flags=re.IGNORECASE)
        else:
            resp_pattern = r"(##\s*Key Responsibilities[\s\S]*?)(?=\n##|\Z)"
            if re.search(resp_pattern, current_content, re.IGNORECASE):
                updated = re.sub(resp_pattern, rf"\g<1>\n\n{new_skills_block}\n", current_content, count=1, flags=re.IGNORECASE)
            else:
                updated = f"{current_content}\n\n{new_skills_block}\n"
        return remove_duplicate_title_headings(context.title, normalize_markdown_content(updated))

    ad_text, _, _ = generate_platform_advertisement(context, platform)
    return ad_text


def compute_posting_readiness(
    context: JobGenerationContext,
    versions: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Compute dynamic job posting readiness checklist across source JD and platform drafts."""
    checks: List[Dict[str, Any]] = []

    # 1. JD Approval Check
    checks.append({
        "id": "jd_approval",
        "category": "Source Governance",
        "label": "Approved Job Description",
        "status": "passed" if context.is_approved else "failed",
        "detail": f"JD is {'approved' if context.is_approved else 'pending recruiter approval (Version ' + str(context.jd_version) + ')'}.",
        "required": True,
    })

    # 2. Mandatory Skills Check
    has_skills = len(context.mandatory_skills) > 0
    checks.append({
        "id": "mandatory_skills",
        "category": "Qualifications",
        "label": "Mandatory Skills Defined",
        "status": "passed" if has_skills else "failed",
        "detail": f"{len(context.mandatory_skills)} mandatory skills recorded." if has_skills else "0 mandatory skills recorded in SQLite.",
        "required": True,
    })

    # 3. Location & Work Mode Check
    loc_ok = context.location and context.location.lower() not in ["not specified", "unspecified"]
    checks.append({
        "id": "location_specified",
        "category": "Employment Details",
        "label": "Location & Work Mode Clear",
        "status": "passed" if loc_ok else "warning",
        "detail": f"{context.location} ({context.work_mode})" if loc_ok else "Location is unspecified.",
        "required": False,
    })

    # 4. Experience Specified Check
    exp_ok = context.min_experience_years is not None
    checks.append({
        "id": "experience_specified",
        "category": "Qualifications",
        "label": "Experience Requirements Specified",
        "status": "passed" if exp_ok else "warning",
        "detail": context.experience_display,
        "required": False,
    })

    # 5. Platform Drafts Status
    generated_count = len(versions)
    approved_count = len([v for v in versions if v.get("status") == "Approved"])
    ready_count = len([v for v in versions if v.get("status") in ["Ready to Publish", "Published"]])
    
    checks.append({
        "id": "platform_drafts",
        "category": "Distribution Status",
        "label": "Platform Drafts Created",
        "status": "passed" if generated_count >= 1 else "warning",
        "detail": f"{generated_count} platform drafts generated ({approved_count} approved, {ready_count} published).",
        "required": True,
    })

    # Calculate overall readiness percentage
    passed_count = len([c for c in checks if c["status"] == "passed"])
    readiness_pct = int((passed_count / len(checks)) * 100)

    is_ready_to_publish = (
        context.is_approved
        and has_skills
        and generated_count > 0
        and approved_count > 0
    )

    return {
        "job_id": context.job_id,
        "job_title": context.title,
        "readiness_percentage": readiness_pct,
        "is_ready_to_publish": is_ready_to_publish,
        "checklist": checks,
        "summary": "Requisition is ready for multi-platform publishing." if is_ready_to_publish else "Complete missing items before publishing.",
    }


def _strip_markdown_asterisks(text: str) -> str:
    """Remove markdown bold asterisks and orphan asterisks for export."""
    cleaned = re.sub(r"(\b[\w\s/&-]+):\*\*", r"\1:", text)
    cleaned = re.sub(r"\*\*(.+?)\*\*", r"\1", cleaned)
    return cleaned.replace("*", "")


def export_advertisement_docx(title: str, content: str) -> bytes:
    """Generate a clean, styled Microsoft Word (.docx) document from advertisement content."""
    import io
    import docx

    clean_content = remove_duplicate_title_headings(title, content)
    doc = docx.Document()
    clean_title = _strip_markdown_asterisks(title or "Job Advertisement").strip()
    doc.add_heading(clean_title, level=1)

    for raw in clean_content.split("\n"):
        line = raw.strip()
        if not line:
            continue
        if line.startswith("#"):
            clean = re.sub(r"^#{1,6}\s*", "", line).strip()
            # If heading repeats title, skip
            if clean_title.lower() in clean.lower():
                continue
            doc.add_heading(_strip_markdown_asterisks(clean), level=2)
        elif line.startswith("•") or line.startswith("-") or line.startswith("*"):
            clean = re.sub(r"^[•\-\*]\s*", "", line).strip()
            doc.add_paragraph(_strip_markdown_asterisks(clean), style="List Bullet")
        else:
            doc.add_paragraph(_strip_markdown_asterisks(line))

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def export_advertisement_pdf(title: str, content: str) -> bytes:
    """Generate a formatted PDF document from advertisement content using PyMuPDF."""
    import pymupdf

    clean_content = remove_duplicate_title_headings(title, content)
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)  # Standard A4
    margin_x = 50
    content_width = 495
    max_y = 790
    y = 60

    # Header title
    clean_title = _strip_markdown_asterisks(title or "Job Advertisement")[:65].strip()
    page.insert_text((margin_x, y), clean_title, fontsize=16, fontname="helv", color=(0.06, 0.09, 0.16))
    y += 10
    page.draw_line(pymupdf.Point(margin_x, y), pymupdf.Point(margin_x + content_width, y), color=(0.01, 0.52, 0.78), width=1.5)
    y += 20

    for raw in clean_content.split("\n"):
        line = raw.strip()
        if not line:
            y += 8
            continue

        if y > max_y:
            page = doc.new_page(width=595, height=842)
            y = 50

        if line.startswith("#"):
            clean = re.sub(r"^#{1,6}\s*", "", line).strip()
            if clean_title.lower() in clean.lower():
                continue
            y += 6
            page.insert_text((margin_x, y), _strip_markdown_asterisks(clean), fontsize=12, fontname="helv", color=(0.09, 0.15, 0.25))
            y += 18
        elif line.startswith("•") or line.startswith("-") or line.startswith("*"):
            clean = re.sub(r"^[•\-\*]\s*", "", line).strip()
            clean_text = _strip_markdown_asterisks(clean)
            words = clean_text.split()
            current_line = "• "
            for word in words:
                if len(current_line) + len(word) + 1 > 95:
                    if y > max_y:
                        page = doc.new_page(width=595, height=842)
                        y = 50
                    page.insert_text((margin_x + 5, y), current_line, fontsize=10, fontname="helv", color=(0.2, 0.2, 0.2))
                    y += 14
                    current_line = "  " + word + " "
                else:
                    current_line += word + " "
            if current_line.strip():
                if y > max_y:
                    page = doc.new_page(width=595, height=842)
                    y = 50
                page.insert_text((margin_x + 5, y), current_line.rstrip(), fontsize=10, fontname="helv", color=(0.2, 0.2, 0.2))
                y += 14
        else:
            clean_text = _strip_markdown_asterisks(line)
            words = clean_text.split()
            current_line = ""
            for word in words:
                if len(current_line) + len(word) + 1 > 95:
                    if y > max_y:
                        page = doc.new_page(width=595, height=842)
                        y = 50
                    page.insert_text((margin_x, y), current_line, fontsize=10, fontname="helv", color=(0.25, 0.25, 0.25))
                    y += 14
                    current_line = word + " "
                else:
                    current_line += word + " "
            if current_line.strip():
                if y > max_y:
                    page = doc.new_page(width=595, height=842)
                    y = 50
                page.insert_text((margin_x, y), current_line.rstrip(), fontsize=10, fontname="helv", color=(0.25, 0.25, 0.25))
                y += 14

    return doc.tobytes()

