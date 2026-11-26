# Import dataclass to return a small immutable summary of locally parsed profile fields.
from dataclasses import dataclass
# Import re to locate email addresses, labeled names, and curated skill terms in text.
import json
import re
from pathlib import Path


# Describe the candidate fields extracted locally for deduplication and search metadata.
@dataclass(frozen=True)
class ParsedResumeProfile:
    # Store a best-effort name from a labeled field or the resume's opening lines.
    name: str | None
    # Store the first syntactically valid email in normalized lowercase form.
    email: str | None
    # Store skill names found in the text using the curated vocabulary below.
    skills: tuple[str, ...]
    # Store experience only when it appears in an explicitly labeled field.
    experience_years: float | None
    # Store location only when it appears in an explicitly labeled field.
    location: str | None


# Match common email address forms without retaining surrounding contact labels.
_EMAIL_PATTERN = re.compile(r"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b")
# Prefer an explicitly labeled candidate name over a heuristic opening-line value.
_LABELED_NAME_PATTERN = re.compile(r"(?im)^\s*(?:candidate\s+)?name\s*[:：-]\s*([^\r\n|,;]{2,100})")
# Match numeric experience only when a resume labels it as total or general experience.
_LABELED_EXPERIENCE_PATTERN = re.compile(r"(?im)^\s*(?:total\s+)?experience\s*[:：-]\s*(\d{1,2}(?:\.\d+)?)\s*(?:years?|yrs?)?\s*$")
# Match a stated current or general location without inferring it from a filename.
_LABELED_LOCATION_PATTERN = re.compile(r"(?im)^\s*(?:current\s+)?location\s*[:：-]\s*([^\r\n|,;]{2,100})")
# Exclude common resume headings from the opening-line name fallback.
_NON_NAME_HEADINGS = frozenset({"resume", "curriculum vitae", "professional summary", "summary", "profile"})
# Keep the supported skill vocabulary local and deterministic without sending text to another model.
_SKILL_ALIASES = {
    "AWS": ("aws", "amazon web services"),
    "Azure": ("azure", "microsoft azure"),
    "C": ("c language",),
    "C#": ("c#", "c sharp"),
    "C++": ("c++", "cpp"),
    "CSS": ("css",),
    "Docker": ("docker",),
    "FastAPI": ("fastapi",),
    "Git": ("git",),
    "HTML": ("html",),
    "Java": ("java",),
    "JavaScript": ("javascript",),
    "Jenkins": ("jenkins",),
    "Kubernetes": ("kubernetes", "k8s"),
    "Linux": ("linux",),
    "Maven": ("maven",),
    "MongoDB": ("mongodb",),
    "MySQL": ("mysql",),
    "Oracle": ("oracle",),
    "PostgreSQL": ("postgresql", "postgres"),
    "Power BI": ("power bi",),
    "Python": ("python",),
    "React": ("react", "reactjs", "react.js"),
    "REST API": ("rest api", "restful api"),
    "Selenium": ("selenium",),
    "SQL": ("sql",),
    "SystemVerilog": ("systemverilog",),
    "TestNG": ("testng",),
    "TypeScript": ("typescript",),
    "UVM": ("uvm", "universal verification methodology"),
    "Excel": ("excel", "microsoft excel", "ms excel"),
    "Outlook": ("outlook", "microsoft outlook", "ms outlook"),
    "Item Setup": ("item setup", "item set up", "product setup"),
    "Data Quality": ("data quality", "data validation", "data remediation"),
    "Vendor Coordination": ("vendor coordination", "vendor management", "supplier coordination"),
    "Retail Operations": ("retail operations", "merchandising operations", "retail merchandising"),
}
_MATCH_ALIASES = json.loads((Path(__file__).resolve().parent / "data" / "skill_aliases.json").read_text(encoding="utf-8"))
_SKILL_ALIASES.update({name: tuple(values) for name, values in _MATCH_ALIASES.items()})


# Build a boundary-aware matcher so short skill terms do not match inside larger words.
def _skill_pattern(alias: str) -> re.Pattern[str]:
    # Escape punctuation before adding word boundaries around the literal skill phrase.
    escaped_alias = re.escape(alias)
    # Use alphanumeric boundaries because skill names can contain punctuation such as C++ or .NET.
    return re.compile(rf"(?<![A-Za-z0-9]){escaped_alias}(?![A-Za-z0-9])", re.IGNORECASE)


# Cache the vocabulary matchers once so repeated resume parsing stays inexpensive.
_SKILL_PATTERNS = tuple(
    (canonical, _skill_pattern(alias))
    for canonical, aliases in _SKILL_ALIASES.items()
    for alias in set(aliases + (canonical,))
)


# Parse a resume's minimal candidate identity and skill set without external API calls.
def parse_resume_profile(text: str) -> ParsedResumeProfile:
    # Reject non-text input so extraction failures cannot become fabricated profiles.
    if not isinstance(text, str):
        raise TypeError("Resume profile parsing requires text input.")
    # Reject empty input because it cannot support identity or skill extraction.
    if not text.strip():
        raise ValueError("Resume profile parsing requires non-empty text.")
    # Find an explicitly labeled name while avoiding any values inferred from a filename.
    labeled_name = _LABELED_NAME_PATTERN.search(text)
    name = labeled_name.group(1).strip(" \t.-") if labeled_name else None
    # Use a restrained first-line fallback only when no name label is present.
    if not name:
        for line in text.splitlines()[:12]:
            candidate_line = line.strip(" \t|:-")
            # Skip headings, contact details, long lines, and lines containing digits.
            if not candidate_line or candidate_line.casefold() in _NON_NAME_HEADINGS:
                continue
            if len(candidate_line) <= 80 and not any(char.isdigit() for char in candidate_line) and not _EMAIL_PATTERN.search(candidate_line):
                name = candidate_line
                break
    # Normalize one email address for stable candidate matching while keeping it local.
    email_match = _EMAIL_PATTERN.search(text)
    email = email_match.group(0).casefold() if email_match else None
    # Collect each canonical skill at most once even when several aliases appear.
    found_skills = {
        canonical
        for canonical, pattern in _SKILL_PATTERNS
        if pattern.search(text)
    }
    # Return skills in stable case-insensitive order for repeatable storage and tests.
    skills = tuple(sorted(found_skills, key=str.casefold))
    # Parse experience only from a strict labeled line so inferred values remain unknown.
    experience_match = _LABELED_EXPERIENCE_PATTERN.search(text)
    experience_years = float(experience_match.group(1)) if experience_match else None
    # Parse location only from an explicitly labeled line without using the source filename.
    location_match = _LABELED_LOCATION_PATTERN.search(text)
    location = location_match.group(1).strip() if location_match else None
    # Return only locally supported profile fields used by SQLite and structured search filters.
    return ParsedResumeProfile(
        name=name or None,
        email=email,
        skills=skills,
        experience_years=experience_years,
        location=location,
    )


def extract_resume_skill_evidence(text: str) -> list[dict[str, str]]:
    """Return only skills literally present in the resume, with their complete source line."""
    evidence = []
    seen = set()
    for canonical, pattern in _SKILL_PATTERNS:
        if canonical in seen:
            continue
        for line in text.splitlines():
            if len(line.strip()) <= 260 and pattern.search(line):
                evidence.append({"skill": canonical, "evidence": line.strip()})
                seen.add(canonical)
                break
    return sorted(evidence, key=lambda item: item["skill"].casefold())


def extract_portfolio_links(text: str) -> list[str]:
    """Extract verifiable creative portfolio URLs (Behance, Dribbble, ArtStation, custom portfolio domains)."""
    if not text:
        return []
    url_pattern = re.compile(
        r"(?:https?://)?(?:www\.)?(?:behance\.net/[A-Za-z0-9_.-]+|dribbble\.com/[A-Za-z0-9_.-]+|artstation\.com/[A-Za-z0-9_.-]+|[A-Za-z0-9_.-]+\.myportfolio\.com|(?:portfolio|website)\s*[:：-]\s*https?://[^\s,]+)",
        re.IGNORECASE,
    )
    links = []
    for match in url_pattern.findall(text):
        cleaned = match.strip().rstrip(".,;)")
        if cleaned and cleaned not in links:
            links.append(cleaned)
    return links
