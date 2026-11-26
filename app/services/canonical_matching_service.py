"""Deterministic JD extraction, resume evidence, timeline, and scoring shared by every match flow."""

from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import date
from pathlib import Path
from typing import Any, Callable


ENGINE_VERSION = "3.0"
CONFIG_VERSION = "mandatory-average-preferred-bonus-10-v1"
MANDATORY_WEIGHT = 1.0
PREFERRED_BONUS_CAP = 10.0
PARTIAL_CREDIT_CAP = 0.8
SEMANTIC_PARTIAL_THRESHOLD = 0.55
SEMANTIC_BORDERLINE_THRESHOLD = 0.7

_STOP = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "into", "is", "it", "of", "on", "or", "the", "to", "with", "within",
    "ability", "able", "apply", "applying", "candidate", "demonstrate", "demonstrated", "experience", "experienced", "familiar", "familiarity", "have", "having", "knowledge", "minimum", "must", "preferred", "proficiency", "proficient", "qualification", "qualifications", "required", "requirement", "requirements", "responsibility", "responsibilities", "skill", "skills", "strong", "work", "working", "years",
    "particularly", "especially", "including", "such", "general", "plus", "hands-on",
}
_HEADER_CATEGORIES = (
    (("desired", "preferred", "nice to have", "good to have"), "preferred_skills", "Preferred"),
    (("mandatory", "required", "must have", "minimum qualification"), "mandatory_skills", "Mandatory"),
    (("qualification", "functional skills"), "mandatory_skills", None),
    (("education", "educational", "degree", "academic"), "educational_qualifications", None),
    (("certification", "certified"), "certifications", None),
    (("experience", "tenure"), "minimum_experience", None),
    (("interpersonal", "soft skills", "communication skills"), "other_requirements", None),
    (("responsibilit", "primary function", "duties", "what you will do", "accountabilit"), "key_responsibilities", None),
    (("location", "work mode", "work arrangement"), "location_requirements", None),
    (("employment type", "work type"), "employment_type", None),
    (("technical", "tools", "technology", "technologies"), "technical_skills", None),
    (("domain", "industry"), "domain_knowledge", None),
)
_ALIAS_DATA = json.loads((Path(__file__).resolve().parents[1] / "data" / "skill_aliases.json").read_text(encoding="utf-8"))
_MONTHS = {name.lower(): i for i, name in enumerate(("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"), 1)}
_MONTHS.update({name[:3].lower(): i for name, i in _MONTHS.copy().items() if len(name) > 3})
_DATE = r"(?:[A-Za-z]{3,9}\s+\d{4}|\d{4}[-/]\d{1,2}|\d{1,2}[-/]\d{4}|\d{4})"
_DATE_RANGE = re.compile(rf"(?P<start>{_DATE})\s*(?:-|\u2013|\u2014|to|through)\s*(?P<end>{_DATE}|present|current|now|till\s+(?:date|present)|to\s+date)", re.I)
_KNOWN_HEADINGS = {"desired qualifications and experience", "primary function", "interpersonal skills", "education", "experience", "responsibilities", "technical skills", "preferred qualifications", "required qualifications", "certifications", "tools", "location"}
_RESUME_SECTION_HEADINGS = {"professional experience", "work experience", "employment history", "work history", "internship experience", "education", "skills", "projects"}


def _plain_norm(text: str) -> str:
    """Normalize punctuation and spacing before applying the shared alias vocabulary."""
    return " ".join(re.findall(r"[a-z0-9+#]+", text.lower()))


_ALIAS_REPLACEMENTS = sorted(
    ((_plain_norm(alias), _plain_norm(canonical)) for canonical, aliases in _ALIAS_DATA.items() for alias in aliases),
    key=lambda pair: len(pair[0]),
    reverse=True,
)


def canonicalize_matching_text(text: str) -> str:
    """Normalize JD and resume text through the same maintained, data-backed alias map."""
    normalized = _plain_norm(text)
    for alias, canonical in _ALIAS_REPLACEMENTS:
        if canonical in normalized:
            continue
        normalized = re.sub(rf"(?<![a-z0-9]){re.escape(alias)}(?![a-z0-9])", canonical, normalized)
    return normalized


def _norm(text: str) -> str:
    """Normalize punctuation and spacing without erasing exact-vs-equivalent provenance."""
    return _plain_norm(text)


def _key_terms(text: str) -> list[str]:
    """Retain specific content words; generic resume/JD language cannot establish a match."""
    return [word for word in _norm(text).split() if len(word) > 1 and word not in _STOP and not word.isdigit()]


def _dedupe_text(text: str) -> str:
    """Collapse exact and explicitly equivalent terminology without broad semantic guessing."""
    return canonicalize_matching_text(text)


def _category_for(text: str, section_category: str) -> str:
    """Apply deterministic category cues after the section context has been identified."""
    if re.search(r"\b\d+\s*\+\s*(?:years?|yrs?)\b", text, re.I):
        return "minimum_experience"
    if re.search(r"\b(?:\d+\s*(?:-|\u2013|to)?\s*\d*\s*(?:years?|yrs?)|at least \d+ years?)\b", text, re.I):
        return "minimum_experience"
    if re.search(r"\b(?:degree|diploma|bachelor|master|ph\.d|education)\b", text, re.I):
        return "educational_qualifications"
    if re.search(r"\b(?:certification|certified|license|licence)\b", text, re.I):
        return "certifications"
    if re.search(r"\b(?:remote|hybrid|on.site|relocat|location|travel)\b", text, re.I):
        return "location_requirements"
    if re.search(r"\b(?:full.time|part.time|contract|internship|temporary)\b", text, re.I):
        return "employment_type"
    if re.search(r"\b(?:shift|evening shift|night shift|rotational shift)\b", text, re.I):
        return "operational_constraints"
    if re.search(r"\b(?:portfolio|behance|dribbble|artstation)\b", text, re.I):
        return "portfolio_requirements"
    if canonicalize_matching_text(text) in {k.lower() for k in _ALIAS_DATA} or any(re.search(rf"\b{tool}\b", text, re.I) for tool in ("excel", "outlook", "word", "powerpoint", "sql", "python", "cad", "revit", "sap", "erp", "photoshop", "illustrator", "indesign", "after effects", "cinema 4d", "maya", "smoke", "keynote")):
        return "technical_skills"
    if re.search(r"\b(?:communication|collaboration|interpersonal|leadership|negotiation)\b", text, re.I) and section_category == "other_requirements":
        return "other_requirements"
    return section_category


def extract_jd_requirements(jd_text: str) -> list[dict[str, Any]]:
    """Extract deterministic, de-duplicated atomic requirements while retaining exact source locations."""
    candidates: dict[tuple[str, str], dict[str, Any]] = {}
    section_category, section_class = "job_overview", "Mandatory"
    preferred_words = re.compile(r"\b(?:preferred|desired|desirable|optional|nice to have|good to have|plus|added advantage|advantageous|would be an advantage|an advantage|is an advantage)\b", re.I)
    required_words = re.compile(r"\b(?:required|mandatory|must have|essential|minimum)\b", re.I)
    for line_number, source_line in enumerate(jd_text.splitlines(), 1):
        stripped = source_line.strip()
        if not stripped:
            continue
        line = re.sub(r"^\s*(?:[-*•▪>]+|\d+[.)])\s*", "", stripped).strip()
        heading = line.rstrip(":").strip()
        # Uppercase bullets such as RAP or ODATA are skill evidence, not section headings.
        is_heading = not bool(re.match(r"^\s*(?:[-*â€¢â–ª>]+|\d+[.)])\s*", stripped)) and ((len(heading) <= 90 and heading.upper() == heading and bool(re.search(r"[A-Z]", heading))) or (stripped.endswith(":") and len(heading.split()) <= 7) or _norm(heading) in _KNOWN_HEADINGS)
        if is_heading:
            upper = heading.upper()
            if any(word in upper for word in ("OVERVIEW", "ABOUT", "COMPANY", "JOB TITLE", "POSITION")):
                section_category, section_class = "job_overview", "Mandatory"
            else:
                section_category, header_class = "other_requirements", None
                for markers, category, classification in _HEADER_CATEGORIES:
                    if any(marker in heading.lower() for marker in markers):
                        section_category, header_class = category, classification
                        break
                section_class = header_class or ("Preferred" if preferred_words.search(heading) else "Mandatory")
            continue

        bullet = bool(re.match(r"^\s*(?:[-*•▪>]+|\d+[.)])\s*", stripped))
        section_is_requirement = section_category not in {"job_overview", "role_summary"}
        explicit_statement = bool(preferred_words.search(line) or required_words.search(line) or re.search(r"\b(?:must|minimum|degree|certification|(?:years?\s+of\s+)?experience|responsible for|proficient in|knowledge of)\b", line, re.I))
        if not bullet and not section_is_requirement and not explicit_statement:
            continue

        line_class = "Preferred" if section_class == "Preferred" or preferred_words.search(line) else "Responsibility" if section_category in {"key_responsibilities", "operational_constraints"} or re.search(r"\b(?:shift|evening shift)\b", line, re.I) else "Mandatory"
        body = re.sub(r"^(?:preferred|desired|desirable|required|mandatory|optional)\s*(?:qualifications?|skills?|requirements?)?\s*:?\s*", "", line, flags=re.I).strip(" .:-")
        action_split = re.sub(r"\s+and\s+(?=(?:manage|coordinate|lead|design|develop|maintain|support|perform|conduct|ensure|prepare|analyze|deliver|communicate|inspect|operate|review)\b)", ";", body, flags=re.I)
        chunks = [chunk.strip(" .:-") for chunk in re.split(r"\s*;\s*|\s+\|\s+", action_split) if chunk.strip(" .:-")]
        atomic: list[tuple[str, list[str] | None]] = []
        for chunk in chunks:
            slash_parts = [part.strip() for part in chunk.split("/")]
            alternatives = None
            experience_suffix = None
            if len(slash_parts) > 1 and all(1 <= len(_key_terms(part)) <= 3 for part in slash_parts):
                years_suffix = re.search(r"\s+(\d+(?:\.\d+)?\s*\+?\s*(?:years?|yrs?).*)$", slash_parts[-1], re.I)
                if years_suffix:
                    slash_parts[-1] = slash_parts[-1][:years_suffix.start()].strip()
                    experience_suffix = years_suffix.group(1)
                alternatives = [part for part in slash_parts if part]
                chunk = " OR ".join(alternatives)
            list_match = re.match(r"^(.*?\b(?:experience with|proficiency in|knowledge of|familiarity with|skills in|tools such as|tools including|proficiency,? particularly|proficiency,? including)\s+)(.+)$", chunk, re.I)
            if list_match:
                entries = re.split(r",\s*(?![^()]*\))|\s+and\s+(?![^()]*\))", list_match.group(2).rstrip("."), flags=re.I)
                if len(entries) > 1 and all(1 <= len(_key_terms(item)) <= 5 for item in entries):
                    for item in entries:
                        clean_item = item.strip()
                        if clean_item:
                            if re.search(r"\b(?:particularly|including)\s*$", list_match.group(1), re.I):
                                atomic.append((clean_item, None))
                            else:
                                atomic.append((f"{list_match.group(1)}{clean_item}", None))
                    continue
            atomic.append((chunk, alternatives))
            if experience_suffix:
                atomic.append((experience_suffix, None))

        for requirement_text, alternatives in atomic:
            category = _category_for(requirement_text, section_category)
            normalized = _norm(requirement_text)
            terms = _key_terms(requirement_text)
            if not normalized or (not terms and category != "minimum_experience"):
                continue
            identity = (category, _dedupe_text(requirement_text))
            item = candidates.get(identity)
            if item is None:
                item = {"normalized": normalized, "category": category, "classification": line_class, "original_text": requirement_text, "alternatives": alternatives, "source_evidence": source_line, "source_locations": []}
                candidates[identity] = item
            elif line_class == "Mandatory" and item["classification"] != "Responsibility":
                item["classification"] = "Mandatory"
            location = {"line": line_number, "text": source_line}
            if location not in item["source_locations"]:
                item["source_locations"].append(location)

    if not candidates:
        for line_number, source_line in enumerate(jd_text.splitlines(), 1):
            stripped = source_line.strip()
            if not stripped:
                continue
            line = re.sub(r"^\s*(?:[-*•▪>]+|\d+[.)])\s*", "", stripped).strip()
            action_split = re.sub(r"\s+and\s+(?=(?:manage|coordinate|lead|design|develop|maintain|support|perform|conduct|ensure|prepare|analyze|deliver|communicate|inspect|operate|review|implement|configure)\b)", ";", line, flags=re.I)
            chunks = [chunk.strip(" .:-") for chunk in re.split(r"\s*;\s*|\s+\|\s+|\.\s+", action_split) if chunk.strip(" .:-")]
            for chunk in chunks:
                if len(_norm(chunk).split()) < 2:
                    continue
                cat = _category_for(chunk, "mandatory_skills")
                normalized = _norm(chunk)
                terms = _key_terms(chunk)
                if not normalized or (not terms and cat != "minimum_experience"):
                    continue
                identity = (cat, _dedupe_text(chunk))
                if identity not in candidates:
                    candidates[identity] = {
                        "normalized": normalized,
                        "category": cat,
                        "classification": "Mandatory",
                        "original_text": chunk,
                        "source_evidence": source_line,
                        "source_locations": [{"line": line_number, "text": source_line}],
                    }

    requirements = []
    for item in candidates.values():
        item["requirement_id"] = hashlib.sha256(f"{item['category']}|{item['classification']}|{item['normalized']}".encode()).hexdigest()[:16]
        item["jd_source_line"] = item["source_locations"][0]["line"]
        item["tokens"] = _key_terms(item["original_text"])
        requirements.append(item)
    return requirements


def extract_jd_requirements_with_audit(jd_text: str) -> dict[str, Any]:
    """Return the canonical requirements plus an explicit disposition for every non-empty line."""
    requirements = extract_jd_requirements(jd_text)
    source_lines = jd_text.splitlines()
    classified = {
        location["line"]
        for requirement in requirements
        for location in requirement["source_locations"]
    }
    line_audit = []
    for line_number, source_line in enumerate(source_lines, 1):
        if not source_line.strip():
            continue
        if line_number in classified:
            line_audit.append({"line": line_number, "text": source_line, "status": "CLASSIFIED"})
            continue
        stripped = source_line.strip()
        bullet = bool(re.match(r"^\s*(?:[-*â€¢â–ª>]+|\d+[.)])\s*", stripped))
        content = re.sub(r"^\s*(?:[-*â€¢â–ª>]+|\d+[.)])\s*", "", stripped).strip()
        heading = content.rstrip(":").strip()
        is_heading = not bullet and ((len(heading) <= 90 and heading.upper() == heading and bool(re.search(r"[A-Z]", heading))) or (stripped.endswith(":") and len(heading.split()) <= 7) or _norm(heading) in _KNOWN_HEADINGS)
        reason = "section heading" if is_heading else "informational prose outside a requirements section or no classifiable terms"
        line_audit.append({"line": line_number, "text": source_line, "status": "IGNORED", "reason": reason})
    return {
        "requirements": requirements,
        "line_audit": line_audit,
        "ignored_lines": [line for line in line_audit if line["status"] == "IGNORED"],
    }


def _snippet(text: str, terms: list[str], limit: int = 260) -> str | None:
    """Return the highest-overlap complete sentence, omitting snippets too long to quote intact."""
    chunks = [sentence.strip() for sentence in re.split(r"(?<=[.!?])\s+|\n+", text) if sentence.strip()]
    ranked = sorted(chunks, key=lambda sentence: sum(bool(re.search(rf"\b{re.escape(word)}\b", sentence, re.I)) for word in set(terms)), reverse=True)
    return next((sentence for sentence in ranked if len(sentence) <= limit and any(re.search(rf"\b{re.escape(word)}\b", sentence, re.I) for word in terms)), None)


def _full_evidence_snippet(text: str, terms: list[str], limit: int = 260) -> str | None:
    """Require every specific requirement term in one source sentence before awarding direct credit."""
    wanted = set(terms)
    chunks = [sentence.strip() for sentence in re.split(r"(?<=[.!?])\s+|\n+", text) if sentence.strip()]
    best = max(chunks, key=lambda sentence: len(wanted.intersection(set(_norm(sentence).split()))), default=None)
    return best if best and wanted and wanted.issubset(set(_norm(best).split())) and len(best) <= limit else None


def _equivalent_evidence_snippet(text: str, requirement: str, limit: int = 260) -> str | None:
    """Find one full source sentence whose maintained aliases normalize to the requirement."""
    wanted = set(canonicalize_matching_text(requirement).split())
    exact = set(_plain_norm(requirement).split())
    for sentence in re.split(r"(?<=[.!?])\s+|\n+", text):
        candidate = set(canonicalize_matching_text(sentence).split())
        if wanted and wanted.issubset(candidate) and not exact.issubset(set(_plain_norm(sentence).split())):
            return sentence.strip() if len(sentence.strip()) <= limit else None
    return None


def _validate_semantic_judgment(judgment: Any, chunk: str) -> dict[str, Any] | None:
    """Accept only the exact judge schema and quoted evidence copied from the resume chunk."""
    if not isinstance(judgment, dict) or set(judgment) != {"verdict", "confidence", "evidence_quote", "reason"}:
        return None
    verdict, confidence = judgment["verdict"], judgment["confidence"]
    quote, reason = judgment["evidence_quote"], judgment["reason"]
    if verdict not in {"direct", "partial", "none", "unverifiable"} or not isinstance(confidence, (int, float)) or not math.isfinite(float(confidence)) or not 0 <= confidence <= 1:
        return None
    if not isinstance(quote, str) or not isinstance(reason, str) or confidence < 0.7:
        return None
    if verdict in {"direct", "partial"} and (not quote or quote not in chunk):
        return None
    return judgment


def generate_requirement_interview_questions(requirements: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Create grounded recruiter probes for unresolved evidence and non-scored responsibilities."""
    questions = []
    for item in requirements:
        classification = item.get("classification")
        status = item.get("evidence_status", item.get("status"))
        if classification != "Responsibility" and status not in {"PARTIAL_MATCH", "UNVERIFIED"}:
            continue
        requirement = item.get("original_text", "the role requirement")
        responsibility = classification == "Responsibility"
        focus = "Responsibility" if responsibility else "Evidence verification"
        question = (
            f"Describe a specific example of how you handled: {requirement}."
            if responsibility
            else f"What hands-on experience can you substantiate for: {requirement}?"
        )
        signal = "Clear ownership, approach, decisions, and outcome." if responsibility else "A concrete project example, personal contribution, and depth of experience."
        questions.append({"focus_skill": requirement, "type": focus, "question": question, "expected_signal": signal, "what_to_look_for": signal})
    return questions


def _month_index(value: str, as_of: date) -> tuple[int | None, bool]:
    """Convert only explicit year/month values; year-only dates are retained as ambiguous."""
    value = value.strip().lower()
    if value in {"present", "current", "now", "till date", "till present", "to date"}:
        return as_of.year * 12 + as_of.month - 1, False
    month_year = re.fullmatch(r"([a-z]{3,9})\s+(\d{4})", value)
    if month_year:
        month = _MONTHS.get(month_year.group(1)[:3], _MONTHS.get(month_year.group(1)))
        return (int(month_year.group(2)) * 12 + month - 1, False) if month else (None, True)
    year_month = re.fullmatch(r"(\d{4})[-/](\d{1,2})", value)
    if year_month:
        year, month = int(year_month.group(1)), int(year_month.group(2))
        return (year * 12 + month - 1, False) if 1 <= month <= 12 else (None, True)
    month_year_numeric = re.fullmatch(r"(\d{1,2})[-/](\d{4})", value)
    if month_year_numeric:
        month, year = int(month_year_numeric.group(1)), int(month_year_numeric.group(2))
        return (year * 12 + month - 1, False) if 1 <= month <= 12 else (None, True)
    return None, True


def calculate_experience(resume_text: str, relevant_terms: list[str], as_of: date | None = None) -> dict[str, Any]:
    """Merge dated employment month intervals, excluding internships from professional tenure."""
    today = as_of or date.today()
    today_month = today.year * 12 + today.month - 1
    current_section = ""
    inside_experience = False
    blocks: list[dict[str, Any]] = []
    lines = resume_text.splitlines()
    next_context_start = 0
    for index, raw_line in enumerate(lines):
        line = raw_line.strip()
        if not line:
            continue
        heading_raw = line.strip("#:* ")
        heading = heading_raw.lower()
        if not _DATE_RANGE.search(line) and len(heading) < 80 and (heading_raw.upper() == heading_raw or raw_line.strip().endswith(":") or heading in _RESUME_SECTION_HEADINGS):
            is_experience = bool(re.search(r"\b(?:experience|employment|work history|professional history|internships?)\b", heading))
            if is_experience:
                current_section = heading
                inside_experience = True
                next_context_start = index + 1
            elif inside_experience:
                inside_experience = False
            continue
        if not inside_experience:
            continue
        match = _DATE_RANGE.search(line)
        if not match:
            continue
        start, start_ambiguous = _month_index(match.group("start"), today)
        end, end_ambiguous = _month_index(match.group("end"), today)
        if end is not None and end > today_month:
            end = today_month
        tail = []
        for following in lines[index + 1:]:
            next_heading = following.strip().strip("#:* ")
            if _DATE_RANGE.search(following) or (len(next_heading) < 80 and (next_heading.upper() == next_heading or following.strip().endswith(":"))):
                break
            tail.append(following.strip())
        context = " ".join(lines[max(next_context_start, index - 3):index + 1] + tail).strip()
        next_context_start = index + 1
        internship = bool(re.search(r"\bintern(ship)?\b", current_section + " " + context, re.I))
        ambiguous = start_ambiguous or end_ambiguous or start is None or end is None or start > end or start > today_month
        matching_terms = {term for term in relevant_terms if len(term) > 2 and term not in _STOP and term in _norm(context).split()}
        blocks.append({"start": start, "end": end, "internship": internship, "ambiguous": ambiguous, "evidence": context, "relevant": len(matching_terms) >= 2})

    # Entries mentioning employment but lacking a parseable interval make the timeline incomplete.
    timeline_lines = [line for line in lines if re.search(r"\b(?:experience|employment|work history|internship)\b", line, re.I)]
    ambiguous_timeline = any(block["ambiguous"] for block in blocks) or bool(timeline_lines and not blocks)
    professionals = [block for block in blocks if not block["internship"] and not block["ambiguous"]]
    internships = [block for block in blocks if block["internship"] and not block["ambiguous"]]
    relevant = [block for block in professionals if block["relevant"]]

    def merged_months(intervals: list[dict[str, Any]]) -> int:
        ranges = sorted((item["start"], item["end"]) for item in intervals)
        total = 0
        if not ranges:
            return total
        start, end = ranges[0]
        for next_start, next_end in ranges[1:]:
            if next_start <= end + 1:
                end = max(end, next_end)
            else:
                total += end - start + 1
                start, end = next_start, next_end
        return total + end - start + 1

    known_professional_months = merged_months(professionals)
    known_internship_months = merged_months(internships)
    known_relevant_months = merged_months(relevant)
    verified = bool(blocks) and not ambiguous_timeline
    return {
        "status": "VERIFIED" if verified else "UNVERIFIED",
        "total_professional_years": round(known_professional_months / 12, 2) if verified else None,
        "relevant_years": round(known_relevant_months / 12, 2) if verified and relevant else 0.0 if verified else None,
        "internship_years": round(known_internship_months / 12, 2) if verified else None,
        "known_professional_years": round(known_professional_months / 12, 2),
        "known_relevant_years": round(known_relevant_months / 12, 2),
        "ambiguous_timeline": ambiguous_timeline,
        "employment_evidence": [block["evidence"] for block in relevant],
    }


def _stated_experience_claims(resume_text: str) -> list[dict[str, Any]]:
    """Capture explicit years claims verbatim without treating them as calculated employment tenure."""
    claims = []
    for line in resume_text.splitlines():
        if not re.search(r"\b(?:experience|developer|engineer|consultant|architect)\b", line, re.I):
            continue
        match = re.search(r"\b(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\b", line, re.I)
        if match:
            claims.append({"stated_years": float(match.group(1)), "evidence": line.strip(), "source": "resume_text"})
    return claims


def evaluate_requirements(
    jd_text: str,
    resume_text: str,
    *,
    resume_complete: bool,
    profile_summary: str = "",
    profile_skills: list[str] | None = None,
    role_title: str = "",
    as_of: date | None = None,
    semantic_matcher: Callable[[str, str], float] | None = None,
    semantic_judge: Callable[[str, str, float], dict[str, Any]] | None = None,
    semantic_unavailable_reason: str | None = None,
) -> dict[str, Any]:
    """Evaluate and score all requirements identically for pasted and persisted comparisons."""
    extraction = extract_jd_requirements_with_audit(jd_text)
    requirements = extraction["requirements"]
    relevant_terms = _key_terms(" ".join([role_title] + [item["original_text"] for item in requirements if item["category"] in {"domain_knowledge", "key_responsibilities", "minimum_experience"}]))
    stated_experience_context = set(_key_terms(canonicalize_matching_text(" ".join(
        [role_title] + [item["original_text"] for item in requirements
                       if item["classification"] == "Mandatory" and item["category"] != "key_responsibilities"]
    ))))
    experience = calculate_experience(resume_text, relevant_terms, as_of)
    rows = []
    semantic_success_count = 0
    semantic_failure_count = 0
    for req in requirements:
        text, category = req["original_text"], req["category"]
        tokens = req["tokens"]
        semantic_score = None
        requirement_minimum = requirement_maximum = None
        alternatives = req.get("alternatives") or []
        alternative_snippets = [(alternative, _full_evidence_snippet(resume_text, _key_terms(alternative))) for alternative in alternatives]
        matched_alternative = next(((alternative, evidence) for alternative, evidence in alternative_snippets if evidence), None)
        snippet = matched_alternative[1] if matched_alternative else _full_evidence_snippet(resume_text, tokens)
        equivalent_snippet = _equivalent_evidence_snippet(resume_text, matched_alternative[0]) if matched_alternative else _equivalent_evidence_snippet(resume_text, text) if not snippet else None
        matched_source = "resume_text" if snippet else None
        if category == "minimum_experience":
            range_match = re.search(r"(?P<min>\d+(?:\.\d+)?)\s*(?:-|\u2013|\u2014|to)\s*(?P<max>\d+(?:\.\d+)?)\s*(?:years?|yrs?)|(?:at least|minimum of)\s+(?P<atleast>\d+(?:\.\d+)?)\s*(?:years?|yrs?)", text, re.I)
            minimum = float(range_match.group("min") or range_match.group("atleast")) if range_match else None
            if minimum is None:
                plus_years = re.search(r"(\d+(?:\.\d+)?)\s*\+\s*(?:years?|yrs?)", text, re.I)
                minimum = float(plus_years.group(1)) if plus_years else None
            maximum = float(range_match.group("max")) if range_match and range_match.group("max") else None
            requirement_minimum, requirement_maximum = minimum, maximum
            relevant_years = experience["relevant_years"]
            stated_claim = next(
                (claim for claim in _stated_experience_claims(resume_text)
                 if claim["stated_years"] >= (minimum or float("inf"))
                 and bool(stated_experience_context.intersection(
                     _key_terms(canonicalize_matching_text(claim["evidence"]))
                 ))),
                None,
            )
            if relevant_years is None and stated_claim and minimum is not None:
                status, credit, snippet, source = "DIRECT_MATCH", 1.0, stated_claim["evidence"], "resume_stated_experience"
                explanation = f"Candidate-stated {stated_claim['stated_years']:g} years in relevant role context meets the {minimum:g}-year minimum; employment dates are not independently verified."
            elif relevant_years is None or minimum is None:
                status, credit, snippet, source = "UNVERIFIED", None, None, None
                explanation = "Employment dates or relevant role evidence are insufficient to verify experience."
            else:
                ratio = relevant_years / minimum if relevant_years < minimum else min(1.0, maximum / relevant_years) if maximum and relevant_years > maximum and relevant_years else 1.0
                status = "DIRECT_MATCH" if ratio >= 1.0 else "PARTIAL_MATCH" if ratio > 0 else "MISSING"
                credit = 1.0 if status == "DIRECT_MATCH" else min(PARTIAL_CREDIT_CAP, ratio) if status == "PARTIAL_MATCH" else 0.0
                source = "resume_employment_dates" if experience["employment_evidence"] else None
                snippet = experience["employment_evidence"][0] if source else None
                explanation = f"Calculated relevant professional experience: {relevant_years:.2f} years; required range {minimum:g}–{maximum:g} years." if maximum else f"Calculated relevant professional experience: {relevant_years:.2f} years; minimum {minimum:g}."
        elif matched_source:
            status, credit, source = "DIRECT_MATCH", 1.0, matched_source
            explanation = "All specific requirement terms occur together in verbatim resume or profile evidence."
        elif equivalent_snippet:
            status, credit, source = "EQUIVALENT_MATCH", 0.9, "resume_text"
            snippet = equivalent_snippet
            explanation = "Resume sentence uses maintained equivalent terminology from the shared alias map."
        elif category == "educational_qualifications" and re.search(r"\b(?:bachelor|master|b\.?tech|b\.?e\.?|b\.?com|b\.?sc|m\.?sc|mba|mca|bca|bfa|b\.?des|b\.?a\.?|diploma|college|university|degree)\b", resume_text, re.I):
            deg_match = re.search(r"([^.\n]*\b(?:bachelor|master|b\.?tech|b\.?e\.?|b\.?com|b\.?sc|m\.?sc|mba|mca|bca|bfa|b\.?des|b\.?a\.?|diploma|college|university|degree)\b[^.\n]*)", resume_text, re.I)
            snippet = deg_match.group(1).strip() if deg_match else None
            status, credit, source = "EQUIVALENT_MATCH", 1.0, "resume_text"
            explanation = "Candidate holds a recognized collegiate degree or equivalent credential matching educational requirements."
        elif category == "portfolio_requirements" and re.search(r"\b(?:portfolio|behance|dribbble|artstation|myportfolio|campaigns?|creative samples?)\b", resume_text, re.I):
            port_match = re.search(r"([^.\n]*\b(?:portfolio|behance|dribbble|artstation|myportfolio|campaigns?|creative samples?)\b[^.\n]*)", resume_text, re.I)
            snippet = port_match.group(1).strip() if port_match else None
            status, credit, source = "DIRECT_MATCH", 1.0, "resume_text"
            explanation = "Candidate profile provides verifiable portfolio evidence, creative campaigns, or portfolio URL."
        else:
            source, snippet, semantic_score = None, None, None
            profile_skill = next((skill for skill in (profile_skills or []) if _norm(skill) == _norm(text)), None)
            if profile_skill:
                status, credit, source, snippet = "PARTIAL_MATCH", 0.5, "candidate_skills", profile_skill
                explanation = "The structured candidate profile lists this skill; depth is not demonstrated by the resume excerpt."
            elif profile_skills and any(set(tokens) & set(_key_terms(skill)) for skill in profile_skills):
                profile_skill = next(skill for skill in profile_skills if set(tokens) & set(_key_terms(skill)))
                status, credit, source, snippet = "PARTIAL_MATCH", 0.5, "candidate_skills", profile_skill
                explanation = "The structured candidate profile lists this skill; depth is not demonstrated by the resume excerpt."
            elif semantic_matcher and resume_text:
                chunks = [part.strip() for part in re.split(r"(?<=[.!?])\s+|\n+", resume_text) if part.strip()]
                scored_chunks = []
                try:
                    for chunk in chunks:
                        value = float(semantic_matcher(text, chunk))
                        if not math.isfinite(value) or not 0 <= value <= 1:
                            raise ValueError("Semantic similarity must be finite and between zero and one.")
                        scored_chunks.append((value, chunk))
                    if not scored_chunks:
                        raise ValueError("Resume contains no sentence-sized evidence chunks.")
                    semantic_score, best_chunk = max(scored_chunks, key=lambda item: item[0])
                    semantic_success_count += 1
                    if semantic_score < SEMANTIC_PARTIAL_THRESHOLD:
                        status, credit, explanation = ("MISSING", 0.0, "No semantically relevant supporting sentence was found in the reviewed resume.") if resume_complete else ("UNVERIFIED", None, "Resume completeness is insufficient to confirm absence.")
                    elif semantic_judge and SEMANTIC_BORDERLINE_THRESHOLD <= semantic_score < 0.88:
                        judgment = _validate_semantic_judgment(semantic_judge(text, best_chunk, semantic_score), best_chunk)
                        if judgment is None:
                            status, credit, explanation = "UNVERIFIED", None, "The borderline semantic judgment failed schema or evidence-quote validation."
                        else:
                            snippet = judgment["evidence_quote"] or None
                            source = "resume_text" if snippet else None
                            explanation = judgment["reason"]
                            verdict = judgment["verdict"]
                            if verdict == "direct":
                                status, credit = "EQUIVALENT_MATCH", 0.9
                            elif verdict == "partial":
                                status, credit = "PARTIAL_MATCH", round(min(PARTIAL_CREDIT_CAP, max(0.5, 0.5 + (semantic_score - SEMANTIC_PARTIAL_THRESHOLD) * 0.3 / (1 - SEMANTIC_PARTIAL_THRESHOLD))), 4)
                            elif verdict == "none":
                                status, credit = ("MISSING", 0.0) if resume_complete else ("UNVERIFIED", None)
                            else:
                                status, credit = "UNVERIFIED", None
                    else:
                        status = "PARTIAL_MATCH"
                        credit = round(min(PARTIAL_CREDIT_CAP, max(0.5, 0.5 + (semantic_score - SEMANTIC_PARTIAL_THRESHOLD) * 0.3 / (1 - SEMANTIC_PARTIAL_THRESHOLD))), 4)
                        snippet, source = (best_chunk, "resume_text") if len(best_chunk) <= 260 else (None, None)
                        explanation = f"Best supporting resume sentence has semantic similarity {semantic_score:.2f}; it supports part, not all, of the requirement."
                except Exception:
                    semantic_failure_count += 1
                    status, credit, explanation = "UNVERIFIED", None, "The configured 2048-dimensional semantic comparison was unavailable or invalid."
            elif resume_complete and (semantic_matcher is not None or category in {"technical_skills", "tools_and_technologies", "portfolio_requirements"}):
                status, credit, explanation = "MISSING", 0.0, "No supporting evidence was found in the reviewed resume."
            else:
                status, credit, explanation = "UNVERIFIED", None, "Semantic evidence was not run; lexical overlap alone cannot establish a match or a confirmed gap."
        weight = MANDATORY_WEIGHT
        rows.append({**req, "evidence_status": status, "status": status, "evidence": snippet, "evidence_source": source, "explanation": explanation, "confidence": {"DIRECT_MATCH": 0.95, "EQUIVALENT_MATCH": 0.85, "PARTIAL_MATCH": 0.65, "MISSING": 0.85, "UNVERIFIED": 0.0}[status], "credit": credit, "weight": weight, "semantic_similarity": semantic_score, "experience_minimum": requirement_minimum, "experience_maximum": requirement_maximum})

    # Only mandatory requirements determine the base; preferences can add at most ten points.
    mandatory_rows = [row for row in rows if row["classification"] == "Mandatory"]
    evaluable = [row for row in mandatory_rows if row["evidence_status"] != "UNVERIFIED"]
    denominator = sum(row["weight"] for row in evaluable)
    mandatory_score = 100 * sum((row["credit"] or 0) * row["weight"] for row in evaluable) / denominator if denominator else None
    preferred_rows = [row for row in rows if row["classification"] == "Preferred" and row["evidence_status"] != "UNVERIFIED"]
    preferred_denominator = sum(row["weight"] for row in preferred_rows)
    preferred_score = 100 * sum((row["credit"] or 0) * row["weight"] for row in preferred_rows) / preferred_denominator if preferred_denominator else None
    preferred_bonus = min(PREFERRED_BONUS_CAP, PREFERRED_BONUS_CAP * preferred_score / 100) if preferred_score is not None else 0.0
    unrounded = min(100.0, mandatory_score + preferred_bonus) if mandatory_score is not None else None
    applied_preferred_bonus = unrounded - mandatory_score if unrounded is not None and mandatory_score is not None else 0.0
    for row in rows:
        if row["classification"] == "Mandatory" and denominator and row["evidence_status"] != "UNVERIFIED":
            row["score_contribution"] = round(100 * (row["credit"] or 0) * row["weight"] / denominator, 4)
        elif row["classification"] == "Preferred" and preferred_denominator and row["evidence_status"] != "UNVERIFIED":
            row["score_contribution"] = round(applied_preferred_bonus * (row["credit"] or 0) * row["weight"] / preferred_denominator / max(preferred_score / 100, 1e-12), 4)
        else:
            row["score_contribution"] = None

    def category_score(predicate) -> float | None:
        selected = [row for row in evaluable if predicate(row)]
        weight = sum(row["weight"] for row in selected)
        return round(100 * sum((row["credit"] or 0) * row["weight"] for row in selected) / weight, 2) if weight else None

    coverage = 100 * sum(row["evidence_status"] != "UNVERIFIED" for row in rows) / len(rows) if rows else 0.0
    confidence = sum(row["confidence"] * row["weight"] for row in evaluable) / denominator if denominator else 0.0
    confidence = min(confidence, coverage / 100)
    confidence_label = "High" if confidence >= 0.85 else "Medium" if confidence >= 0.6 else "Low"
    if semantic_success_count == 0:
        confidence = min(confidence, 0.4)
        confidence_label = "Low"
    responsibility_rows = [row for row in rows if row["classification"] == "Responsibility" and row["evidence_status"] != "UNVERIFIED"]
    responsibility_weight = sum(row["weight"] for row in responsibility_rows)
    responsibility_score = round(100 * sum((row["credit"] or 0) * row["weight"] for row in responsibility_rows) / responsibility_weight, 2) if responsibility_weight else None
    domain_score = category_score(lambda row: row["category"] == "domain_knowledge")
    location_score = category_score(lambda row: row["category"] in {"location_requirements", "employment_type"})
    return {
        "requirements": rows,
        "line_audit": extraction["line_audit"],
        "ignored_lines": extraction["ignored_lines"],
        "match_score_unrounded": unrounded,
        "match_score": round(unrounded) if unrounded is not None else None,
        "classification": classify_match_tier(round(unrounded)) if unrounded is not None else "Insufficient Evidence",
        "mandatory_score": round(mandatory_score, 2) if mandatory_score is not None else None,
        "preferred_score": round(preferred_score, 2) if preferred_score is not None else None,
        "preferred_bonus": round(applied_preferred_bonus, 4),
        "scoring_mode": "semantic" if semantic_success_count else "lexical-only",
        "semantic_unavailable_reason": "Configured 2048-dimensional semantic comparison failed; unresolved evidence remains unverified." if semantic_failure_count else semantic_unavailable_reason or "Semantic comparison was not run for this input; unresolved evidence remains unverified." if not semantic_success_count else None,
        "semantic_fit_score": round(sum(row["semantic_similarity"] for row in rows if row["semantic_similarity"] is not None) / max(1, sum(row["semantic_similarity"] is not None for row in rows)), 4) if semantic_success_count else None,
        "semantic_model": getattr(semantic_matcher, "model_name", None) if semantic_success_count else None,
        "semantic_dimensions": getattr(semantic_matcher, "dimensions", None) if semantic_success_count else None,
        "semantic_judge_model": getattr(semantic_judge, "model_name", None) if semantic_judge else None,
        "technical_score": category_score(lambda row: row["category"] in {"mandatory_skills", "preferred_skills", "technical_skills", "tools_and_technologies", "domain_knowledge"}),
        "education_score": category_score(lambda row: row["category"] in {"educational_qualifications", "certifications"}),
        "experience_score": category_score(lambda row: row["category"] == "minimum_experience"),
        "responsibility_score": responsibility_score,
        "domain_score": domain_score,
        "location_score": location_score,
        "evidence_coverage": round(coverage, 2),
        "score_confidence": confidence_label,
        "score_confidence_value": round(confidence, 4),
        "missing_count": sum(row["evidence_status"] == "MISSING" for row in rows),
        "unverified_count": sum(row["evidence_status"] == "UNVERIFIED" for row in rows),
        "mandatory_gap_count": sum(row["classification"] == "Mandatory" and row["evidence_status"] == "MISSING" for row in rows),
        "mandatory_unverified_count": sum(row["classification"] == "Mandatory" and row["evidence_status"] == "UNVERIFIED" for row in rows),
        "experience": experience,
        "stated_experience_claims": _stated_experience_claims(resume_text),
    }


def classify_match_tier(score: int) -> str:
    """Keep the requested suitability bands centralized for every comparison view."""
    if score >= 80:
        return "Strong"
    if score >= 60:
        return "Good"
    if score >= 40:
        return "Partial"
    return "Weak"
