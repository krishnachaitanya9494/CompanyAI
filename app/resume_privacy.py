"""Detect and redact direct identifiers while keeping source mappings local."""  # Describe the privacy boundary.

from __future__ import annotations  # Allow forward references in privacy result types.

import re  # Detect common identifier formats using local regular expressions.
from dataclasses import dataclass, field  # Keep local redaction state immutable and structured.
from typing import Iterable  # Accept a sequence of caller-known personal identifiers.

_EMAIL_RE = re.compile(r"(?<![\w.+-])[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+(?![\w-])", re.IGNORECASE)  # Match conventional email addresses before sentence punctuation.
_OBFUSCATED_EMAIL_RE = re.compile(r"(?<!\w)[A-Z0-9._%+-]+\s*(?:\[at\]|\(at\)|\s+at\s+)\s*[A-Z0-9.-]+\s*(?:\[dot\]|\(dot\)|\s+dot\s+)\s*[A-Z]{2,}(?!\w)", re.IGNORECASE)  # Match common written-out email forms.
_PHONE_RE = re.compile(r"(?<![\w])\+?\d(?:[\d \t().-]{5,}\d)(?![\w])")  # Find formatted phone-like numeric sequences.
_BARE_PHONE_RE = re.compile(r"(?<!\d)\+?\d{10,15}(?!\d)")  # Find unformatted international-length phone numbers.
_GOVERNMENT_ID_RES = (re.compile(r"(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)"), re.compile(r"(?<!\d)(?:\d{4}[ -]?){2}\d{4}(?!\d)"))  # Recognize common SSN- and Aadhaar-shaped identifiers.
_LABELED_IDENTIFIER_RE = re.compile(r"(?im)\b(?:candidate\s+name|name|e-?mail|phone|mobile|telephone|ssn|aadhaar|passport)\s*[:#-]\s*([^\r\n,;|]+)")  # Catch identifiers explicitly labeled in source text.
_REDACTION_TOKEN = object()  # Mark instances created by the trusted local redactor.


class PrivacyError(ValueError):  # Represent a privacy validation failure without exposing source text.
    """Raised when text cannot be safely approved for outbound transmission."""  # Keep failures explicit.


class PrivacyMappingError(PrivacyError):  # Represent an ambiguous or invalid source-offset mapping.
    """Raised when sanitized offsets cannot be mapped precisely to source text."""  # Prevent guessed evidence links.


@dataclass(frozen=True)
class RedactionSpan:  # Track one replaced source range for local evidence verification.
    original_start: int  # Store the inclusive offset in the unchanged source text.
    original_end: int  # Store the exclusive offset in the unchanged source text.
    sanitized_start: int  # Store the inclusive offset in the sanitized text.
    sanitized_end: int  # Store the exclusive offset in the sanitized text.
    replacement: str  # Store the synthetic redaction marker used at the sanitized range.
    category: str  # Describe the identifier class without storing its value.


@dataclass(frozen=True)
class RedactedText:  # Keep source text and offset mappings local to the process.
    sanitized_text: str  # Expose only text intended for outbound validation.
    spans: tuple[RedactionSpan, ...] = field(repr=False)  # Hide source mappings from routine object representations.
    _source_text: str = field(repr=False)  # Retain original text unchanged for local evidence checks.
    _additional_identifiers: tuple[str, ...] = field(repr=False)  # Retain caller-supplied identifiers only in local memory.
    _verification_token: object = field(repr=False, compare=False)  # Prevent manually constructed results passing the gate.

    def original_offset(self, sanitized_offset: int) -> int:  # Map a safe sanitized boundary to the original text.
        if not isinstance(sanitized_offset, int) or isinstance(sanitized_offset, bool):  # Reject non-integer offsets.
            raise PrivacyMappingError("Sanitized offset must be an integer.")  # Avoid coercion or guesswork.
        if not 0 <= sanitized_offset <= len(self.sanitized_text):  # Reject offsets outside sanitized text.
            raise PrivacyMappingError("Sanitized offset is outside the text.")  # Keep mappings bounded.
        shift = 0  # Accumulate length changes from preceding redactions.
        for span in self.spans:  # Inspect replacements in their stable document order.
            if sanitized_offset < span.sanitized_start:  # Stop before the next replaced region.
                break  # The current accumulated shift now maps this boundary.
            if sanitized_offset == span.sanitized_start:  # Preserve an exact boundary before a replacement.
                return span.original_start  # Map to the original identifier's first character.
            if span.sanitized_start < sanitized_offset < span.sanitized_end:  # Detect a point inside a placeholder.
                raise PrivacyMappingError("Offset falls inside a redaction placeholder.")  # Avoid mapping ambiguity.
            if sanitized_offset == span.sanitized_end:  # Preserve an exact boundary after a replacement.
                return span.original_end  # Map to the original identifier's final boundary.
            shift += (span.original_end - span.original_start) - (span.sanitized_end - span.sanitized_start)  # Track prior length differences.
        return sanitized_offset + shift  # Translate the remaining boundary exactly.

    def original_range(self, start: int, end: int) -> tuple[int, int]:  # Map an evidence span without partial placeholders.
        if not isinstance(start, int) or isinstance(start, bool) or not isinstance(end, int) or isinstance(end, bool):  # Require integer endpoints.
            raise PrivacyMappingError("Sanitized range endpoints must be integers.")  # Reject ambiguous endpoint types.
        if not 0 <= start <= end <= len(self.sanitized_text):  # Check the half-open range against sanitized text.
            raise PrivacyMappingError("Sanitized range is outside the text.")  # Prevent invalid source references.
        if start == end:  # Preserve zero-width caret ranges only when they are safe.
            point = self.original_offset(start)  # Reuse the strict boundary mapper.
            return point, point  # Return a zero-width source range.
        for span in self.spans:  # Ensure an evidence range never cuts through a placeholder.
            if start < span.sanitized_start < end and end < span.sanitized_end:  # Detect a range ending inside a token.
                raise PrivacyMappingError("Sanitized range ends inside a redaction placeholder.")  # Require full-token evidence.
            if span.sanitized_start < start < span.sanitized_end:  # Detect a range beginning inside a token.
                raise PrivacyMappingError("Sanitized range starts inside a redaction placeholder.")  # Require full-token evidence.
            if span.sanitized_start < end < span.sanitized_end:  # Detect a range ending inside a token.
                raise PrivacyMappingError("Sanitized range ends inside a redaction placeholder.")  # Require full-token evidence.
        return self.original_offset(start), self.original_offset(end)  # Map both exact boundaries to original offsets.


def _find_matches(text: str, additional_identifiers: tuple[str, ...]) -> list[tuple[int, int, str]]:  # Gather local direct-identifier spans.
    matches: list[tuple[int, int, str]] = []  # Collect offsets and identifier categories without logging values.
    for match in _EMAIL_RE.finditer(text):  # Find standard email addresses in memory.
        matches.append((match.start(), match.end(), "EMAIL"))  # Record only location and category.
    for match in _OBFUSCATED_EMAIL_RE.finditer(text):  # Find common obfuscated email spellings.
        matches.append((match.start(), match.end(), "EMAIL"))  # Treat obfuscated addresses as direct identifiers.
    for match in _PHONE_RE.finditer(text):  # Find formatted phone-like values.
        digits = sum(character.isdigit() for character in match.group())  # Count digits without retaining a copy.
        if 7 <= digits <= 15:  # Accept plausible telephone number lengths.
            matches.append((match.start(), match.end(), "PHONE"))  # Record the candidate phone span.
    for match in _BARE_PHONE_RE.finditer(text):  # Find unformatted international-length phone values.
        matches.append((match.start(), match.end(), "PHONE"))  # Record only the candidate's offsets and category.
    for pattern in _GOVERNMENT_ID_RES:  # Check common government-ID digit patterns locally.
        for match in pattern.finditer(text):  # Find each pattern occurrence in the unchanged source.
            matches.append((match.start(), match.end(), "GOVERNMENT_ID"))  # Record only the ID span and category.
    for match in _LABELED_IDENTIFIER_RE.finditer(text):  # Find direct identifiers introduced by explicit labels.
        value_start, value_end = match.span(1)  # Select only the labeled value and exclude its label.
        while value_start < value_end and text[value_start].isspace():  # Trim leading separator whitespace from the span.
            value_start += 1  # Advance to the first non-whitespace value character.
        while value_end > value_start and text[value_end - 1].isspace():  # Trim trailing separator whitespace from the span.
            value_end -= 1  # Move to the last non-whitespace value character.
        if text[value_start:value_end].startswith("[REDACTED_"):  # Preserve a previously redacted labeled value.
            continue  # Do not mistake the safe placeholder for an unresolved identifier.
        if value_start < value_end:  # Ignore empty label values rather than creating invalid ranges.
            matches.append((value_start, value_end, "LABELED_IDENTIFIER"))  # Redact the explicitly labeled value.
    for identifier in additional_identifiers:  # Include names or organization-specific identifiers known locally.
        if not isinstance(identifier, str) or not identifier.strip():  # Reject invalid caller-provided identifiers.
            raise PrivacyError("Additional identifiers must be non-empty strings.")  # Fail closed on bad configuration.
        if len(identifier.strip()) < 2:  # Avoid unsafe single-character over-redaction rules.
            raise PrivacyError("Additional identifiers must contain at least two characters.")  # Require a meaningful identifier.
        escaped = re.escape(identifier.strip())  # Match caller values literally rather than as regular expressions.
        for match in re.finditer(escaped, text, re.IGNORECASE):  # Redact every occurrence without case sensitivity.
            matches.append((match.start(), match.end(), "ADDITIONAL_IDENTIFIER"))  # Store only source offsets and category.
    return matches  # Return all detected ranges for conflict resolution.


def _merge_matches(matches: Iterable[tuple[int, int, str]]) -> list[tuple[int, int, str]]:  # Resolve overlapping detector matches.
    priority = {"GOVERNMENT_ID": 0, "EMAIL": 1, "PHONE": 2, "LABELED_IDENTIFIER": 3, "ADDITIONAL_IDENTIFIER": 4}  # Prefer specific known classes.
    ordered = sorted(matches, key=lambda item: (item[0], item[1], priority[item[2]]))  # Ensure deterministic source order.
    merged: list[tuple[int, int, str]] = []  # Store non-overlapping ranges for reliable replacements.
    for candidate in ordered:  # Resolve each candidate against the preceding accepted span.
        if not merged or candidate[0] >= merged[-1][1]:  # Accept candidates that do not overlap.
            merged.append(candidate)  # Preserve each distinct identifier occurrence.
            continue  # Inspect the next detected range.
        previous = merged[-1]  # Read the accepted overlapping span.
        if candidate[:2] == previous[:2]:  # Collapse multiple detectors finding the same exact range.
            if priority[candidate[2]] < priority[previous[2]]:  # Prefer the more specific category.
                merged[-1] = candidate  # Keep the identical range with a stronger classification.
            continue  # Exact duplicate spans are not ambiguous.
        if candidate[0] >= previous[0] and candidate[1] <= previous[1]:  # Ignore a detector range fully covered by a stronger span.
            continue  # The encompassing replacement already protects the complete source text.
        if previous[0] >= candidate[0] and previous[1] <= candidate[1]:  # Replace a prior span fully covered by this candidate.
            merged[-1] = candidate  # Protect the complete larger labeled or caller-supplied identifier.
            continue  # Continue resolving subsequent matches.
        raise PrivacyError("Overlapping identifier detections are ambiguous.")  # Reject partial overlaps rather than guess.
    return merged  # Return a deterministic sequence of disjoint source spans.


def redact_pii(text: str, additional_identifiers: Iterable[str] = ()) -> RedactedText:  # Redact direct identifiers without changing caller text.
    if not isinstance(text, str):  # Require textual input before applying any detectors.
        raise PrivacyError("Text to redact must be a string.")  # Fail closed rather than stringify unknown objects.
    identifiers = tuple(additional_identifiers)  # Freeze local custom identifiers for repeatable gate verification.
    matches = _merge_matches(_find_matches(text, identifiers))  # Detect and resolve every supported identifier occurrence.
    pieces: list[str] = []  # Assemble a separate sanitized value without mutating source text.
    spans: list[RedactionSpan] = []  # Preserve the local mapping for each replaced source range.
    original_cursor = 0  # Track the next unconsumed source offset.
    sanitized_cursor = 0  # Track the next output offset.
    category_counts: dict[str, int] = {}  # Number placeholders by category without exposing identifier values.
    for start, end, category in matches:  # Process matches in monotonically increasing source order.
        unchanged = text[original_cursor:start]  # Copy source text preceding this identifier verbatim.
        pieces.append(unchanged)  # Preserve unchanged text in the sanitized output.
        sanitized_cursor += len(unchanged)  # Advance the sanitized offset over unchanged text.
        category_counts[category] = category_counts.get(category, 0) + 1  # Give this category a stable local sequence.
        replacement = f"[REDACTED_{category}_{category_counts[category]}]"  # Replace the identifier with a synthetic marker.
        sanitized_start = sanitized_cursor  # Record where the marker begins in sanitized text.
        pieces.append(replacement)  # Add only the redaction marker, never the identifier value.
        sanitized_cursor += len(replacement)  # Advance past the inserted marker.
        spans.append(RedactionSpan(start, end, sanitized_start, sanitized_cursor, replacement, category))  # Keep the exact local offset mapping.
        original_cursor = end  # Continue after the source identifier.
    pieces.append(text[original_cursor:])  # Preserve the remaining source text unchanged.
    return RedactedText("".join(pieces), tuple(spans), text, identifiers, _REDACTION_TOKEN)  # Return sanitized text plus hidden local mapping.


def validate_outbound_text(result: RedactedText) -> str:  # Approve only locally redacted and integrity-checked text.
    if not isinstance(result, RedactedText) or result._verification_token is not _REDACTION_TOKEN:  # Require trusted redactor output.
        raise PrivacyError("Outbound text must come from redact_pii().")  # Reject raw or manually fabricated content.
    expected = redact_pii(result._source_text, result._additional_identifiers)  # Recompute redaction and mappings from untouched source.
    if expected.sanitized_text != result.sanitized_text or expected.spans != result.spans:  # Detect altered text or offsets.
        raise PrivacyError("Redaction integrity validation failed.")  # Fail closed on any mismatch.
    if _find_matches(result.sanitized_text, ()):  # Reject remaining direct identifiers after checking redaction integrity.
        raise PrivacyError("Outbound text still contains a detected identifier.")  # Prevent transmission when privacy is uncertain.
    if any(span.original_start < 0 or span.original_end > len(result._source_text) for span in result.spans):  # Validate all original ranges.
        raise PrivacyError("Redaction mapping is outside the original text.")  # Reject corrupt local mappings.
    return result.sanitized_text  # Return only the privacy-validated text, never mappings or source text.
