"""Collect public job descriptions and record manual-import fallbacks."""

from __future__ import annotations

import json
import re
import tempfile
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import httpx


# Resolve default paths from this module so commands work from any directory.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MANIFEST_PATH = PROJECT_ROOT / "data" / "jds" / "jd_sources.json"
DEFAULT_TEXT_DIRECTORY = PROJECT_ROOT / "data" / "jds" / "retrieved"
MANIFEST_SCHEMA_VERSION = 1
DEFAULT_TIMEOUT_SECONDS = 15.0
_SAFE_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$")


class _ReadableTextParser(HTMLParser):
    """Collect visible page text while skipping non-content HTML elements."""

    _BLOCK_TAGS = {
        "address", "article", "aside", "blockquote", "br", "dd", "div",
        "dl", "dt", "fieldset", "figcaption", "figure", "footer", "form",
        "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "li",
        "main", "ol", "p", "section", "table", "td", "th", "tr", "ul",
    }
    _IGNORED_TAGS = {"script", "style", "noscript", "svg", "template"}
    _VOID_TAGS = {
        "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr",
    }

    def __init__(self) -> None:
        """Initialize the parser's text buffer and ignored-element depth."""
        super().__init__(convert_charrefs=True)
        self._parts: list[str] = []
        self._ignored_tags: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        """Skip non-content elements and add spacing around block elements."""
        attributes = dict(attrs)
        is_hidden = (
            "hidden" in attributes
            or attributes.get("aria-hidden", "").lower() == "true"
            or "display:none" in attributes.get("style", "").replace(" ", "").lower()
        )
        if (tag in self._IGNORED_TAGS or is_hidden) and tag not in self._VOID_TAGS:
            self._ignored_tags.append(tag)
        if not self._ignored_tags and tag in self._BLOCK_TAGS:
            self._parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        """Resume visible text after ignored elements and close block spacing."""
        if self._ignored_tags and self._ignored_tags[-1] == tag:
            self._ignored_tags.pop()
        if not self._ignored_tags and tag in self._BLOCK_TAGS:
            self._parts.append("\n")

    def handle_data(self, data: str) -> None:
        """Append visible text nodes to the page text buffer."""
        if not self._ignored_tags and data.strip():
            self._parts.append(f" {data.strip()} ")

    def readable_text(self) -> str:
        """Return normalized readable text with blank lines collapsed."""
        lines = [
            " ".join(part.split())
            for part in "".join(self._parts).splitlines()
        ]
        return "\n".join(line for line in lines if line).strip()


def _utc_date() -> str:
    """Return today's UTC date in ISO format for retrieval metadata."""
    return datetime.now(timezone.utc).date().isoformat()


def _validate_source(source: dict[str, Any]) -> None:
    """Check required web-source fields and reject unsafe identifiers or URLs."""
    for field_name in ("jd_id", "company_name", "job_title", "source_url"):
        if not isinstance(source.get(field_name), str) or not source[field_name].strip():
            raise ValueError(f"Source is missing a valid {field_name}.")

    if not _SAFE_ID_PATTERN.fullmatch(source["jd_id"].strip()):
        raise ValueError("JD ID may contain only letters, numbers, dots, underscores, and hyphens.")

    parsed_url = urlsplit(source["source_url"].strip())
    if parsed_url.scheme.lower() not in {"http", "https"} or not parsed_url.hostname:
        raise ValueError("Source URL must be an absolute HTTP or HTTPS URL.")
    if parsed_url.username or parsed_url.password:
        raise ValueError("Source URL must not contain embedded credentials.")
    try:
        parsed_url.port
    except ValueError as error:
        raise ValueError("Source URL contains an invalid port.") from error


def _validate_local_source(source: dict[str, Any]) -> None:
    """Check required fields for a JD imported from a local file."""
    for field_name in (
        "jd_id",
        "job_title",
        "source_filename",
        "local_extracted_file_path",
        "source_sha256",
        "content_sha256",
        "import_status",
    ):
        if not isinstance(source.get(field_name), str) or not source[field_name].strip():
            raise ValueError(f"Local JD source is missing a valid {field_name}.")

    if not _SAFE_ID_PATTERN.fullmatch(source["jd_id"].strip()):
        raise ValueError("JD ID may contain only letters, numbers, dots, underscores, and hyphens.")

    for hash_field in ("source_sha256", "content_sha256"):
        if not re.fullmatch(r"[a-f0-9]{64}", source[hash_field]):
            raise ValueError(f"Local JD source contains an invalid {hash_field}.")


def _validate_manifest_source(source: dict[str, Any]) -> None:
    """Validate either a local-file import or an existing public URL source."""
    if source.get("source_type") == "local_file":
        _validate_local_source(source)
    else:
        _validate_source(source)


def _read_manifest(manifest_path: Path) -> dict[str, Any]:
    """Load the versioned manifest, returning an empty manifest if absent."""
    if not manifest_path.exists():
        return {"schema_version": MANIFEST_SCHEMA_VERSION, "sources": []}

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError("JD source manifest could not be read as valid JSON.") from error

    if (
        not isinstance(manifest, dict)
        or manifest.get("schema_version") != MANIFEST_SCHEMA_VERSION
        or not isinstance(manifest.get("sources"), list)
    ):
        raise ValueError("JD source manifest has an unsupported structure.")

    seen_ids: set[str] = set()
    for source in manifest["sources"]:
        if not isinstance(source, dict):
            raise ValueError("JD source manifest contains an invalid source record.")
        _validate_manifest_source(source)
        jd_id = source["jd_id"].strip()
        if jd_id in seen_ids:
            raise ValueError("JD source manifest contains duplicate JD IDs.")
        seen_ids.add(jd_id)
    return manifest


def _write_manifest(manifest_path: Path, manifest: dict[str, Any]) -> None:
    """Atomically save manifest changes to avoid partially written JSON."""
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=manifest_path.parent,
            prefix=f"{manifest_path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            json.dump(manifest, temporary_file, indent=2, ensure_ascii=False)
            temporary_file.write("\n")
        temporary_path.replace(manifest_path)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()


def _save_source_record(
    source: dict[str, Any],
    manifest_path: Path,
) -> None:
    """Insert or replace one source record by JD ID in the manifest."""
    manifest = _read_manifest(manifest_path)
    records = manifest["sources"]
    for index, existing in enumerate(records):
        if existing["jd_id"] == source["jd_id"]:
            records[index] = source
            break
    else:
        records.append(source)
    _write_manifest(manifest_path, manifest)


def _extract_readable_html(html: str) -> str:
    """Convert HTML into readable text without executing or rendering it."""
    parser = _ReadableTextParser()
    parser.feed(html)
    parser.close()
    return parser.readable_text()


def collect_job_description(
    source: dict[str, Any],
    manifest_path: str | Path = DEFAULT_MANIFEST_PATH,
    text_directory: str | Path = DEFAULT_TEXT_DIRECTORY,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    """Fetch one public HTML JD and record either success or a safe failure."""
    manifest_file = Path(manifest_path)
    output_directory = Path(text_directory)
    result = dict(source)
    result.update(
        retrieval_date=_utc_date(),
        retrieval_status="failed",
        retrieved_text_path=None,
        error=None,
    )

    try:
        _validate_source(source)
        if timeout_seconds <= 0:
            raise ValueError("Timeout must be greater than zero.")

        response = httpx.get(
            source["source_url"].strip(),
            timeout=timeout_seconds,
            follow_redirects=True,
            headers={"Accept": "text/html,application/xhtml+xml"},
        )
        response.raise_for_status()
        content_type = response.headers.get("content-type", "").lower()
        if content_type and "html" not in content_type:
            raise ValueError("Career page response was not HTML.")

        extracted_text = _extract_readable_html(response.text)
        if not extracted_text:
            raise ValueError("Career page contained no readable text.")

        output_directory.mkdir(parents=True, exist_ok=True)
        text_path = output_directory / f"{source['jd_id']}.txt"
        text_path.write_text(extracted_text + "\n", encoding="utf-8")
        result.update(
            retrieval_status="retrieved",
            retrieved_text_path=str(text_path),
        )
    except httpx.HTTPStatusError as error:
        result["error"] = f"HTTP request failed with status {error.response.status_code}."
    except httpx.RequestError as error:
        result["error"] = f"HTTP request failed ({type(error).__name__})."
    except (OSError, ValueError) as error:
        # Keep errors useful without persisting response bodies or credentials.
        result["error"] = str(error)

    _save_source_record(result, manifest_file)
    return result


def collect_all_job_descriptions(
    manifest_path: str | Path = DEFAULT_MANIFEST_PATH,
    text_directory: str | Path = DEFAULT_TEXT_DIRECTORY,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
) -> list[dict[str, Any]]:
    """Fetch every source currently listed in the JD manifest."""
    manifest_file = Path(manifest_path)
    manifest = _read_manifest(manifest_file)
    return [
        collect_job_description(
            source,
            manifest_path=manifest_file,
            text_directory=text_directory,
            timeout_seconds=timeout_seconds,
        )
        for source in manifest["sources"]
        if source.get("source_type") != "local_file"
    ]


def import_manual_text(
    jd_id: str,
    text: str,
    manifest_path: str | Path = DEFAULT_MANIFEST_PATH,
    text_directory: str | Path = DEFAULT_TEXT_DIRECTORY,
) -> dict[str, Any]:
    """Save supplied JD text as a fallback for a previously failed URL fetch."""
    manifest_file = Path(manifest_path)
    manifest = _read_manifest(manifest_file)
    matching_source = next(
        (source for source in manifest["sources"] if source["jd_id"] == jd_id),
        None,
    )
    if matching_source is None:
        raise ValueError("Manual fallback requires a JD source already in the manifest.")
    if matching_source.get("retrieval_status") != "failed":
        raise ValueError("Manual fallback is available only after URL retrieval fails.")
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Manual JD text must not be empty.")

    output_directory = Path(text_directory)
    output_directory.mkdir(parents=True, exist_ok=True)
    text_path = output_directory / f"{jd_id}.txt"
    text_path.write_text(text.strip() + "\n", encoding="utf-8")

    result = dict(matching_source)
    result.update(
        retrieval_date=_utc_date(),
        retrieval_status="manual_import",
        retrieved_text_path=str(text_path),
        error=None,
    )
    _save_source_record(result, manifest_file)
    return result
