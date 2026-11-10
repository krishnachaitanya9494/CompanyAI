"""Pydantic schemas for evidence-linked job-description analysis results."""

# Import datetime types for the generated analysis timestamp.
from datetime import datetime

# Import Pydantic primitives for strict, nested response validation.
from pydantic import BaseModel, ConfigDict, Field, model_validator


# Define a source excerpt that can be checked against sanitized JD text.
class EvidenceReference(BaseModel):
    """Point to an exact excerpt in a named source section and source line."""

    # Reject undeclared model-generated evidence fields.
    model_config = ConfigDict(extra="forbid")

    # Store the exact section heading associated with the evidence.
    section: str = Field(min_length=1)

    # Store the source file's one-based line number for traceability.
    source_line: int = Field(gt=0)

    # Store the exact excerpt that supports the corresponding extracted value.
    quote: str = Field(min_length=1)


# Define a text value that must carry a checkable source excerpt.
class EvidenceText(BaseModel):
    """Represent one extracted text value and its supporting JD passage."""

    # Reject undeclared model-generated text-value fields.
    model_config = ConfigDict(extra="forbid")

    # Store the extracted text without detaching it from its evidence.
    value: str = Field(min_length=1)

    # Require a source location and quote for every non-null text value.
    evidence: EvidenceReference


# Define a numeric value, such as years of experience, with source evidence.
class EvidenceNumber(BaseModel):
    """Represent one extracted number and its supporting JD passage."""

    # Reject undeclared model-generated numeric-value fields.
    model_config = ConfigDict(extra="forbid")

    # Store a non-negative number such as a minimum experience requirement.
    value: float = Field(ge=0)

    # Require a source location and quote for every non-null numeric value.
    evidence: EvidenceReference


# Define the structured requirements extracted from one job description.
class JDRequirements(BaseModel):
    """Describe JD requirements while preserving evidence for every value."""

    # Reject undeclared output fields instead of silently accepting model drift.
    model_config = ConfigDict(extra="forbid")

    # Keep the job title null when the source does not state it clearly.
    job_title: EvidenceText | None = None

    # Keep the employer null when the source does not identify one.
    company_name: EvidenceText | None = None

    # Keep the location null when the source does not state it clearly.
    location: EvidenceText | None = None

    # Keep the employment type null when the source does not state it clearly.
    employment_type: EvidenceText | None = None

    # Store the minimum experience only when the source supports a number.
    minimum_experience_years: EvidenceNumber | None = None

    # Store the maximum experience only when the source supports a number.
    maximum_experience_years: EvidenceNumber | None = None

    # Separate explicitly required skills from preferred skills.
    required_skills: list[EvidenceText] = Field(default_factory=list)

    # Keep preferred skills in their own evidence-backed list.
    preferred_skills: list[EvidenceText] = Field(default_factory=list)

    # Group programming languages without guessing from role context.
    programming_languages: list[EvidenceText] = Field(default_factory=list)

    # Group frameworks explicitly named in the JD.
    frameworks: list[EvidenceText] = Field(default_factory=list)

    # Group testing tools explicitly named in the JD.
    testing_tools: list[EvidenceText] = Field(default_factory=list)

    # Group databases explicitly named in the JD.
    databases: list[EvidenceText] = Field(default_factory=list)

    # Group cloud technologies explicitly named in the JD.
    cloud_technologies: list[EvidenceText] = Field(default_factory=list)

    # Preserve stated education requirements as evidence-backed text.
    education_requirements: list[EvidenceText] = Field(default_factory=list)

    # Preserve stated certifications as evidence-backed text.
    certifications: list[EvidenceText] = Field(default_factory=list)

    # Preserve responsibilities as source-supported text items.
    responsibilities: list[EvidenceText] = Field(default_factory=list)

    # Keep required qualifications separate from preferred qualifications.
    required_qualifications: list[EvidenceText] = Field(default_factory=list)

    # Keep preferred qualifications separate from required qualifications.
    preferred_qualifications: list[EvidenceText] = Field(default_factory=list)

    # Preserve other relevant requirements only when supported by evidence.
    other_requirements: list[EvidenceText] = Field(default_factory=list)

    # Check that a model response does not reverse a stated experience range.
    @model_validator(mode="after")
    def validate_experience_range(self) -> "JDRequirements":
        """Reject a maximum experience value below its stated minimum."""

        # Read the minimum and maximum only when both are explicitly present.
        minimum = self.minimum_experience_years
        maximum = self.maximum_experience_years

        # Reject contradictory ranges rather than silently changing a value.
        if minimum is not None and maximum is not None and minimum.value > maximum.value:
            raise ValueError("Minimum experience cannot exceed maximum experience.")

        # Return the validated requirements object for Pydantic.
        return self


# Define an analysis record that links generated fields to the unchanged JD.
class JDAnalysisRecord(BaseModel):
    """Link structured requirements to the original manifest record."""

    # Reject undeclared record metadata fields.
    model_config = ConfigDict(extra="forbid")

    # Preserve the JD's existing manifest identifier.
    jd_id: str = Field(min_length=1)

    # Preserve the source filename without copying or replacing source text.
    source_filename: str = Field(min_length=1)

    # Retain the source-file digest recorded during the import stage.
    source_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")

    # Retain the imported JD-content digest for integrity checks.
    content_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")

    # Record which separately configured Nemotron model created this result.
    model: str = Field(min_length=1)

    # Record when this structured result was generated.
    analyzed_at: datetime

    # Store only generated requirements, not a replacement original JD body.
    requirements: JDRequirements
