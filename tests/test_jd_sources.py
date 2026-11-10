"""Tests for public JD retrieval and manual text fallback."""

import json
from pathlib import Path
from unittest.mock import Mock

import httpx
import pytest

from app.jd_sources import (
    collect_job_description,
    import_manual_text,
)


def _source() -> dict[str, str]:
    """Return a synthetic source record that does not identify a real company."""
    return {
        "jd_id": "sample-role-1",
        "company_name": "Example Company",
        "job_title": "Sample Engineer",
        "source_url": "https://careers.example.test/jobs/sample-role-1",
    }


def test_collection_saves_readable_html_and_manifest(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Extract visible text and retain the source URL and retrieval metadata."""
    response = Mock()
    response.headers = {"content-type": "text/html; charset=utf-8"}
    response.text = (
        "<html><head><script>hidden()</script></head>"
        "<body><h1>Sample Engineer</h1><p><strong>Python</strong> and database experience.</p>"
        "<div hidden>inaccessible payload</div><p>Readable after hidden content.</p></body></html>"
    )
    response.raise_for_status.return_value = None
    get_mock = Mock(return_value=response)
    monkeypatch.setattr("app.jd_sources.httpx.get", get_mock)
    manifest_path = tmp_path / "jd_sources.json"
    text_directory = tmp_path / "retrieved"

    result = collect_job_description(
        _source(), manifest_path=manifest_path, text_directory=text_directory
    )

    assert result["retrieval_status"] == "retrieved"
    assert result["source_url"] == _source()["source_url"]
    saved_text = Path(result["retrieved_text_path"]).read_text(encoding="utf-8")
    assert "Sample Engineer" in saved_text
    assert "Python and database experience." in saved_text
    assert "hidden()" not in saved_text
    assert "inaccessible payload" not in saved_text
    assert "Readable after hidden content." in saved_text
    saved_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert saved_manifest["sources"][0]["retrieval_status"] == "retrieved"
    get_mock.assert_called_once()


def test_invalid_url_is_recorded_as_failed_without_request(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Reject non-web URLs and make the failure available for manual fallback."""
    get_mock = Mock(side_effect=AssertionError("Invalid URL must not be requested"))
    monkeypatch.setattr("app.jd_sources.httpx.get", get_mock)
    source = _source()
    source["source_url"] = "file:///private/document.html"
    manifest_path = tmp_path / "jd_sources.json"

    result = collect_job_description(source, manifest_path=manifest_path)

    assert result["retrieval_status"] == "failed"
    assert "HTTP or HTTPS" in result["error"]
    get_mock.assert_not_called()
    assert json.loads(manifest_path.read_text(encoding="utf-8"))["sources"][0]["source_url"] == source["source_url"]


def test_unavailable_website_is_recorded_without_retry_or_bypass(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Record ordinary HTTP failures and leave restricted pages for manual input."""
    response = Mock()
    response.status_code = 403
    response.raise_for_status.side_effect = httpx.HTTPStatusError(
        "forbidden", request=Mock(), response=response
    )
    get_mock = Mock(return_value=response)
    monkeypatch.setattr("app.jd_sources.httpx.get", get_mock)

    result = collect_job_description(_source(), manifest_path=tmp_path / "manifest.json")

    assert result["retrieval_status"] == "failed"
    assert result["error"] == "HTTP request failed with status 403."
    get_mock.assert_called_once()


def test_manual_text_fallback_preserves_source_and_saves_text(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Allow manually supplied text after a failed HTTP fetch."""
    monkeypatch.setattr(
        "app.jd_sources.httpx.get",
        Mock(side_effect=httpx.ConnectError("unavailable")),
    )
    manifest_path = tmp_path / "jd_sources.json"
    text_directory = tmp_path / "retrieved"
    failed = collect_job_description(
        _source(), manifest_path=manifest_path, text_directory=text_directory
    )

    result = import_manual_text(
        failed["jd_id"],
        "  Manually copied sample requirements.  ",
        manifest_path=manifest_path,
        text_directory=text_directory,
    )

    assert result["retrieval_status"] == "manual_import"
    assert result["source_url"] == _source()["source_url"]
    assert result["error"] is None
    assert Path(result["retrieved_text_path"]).read_text(encoding="utf-8") == (
        "Manually copied sample requirements.\n"
    )


def test_manual_fallback_rejects_empty_text_and_nonfailed_source(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Require non-empty fallback text and a failed public retrieval first."""
    response = Mock()
    response.headers = {"content-type": "text/html"}
    response.text = "<p>Public sample JD</p>"
    response.raise_for_status.return_value = None
    monkeypatch.setattr("app.jd_sources.httpx.get", Mock(return_value=response))
    manifest_path = tmp_path / "jd_sources.json"
    result = collect_job_description(_source(), manifest_path=manifest_path)

    with pytest.raises(ValueError, match="only after URL retrieval fails"):
        import_manual_text(result["jd_id"], "manual", manifest_path=manifest_path)

    monkeypatch.setattr("app.jd_sources.httpx.get", Mock(side_effect=httpx.ConnectError("offline")))
    failed = collect_job_description(_source(), manifest_path=manifest_path)
    with pytest.raises(ValueError, match="must not be empty"):
        import_manual_text(failed["jd_id"], "  ", manifest_path=manifest_path)
