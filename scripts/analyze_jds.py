"""Run evidence-checked Nemotron analysis for the seven manifest-listed JDs."""

# Import hashing to verify that each imported JD file remains unchanged.
import hashlib

# Import JSON support for reading the manifest and writing analysis records.
import json

# Import standard output for safe status-only progress messages.
import sys

# Import temporary-file helpers for atomic analysis output writes.
import tempfile

# Import Path for manifest, source, and output paths.
from pathlib import Path

# Import typing helpers for explicit manifest record types.
from typing import Any

# Import only the expected seven IDs and analysis client from the JD module.
from app.jd_analyzer import (
    EXPECTED_JD_IDS,
    JDAnalysisError,
    OpenRouterLLMConfig,
    analyze_jd_text,
    get_openrouter_llm_config,
)

# Import the project root and the already-used JD manifest path.
from app.jd_sources import DEFAULT_MANIFEST_PATH, PROJECT_ROOT


# Define the default folder that receives generated JSON without touching source JDs.
DEFAULT_ANALYSIS_DIRECTORY = PROJECT_ROOT / "data" / "jds" / "analysis"


# Load exactly the seven imported local JD records and ignore all other sources.
def load_seven_jd_records(
    manifest_path: str | Path = DEFAULT_MANIFEST_PATH,
) -> list[dict[str, Any]]:
    """Read only JD-001 through JD-007 local-file entries from the manifest."""

    # Read the manifest without writing or modifying it.
    try:
        manifest = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        raise JDAnalysisError("The JD source manifest could not be read.") from None

    # Reject malformed manifest containers without echoing their contents.
    if not isinstance(manifest, dict) or not isinstance(manifest.get("sources"), list):
        raise JDAnalysisError("The JD source manifest has an invalid structure.")

    # Select only the seven known local imports, excluding retrieved samples and URLs.
    expected_ids = set(EXPECTED_JD_IDS)
    selected = [
        record
        for record in manifest["sources"]
        if isinstance(record, dict)
        and record.get("source_type") == "local_file"
        and record.get("jd_id") in expected_ids
    ]

    # Require one and only one manifest record for every expected imported JD.
    selected_ids = [record["jd_id"] for record in selected]
    if len(selected_ids) != len(EXPECTED_JD_IDS) or set(selected_ids) != expected_ids:
        raise JDAnalysisError("The manifest does not contain exactly the seven imported JD records.")

    # Return records in the stable JD-001 through JD-007 order.
    by_id = {record["jd_id"]: record for record in selected}
    return [by_id[jd_id] for jd_id in EXPECTED_JD_IDS]


# Load one source JD only when it resolves inside the data/jds directory.
def read_verified_jd_text(
    record: dict[str, Any],
    project_root: str | Path = PROJECT_ROOT,
) -> str:
    """Read a manifest JD and verify its imported content hash before analysis."""

    # Resolve the project and JD directories to prevent path traversal.
    root = Path(project_root).resolve()
    jd_directory = (root / "data" / "jds").resolve()

    # Resolve the relative manifest path beneath the project's JD data folder.
    source_path = (root / record["local_extracted_file_path"]).resolve()

    # Reject manifest paths that would reach outside data/jds.
    if not source_path.is_relative_to(jd_directory) or not source_path.is_file():
        raise JDAnalysisError("A manifest JD file is missing or outside data/jds.")

    # Read source bytes once so the hash matches exactly what is decoded.
    source_bytes = source_path.read_bytes()

    # Verify the exact imported JD content before passing it to the analyzer.
    actual_hash = hashlib.sha256(source_bytes).hexdigest()
    if actual_hash != record.get("content_sha256"):
        raise JDAnalysisError("An imported JD file no longer matches its manifest hash.")

    # Decode only UTF-8 JD files and keep decoding details out of user-facing errors.
    try:
        return source_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise JDAnalysisError("An imported JD file is not valid UTF-8 text.") from None


# Save one analysis JSON file atomically under the analysis output directory.
def _save_analysis(result: Any, output_directory: Path) -> Path:
    """Write one generated result without changing any source document."""

    # Create only the separate analysis-output folder when needed.
    output_directory.mkdir(parents=True, exist_ok=True)

    # Derive a safe result filename from the known manifest JD identifier.
    output_path = output_directory / f"{result.jd_id}.json"

    # Prepare an atomic temporary file beside its final analysis path.
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=output_directory,
            prefix=f"{result.jd_id}.",
            suffix=".tmp",
            delete=False,
        ) as temporary_file:
            # Remember the temporary path so failures can clean up only this file.
            temporary_path = Path(temporary_file.name)

            # Serialize only the structured result and its evidence references.
            temporary_file.write(result.model_dump_json(indent=2))

            # End the JSON file with a newline for readable version-control diffs.
            temporary_file.write("\n")

        # Replace the prior analysis output atomically after the new JSON is complete.
        temporary_path.replace(output_path)
    finally:
        # Remove an unfinished temporary output without touching original JD files.
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()

    # Return the separate analysis result path for status reporting.
    return output_path


# Analyze and save only the seven imported JD records using one OpenRouter config.
def analyze_manifest_jds(
    *,
    manifest_path: str | Path = DEFAULT_MANIFEST_PATH,
    project_root: str | Path = PROJECT_ROOT,
    output_directory: str | Path = DEFAULT_ANALYSIS_DIRECTORY,
    config: OpenRouterLLMConfig | None = None,
) -> list[Path]:
    """Analyze the seven manifest JDs and write separate evidence-linked JSON files."""

    # Load and validate OpenRouter settings before any hosted request can be made.
    active_config = config or get_openrouter_llm_config()

    # Select only the seven known local-file manifest records.
    jd_records = load_seven_jd_records(manifest_path)

    # Prepare a separate output folder for structured analysis records.
    result_directory = Path(output_directory)

    # Collect only output paths, never original text or model prompts.
    saved_paths: list[Path] = []

    # Process each expected JD independently to maintain clear source boundaries.
    for record in jd_records:
        # Read and integrity-check only this JD's own local source file.
        original_text = read_verified_jd_text(record, project_root=project_root)

        # Request analysis with the original ID, filename, hashes, and source lines.
        result = analyze_jd_text(
            jd_id=record["jd_id"],
            source_filename=record["source_filename"],
            source_sha256=record["source_sha256"],
            content_sha256=record["content_sha256"],
            original_text=original_text,
            source_start_line=record["source_start_line"],
            config=active_config,
        )

        # Save structured output separately from original JD files.
        saved_paths.append(_save_analysis(result, result_directory))

    # Return analysis paths so callers can inspect results without printing contents.
    return saved_paths


# Provide a command-line entry point that prints only safe status messages.
def main() -> int:
    """Run the seven manifest analyses and report IDs without sensitive content."""

    # Validate configuration early so missing settings cannot trigger partial requests.
    try:
        get_openrouter_llm_config()
    except JDAnalysisError as error:
        # Print only controlled configuration messages, never keys or source text.
        print(str(error))
        return 1

    # Run the seven analyses while keeping errors free from response or JD text.
    try:
        output_paths = analyze_manifest_jds()
    except Exception as error:
        # Report only the safe exception class rather than its message or payload.
        print(f"JD analysis stopped ({type(error).__name__}).")
        return 1

    # Print each JD identifier and output filename without printing extracted content.
    for output_path in output_paths:
        print(f"{output_path.stem}: saved {output_path.name}")

    # Return a success code for shell scripts and scheduled runs.
    return 0


# Exit with the command-line status only when this module runs as a script.
if __name__ == "__main__":
    sys.exit(main())
