# Import math for finite numerical operations, ceiling, and rounding.
import math
# Import re for regex parsing, token extraction, and evidence window slicing.
import re
from collections import defaultdict
# Import Path for reading local resume document files.
from pathlib import Path
# Import typing helpers for signatures, mappings, and data collections.
from typing import Any, Dict, List, Optional, Sequence, Tuple, Set
# Import dataclass for typed data representations.
from dataclasses import dataclass, field
# Import Pydantic models for validation of filter schemas and scoring weights.
from pydantic import BaseModel, Field as PydanticField
# Import SQLAlchemy expressions and Session.
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import Session

# Import database models for candidates, resumes, jobs, segmentations, and embeddings.
from database.models import (
    Candidate,
    Resume,
    ResumeEmbedding,
    Job,
    JDSegmentation,
    JobRequirement,
    JobEmbedding,
)
# Import cosine similarity calculator from the semantic search module.
from app.semantic_search import cosine_similarity
# Import standard 15 recruitment categories and category display labels.
from app.services.jd_segmentation_service import (
    STANDARD_15_CATEGORIES,
    CATEGORY_LABELS,
)
# Import document resume text extractor.
from app.resume_extractor import extract_resume_text

# In-memory text cache keyed by SHA-256 and file path to avoid redundant disk I/O.
_RESUME_TEXT_CACHE: Dict[str, str] = {}

# Standard English and recruitment stopwords to prevent false-positive keyword matching.
STOPWORDS: Set[str] = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
    "can", "cannot", "could", "did", "do", "does", "doing", "don't", "down", "during", "each", "few",
    "for", "from", "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself",
    "him", "himself", "his", "how", "i", "if", "in", "into", "is", "isn't", "it", "its", "itself",
    "let's", "me", "more", "most", "must", "my", "myself", "no", "nor", "not", "of", "off", "on", "once",
    "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "she",
    "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves",
    "then", "there", "these", "they", "this", "those", "through", "to", "too", "under", "until", "up",
    "very", "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why", "with",
    "would", "you", "your", "yours", "yourself", "yourselves",
    # Boilerplate JD vocabulary that should never match candidate skills by itself
    "looking", "experienced", "experience", "years", "candidate", "candidates", "role", "scope",
    "responsibility", "responsibilities", "responsible", "qualification", "qualifications", "proficient",
    "proficiency", "demonstrated", "knowledge", "expertise", "strong", "ability", "skills", "skill",
    "implement", "implementing", "configure", "configuring", "support", "supporting", "design", "designing",
    "develop", "developing", "work", "working", "team", "teams", "lead", "leading", "required", "preferred",
    "mandatory", "section", "line", "source", "title", "must", "have", "nice", "plus"
}

# 5 categories that represent verifiable technical competencies and skills.
SKILL_CATEGORIES: Set[str] = {
    "mandatory_skills",
    "preferred_skills",
    "technical_skills",
    "tools_and_technologies",
    "domain_knowledge",
}


# Schema for customizable deterministic scoring weights.
class MatchScoreWeights(BaseModel):
    # Mandatory skills component weight (default 35%).
    mandatory_skills: float = PydanticField(default=0.35, ge=0.0, le=1.0, description="Mandatory skills weight")
    # Preferred skills component weight (default 15%).
    preferred_skills: float = PydanticField(default=0.15, ge=0.0, le=1.0, description="Preferred skills weight")
    # Relevant experience component weight (default 20%).
    relevant_experience: float = PydanticField(default=0.20, ge=0.0, le=1.0, description="Relevant experience weight")
    # Responsibilities and domain fit component weight (default 15%).
    domain_fit: float = PydanticField(default=0.15, ge=0.0, le=1.0, description="Responsibilities and domain fit weight")
    # Vector semantic relevance component weight (default 15%).
    semantic_relevance: float = PydanticField(default=0.15, ge=0.0, le=1.0, description="Vector semantic relevance weight")

    # Helper method to normalize weights so they sum strictly to 1.0.
    def normalized(self) -> "MatchScoreWeights":
        # Calculate raw sum of all component weights.
        total = (
            self.mandatory_skills
            + self.preferred_skills
            + self.relevant_experience
            + self.domain_fit
            + self.semantic_relevance
        )
        # Avoid division by zero if all weights are zero.
        if total <= 0:
            # Return equal weights if zero sum provided.
            return MatchScoreWeights(
                mandatory_skills=0.35,
                preferred_skills=0.15,
                relevant_experience=0.20,
                domain_fit=0.15,
                semantic_relevance=0.15,
            )
        # Return scaled weights summing strictly to 1.0.
        return MatchScoreWeights(
            mandatory_skills=self.mandatory_skills / total,
            preferred_skills=self.preferred_skills / total,
            relevant_experience=self.relevant_experience / total,
            domain_fit=self.domain_fit / total,
            semantic_relevance=self.semantic_relevance / total,
        )


# Schema for structured SQL candidate filtering and search criteria.
class CandidateMatchingFilters(BaseModel):
    # Minimum experience in years.
    min_experience: Optional[float] = PydanticField(default=None, description="Minimum experience filter")
    # Maximum experience in years.
    max_experience: Optional[float] = PydanticField(default=None, description="Maximum experience filter")
    # Geographic location substring filter.
    location: Optional[str] = PydanticField(default=None, description="Candidate location filter")
    # Availability notice period filter.
    availability: Optional[str] = PydanticField(default=None, description="Availability notice filter")
    # Candidate recruitment stage filter.
    stage: Optional[str] = PydanticField(default=None, description="Recruitment pipeline stage filter")
    # Specific required skill tags filter (candidate must have at least one or all).
    skills: Optional[List[str]] = PydanticField(default=None, description="Specific skill tags filter")
    # Minimum overall match score threshold (0-100).
    min_score: Optional[float] = PydanticField(default=None, ge=0.0, le=100.0, description="Minimum score filter")
    # Free-text search string for name, skills, or summary.
    search: Optional[str] = PydanticField(default=None, description="Free text search filter")
    # Sort column: match_score, experience, name, similarity.
    sort_by: str = PydanticField(default="match_score", description="Sort field")
    # Sort direction: desc or asc.
    sort_order: str = PydanticField(default="desc", description="Sort order: desc or asc")


# Structure representing an individual evaluated requirement for a candidate.
@dataclass
class RequirementMatchItem:
    # Identifier of the job requirement row.
    requirement_id: int
    # 15-category code.
    category: str
    # Human-readable category label.
    category_label: str
    # Importance classification: Mandatory or Preferred.
    classification: str
    # Original text requirement from JD.
    original_text: str
    # Evaluation status: SATISFIED, GAP, UNVERIFIED.
    status: str
    # Verification level: VERIFIED, PARTIALLY_SUPPORTED, UNVERIFIED, NO_EVIDENCE.
    verification_status: str
    # Source provenance of evidence: resume_text, candidate_skills, candidate_summary, semantic_vector, none.
    evidence_source: str
    # Confidence in status determination (0.0 to 1.0).
    confidence: float
    # Verbatim or context evidence snippet from resume/profile.
    evidence: str
    # Resume filename or reference.
    resume_reference: str
    # Explanation note for recruiter.
    notes: str


# Structure representing a fully evaluated candidate match against a job.
@dataclass
class CandidateMatchResult:
    # Candidate integer primary key.
    candidate_id: int
    # Formatted display code (e.g. cand-042).
    code: str
    # Full candidate name.
    name: str
    # Contact email address.
    email: str
    # Contact telephone number.
    phone: str
    # Extracted professional title.
    current_role: str
    # Total experience in years.
    experience_years: float
    # Geographic location.
    location: str
    # Availability notice period.
    availability: str
    # Recruitment pipeline stage.
    stage: str
    # Overall deterministic match score (0-100).
    match_score: int
    # Vector cosine similarity float in [-1.0, 1.0].
    similarity: float
    # Categorical tier classification (eligibility-adjusted).
    classification: str
    # Dictionary of component scores.
    component_scores: Dict[str, float]
    # Detailed list of evaluated requirements.
    requirements: List[RequirementMatchItem]
    # Highlighted evidence excerpts.
    evidence_highlights: List[str]
    # Recruiter explanation structure.
    explanations: Dict[str, Any]
    # Winning resume ID that produced this evaluation.
    winning_resume_id: Optional[int]
    # Winning resume filename.
    winning_resume_filename: str
    # Candidate skills list.
    skills: List[str]
    # Raw deterministic match score before any eligibility adjustments (0-100).
    raw_score: int = 0
    # Match tier derived strictly from raw score without eligibility downgrade.
    score_based_tier: str = "Needs Review"
    # Final match tier after applying mandatory requirement protection policy.
    eligibility_adjusted_tier: str = "Needs Review"
    # Detailed narrative documenting mandatory requirement compliance or gaps.
    critical_gap_explanation: str = ""
    # Raw unscaled vector cosine similarity in [-1.0, 1.0].
    raw_cosine_similarity: float = 0.0
    # Flag indicating whether candidate has any unmet mandatory requirements.
    has_critical_gap: bool = False
    # Number of mandatory requirement gaps.
    mandatory_gap_count: int = 0
    # Number of unverified mandatory requirements.
    mandatory_unverified_count: int = 0


# Retrieve active approved segmentation for a job, falling back to latest segmentation if unapproved.
def get_active_approved_segmentation(db: Session, job_id: int) -> Optional[JDSegmentation]:
    # Query approved segmentation with highest version and highest ID.
    approved_seg = (
        db.query(JDSegmentation)
        .filter(JDSegmentation.job_id == job_id, JDSegmentation.is_approved == 1)
        .order_by(JDSegmentation.version.desc(), JDSegmentation.id.desc())
        .first()
    )
    # If approved segmentation found, return it immediately.
    if approved_seg:
        return approved_seg
    # Fallback to the latest available segmentation for this job.
    latest_seg = (
        db.query(JDSegmentation)
        .filter(JDSegmentation.job_id == job_id)
        .order_by(JDSegmentation.version.desc(), JDSegmentation.id.desc())
        .first()
    )
    # Return latest segmentation or None if no segmentations exist.
    return latest_seg


# Retrieve stored job embeddings for a segmentation, returning full JD vector and requirement vectors map.
def get_segmentation_embeddings_map(
    db: Session, segmentation_id: int
) -> Tuple[Optional[JobEmbedding], Dict[int, JobEmbedding]]:
    # Query only genuine Nemotron embeddings stored for this segmentation.
    embeddings = (
        db.query(JobEmbedding)
        .filter(
            JobEmbedding.segmentation_id == segmentation_id,
            JobEmbedding.generation_method == "nemotron_api",
        )
        .all()
    )
    # Initialize container for full JD embedding.
    full_jd_emb: Optional[JobEmbedding] = None
    # Initialize dictionary mapping requirement_id to its JobEmbedding.
    req_emb_map: Dict[int, JobEmbedding] = {}
    # Iterate through each stored job embedding record.
    for emb in embeddings:
        # Check if embedding represents the full JD document.
        if emb.embedding_type == "full_jd" or emb.requirement_id is None:
            # Assign full JD embedding.
            full_jd_emb = emb
        else:
            # Assign requirement embedding mapped by requirement integer key.
            req_emb_map[emb.requirement_id] = emb
    # Return tuple of full JD embedding and requirement embeddings dictionary.
    return full_jd_emb, req_emb_map


# Extract readable text from candidate resume on disk alongside provenance flag without poisoning cache.
def get_resume_text_and_provenance(resume: Resume, candidate: Candidate, load_disk: bool = True) -> Tuple[str, bool]:
    # Check memory cache strictly for verified extracted resume document text.
    if resume.content_sha256 and resume.content_sha256 in _RESUME_TEXT_CACHE:
        # Return cached disk-extracted resume text with verified disk provenance.
        return _RESUME_TEXT_CACHE[resume.content_sha256], True
    # Check memory cache by file path for previously extracted document text.
    if resume.file_path and resume.file_path in _RESUME_TEXT_CACHE:
        # Return cached disk-extracted resume text with verified disk provenance.
        return _RESUME_TEXT_CACHE[resume.file_path], True

    # Initialize extracted disk text container and provenance flag.
    text_content = ""
    has_disk_text = False

    # Parse document from local filesystem only when disk loading is requested and file exists.
    if load_disk and resume.file_path:
        # Resolve local path safely.
        file_path_obj = Path(resume.file_path)
        if file_path_obj.is_file():
            try:
                # Extract raw text content from PDF, DOCX, DOC, or TXT resume document.
                extracted = extract_resume_text(file_path_obj)
                text_content = extracted.get("text", "")
                # Mark genuine disk extraction only when non-empty document text was obtained.
                if text_content and text_content.strip():
                    has_disk_text = True
            except Exception:
                # Clear extracted text cleanly on parser failure without fabricating content.
                text_content = ""
                has_disk_text = False

    # Store ONLY verified disk-extracted resume text in the shared cache so fallback profile strings never poison disk reads.
    if has_disk_text:
        if resume.content_sha256:
            _RESUME_TEXT_CACHE[resume.content_sha256] = text_content
        if resume.file_path:
            _RESUME_TEXT_CACHE[resume.file_path] = text_content

    # Return disk text (or empty string if disk not read/unavailable) alongside exact provenance flag.
    return text_content, has_disk_text


# Backwards-compatible wrapper returning extracted resume text or candidate profile summary text.
def get_cached_resume_text(resume: Resume, candidate: Candidate, load_disk: bool = True) -> str:
    # Attempt to read verified disk resume text first.
    disk_text, has_disk = get_resume_text_and_provenance(resume, candidate, load_disk=load_disk)
    if has_disk:
        return disk_text
    # Assemble read-only summary fallback string without writing it into disk cache.
    parts = [
        f"Summary: {candidate.summary or ''}",
        f"Skills: {', '.join(candidate.skills or [])}",
    ]
    return "\n".join(parts)


# Extract a verbatim evidence snippet matching a given query or keywords from resume text.
def find_evidence_snippet(text: str, keywords: List[str], max_chars: int = 240) -> Optional[str]:
    # Reject empty text or empty keyword list.
    if not text or not keywords:
        return None
    # Normalize text to lower case for case-insensitive search.
    text_lower = text.lower()
    # Search for each keyword in text.
    for kw in keywords:
        # Clean keyword string.
        cleaned_kw = kw.strip().lower()
        # Skip trivial or empty keywords and stopwords.
        if len(cleaned_kw) < 3 or cleaned_kw in STOPWORDS:
            continue
        # Find position of keyword in text.
        idx = text_lower.find(cleaned_kw)
        # If found in text, extract surrounding window.
        if idx != -1:
            # Calculate window start index.
            start = max(0, idx - 50)
            # Calculate window end index.
            end = min(len(text), idx + len(cleaned_kw) + max_chars - 50)
            # Extract substring slice.
            snippet = text[start:end].strip()
            # Collapse internal repeated whitespace.
            snippet = re.sub(r"\s+", " ", snippet)
            # Add ellipsis prefix if truncated at start.
            if start > 0:
                snippet = "..." + snippet
            # Add ellipsis suffix if truncated at end.
            if end < len(text):
                snippet = snippet + "..."
            # Return cleaned evidence snippet.
            return snippet
    # Return None if no keywords were matched in text.
    return None


# Classify match tier from deterministic 0-100 score.
def classify_match_tier(score: int) -> str:
    # Check for Excellent Match range (88-100).
    if score >= 88:
        return "Excellent Match"
    # Check for Strong Match range (75-87).
    if score >= 75:
        return "Strong Match"
    # Check for Potential Match range (60-74).
    if score >= 60:
        return "Potential Match"
    # Check for Partial Match range (45-59).
    if score >= 45:
        return "Partial Match"
    # Default to Needs Review for low scores (<45).
    return "Needs Review"


# Evaluate candidate match against a specific resume vector and job requirements.
def evaluate_resume_candidate_match(
    candidate: Candidate,
    resume: Resume,
    resume_vector: List[float],
    job: Job,
    segmentation: Optional[JDSegmentation],
    requirements: List[JobRequirement],
    full_jd_emb: Optional[JobEmbedding],
    req_emb_map: Dict[int, JobEmbedding],
    weights: MatchScoreWeights,
    load_disk_text: bool = True,
) -> CandidateMatchResult:
    # Retrieve genuine disk resume text and boolean provenance without mixing profile fallback into cache.
    resume_text, has_disk_text = get_resume_text_and_provenance(resume, candidate, load_disk=load_disk_text)
    # Compile candidate skills in lower case for fast lookup.
    candidate_skills_lower = [s.lower() for s in (candidate.skills or [])]

    # Compute full JD semantic vector similarity if vector is available.
    raw_cosine = 0.0
    # Check if full JD embedding exists and has valid coordinates.
    if full_jd_emb and full_jd_emb.embedding_vector and resume_vector:
        try:
            # Calculate unscaled cosine similarity across 2048 dimensions without artificial floor.
            raw_cosine = float(cosine_similarity(full_jd_emb.embedding_vector, resume_vector))
        except Exception:
            # Fallback to zero similarity on arithmetic failure.
            raw_cosine = 0.0
    # Retain raw unscaled cosine similarity in [-1.0, 1.0].
    vector_similarity = raw_cosine

    # Initialize container for requirement match evaluations.
    evaluated_reqs: List[RequirementMatchItem] = []
    # Track counts for technical skills scoring.
    mandatory_total = 0
    mandatory_satisfied = 0
    mandatory_unverified = 0
    preferred_total = 0
    preferred_satisfied = 0
    preferred_unverified = 0
    evidence_highlights: List[str] = []

    # Check whether segmentation requirements include any verifiable technical skill categories.
    has_skill_categories = any(r.category in SKILL_CATEGORIES for r in requirements)
    # If no structured skill requirements exist (e.g., empty segmentation or overview-only draft), synthesize from job skills.
    if not requirements or not has_skill_categories:
        # Preserve any non-skill segmentation requirements while supplementing with operational job skills.
        synthetic_reqs: List[JobRequirement] = list(requirements)
        for idx, req_sk in enumerate(job.required_skills or []):
            synthetic_reqs.append(
                JobRequirement(
                    id=-(idx + 1),
                    category="mandatory_skills",
                    classification="Mandatory",
                    original_text=f"Demonstrated proficiency in {req_sk}",
                    normalized_skill=req_sk,
                    confidence=0.95,
                    order_index=len(synthetic_reqs) + idx,
                )
            )
        for idx, pref_sk in enumerate(job.preferred_skills or []):
            synthetic_reqs.append(
                JobRequirement(
                    id=-(len(job.required_skills or []) + idx + 1),
                    category="preferred_skills",
                    classification="Preferred",
                    original_text=f"Experience with {pref_sk}",
                    normalized_skill=pref_sk,
                    confidence=0.85,
                    order_index=len(synthetic_reqs) + idx,
                )
            )
        requirements = synthetic_reqs

    # Evaluate each requirement against candidate skills and resume text.
    for req in requirements:
        is_mandatory = req.classification.lower() == "mandatory"
        is_skill_category = req.category in SKILL_CATEGORIES

        # Only verifiable skills increment mandatory_total or preferred_total
        if is_skill_category:
            if is_mandatory:
                mandatory_total += 1
            else:
                preferred_total += 1

        # Extract keyword candidates for this requirement using word-boundary splitters so 'and'/'with' never break words.
        keywords = []
        if req.normalized_skill:
            keywords.append(req.normalized_skill.strip())
        else:
            clean_text = re.sub(r'\[.*?\]', '', req.original_text)
            raw_tokens = re.split(r"[,;•\n/]+|\band\b|\bwith\b", clean_text, flags=re.IGNORECASE)
            for t in raw_tokens:
                trimmed = t.strip()
                if len(trimmed) >= 3 and trimmed.lower() not in STOPWORDS:
                    keywords.append(trimmed)

        # Check for skill match in candidate's structured skills.
        skill_matched = False
        matched_skill_name = ""
        for cand_sk in candidate_skills_lower:
            for kw in keywords:
                kw_lower = kw.lower()
                if kw_lower == cand_sk or (len(kw_lower) >= 4 and kw_lower in cand_sk) or (len(cand_sk) >= 4 and cand_sk in kw_lower):
                    skill_matched = True
                    matched_skill_name = cand_sk
                    break
            if skill_matched:
                break

        # Check for requirement embedding cosine similarity if available.
        req_emb = req_emb_map.get(req.id)
        req_cosine = 0.0
        if req_emb and req_emb.embedding_vector and resume_vector:
            try:
                raw_sim = cosine_similarity(req_emb.embedding_vector, resume_vector)
                req_cosine = max(0.0, min(1.0, raw_sim))
            except Exception:
                req_cosine = 0.0

        # Search for verbatim text evidence strictly in genuine disk resume document when available.
        disk_snippet = find_evidence_snippet(resume_text, keywords) if (has_disk_text and keywords) else None
        # Search candidate profile summary separately so profile text is never mislabeled as a disk resume quote.
        summary_snippet = find_evidence_snippet(candidate.summary or "", keywords) if (disk_snippet is None and keywords) else None

        # Determine requirement status: SATISFIED, GAP, UNVERIFIED.
        status = "UNVERIFIED"
        confidence = 0.60
        verification_status = "UNVERIFIED"
        evidence_source = "unverified"
        notes = ""

        # Condition 1: Candidate skill matched or verbatim resume/profile text snippet corroborated.
        if skill_matched or disk_snippet is not None or summary_snippet is not None:
            status = "SATISFIED"
            if disk_snippet is not None:
                # Genuine verbatim quote extracted directly from candidate's resume document on disk.
                confidence = 0.95 if skill_matched else 0.85
                verification_status = "VERIFIED"
                evidence_source = "resume_text"
                notes = "Verified via verbatim excerpt in candidate resume."
                final_evidence = disk_snippet
                evidence_highlights.append(f"{req.normalized_skill or req.original_text[:35]}: \"{disk_snippet}\"")
            elif summary_snippet is not None and skill_matched:
                # Both structured skill tag and indexed summary mention the requirement.
                confidence = 0.82
                verification_status = "PARTIALLY_SUPPORTED"
                evidence_source = "candidate_summary"
                notes = f"Supported by candidate skill tag '{matched_skill_name}' and indexed profile summary."
                final_evidence = summary_snippet
            elif skill_matched:
                # Structured candidate profile skill tag corroboration without verbatim resume quote.
                confidence = 0.80
                verification_status = "PARTIALLY_SUPPORTED"
                evidence_source = "candidate_skills"
                notes = f"Corroborated by candidate structured skill tag '{matched_skill_name}'."
                final_evidence = f"Candidate profile lists skill tag '{matched_skill_name}'."
            else:
                # Profile summary mention only without structured tag or disk resume quote.
                confidence = 0.72
                verification_status = "PARTIALLY_SUPPORTED"
                evidence_source = "candidate_summary"
                notes = "Corroborated by indexed candidate profile summary; confirm depth during interview."
                final_evidence = summary_snippet

            if is_skill_category:
                if is_mandatory:
                    mandatory_satisfied += 1
                else:
                    preferred_satisfied += 1

        # Condition 2: Clear GAP if requirement is completely absent from skills, text, and strong vector match.
        elif not skill_matched and disk_snippet is None and summary_snippet is None and req_cosine < 0.45:
            # Mark requirement gap.
            status = "GAP"
            # High confidence of absence in indexed sources.
            confidence = 0.85
            # Set NO_EVIDENCE verification level.
            verification_status = "NO_EVIDENCE"
            # Provenance source is none.
            evidence_source = "none"
            # Human-readable note explicitly clarifying indexed sources scope.
            notes = "No evidence found in indexed sources; requirement not evident in candidate skills or resume document."
            # Honest evidence string without misleading omissions.
            final_evidence = "No evidence found in indexed sources."

        # Condition 3: UNVERIFIED when semantic alignment exists (>= 0.45) without verified text/skill proof.
        else:
            # Never falsely mark pure semantic similarity as SATISFIED evidence.
            status = "UNVERIFIED"
            # Moderate confidence scaled gently by cosine alignment, awaiting human screening.
            confidence = 0.68 if req_cosine >= 0.75 else 0.50
            # Set UNVERIFIED verification level.
            verification_status = "UNVERIFIED"
            # Record semantic retrieval signal separately from resume text evidence.
            evidence_source = "semantic_vector" if req_cosine >= 0.75 else "unverified"
            # Note stating interviewer validation is required.
            notes = f"Semantic vector alignment ({req_cosine:.2f}) without explicit text match; requires recruiter verification during interview."
            # Honest evidence instruction.
            final_evidence = "Semantic retrieval signal only — verify requirement explicitly during interview."
            if is_skill_category:
                if is_mandatory:
                    mandatory_unverified += 1
                else:
                    preferred_unverified += 1

        # Append evaluated requirement item.
        evaluated_reqs.append(
            RequirementMatchItem(
                requirement_id=req.id,
                category=req.category,
                category_label=CATEGORY_LABELS.get(req.category, req.category.replace("_", " ").title()),
                classification=req.classification,
                original_text=req.original_text,
                status=status,
                verification_status=verification_status,
                evidence_source=evidence_source,
                confidence=confidence,
                evidence=final_evidence,
                resume_reference=resume.source_filename,
                notes=notes,
            )
        )

    # 1. Mandatory Skills Score (0-100):
    if mandatory_total > 0:
        mand_score = ((mandatory_satisfied + (mandatory_unverified * 0.35)) / mandatory_total) * 100.0
    else:
        mand_score = 100.0
    mand_score = max(0.0, min(100.0, mand_score))

    # 2. Preferred Skills Score (0-100):
    if preferred_total > 0:
        pref_score = ((preferred_satisfied + (preferred_unverified * 0.25)) / preferred_total) * 100.0
    else:
        pref_score = 100.0
    pref_score = max(0.0, min(100.0, pref_score))

    # 3. Relevant Experience Score (0-100):
    cand_exp = candidate.experience_years or 0.0
    min_exp = job.min_experience_years or 0.0
    max_exp = job.max_experience_years or 15.0

    has_domain_relevance = (mandatory_satisfied > 0 or preferred_satisfied > 0)
    if min_exp > 0:
        if has_domain_relevance:
            if cand_exp >= min_exp:
                exp_score = 100.0
                if cand_exp > max_exp + 5.0:
                    exp_score = 90.0
            else:
                exp_score = (cand_exp / min_exp) * 85.0
        else:
            exp_score = min(35.0, (cand_exp / max(1.0, min_exp)) * 35.0)
    else:
        exp_score = 90.0 if has_domain_relevance else 40.0
    exp_score = max(0.0, min(100.0, exp_score))

    # 4. Responsibilities and Domain Fit Score (0-100):
    domain_match_count = 0
    domain_checks = [job.title or "", job.department or ""]
    domain_tokens = [w for w in re.findall(r'\b[a-zA-Z]{3,}\b', " ".join(domain_checks).lower()) if w not in STOPWORDS]
    cand_profile_text = f"{candidate.summary or ''} {' '.join(candidate.skills or [])}".lower()
    for token in domain_tokens:
        if token in cand_profile_text:
            domain_match_count += 1

    if domain_tokens:
        domain_score = min(100.0, (domain_match_count / max(1, len(domain_tokens))) * 100.0)
    else:
        domain_score = 50.0

    if has_domain_relevance:
        domain_score = max(domain_score, 40.0)
    domain_score = round(max(0.0, min(100.0, domain_score)), 1)

    # 5. Semantic Relevance Score (0-100):
    # Non-negative component score derived from vector similarity (negative cosine yields 0.0 component pts).
    semantic_score = max(0.0, min(100.0, vector_similarity * 100.0))

    # Deterministic weighted total score calculation.
    norm_w = weights.normalized()
    total_raw_score = (
        (norm_w.mandatory_skills * mand_score)
        + (norm_w.preferred_skills * pref_score)
        + (norm_w.relevant_experience * exp_score)
        + (norm_w.domain_fit * domain_score)
        + (norm_w.semantic_relevance * semantic_score)
    )
    # Raw deterministic match score bounded to [0, 100].
    raw_score = int(round(max(0.0, min(100.0, total_raw_score))))
    # Baseline match tier derived strictly from raw score.
    score_based_tier = classify_match_tier(raw_score)

    # Mandatory Requirement Protection Policy:
    # Identify verified mandatory requirement gaps in skill categories.
    mandatory_gaps = [
        r for r in evaluated_reqs
        if r.classification.lower() == "mandatory" and r.status == "GAP" and r.category in SKILL_CATEGORIES
    ]
    mandatory_gap_count = len(mandatory_gaps)
    # Identify unverified mandatory requirements needing interview confirmation.
    mandatory_unverified_items = [
        r for r in evaluated_reqs
        if r.classification.lower() == "mandatory" and r.status == "UNVERIFIED" and r.category in SKILL_CATEGORIES
    ]
    mandatory_unverified_count = len(mandatory_unverified_items)
    has_critical_gap = mandatory_gap_count > 0

    # Determine eligibility-adjusted tier while keeping raw score strictly unchanged.
    eligibility_adjusted_tier = score_based_tier
    if mandatory_gap_count == 1:
        # Exactly one mandatory gap caps tier at Potential Match.
        if score_based_tier in ("Excellent Match", "Strong Match"):
            eligibility_adjusted_tier = "Potential Match"
    elif mandatory_gap_count >= 2:
        # Multiple mandatory gaps caps tier at Partial Match.
        if score_based_tier in ("Excellent Match", "Strong Match", "Potential Match"):
            eligibility_adjusted_tier = "Partial Match"

    # Formulate explicit critical gap explanation without ambiguity.
    if mandatory_gap_count > 0:
        # Extract concise requirement descriptions for unmet mandatory items.
        gap_names = [g.original_text[:35] for g in mandatory_gaps]
        critical_gap_explanation = (
            f"Candidate has {mandatory_gap_count} unmet mandatory requirement(s): {', '.join(gap_names)}. "
            f"Eligibility tier adjusted from {score_based_tier} to {eligibility_adjusted_tier}. "
            "Recruiter review required before shortlisting."
        )
    elif mandatory_unverified_count > 0:
        # Extract concise requirement descriptions for unverified items needing interview validation.
        unverified_names = [u.original_text[:35] for u in mandatory_unverified_items]
        critical_gap_explanation = (
            f"All verifiable mandatory requirements met, but {mandatory_unverified_count} mandatory requirement(s) "
            f"require interview confirmation: {', '.join(unverified_names)}."
        )
    else:
        critical_gap_explanation = (
            f"All {mandatory_total} mandatory technical requirements satisfied. Fully eligible for {score_based_tier}."
        )

    # Compile recruiter explanations.
    why_matched = []
    missing_requirements = []
    needs_verification = []

    if mandatory_satisfied > 0:
        why_matched.append(f"Satisfies {mandatory_satisfied} of {mandatory_total} mandatory technical skills.")
    if cand_exp >= min_exp and min_exp > 0 and has_domain_relevance:
        why_matched.append(f"Meets experience criteria with {cand_exp:.1f} years (minimum required: {min_exp:.1f} years).")
    if vector_similarity >= 0.70:
        why_matched.append(f"High semantic vector alignment ({vector_similarity:.4f} Semantic Similarity) with role description.")

    for r in evaluated_reqs:
        if r.status == "GAP":
            missing_requirements.append(f"Missing {r.classification.lower()} requirement: {r.original_text[:90]}")
        elif r.status == "UNVERIFIED":
            needs_verification.append(f"Verify in interview: {r.original_text[:90]}")

    if has_critical_gap:
        # Extract concise requirement descriptions for narrative summary.
        gap_names = [g.original_text[:35] for g in mandatory_gaps]
        summary_narrative = (
            f"{candidate.name} achieved a raw score of {raw_score}% ({score_based_tier}) with an eligibility-adjusted tier of "
            f"{eligibility_adjusted_tier} due to {mandatory_gap_count} unmet mandatory requirement(s): "
            f"{', '.join(gap_names)}. Shortlisting requires recruiter review."
        )
    elif mandatory_unverified_count > 0:
        summary_narrative = (
            f"{candidate.name} is classified as a {eligibility_adjusted_tier} ({raw_score}%) with "
            f"{mandatory_satisfied}/{mandatory_total} mandatory requirements satisfied and "
            f"{mandatory_unverified_count} requirement(s) needing interview verification."
        )
    else:
        summary_narrative = (
            f"{candidate.name} is classified as a {eligibility_adjusted_tier} ({raw_score}%) with "
            f"all {mandatory_total} mandatory requirements satisfied and "
            f"{cand_exp:.1f} years relevant experience."
        )

    # Return completed CandidateMatchResult with clean separation of scores and tiers.
    return CandidateMatchResult(
        candidate_id=candidate.id,
        code=f"cand-{candidate.id:03d}",
        name=candidate.name,
        email=candidate.email,
        phone=candidate.phone,
        current_role=candidate.summary.split(".")[0] if candidate.summary else "Candidate Profile",
        experience_years=cand_exp,
        # Preserve stored location or mark missing facts honestly rather than inventing a city.
        location=candidate.location or "Not specified",
        # Preserve stored availability or mark missing facts honestly.
        availability=candidate.availability or "Not specified",
        stage=candidate.stage or "New",
        match_score=raw_score,
        similarity=round(vector_similarity, 4),
        classification=eligibility_adjusted_tier,
        raw_score=raw_score,
        score_based_tier=score_based_tier,
        eligibility_adjusted_tier=eligibility_adjusted_tier,
        critical_gap_explanation=critical_gap_explanation,
        raw_cosine_similarity=round(vector_similarity, 4),
        component_scores={
            "mandatory_skills": round(mand_score, 1),
            "preferred_skills": round(pref_score, 1),
            "relevant_experience": round(exp_score, 1),
            "domain_fit": round(domain_score, 1),
            "semantic_relevance": round(semantic_score, 1),
        },
        requirements=evaluated_reqs,
        evidence_highlights=evidence_highlights[:4],
        explanations={
            "why_matched": why_matched,
            "missing_requirements": missing_requirements,
            "needs_verification": needs_verification,
            "summary_narrative": summary_narrative,
            "critical_gap_explanation": critical_gap_explanation,
        },
        winning_resume_id=resume.id,
        winning_resume_filename=resume.source_filename,
        skills=candidate.skills or [],
        has_critical_gap=has_critical_gap,
        mandatory_gap_count=mandatory_gap_count,
        mandatory_unverified_count=mandatory_unverified_count,
    )


# Multi-resume evaluation: Evaluate candidate across all their stored resumes and select highest scoring match.
def evaluate_candidate_multi_resume(
    candidate: Candidate,
    job: Job,
    segmentation: Optional[JDSegmentation],
    requirements: List[JobRequirement],
    full_jd_emb: Optional[JobEmbedding],
    req_emb_map: Dict[int, JobEmbedding],
    weights: MatchScoreWeights,
    db: Session,
    load_disk_text: bool = True,
    resumes_by_cand: Optional[Dict[int, List[Resume]]] = None,
    embeddings_by_resume: Optional[Dict[int, ResumeEmbedding]] = None,
) -> CandidateMatchResult:
    if resumes_by_cand is not None:
        resumes = resumes_by_cand.get(candidate.id, [])
    else:
        resumes = db.query(Resume).filter(Resume.candidate_id == candidate.id).all()

    if not resumes:
        dummy_resume = Resume(
            id=0,
            candidate_id=candidate.id,
            source_filename="profile_facts.txt",
            file_path="",
            content_sha256="",
        )
        return evaluate_resume_candidate_match(
            candidate=candidate,
            resume=dummy_resume,
            resume_vector=[],
            job=job,
            segmentation=segmentation,
            requirements=requirements,
            full_jd_emb=full_jd_emb,
            req_emb_map=req_emb_map,
            weights=weights,
            load_disk_text=load_disk_text,
        )

    best_result: Optional[CandidateMatchResult] = None

    for resume in resumes:
        if embeddings_by_resume is not None:
            emb_record = embeddings_by_resume.get(resume.id)
        else:
            emb_record = (
                db.query(ResumeEmbedding)
                .filter(
                    ResumeEmbedding.resume_id == resume.id,
                    ResumeEmbedding.generation_method == "nemotron_api",
                )
                .first()
            )
        vector = emb_record.embedding_vector if emb_record and emb_record.embedding_vector else []

        result = evaluate_resume_candidate_match(
            candidate=candidate,
            resume=resume,
            resume_vector=vector,
            job=job,
            segmentation=segmentation,
            requirements=requirements,
            full_jd_emb=full_jd_emb,
            req_emb_map=req_emb_map,
            weights=weights,
            load_disk_text=load_disk_text,
        )

        if best_result is None or result.match_score > best_result.match_score:
            best_result = result

    return best_result  # type: ignore


# Search, filter, rank, and match candidates for a job description.
def search_and_match_candidates(
    db: Session,
    job_id: int,
    filters: Optional[CandidateMatchingFilters] = None,
    weights: Optional[MatchScoreWeights] = None,
    page: int = 1,
    page_size: int = 50,
    auto_generate_embeddings: bool = False,
    **kwargs: Any,
) -> Dict[str, Any]:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise ValueError(f"Job with ID {job_id} not found.")

    active_filters = filters or CandidateMatchingFilters()
    if "search" in kwargs and kwargs["search"] and not active_filters.search:
        active_filters.search = str(kwargs["search"])

    active_weights = (weights or MatchScoreWeights()).normalized()

    segmentation = get_active_approved_segmentation(db, job_id)
    requirements: List[JobRequirement] = []
    full_jd_emb: Optional[JobEmbedding] = None
    req_emb_map: Dict[int, JobEmbedding] = {}

    if not segmentation:
        # Fallback to any existing segmentation for this job and auto-approve for semantic matching
        segmentation = (
            db.query(JDSegmentation)
            .filter(JDSegmentation.job_id == job_id)
            .order_by(JDSegmentation.version.desc())
            .first()
        )
        if segmentation and segmentation.status != "approved":
            segmentation.is_approved = 1
            segmentation.status = "approved"
            db.commit()

    if segmentation:
        requirements = (
            db.query(JobRequirement)
            .filter(JobRequirement.segmentation_id == segmentation.id)
            .order_by(JobRequirement.order_index.asc())
            .all()
        )
        full_jd_emb, req_emb_map = get_segmentation_embeddings_map(db, segmentation.id)

    # Optional self-healing AI embedding generation: only attempt if explicitly enabled
    if auto_generate_embeddings:
        if not full_jd_emb and segmentation:
            try:
                from app.services.jd_embedding_service import generate_segmentation_embeddings
                generate_segmentation_embeddings(db, segmentation.id)
                full_jd_emb, req_emb_map = get_segmentation_embeddings_map(db, segmentation.id)
            except Exception:
                pass
        elif not full_jd_emb and not segmentation:
            try:
                from app.services.jd_segmentation_service import segment_job_description
                from app.services.jd_embedding_service import generate_segmentation_embeddings
                segmentation = segment_job_description(db, job=job)
                if segmentation:
                    segmentation.is_approved = 1
                    segmentation.status = "approved"
                    db.commit()
                    generate_segmentation_embeddings(db, segmentation.id)
                    full_jd_emb, req_emb_map = get_segmentation_embeddings_map(db, segmentation.id)
                    requirements = (
                        db.query(JobRequirement)
                        .filter(JobRequirement.segmentation_id == segmentation.id)
                        .order_by(JobRequirement.order_index.asc())
                        .all()
                    )
            except Exception:
                pass

    cand_query = db.query(Candidate)

    if active_filters.min_experience is not None:
        cand_query = cand_query.filter(Candidate.experience_years >= active_filters.min_experience)

    if active_filters.max_experience is not None:
        cand_query = cand_query.filter(Candidate.experience_years <= active_filters.max_experience)

    if active_filters.location:
        cand_query = cand_query.filter(Candidate.location.ilike(f"%{active_filters.location}%"))

    if active_filters.availability:
        cand_query = cand_query.filter(Candidate.availability.ilike(f"%{active_filters.availability}%"))

    if active_filters.stage:
        cand_query = cand_query.filter(Candidate.stage.ilike(f"%{active_filters.stage}%"))

    if active_filters.search:
        search_term = f"%{active_filters.search}%"
        cand_query = cand_query.filter(
            or_(
                Candidate.name.ilike(search_term),
                Candidate.summary.ilike(search_term),
                Candidate.location.ilike(search_term),
            )
        )

    filtered_candidates = cand_query.all()

    if active_filters.skills:
        req_skills_lower = [s.lower() for s in active_filters.skills]
        filtered_candidates = [
            c
            for c in filtered_candidates
            if any(
                any(req_sk in cand_sk.lower() for req_sk in req_skills_lower)
                for cand_sk in (c.skills or [])
            )
        ]

    # Bulk pre-fetch resumes and embeddings in 2 batch queries to eliminate N+1 latency
    cand_ids = [c.id for c in filtered_candidates]
    resumes_by_cand: Dict[int, List[Resume]] = defaultdict(list)
    embeddings_by_resume: Dict[int, ResumeEmbedding] = {}
    if cand_ids:
        all_resumes = db.query(Resume).filter(Resume.candidate_id.in_(cand_ids)).all()
        for r in all_resumes:
            resumes_by_cand[r.candidate_id].append(r)
        resume_ids = [r.id for r in all_resumes]
        if resume_ids:
            all_embs = (
                db.query(ResumeEmbedding)
                .filter(
                    ResumeEmbedding.resume_id.in_(resume_ids),
                    ResumeEmbedding.generation_method == "nemotron_api",
                )
                .all()
            )
            for emb in all_embs:
                embeddings_by_resume[emb.resume_id] = emb

    # Evaluate each filtered candidate
    evaluated_results: List[CandidateMatchResult] = []
    for cand in filtered_candidates:
        match_result = evaluate_candidate_multi_resume(
            candidate=cand,
            job=job,
            segmentation=segmentation,
            requirements=requirements,
            full_jd_emb=full_jd_emb,
            req_emb_map=req_emb_map,
            weights=active_weights,
            db=db,
            load_disk_text=False,
            resumes_by_cand=resumes_by_cand,
            embeddings_by_resume=embeddings_by_resume,
        )
        if active_filters.min_score is not None:
            if match_result.match_score < active_filters.min_score:
                continue
        evaluated_results.append(match_result)

    # Sort evaluated candidates.
    sort_key = active_filters.sort_by
    is_reverse = active_filters.sort_order.lower() == "desc"

    if sort_key == "experience":
        evaluated_results.sort(key=lambda x: x.experience_years, reverse=is_reverse)
    elif sort_key == "name":
        evaluated_results.sort(key=lambda x: x.name.lower(), reverse=not is_reverse)
    elif sort_key == "similarity":
        evaluated_results.sort(key=lambda x: x.similarity, reverse=is_reverse)
    else:
        evaluated_results.sort(key=lambda x: (x.match_score, x.similarity, -x.candidate_id), reverse=is_reverse)

    # Calculate summary KPIs across the FULL filtered candidate pool.
    total_evaluated = len(evaluated_results)
    excellent_count = sum(1 for r in evaluated_results if r.classification == "Excellent Match")
    strong_count = sum(1 for r in evaluated_results if r.classification == "Strong Match")
    potential_count = sum(1 for r in evaluated_results if r.classification == "Potential Match")
    partial_count = sum(1 for r in evaluated_results if r.classification == "Partial Match")
    review_count = sum(1 for r in evaluated_results if r.classification == "Needs Review")
    avg_score = (
        round(sum(r.match_score for r in evaluated_results) / total_evaluated, 1)
        if total_evaluated > 0
        else 0.0
    )

    # Calculate pagination slice.
    offset = (page - 1) * page_size
    paginated_results = evaluated_results[offset : offset + page_size]
    total_pages = max(1, math.ceil(total_evaluated / page_size)) if page_size > 0 else 1

    # Enrich paginated display candidates with full disk text citations if needed (top 5 for fast responsive UI).
    enriched_results: List[CandidateMatchResult] = []
    for idx, cand_res in enumerate(paginated_results):
        # If no evidence excerpts yet and candidate has a winning resume, re-evaluate with disk text for top 5 candidates
        if idx < 5 and not cand_res.evidence_highlights and cand_res.winning_resume_id:
            db_cand = db.query(Candidate).filter(Candidate.id == cand_res.candidate_id).first()
            if db_cand:
                cand_res = evaluate_candidate_multi_resume(
                    candidate=db_cand,
                    job=job,
                    segmentation=segmentation,
                    requirements=requirements,
                    full_jd_emb=full_jd_emb,
                    req_emb_map=req_emb_map,
                    weights=active_weights,
                    db=db,
                    load_disk_text=True,
                )
        enriched_results.append(cand_res)

    # Re-sort paginated display slice if disk resume evidence surfaced additional preferred/verified skill matches.
    if sort_key == "match_score":
        enriched_results.sort(key=lambda x: (x.match_score, x.similarity, -x.candidate_id), reverse=is_reverse)

    # Serialize results to dictionary format.
    serialized_matches = [
        {
            "id": r.candidate_id,
            "numeric_id": r.candidate_id,
            "candidate_id": r.candidate_id,
            "code": r.code,
            "name": r.name,
            "candidate_name": r.name,
            "email": r.email,
            "phone": r.phone,
            "currentRole": r.current_role,
            "experienceYears": r.experience_years,
            "experience_years": r.experience_years,
            "location": r.location,
            "availability": r.availability,
            "status": r.stage,
            "stage": r.stage,
            "matchScore": r.match_score,
            "match_score": r.match_score,
            # Unadjusted raw deterministic score.
            "rawScore": r.raw_score,
            "raw_score": r.raw_score,
            # Baseline tier derived strictly from raw score.
            "scoreBasedTier": r.score_based_tier,
            "score_based_tier": r.score_based_tier,
            # Final tier after mandatory requirement protection policy.
            "eligibilityAdjustedTier": r.eligibility_adjusted_tier,
            "eligibility_adjusted_tier": r.eligibility_adjusted_tier,
            # Narrative explaining requirement gaps or full satisfaction.
            "criticalGapExplanation": r.critical_gap_explanation,
            "critical_gap_explanation": r.critical_gap_explanation,
            # Semantic cosine similarity in raw [-1.0, 1.0] coordinates.
            "rawCosineSimilarity": r.raw_cosine_similarity,
            "raw_cosine_similarity": r.raw_cosine_similarity,
            "semanticSimilarity": r.raw_cosine_similarity,
            "semantic_similarity": r.raw_cosine_similarity,
            "similarity": r.similarity,
            "classification": r.classification,
            "hasCriticalGap": r.has_critical_gap,
            "mandatoryGapCount": r.mandatory_gap_count,
            "mandatoryUnverifiedCount": r.mandatory_unverified_count,
            "componentScores": r.component_scores,
            "component_scores": r.component_scores,
            "primarySkills": r.skills[:4],
            "secondarySkills": r.skills[4:],
            "skills": r.skills,
            "evidenceHighlights": r.evidence_highlights,
            "evidence_citation": r.evidence_highlights[0] if r.evidence_highlights else (
                r.requirements[0].evidence if r.requirements and r.requirements[0].evidence != "Evidence unavailable." else "Evidence unavailable."
            ),
            "explanations": r.explanations,
            "winningResumeId": r.winning_resume_id,
            "winningResumeFilename": r.winning_resume_filename,
            "requirements": [
                {
                    "requirement_id": req.requirement_id,
                    "category": req.category,
                    "category_label": req.category_label,
                    "classification": req.classification,
                    "original_text": req.original_text,
                    "status": req.status,
                    "verification_status": req.verification_status,
                    "evidence_source": req.evidence_source,
                    "confidence": req.confidence,
                    "evidence": req.evidence,
                    "resume_reference": req.resume_reference,
                    "notes": req.notes,
                }
                for req in r.requirements
            ],
        }
        for r in enriched_results
    ]

    return {
        "job_id": job.id,
        "job_title": job.title,
        "job_code": job.job_code or f"REQ-{job.id}",
        "segmentation_id": segmentation.id if segmentation else None,
        "segmentation_version": segmentation.version if segmentation else None,
        "total_evaluated": total_evaluated,
        "total_pages": total_pages,
        "page": page,
        "page_size": page_size,
        "summary": {
            # Total unique candidates evaluated for this requisition.
            "total_evaluated": total_evaluated,
            # Explicit candidate count denominator.
            "total_evaluated_candidates": total_evaluated,
            # Unit indicator clarifying metric counts unique candidates.
            "metric_unit": "unique_candidates",
            # Number of unique candidates matching each tier.
            "excellent_matches": excellent_count,
            "strong_matches": strong_count,
            "potential_matches": potential_count,
            "partial_matches": partial_count,
            "needs_review": review_count,
            "average_score": avg_score,
            # Individual requirements count evaluated per candidate.
            "total_requirements_evaluated": len(requirements),
        },
        "matches": serialized_matches,
    }


# Multi-candidate side-by-side comparison for up to 5 candidates.
def compare_candidates_for_job(
    db: Session,
    job_id: int,
    candidate_ids: List[int],
    weights: Optional[MatchScoreWeights] = None,
    auto_generate_embeddings: bool = False,
) -> Dict[str, Any]:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise ValueError(f"Job with ID {job_id} not found.")

    if len(candidate_ids) < 2:
        raise ValueError("At least 2 candidates are required for comparison.")
    if len(candidate_ids) > 5:
        raise ValueError("A maximum of 5 candidates can be compared simultaneously.")

    active_weights = (weights or MatchScoreWeights()).normalized()

    segmentation = get_active_approved_segmentation(db, job_id)
    requirements: List[JobRequirement] = []
    full_jd_emb: Optional[JobEmbedding] = None
    req_emb_map: Dict[int, JobEmbedding] = {}

    if not segmentation:
        # Fallback to any existing segmentation for this job and auto-approve for semantic matching
        segmentation = (
            db.query(JDSegmentation)
            .filter(JDSegmentation.job_id == job_id)
            .order_by(JDSegmentation.version.desc())
            .first()
        )
        if segmentation and segmentation.status != "approved":
            segmentation.is_approved = 1
            segmentation.status = "approved"
            db.commit()

    if segmentation:
        requirements = (
            db.query(JobRequirement)
            .filter(JobRequirement.segmentation_id == segmentation.id)
            .order_by(JobRequirement.order_index.asc())
            .all()
        )
        full_jd_emb, req_emb_map = get_segmentation_embeddings_map(db, segmentation.id)

    # Optional self-healing AI embedding generation: ensure 2048-dim vectors exist for semantic matching
    if auto_generate_embeddings:
        if not full_jd_emb and segmentation:
            try:
                from app.services.jd_embedding_service import generate_segmentation_embeddings
                generate_segmentation_embeddings(db, segmentation.id)
                full_jd_emb, req_emb_map = get_segmentation_embeddings_map(db, segmentation.id)
            except Exception:
                pass
        elif not full_jd_emb and not segmentation:
            try:
                from app.services.jd_segmentation_service import segment_job_description
                from app.services.jd_embedding_service import generate_segmentation_embeddings
                segmentation = segment_job_description(db, job=job)
                if segmentation:
                    segmentation.is_approved = 1
                    segmentation.status = "approved"
                    db.commit()
                    generate_segmentation_embeddings(db, segmentation.id)
                    full_jd_emb, req_emb_map = get_segmentation_embeddings_map(db, segmentation.id)
                    requirements = (
                        db.query(JobRequirement)
                        .filter(JobRequirement.segmentation_id == segmentation.id)
                        .order_by(JobRequirement.order_index.asc())
                        .all()
                    )
            except Exception:
                pass

    compared_candidates: List[Dict[str, Any]] = []
    for cid in candidate_ids:
        cand = db.query(Candidate).filter(Candidate.id == cid).first()
        if not cand:
            continue
        eval_result = evaluate_candidate_multi_resume(
            candidate=cand,
            job=job,
            segmentation=segmentation,
            requirements=requirements,
            full_jd_emb=full_jd_emb,
            req_emb_map=req_emb_map,
            weights=active_weights,
            db=db,
            load_disk_text=True,
        )
        compared_candidates.append(
            {
                "candidate_id": eval_result.candidate_id,
                "name": eval_result.name,
                "code": eval_result.code,
                "current_role": eval_result.current_role,
                "experience_years": eval_result.experience_years,
                "location": eval_result.location,
                "availability": eval_result.availability,
                "stage": eval_result.stage,
                "match_score": eval_result.match_score,
                "similarity": eval_result.similarity,
                "classification": eval_result.classification,
                # Explicit raw score and tier attributes.
                "raw_score": eval_result.raw_score,
                "score_based_tier": eval_result.score_based_tier,
                "eligibility_adjusted_tier": eval_result.eligibility_adjusted_tier,
                "critical_gap_explanation": eval_result.critical_gap_explanation,
                "raw_cosine_similarity": eval_result.raw_cosine_similarity,
                "semantic_similarity": eval_result.raw_cosine_similarity,
                "has_critical_gap": eval_result.has_critical_gap,
                "mandatory_gap_count": eval_result.mandatory_gap_count,
                "mandatory_unverified_count": eval_result.mandatory_unverified_count,
                "component_scores": eval_result.component_scores,
                "explanations": eval_result.explanations,
                "winning_resume_filename": eval_result.winning_resume_filename,
                "requirements_map": {
                    req_item.requirement_id: {
                        "status": req_item.status,
                        "verification_status": req_item.verification_status,
                        "evidence_source": req_item.evidence_source,
                        "confidence": req_item.confidence,
                        "evidence": req_item.evidence,
                        "notes": req_item.notes,
                    }
                    for req_item in eval_result.requirements
                },
            }
        )

    if not compared_candidates:
        raise ValueError("None of the specified candidate IDs could be evaluated.")

    matrix_rows = []
    for req in requirements:
        row_evaluations = {}
        for c in compared_candidates:
            cid = c["candidate_id"]
            eval_data = c["requirements_map"].get(
                req.id,
                {
                    "status": "UNVERIFIED",
                    "verification_status": "UNVERIFIED",
                    "evidence_source": "none",
                    "confidence": 0.5,
                    "evidence": "No evidence found in indexed sources.",
                    "notes": "",
                },
            )
            row_evaluations[cid] = eval_data

        matrix_rows.append(
            {
                "requirement_id": req.id,
                "category": req.category,
                "category_label": CATEGORY_LABELS.get(req.category, req.category.replace("_", " ").title()),
                "classification": req.classification,
                "original_text": req.original_text,
                "evaluations": row_evaluations,
            }
        )

    # Determine recommended candidate favoring those without critical mandatory gaps
    no_gap_candidates = [c for c in compared_candidates if not c.get("has_critical_gap")]
    candidates_pool = no_gap_candidates if no_gap_candidates else compared_candidates
    best_candidate = max(candidates_pool, key=lambda x: (x["match_score"], x["similarity"]))

    # Formulate clear rationale note based on mandatory requirement compliance.
    if not best_candidate.get("has_critical_gap"):
        gap_note = " (satisfies all evaluated mandatory requirements)."
    else:
        gap_count = best_candidate.get("mandatory_gap_count", 1)
        gap_note = f" (note: has {gap_count} mandatory skill gap(s) requiring recruiter review)."

    recommendation = {
        "recommended_candidate_id": best_candidate["candidate_id"],
        "recommended_candidate_name": best_candidate["name"],
        "recommendation_rationale": (
            f"{best_candidate['name']} is the recommended shortlist pick with a match score of "
            f"{best_candidate['match_score']}% ({best_candidate['eligibility_adjusted_tier']}) and "
            f"{best_candidate['experience_years']} years experience{gap_note}"
        ),
    }

    return {
        "job_id": job.id,
        "job_title": job.title,
        "job_code": job.job_code or f"REQ-{job.id}",
        "candidates": compared_candidates,
        "matrix_rows": matrix_rows,
        "recommendation": recommendation,
    }


# Retrieve distinct filter options from SQLite candidate records for recruiter workspace filters.
def get_matching_filter_options(db: Session) -> Dict[str, Any]:
    locations = [
        loc[0]
        for loc in db.query(Candidate.location)
        .filter(Candidate.location.is_not(None), Candidate.location != "")
        .distinct()
        .all()
    ]
    stages = [
        stg[0]
        for stg in db.query(Candidate.stage)
        .filter(Candidate.stage.is_not(None), Candidate.stage != "")
        .distinct()
        .all()
    ]
    availabilities = [
        av[0]
        for av in db.query(Candidate.availability)
        .filter(Candidate.availability.is_not(None), Candidate.availability != "")
        .distinct()
        .all()
    ]
    min_exp, max_exp = (
        db.query(
            func.min(Candidate.experience_years),
            func.max(Candidate.experience_years),
        ).first()
        or (0.0, 20.0)
    )

    return {
        "locations": sorted(locations),
        "stages": sorted(stages),
        "availabilities": sorted(availabilities),
        "experience_range": {
            "min": float(min_exp or 0.0),
            "max": float(max_exp or 20.0),
        },
    }
