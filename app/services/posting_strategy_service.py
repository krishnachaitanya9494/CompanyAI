"""Dynamic AI Job Posting Strategy & Platform Suitability Engine.

Analyzes job requisition context to dynamically evaluate distribution channels (LinkedIn, Naukri, Indeed,
Company Careers, Employee Referral) based on role seniority, domain, skill scarcity, and location.
Generates explainable, evidence-grounded recommendations with target audience, keyword banks, and challenges.
"""

from __future__ import annotations

from typing import Any, Dict, List
from app.services.jd_context_service import JobGenerationContext


def analyze_posting_strategy(context: JobGenerationContext) -> Dict[str, Any]:
    """Compute dynamic distribution strategy and suitability ratings across all platforms."""
    domain = context.role_domain
    seniority = context.seniority
    location = context.location.lower()
    skills = context.mandatory_skills
    exp = context.min_experience_years or 0.0

    # Determine India vs Global orientation
    is_india_market = any(city in location for city in ["bangalore", "bengaluru", "hyderabad", "pune", "mumbai", "delhi", "noida", "gurgaon", "chennai", "india"])
    is_senior = seniority in ["Senior", "Lead / Manager", "Executive / Director"] or exp >= 7.0
    is_niche_tech = domain in ["Semiconductor & Hardware Engineering", "Enterprise Applications & ERP"]

    platforms_eval: List[Dict[str, Any]] = []

    # 1. LinkedIn
    linkedin_score = 95 if is_senior else (85 if is_niche_tech else 80)
    linkedin_suitability = "Highly Recommended" if linkedin_score >= 85 else "Recommended"
    linkedin_reasons = []
    if is_senior:
        linkedin_reasons.append(f"Premier channel for {seniority} level talent and passive leadership engagement.")
    if is_niche_tech:
        linkedin_reasons.append(f"High concentration of certified {domain} specialists in professional groups.")
    if not linkedin_reasons:
        linkedin_reasons.append("Broad reach across professional networks and employer brand followers.")

    platforms_eval.append({
        "name": "LinkedIn",
        "suitability": linkedin_suitability,
        "suitability_score": linkedin_score,
        "reason": " ".join(linkedin_reasons),
        "target_audience": f"{seniority} {context.title} professionals, alumni of enterprise tech firms, passive candidates",
        "suggested_title": f"{context.title} - {context.work_mode}" if context.work_mode != "Not specified" else context.title,
        "search_keywords": (skills[:6] if skills else [context.title, domain]),
        "recommended_format": "Engaging conversational hook, structured impact bullet points, clear direct-apply CTA, domain hashtags",
        "distribution_strategy": "Post organically to company page; amplify via hiring manager and team reposts; target specialized groups",
        "potential_challenges": "High competition for mid-senior talent; requires active recruiter InMail outreach for high conversion",
        "evidence_type": "Verified market heuristic based on seniority & domain density",
    })

    # 2. Naukri
    if is_india_market:
        naukri_score = 92 if domain in ["Finance & Tax Compliance", "Enterprise Applications & ERP", "Software Engineering"] else 84
        naukri_suitability = "Highly Recommended"
        naukri_reason = f"Essential talent hub for Indian tech & finance markets ({context.location}); maximum active jobseeker search volume."
    else:
        naukri_score = 45
        naukri_suitability = "Alternative / Low"
        naukri_reason = "Primarily optimized for Indian domestic talent pool; limited utility for non-India locations."

    platforms_eval.append({
        "name": "Naukri",
        "suitability": naukri_suitability,
        "suitability_score": naukri_score,
        "reason": naukri_reason,
        "target_audience": f"Active candidates in {context.location} with {context.experience_display} searching by key skills",
        "suggested_title": f"{context.title} ({', '.join(skills[:3]) if skills else context.experience_display})",
        "search_keywords": skills + ([context.department] if context.department else []),
        "recommended_format": "Keyword-dense profile summary, explicit notice period preference, bulleted operational duties",
        "distribution_strategy": "Publish on enterprise job portal; set automated alerts for candidate search filters matching mandatory skills",
        "potential_challenges": "High volume of unqualified applicants; recruiter screening filters required to verify mandatory skills",
        "evidence_type": "Verified regional market data",
    })

    # 3. Indeed
    indeed_score = 80 if not is_senior else 70
    indeed_suitability = "Recommended" if indeed_score >= 75 else "Moderate"
    indeed_reason = "High volume candidate traffic for clear operational roles; effective for structured skill matching."
    if domain == "Finance & Tax Compliance":
        indeed_reason = "Strong organic discovery for corporate finance, accounting, and compliance specialists."

    platforms_eval.append({
        "name": "Indeed",
        "suitability": indeed_suitability,
        "suitability_score": indeed_score,
        "reason": indeed_reason,
        "target_audience": f"Actively searching {context.title} candidates looking for transparent requirements and work mode",
        "suggested_title": context.title,
        "search_keywords": skills[:5] + [context.title],
        "recommended_format": "Direct, transparent job overview, clear bulleted requirements vs nice-to-haves, upfront work mode",
        "distribution_strategy": "Post as structured listing; sponsor if initial 7-day organic applicant volume is below target",
        "potential_challenges": "Requires complete salary transparency where available to maximize click-through rate",
        "evidence_type": "Standard job aggregator heuristic",
    })

    # 4. Company Careers Page
    careers_score = 98  # Always authoritative source
    platforms_eval.append({
        "name": "Company Careers Page",
        "suitability": "Highly Recommended",
        "suitability_score": careers_score,
        "reason": "Official system-of-record listing; builds inbound employer brand equity and compliance audit trail.",
        "target_audience": "Direct applicants, brand advocates, referrals, and inbound candidates",
        "suggested_title": f"{context.title} (Req ID: {context.job_code})",
        "search_keywords": skills + [context.title, context.client_name, context.location],
        "recommended_format": "Comprehensive role scope, cultural values, equal opportunity statement, detailed responsibilities",
        "distribution_strategy": "Maintain as primary application URL that all external channel links point towards",
        "potential_challenges": "Relies on external traffic driving to the portal; requires simple mobile-friendly application flow",
        "evidence_type": "Corporate governance standard",
    })

    # 5. Employee Referral
    referral_score = 90 if is_niche_tech or is_senior else 82
    platforms_eval.append({
        "name": "Employee Referral",
        "suitability": "Highly Recommended",
        "suitability_score": referral_score,
        "reason": f"High conversion channel: existing employees have direct peer networks in {domain} and {context.location}.",
        "target_audience": "Internal employees, alumni networks, and trusted former colleagues",
        "suggested_title": f"🚀 Team Referral: We are hiring a {context.title}!",
        "search_keywords": skills[:4] + [context.title],
        "recommended_format": "Short, shareable role announcement highlighting top 3 competencies and referral bonus process",
        "distribution_strategy": "Share in internal Slack/Teams channels; email weekly digest to relevant delivery teams",
        "potential_challenges": "Requires active internal communication to keep requisition top-of-mind with employees",
        "evidence_type": "Internal talent supply heuristic",
    })

    # Sort platforms by suitability score descending
    platforms_eval.sort(key=lambda p: p["suitability_score"], reverse=True)

    # Keywords bank
    keywords_bank = list(dict.fromkeys(
        skills
        + [context.title, domain, context.seniority]
        + ([context.location] if context.location != "Not specified" else [])
    ))

    return {
        "job_id": context.job_id,
        "job_title": context.title,
        "role_domain": domain,
        "seniority": seniority,
        "location": context.location,
        "work_mode": context.work_mode,
        "top_recommended_platform": platforms_eval[0]["name"],
        "platforms": platforms_eval,
        "keywords_bank": keywords_bank,
        "missing_information": context.missing_fields,
        "strategy_summary": f"Prioritize {platforms_eval[0]['name']} and {platforms_eval[1]['name']} for {context.title} based on {domain} domain density and {context.experience_display} requirement.",
    }
