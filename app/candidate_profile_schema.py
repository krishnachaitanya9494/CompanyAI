"""Strict, evidence-linked models for extracted candidate profiles."""  # Document this module's purpose.

from datetime import date, datetime  # Provide typed source and provenance dates.
from decimal import Decimal  # Preserve monetary values without binary floating-point rounding.
from typing import Annotated, Generic, Literal, TypeVar  # Define reusable strict field types.

from pydantic import BaseModel, ConfigDict, Field, model_validator  # Validate all structured profile data.

NormalizedT = TypeVar("NormalizedT")  # Parameterize extracted fields by normalized value type.
NonNegativeInt = Annotated[int, Field(ge=0)]  # Prevent negative months, years, and notice periods.
YearValue = Annotated[int, Field(ge=1900, le=2200)]  # Bound years to a plausible explicit calendar range.


class StrictModel(BaseModel):  # Share strict validation among every nested profile model.
    model_config = ConfigDict(extra="forbid", strict=True)  # Reject unknown fields and implicit coercion.


class EvidenceReference(StrictModel):  # Point to the original immutable extracted text.
    source_id: str = Field(min_length=1)  # Identify the source artifact without exposing a local path.
    quote: str = Field(min_length=1)  # Preserve the exact excerpt supporting a field.
    page_number: int | None = Field(default=None, gt=0)  # Store a one-based page number when available.
    block_id: str | None = Field(default=None, min_length=1)  # Identify a paragraph or table cell when pageless.
    start_char: int | None = Field(default=None, ge=0)  # Store the inclusive offset into immutable extracted text.
    end_char: int | None = Field(default=None, ge=0)  # Store the exclusive offset into immutable extracted text.

    @model_validator(mode="after")  # Validate relationships among independently valid offsets.
    def validate_offsets(self) -> "EvidenceReference":  # Ensure supplied evidence ranges are complete and ordered.
        if (self.start_char is None) != (self.end_char is None):  # Reject one-sided character ranges.
            raise ValueError("Evidence offsets must be supplied together.")  # Explain the invalid range.
        if self.start_char is not None and self.end_char <= self.start_char:  # Reject empty or reversed ranges.
            raise ValueError("Evidence end_char must be greater than start_char.")  # Explain the invalid range.
        if self.page_number is None and self.block_id is None and self.start_char is None:  # Require a usable location.
            raise ValueError("Evidence must include a page, block, or character offset.")  # Prevent untraceable evidence.
        return self  # Return the validated evidence object.


class FieldValue(StrictModel, Generic[NormalizedT]):  # Keep source wording separate from normalized data.
    status: Literal["found", "missing", "ambiguous"] = "missing"  # Distinguish absence from uncertainty.
    extracted_text: str | None = None  # Preserve the literal wording independently of normalization.
    normalized_value: NormalizedT | None = None  # Store only a supported canonical value.
    evidence: list[EvidenceReference] = Field(default_factory=list)  # Link each value to source evidence.

    @model_validator(mode="after")  # Enforce evidence and value requirements for each state.
    def validate_state(self) -> "FieldValue[NormalizedT]":  # Reject unsupported or inconsistent field states.
        if self.status == "missing":  # A missing value must not imply that anything was found.
            if self.extracted_text is not None or self.normalized_value is not None or self.evidence:  # Detect stray data.
                raise ValueError("Missing fields cannot contain values or evidence.")  # Report inconsistent missing data.
        elif not self.extracted_text or not self.evidence:  # Found and ambiguous values both need traceable source text.
            raise ValueError("Found or ambiguous fields require extracted text and evidence.")  # Prevent unsupported claims.
        elif self.status == "ambiguous" and self.normalized_value is not None:  # Do not choose among conflicting values.
            raise ValueError("Ambiguous fields cannot have a normalized value.")  # Preserve uncertainty explicitly.
        return self  # Return the validated field value.


class EmploymentHistoryItem(StrictModel):  # Represent one candidate employment entry.
    company: FieldValue[str] = Field(default_factory=FieldValue)  # Preserve and normalize the employer name.
    job_title: FieldValue[str] = Field(default_factory=FieldValue)  # Preserve and normalize the role title.
    start_date: FieldValue[date] = Field(default_factory=FieldValue)  # Represent a stated employment start date.
    end_date: FieldValue[date] = Field(default_factory=FieldValue)  # Represent a stated employment end date.
    is_current: FieldValue[bool] = Field(default_factory=FieldValue)  # Record current-employment status only if stated.
    description: FieldValue[str] = Field(default_factory=FieldValue)  # Preserve source-supported responsibilities.


class EducationItem(StrictModel):  # Represent one source-supported education record.
    qualification: FieldValue[str] = Field(default_factory=FieldValue)  # Preserve degree or qualification wording.
    institution: FieldValue[str] = Field(default_factory=FieldValue)  # Preserve the named educational institution.
    field_of_study: FieldValue[str] = Field(default_factory=FieldValue)  # Store the stated specialization when present.
    graduation_year: FieldValue[YearValue] = Field(default_factory=FieldValue)  # Normalize a stated year only.


class CertificationItem(StrictModel):  # Represent one source-supported professional certification.
    name: FieldValue[str] = Field(default_factory=FieldValue)  # Preserve the certification's stated name.
    issuer: FieldValue[str] = Field(default_factory=FieldValue)  # Preserve the named issuing organization.
    year: FieldValue[YearValue] = Field(default_factory=FieldValue)  # Normalize a certification year only if stated.


class CompensationValue(StrictModel):  # Represent parsed compensation without assuming currency or pay period.
    amount: Decimal = Field(gt=0)  # Store the stated positive amount without floating-point loss.
    currency: str = Field(pattern=r"^[A-Z]{3}$")  # Require an explicit three-letter currency code.
    period: Literal["hourly", "daily", "weekly", "monthly", "yearly", "unspecified"]  # Keep the stated pay period explicit.


class ProjectExperienceItem(StrictModel):  # Represent one resume project without unsupported inference.
    name: FieldValue[str] = Field(default_factory=FieldValue)  # Preserve the project name when stated.
    role: FieldValue[str] = Field(default_factory=FieldValue)  # Preserve the candidate's stated project role.
    description: FieldValue[str] = Field(default_factory=FieldValue)  # Preserve the source-supported project details.
    technologies: list[FieldValue[str]] = Field(default_factory=list)  # Keep evidenced project technologies separate.


class ResumeProvenance(StrictModel):  # Capture the immutable source and extraction lineage.
    source_id: str = Field(min_length=1)  # Use an opaque identifier rather than a local filename or path.
    file_sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")  # Bind provenance to the exact original file bytes.
    source_format: Literal["pdf", "docx", "doc", "txt"]  # Record the detected source format.
    extracted_text_sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")  # Bind evidence offsets to exact extracted text.
    extractor_version: str = Field(min_length=1)  # Record the parser version used to create source text.
    schema_version: str = Field(min_length=1)  # Record the profile schema version used for validation.
    extracted_at: datetime  # Record when extraction produced the immutable text artifact.


class CandidateProfile(StrictModel):  # Hold the complete evidence-linked candidate profile.
    provenance: ResumeProvenance  # Link every field to a source and extraction version.
    candidate_name: FieldValue[str] = Field(default_factory=FieldValue)  # Keep personal name optional and evidence-backed.
    email: FieldValue[str] = Field(default_factory=FieldValue)  # Keep email optional and evidence-backed.
    phone: FieldValue[str] = Field(default_factory=FieldValue)  # Keep phone optional and evidence-backed.
    total_experience_months: FieldValue[NonNegativeInt] = Field(default_factory=FieldValue)  # Normalize stated total experience.
    relevant_experience_months: FieldValue[NonNegativeInt] = Field(default_factory=FieldValue)  # Normalize relevant experience only.
    current_company: FieldValue[str] = Field(default_factory=FieldValue)  # Store current employer only when supported.
    previous_companies: list[FieldValue[str]] = Field(default_factory=list)  # Preserve evidenced earlier employers.
    technical_skills: list[FieldValue[str]] = Field(default_factory=list)  # Preserve each evidenced technical skill separately.
    certifications: list[CertificationItem] = Field(default_factory=list)  # Preserve source-supported certifications.
    education: list[EducationItem] = Field(default_factory=list)  # Preserve source-supported education records.
    current_location: FieldValue[str] = Field(default_factory=FieldValue)  # Store the stated current location.
    preferred_locations: list[FieldValue[str]] = Field(default_factory=list)  # Preserve stated preferred locations.
    current_ctc: FieldValue[CompensationValue] = Field(default_factory=FieldValue)  # Preserve stated compensation separately from safe normalization.
    expected_ctc: FieldValue[CompensationValue] = Field(default_factory=FieldValue)  # Preserve stated expectations without assuming units.
    notice_period_days: FieldValue[NonNegativeInt] = Field(default_factory=FieldValue)  # Normalize only an explicit notice duration.
    availability_date: FieldValue[date] = Field(default_factory=FieldValue)  # Store an explicit availability date.
    employment_history: list[EmploymentHistoryItem] = Field(default_factory=list)  # Preserve employment entries and evidence.
    previous_job_titles: list[FieldValue[str]] = Field(default_factory=list)  # Preserve evidenced prior titles.
    projects: list[ProjectExperienceItem] = Field(default_factory=list)  # Preserve source-supported project experience.
