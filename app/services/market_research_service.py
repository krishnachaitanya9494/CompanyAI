"""Real-World Employment Market Research Service with Source Provenance.

Retrieves public job postings and employment market reports using approved,
unauthenticated public endpoints (Arbeitnow, Remotive, Google News RSS) via
`httpx`. Never bypasses authentication/CAPTCHAs, never scrapes restricted
portals, and never fabricates vacancies, salaries, or market statistics.
"""

from __future__ import annotations

import hashlib
import html
import logging
import re
import time
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote_plus

import httpx

from app.services.skill_taxonomy_service import extract_skills_from_jd

logger = logging.getLogger("companyai.services.market_research")

# Bound external HTTP requests so report generation remains responsive.
HTTP_TIMEOUT_SECONDS = 8.0
CACHE_TTL_SECONDS = 900  # 15 minutes
_USER_AGENT = "CompanyAI-MarketResearch/1.0 (+https://localhost)"

# In-memory cache keyed by (job_id, jd_hash, location) -> (timestamp, payload)
_RESEARCH_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}

# Common salary pattern in public job/news snippets (e.g., "12-18 LPA", "$90,000 - $120,000", "₹15,00,000")
_SALARY_PATTERN = re.compile(
    r"(?:₹|INR|Rs\.?|\$|USD|€|EUR|£|GBP)\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|K|L|LPA|Cr|lakhs?|crores?|per\s+annum|p\.a\.|/yr|/year))?"
    r"(?:\s?[-–to]+\s?(?:₹|INR|Rs\.?|\$|USD|€|EUR|£|GBP)?\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|K|L|LPA|Cr|lakhs?|crores?|per\s+annum|p\.a\.|/yr|/year))?)?"
    r"|\b\d+(?:\.\d+)?\s?[-–to]+\s?\d+(?:\.\d+)?\s?(?:LPA|lakhs?\s+per\s+annum)\b",
    re.IGNORECASE,
)

# Common experience pattern in public job descriptions/titles (e.g., "3-5 years", "5+ yrs")
_EXP_PATTERN = re.compile(
    r"\b(\d{1,2}\s?(?:[-–to]+\s?\d{1,2}|\+)\s?(?:years?|yrs?))\b",
    re.IGNORECASE,
)


def _now_iso() -> str:
    """Return current UTC ISO timestamp."""
    return datetime.now(timezone.utc).isoformat()


def _today_str() -> str:
    """Return current UTC date string (YYYY-MM-DD)."""
    return datetime.now(timezone.utc).date().isoformat()


def _strip_html(raw: str) -> str:
    """Remove HTML tags and unescape entities into clean single-line text."""
    text = re.sub(r"<[^>]+>", " ", raw or "")
    text = html.unescape(text)
    return " ".join(text.split()).strip()


def _parse_pub_date(raw: Optional[str]) -> Optional[str]:
    """Normalize RSS/ISO/epoch dates into YYYY-MM-DD when parseable."""
    if not raw:
        return None
    val = str(raw).strip()
    if not val:
        return None
    if val.isdigit():
        try:
            return datetime.fromtimestamp(int(val), tz=timezone.utc).date().isoformat()
        except Exception:
            return None
    try:
        return datetime.fromisoformat(val.replace("Z", "+00:00")).date().isoformat()
    except Exception:
        pass
    try:
        return parsedate_to_datetime(val).date().isoformat()
    except Exception:
        return val[:10] if len(val) >= 10 else val


def _tokenize_role_terms(job_title: str, mandatory_skills: List[str]) -> List[str]:
    """Extract clean, lowercase search keywords dynamically from any JD title and skills."""
    stop = {
        "and", "or", "the", "for", "with", "in", "of", "to", "a", "an", "on", "at",
        "senior", "junior", "lead", "staff", "principal", "associate", "manager",
        "specialist", "analyst", "engineer", "developer", "consultant", "executive",
        "job", "role", "position", "req", "requisition", "jd",
    }
    clean_title = re.sub(r"\([^)]*\)", " ", job_title or "")
    title_words = [
        w.lower()
        for w in re.findall(r"[A-Za-z0-9+#.-]{2,}", clean_title)
        if w.lower() not in stop
    ]
    skill_words = [s.strip().lower() for s in (mandatory_skills or []) if s and len(s.strip()) >= 2]
    seen: set[str] = set()
    ordered: List[str] = []
    for term in title_words + skill_words[:6]:
        if term not in seen:
            seen.add(term)
            ordered.append(term)
    return ordered


def _relevance_score(text: str, role_terms: List[str], title_lower: str, location_lower: str) -> int:
    """Compute a simple deterministic relevance score for a fetched posting or news item."""
    hay = (text or "").lower()
    score = 0
    if title_lower and title_lower in hay:
        score += 5
    for term in role_terms:
        if term in hay:
            score += 2
    if location_lower:
        loc_parts = [p.strip() for p in re.split(r"[,/|]+", location_lower) if len(p.strip()) >= 3]
        for part in loc_parts:
            if part in hay:
                score += 2
                break
    return score


def _fetch_arbeitnow_postings(
    client: httpx.Client,
    job_title: str,
    role_terms: List[str],
    location: str,
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """Query Arbeitnow's public job board JSON API and filter for relevant postings."""
    url = "https://www.arbeitnow.com/api/job-board-api"
    accessed = _today_str()
    try:
        resp = client.get(url)
        resp.raise_for_status()
        payload = resp.json()
        rows = payload.get("data") or []
    except Exception as exc:
        logger.warning("Arbeitnow lookup failed: %s", exc)
        return [], f"Arbeitnow public job board unavailable ({exc})"

    title_lower = (job_title or "").strip().lower()
    loc_lower = (location or "").strip().lower()
    matched: List[Tuple[int, Dict[str, Any]]] = []

    for item in rows[:250]:
        title = str(item.get("title") or "").strip()
        company = str(item.get("company_name") or "").strip()
        item_loc = str(item.get("location") or "").strip()
        desc = _strip_html(str(item.get("description") or ""))
        tags = [str(t).strip() for t in (item.get("tags") or []) if str(t).strip()]
        combined = f"{title} {' '.join(tags)} {desc[:1200]}"
        score = _relevance_score(combined, role_terms, title_lower, loc_lower)
        if score < 2:
            continue

        exp_match = _EXP_PATTERN.search(desc)
        salary_match = _SALARY_PATTERN.search(desc)
        matched.append((
            score,
            {
                "company_name": company or "Not specified",
                "job_title": title,
                "location": item_loc or ("Remote" if item.get("remote") else "Not specified"),
                "experience_requirement": exp_match.group(1) if exp_match else "Not specified in posting",
                "posted_date": _parse_pub_date(str(item.get("created_at") or "")) or "Date not listed",
                "source_name": "Arbeitnow Public Job Board",
                "source_url": str(item.get("url") or url),
                "accessed_date": accessed,
                "evidence_type": "Verified information",
                "vacancy_status": "Advertised / previously observed vacancy",
                "skills_mentioned": tags[:10],
                "salary_snippet": salary_match.group(0) if salary_match else None,
                "snippet": desc[:260],
            },
        ))

    matched.sort(key=lambda pair: pair[0], reverse=True)
    return [row for _, row in matched[:8]], None


def _fetch_remotive_postings(
    client: httpx.Client,
    job_title: str,
    role_terms: List[str],
    location: str,
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """Query Remotive's public remote jobs JSON API using dynamic JD keywords."""
    query = " ".join(role_terms[:3]) or job_title or "specialist"
    url = f"https://remotive.com/api/remote-jobs?search={quote_plus(query)}&limit=25"
    accessed = _today_str()
    try:
        resp = client.get(url)
        resp.raise_for_status()
        payload = resp.json()
        rows = payload.get("jobs") or []
    except Exception as exc:
        logger.warning("Remotive lookup failed: %s", exc)
        return [], f"Remotive public job feed unavailable ({exc})"

    title_lower = (job_title or "").strip().lower()
    loc_lower = (location or "").strip().lower()
    matched: List[Tuple[int, Dict[str, Any]]] = []

    for item in rows[:25]:
        title = str(item.get("title") or "").strip()
        company = str(item.get("company_name") or "").strip()
        item_loc = str(item.get("candidate_required_location") or "Remote").strip()
        desc = _strip_html(str(item.get("description") or ""))
        tags = [str(t).strip() for t in (item.get("tags") or []) if str(t).strip()]
        salary = str(item.get("salary") or "").strip()
        combined = f"{title} {' '.join(tags)} {desc[:1200]}"
        score = _relevance_score(combined, role_terms, title_lower, loc_lower)
        if score < 2:
            continue

        exp_match = _EXP_PATTERN.search(desc)
        salary_snippet = salary if salary else None
        if not salary_snippet:
            sm = _SALARY_PATTERN.search(desc)
            salary_snippet = sm.group(0) if sm else None

        matched.append((
            score,
            {
                "company_name": company or "Not specified",
                "job_title": title,
                "location": item_loc,
                "experience_requirement": exp_match.group(1) if exp_match else "Not specified in posting",
                "posted_date": _parse_pub_date(str(item.get("publication_date") or "")) or "Date not listed",
                "source_name": "Remotive Public Job Board",
                "source_url": str(item.get("url") or url),
                "accessed_date": accessed,
                "evidence_type": "Verified information",
                "vacancy_status": "Advertised / previously observed vacancy",
                "skills_mentioned": tags[:10],
                "salary_snippet": salary_snippet,
                "snippet": desc[:260],
            },
        ))

    matched.sort(key=lambda pair: pair[0], reverse=True)
    return [row for _, row in matched[:8]], None


def _fetch_google_news_rss(
    client: httpx.Client,
    query: str,
    category: str,
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """Fetch public Google News RSS items for employment market & hiring activity."""
    rss_url = f"https://news.google.com/rss/search?q={quote_plus(query)}&hl=en-IN&gl=IN&ceid=IN:en"
    accessed = _today_str()
    try:
        resp = client.get(rss_url)
        resp.raise_for_status()
        root = ET.fromstring(resp.text)
    except Exception as exc:
        logger.warning("Google News RSS lookup failed (%s): %s", category, exc)
        return [], f"Public news feed ({category}) unavailable ({exc})"

    items: List[Dict[str, Any]] = []
    for item_el in root.findall("./channel/item")[:10]:
        title = (item_el.findtext("title") or "").strip()
        link = (item_el.findtext("link") or "").strip()
        pub_date = _parse_pub_date(item_el.findtext("pubDate"))
        source_el = item_el.find("source")
        source_name = (source_el.text or "Google News").strip() if source_el is not None else "Google News"
        desc = _strip_html(item_el.findtext("description") or "")
        if not title or not link:
            continue
        salary_match = _SALARY_PATTERN.search(f"{title} {desc}")
        items.append({
            "title": title,
            "source_name": source_name,
            "source_url": link,
            "published_date": pub_date or "Date not listed",
            "accessed_date": accessed,
            "category": category,
            "evidence_type": "Verified information",
            "salary_snippet": salary_match.group(0) if salary_match else None,
            "snippet": desc[:260],
        })
    return items, None


def _extract_skills_from_postings(
    postings: List[Dict[str, Any]],
    jd_mandatory: List[str],
    jd_preferred: List[str],
) -> Dict[str, Any]:
    """Compare skills observed in reviewed job postings against JD mandatory/preferred skills."""
    jd_mand_set = {s.lower(): s for s in (jd_mandatory or []) if s}
    jd_pref_set = {s.lower(): s for s in (jd_preferred or []) if s}
    jd_all_lower = set(jd_mand_set) | set(jd_pref_set)

    skill_counts: Counter = Counter()
    display_names: Dict[str, str] = {}

    for post in postings:
        seen_in_post: set[str] = set()
        raw_tags = list(post.get("skills_mentioned") or [])
        extracted = extract_skills_from_jd(
            f"{post.get('job_title', '')} {post.get('snippet', '')}",
            title=post.get("job_title", ""),
            use_ai=False,
        )
        candidates = raw_tags + list(extracted.get("mandatory_skills") or []) + list(extracted.get("preferred_skills") or [])
        for skill in candidates:
            s_clean = str(skill or "").strip()
            s_low = s_clean.lower()
            if len(s_clean) < 2 or s_low in seen_in_post:
                continue
            seen_in_post.add(s_low)
            skill_counts[s_low] += 1
            display_names.setdefault(s_low, s_clean)

    sample_size = len(postings)
    jd_skills_seen = [
        {"skill": jd_mand_set.get(k) or jd_pref_set.get(k) or display_names[k], "mentions": cnt}
        for k, cnt in skill_counts.most_common()
        if k in jd_all_lower
    ]

    # Do not present a skill as an industry trend based on a single job advertisement.
    min_mentions = 2 if sample_size >= 2 else 999
    additional_market_skills = [
        {"skill": display_names[k], "mentions": cnt}
        for k, cnt in skill_counts.most_common()
        if k not in jd_all_lower and cnt >= min_mentions
    ][:12]

    emerging_skills = [
        {"skill": display_names[k], "mentions": cnt}
        for k, cnt in skill_counts.most_common()
        if k not in jd_all_lower and cnt < min_mentions
    ][:8]

    return {
        "sample_size": sample_size,
        "jd_skills_observed_in_market": jd_skills_seen,
        "additional_market_skills": additional_market_skills,
        "emerging_or_single_mention_skills": emerging_skills,
        "sample_limitation_note": (
            f"Based on {sample_size} reviewed public job postings. "
            + ("Small sample size: treat single-posting skills cautiously." if sample_size < 5 else "Skills appearing in multiple postings are highlighted.")
        )
        if sample_size > 0
        else "No matching public job postings were retrieved to benchmark additional market skills.",
    }


def collect_market_intelligence(
    job_id: int,
    job_title: str,
    location: str,
    jd_text: str,
    mandatory_skills: List[str],
    preferred_skills: List[str],
    force_refresh: bool = False,
) -> Dict[str, Any]:
    """Collect real, sourced external market intelligence for a single requisition.

    Returns structured, provenance-tagged findings and status metadata so partial
    source failures never block report generation.
    """
    jd_digest = hashlib.sha256(
        f"{job_id}|{job_title}|{location}|{jd_text[:1500]}".encode("utf-8")
    ).hexdigest()[:16]
    cache_key = f"{job_id}:{jd_digest}"

    if not force_refresh and cache_key in _RESEARCH_CACHE:
        cached_ts, cached_data = _RESEARCH_CACHE[cache_key]
        if (time.time() - cached_ts) < CACHE_TTL_SECONDS:
            return cached_data

    role_terms = _tokenize_role_terms(job_title, mandatory_skills)
    clean_loc = (location or "India").strip()
    role_phrase = " ".join(role_terms[:3]) or job_title

    failed_sources: List[str] = []
    sources_checked: List[str] = []

    with httpx.Client(
        timeout=HTTP_TIMEOUT_SECONDS,
        follow_redirects=True,
        headers={"User-Agent": _USER_AGENT},
    ) as client:
        arbeitnow_posts, err_a = _fetch_arbeitnow_postings(client, job_title, role_terms, clean_loc)
        sources_checked.append("Arbeitnow Public Job Board")
        if err_a:
            failed_sources.append(err_a)

        remotive_posts, err_r = _fetch_remotive_postings(client, job_title, role_terms, clean_loc)
        sources_checked.append("Remotive Public Job Board")
        if err_r:
            failed_sources.append(err_r)

        hiring_news, err_n1 = _fetch_google_news_rss(
            client, f'"{role_phrase}" hiring OR jobs {clean_loc}', "Hiring Activity"
        )
        sources_checked.append("Google News RSS (Hiring)")
        if err_n1:
            failed_sources.append(err_n1)

        market_news, err_n2 = _fetch_google_news_rss(
            client, f'"{role_phrase}" salary OR skills market {clean_loc}', "Market & Salary Trends"
        )
        sources_checked.append("Google News RSS (Market & Salary)")
        if err_n2:
            failed_sources.append(err_n2)

    all_postings = arbeitnow_posts + remotive_posts
    skill_analysis = _extract_skills_from_postings(all_postings, mandatory_skills, preferred_skills)

    # Aggregate observed hiring locations & remote mentions from actual retrieved postings.
    observed_locations = Counter(
        p["location"] for p in all_postings if p.get("location") and p["location"] != "Not specified"
    )
    remote_count = sum(1 for p in all_postings if "remote" in (p.get("location") or "").lower())

    # Collect verifiable salary snippets only when explicitly present in retrieved sources.
    salary_entries: List[Dict[str, Any]] = []
    for p in all_postings:
        if p.get("salary_snippet"):
            salary_entries.append({
                "salary_range": p["salary_snippet"],
                "role": p["job_title"],
                "location": p["location"],
                "experience_level": p["experience_requirement"],
                "source_name": p["source_name"],
                "source_url": p["source_url"],
                "published_date": p["posted_date"],
                "accessed_date": p["accessed_date"],
                "classification": "Advertised salary",
                "evidence_type": "Verified information",
            })
    for n in market_news:
        if n.get("salary_snippet"):
            salary_entries.append({
                "salary_range": n["salary_snippet"],
                "role": job_title,
                "location": clean_loc,
                "experience_level": "See referenced article",
                "source_name": n["source_name"],
                "source_url": n["source_url"],
                "published_date": n["published_date"],
                "accessed_date": n["accessed_date"],
                "classification": "Published market report / article figure",
                "evidence_type": "Verified information",
            })

    # Build deduplicated source reference list for clickable citations.
    references: List[Dict[str, str]] = []
    seen_urls: set[str] = set()
    for item in all_postings + hiring_news + market_news:
        u = item.get("source_url")
        if u and u not in seen_urls:
            seen_urls.add(u)
            references.append({
                "title": item.get("job_title") or item.get("title") or item.get("source_name") or "Source",
                "source_name": item.get("source_name") or "Public Source",
                "source_url": u,
                "published_date": item.get("posted_date") or item.get("published_date") or "Date not listed",
                "accessed_date": item.get("accessed_date") or _today_str(),
                "evidence_type": item.get("evidence_type") or "Verified information",
            })

    result = {
        "researched_at": _now_iso(),
        "researched_date": _today_str(),
        "sources_checked": sources_checked,
        "failed_sources": failed_sources,
        "research_complete": len(failed_sources) == 0,
        "company_hiring_activity": all_postings,
        "hiring_news": hiring_news[:6],
        "market_news": market_news[:6],
        "skill_analysis": skill_analysis,
        "location_intelligence": {
            "requested_location": clean_loc,
            "observed_hiring_locations": [
                {"location": loc, "postings_count": cnt}
                for loc, cnt in observed_locations.most_common(10)
            ],
            "remote_mentions_count": remote_count,
            "total_postings_reviewed": len(all_postings),
        },
        "salary_intelligence": {
            "available": len(salary_entries) > 0,
            "entries": salary_entries[:8],
            "note": (
                "Salary figures below come directly from advertised job postings or cited articles."
                if salary_entries
                else "Market information not available for this section."
            ),
        },
        "source_references": references[:20],
    }

    if len(_RESEARCH_CACHE) > 50:
        _RESEARCH_CACHE.clear()
    _RESEARCH_CACHE[cache_key] = (time.time(), result)
    return result
