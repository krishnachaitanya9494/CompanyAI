
# Import Optional to indicate that search filters may be omitted.
from typing import Optional

# Import SQLAlchemy's text function for parameterized SQL queries.
from sqlalchemy import text

# Import the existing database session factory.
from database.connection import SessionLocal


# Define the candidate search function.
def search_candidates(
    # Accept an optional skill filter such as Java or Selenium.
    skill: Optional[str] = None,

    # Accept an optional minimum experience requirement.
    min_experience: Optional[float] = None,

    # Accept an optional maximum experience requirement.
    max_experience: Optional[float] = None,

    # Accept an optional candidate work-location filter.
    location: Optional[str] = None,

    # Accept an optional candidate availability filter.
    availability: Optional[str] = None,

    # Accept an optional keyword search phrase.
    keyword: Optional[str] = None,

    # Limit the number of results returned by the search.
    limit: int = 20,

    # Specify the result page, starting with page 1.
    page: int = 1,
) -> list[dict]:

    # Reject limits outside the allowed range.
    if not 1 <= limit <= 100:
        raise ValueError("Limit must be between 1 and 100.")

    # Reject invalid page numbers.
    if page < 1:
        raise ValueError("Page must be 1 or greater.")

    # Build the SQL conditions separately from the user input.
    conditions = []

    # Store all query parameters in a dictionary.
    parameters = {}

    # Add a skill condition when the user supplies a skill.
    if skill:
        conditions.append("skill_set ILIKE :skill")
        parameters["skill"] = f"%{skill.strip()}%"

    # Add a minimum experience condition when provided.
    if min_experience is not None:
        conditions.append(
            "CAST(NULLIF(regexp_replace(total_experience, '[^0-9.]', '', 'g'), '') AS NUMERIC) >= :min_experience"
        )
        parameters["min_experience"] = min_experience

    # Add a maximum experience condition when provided.
    if max_experience is not None:
        conditions.append(
            "CAST(NULLIF(regexp_replace(total_experience, '[^0-9.]', '', 'g'), '') AS NUMERIC) <= :max_experience"
        )
        parameters["max_experience"] = max_experience

    # Add a location condition when the user supplies a location.
    if location:
        conditions.append("current_work_location ILIKE :location")
        parameters["location"] = f"%{location.strip()}%"

    # Add an availability condition when provided.
    if availability:
        conditions.append("candidate_availability ILIKE :availability")
        parameters["availability"] = f"%{availability.strip()}%"

    # Search multiple text fields when a keyword is provided.
    if keyword:
        conditions.append(
            """
            (
                skill_set ILIKE :keyword
                OR education_qualification ILIKE :keyword
                OR current_company ILIKE :keyword
                OR current_work_location ILIKE :keyword
            )
            """
        )
        parameters["keyword"] = f"%{keyword.strip()}%"

    # Combine all supplied filters using AND.
    where_clause = (
        "WHERE " + " AND ".join(conditions)
        if conditions
        else ""
    )

    # Calculate the number of records to skip for pagination.
    offset = (page - 1) * limit

    # Add the result limit and offset to the query parameters.
    parameters["limit"] = limit
    parameters["offset"] = offset

    # Define the SQL query using only non-identifying result fields.
    query = text(
        f"""
        SELECT
            submission_id,
            skill_set,
            total_experience,
            current_company,
            current_work_location,
            preferred_work_location,
            candidate_availability,
            profile_source
        FROM recruitment_submissions_raw
        {where_clause}
        ORDER BY submission_id ASC
        LIMIT :limit
        OFFSET :offset
        """
    )

    # Open a database session for the search operation.
    with SessionLocal() as db:

        # Execute the parameterized search query.
        result = db.execute(query, parameters)

        # Convert the database result rows into dictionaries.
        records = [
            dict(row)
            for row in result.mappings().all()
        ]

        # Return the matching recruitment submissions.
        return records
