"""Pure-standard-library regression tests; runnable directly when backend DLLs are unavailable."""

import unittest
from datetime import date

from app.services.canonical_matching_service import (
    calculate_experience,
    canonicalize_matching_text,
    evaluate_requirements,
    extract_jd_requirements,
    extract_jd_requirements_with_audit,
    generate_requirement_interview_questions,
)
from app.resume_profile_parser import extract_resume_skill_evidence


class CanonicalRequirementTests(unittest.TestCase):
    def test_discovered_candidate_skills_come_from_resume_with_source_lines(self):
        skills = extract_resume_skill_evidence("ABAP Developer\nImplemented ABAP RAP services and OData APIs.\nCreated CDS views.")
        labels = {item["skill"] for item in skills}
        self.assertTrue({"ABAP", "ABAP RESTful Application Programming Model", "OData", "Core Data Services"}.issubset(labels))
        self.assertTrue(all(item["evidence"] in "ABAP Developer\nImplemented ABAP RAP services and OData APIs.\nCreated CDS views." for item in skills))

    def test_interview_questions_cover_partial_unverified_and_responsibility_items(self):
        questions = generate_requirement_interview_questions([
            {"classification": "Mandatory", "evidence_status": "PARTIAL_MATCH", "original_text": "SAP RAP"},
            {"classification": "Mandatory", "evidence_status": "UNVERIFIED", "original_text": "BOPF"},
            {"classification": "Responsibility", "evidence_status": "DIRECT_MATCH", "original_text": "Escalate issues early"},
            {"classification": "Mandatory", "evidence_status": "DIRECT_MATCH", "original_text": "OData"},
        ])
        self.assertEqual(len(questions), 3)
        self.assertTrue(all(item["question"] and item["expected_signal"] for item in questions))

    def test_sap_alias_data_normalizes_both_sides_of_matching(self):
        self.assertEqual(canonicalize_matching_text("RAP"), canonicalize_matching_text("ABAP RESTful Application Programming Model"))
        self.assertEqual(canonicalize_matching_text("BOPF"), canonicalize_matching_text("Business Object Processing Framework"))
        result = evaluate_requirements(
            "REQUIRED SKILLS\n- RAP\n- BOPF",
            "Implemented ABAP RESTful Application Programming Model and Business Object Processing Framework.",
            resume_complete=True,
        )
        self.assertEqual([row["evidence_status"] for row in result["requirements"]], ["EQUIVALENT_MATCH", "EQUIVALENT_MATCH"])

    def test_slash_alternatives_are_one_or_group_and_experience_is_separate(self):
        jd = "REQUIRED QUALIFICATIONS\n- OOABAP/ODATA/WEB DYNPRO/BOPF/RAP 5+ years"
        rows = extract_jd_requirements(jd)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["alternatives"], ["OOABAP", "ODATA", "WEB DYNPRO", "BOPF", "RAP"])
        self.assertEqual(rows[1]["category"], "minimum_experience")
        result = evaluate_requirements(jd, "ABAP Developer, approximately 11 years\nBuilt RAP APIs and OData services.", resume_complete=True, semantic_matcher=lambda requirement, chunk: 0.1)
        self.assertEqual(result["requirements"][0]["evidence_status"], "DIRECT_MATCH")
        self.assertEqual(result["requirements"][1]["evidence_status"], "DIRECT_MATCH")

    def test_resume_without_required_core_skill_stays_below_40(self):
        result = evaluate_requirements(
            "REQUIRED SKILLS\n- ABAP\n- OData\n- BOPF\n- RAP",
            "Python developer with SQL and cloud deployment experience.",
            resume_complete=True,
            semantic_matcher=lambda requirement, chunk: 0.1,
        )
        self.assertLess(result["match_score"], 40)

    def test_semantic_best_sentence_supplies_partial_credit_and_exact_quote(self):
        jd = "REQUIRED SKILLS\n- SAP workflow orchestration"
        resume = "A strong team member with experience of many projects.\nLed end-to-end process automation across SAP service workflows."
        result = evaluate_requirements(
            jd,
            resume,
            resume_complete=True,
            semantic_matcher=lambda requirement, chunk: 0.72 if "Led end-to-end" in chunk else 0.1,
            semantic_judge=lambda requirement, chunk, similarity: {
                "verdict": "partial",
                "confidence": 0.9,
                "evidence_quote": chunk,
                "reason": "The workflow experience is related but does not establish the exact capability.",
            },
        )
        row = result["requirements"][0]
        self.assertEqual(row["evidence_status"], "PARTIAL_MATCH")
        self.assertEqual(row["evidence"], "Led end-to-end process automation across SAP service workflows.")
        self.assertGreaterEqual(row["credit"], 0.5)
        self.assertLessEqual(row["credit"], 0.8)

    def test_semantic_provider_failure_is_unverified_not_a_gap(self):
        result = evaluate_requirements(
            "REQUIRED SKILLS\n- SAP workflow orchestration",
            "Led business processes.",
            resume_complete=True,
            semantic_matcher=lambda requirement, chunk: (_ for _ in ()).throw(RuntimeError("provider unavailable")),
        )
        self.assertEqual(result["requirements"][0]["evidence_status"], "UNVERIFIED")
        self.assertEqual(result["missing_count"], 0)
        self.assertIsNone(result["match_score"])
        self.assertEqual(result["scoring_mode"], "lexical-only")

    def test_added_advantage_is_preferred_and_responsibilities_are_not_gating(self):
        result = evaluate_requirements(
            "TECHNICAL SKILLS\n- ABAP\n- Clean Core and BTP will be an added advantage\nRESPONSIBILITIES\n- Assess accurately the time required to complete work",
            "ABAP developer with ABAP RAP and OData experience.",
            resume_complete=True,
        )
        rows = result["requirements"]
        preferred = next(row for row in rows if "added advantage" in row["original_text"])
        responsibility = next(row for row in rows if "Assess accurately" in row["original_text"])
        self.assertEqual(preferred["classification"], "Preferred")
        self.assertEqual(responsibility["classification"], "Responsibility")
        self.assertIsNone(responsibility["score_contribution"])

    def test_jd_line_audit_accounts_for_uppercase_skills_and_ignored_headings(self):
        parsed = extract_jd_requirements_with_audit(
            "TECHNICAL SKILLS\n- OOABAP\n- ODATA\n- RAP\nRESPONSIBILITIES\nPerforms detailed business analysis."
        )
        self.assertEqual(
            [row["original_text"] for row in parsed["requirements"]],
            ["OOABAP", "ODATA", "RAP", "Performs detailed business analysis"],
        )
        self.assertEqual(
            {line["line"]: line["reason"] for line in parsed["ignored_lines"]},
            {1: "section heading", 5: "section heading"},
        )

    def test_heading_context_bullets_deduplication_and_atomic_lists(self):
        rows = extract_jd_requirements("""PRIMARY FUNCTION
- Operate POS systems; reconcile cash drawers
Desired Qualifications and Experience
- Experience with MicroStation, Autodesk Revit
- Experience with Revit""")
        self.assertEqual(len(rows), 4)
        self.assertEqual([row["classification"] for row in rows], ["Responsibility", "Responsibility", "Preferred", "Preferred"])
        self.assertEqual(rows[0]["category"], "key_responsibilities")
        self.assertEqual(rows[0]["source_locations"][0]["line"], 2)
        self.assertEqual(sum("revit" in row["normalized"] for row in rows), 1)

    def test_score_uses_mandatory_only_and_preferred_is_a_capped_bonus(self):
        jd = """REQUIRED QUALIFICATIONS
- ABAP
- RAP
PREFERRED QUALIFICATIONS
- BTP
RESPONSIBILITIES
- Assess delivery timelines"""
        semantic_matcher = lambda requirement, chunk: 0.1
        without_bonus = evaluate_requirements(jd, "ABAP developer.", resume_complete=True, semantic_matcher=semantic_matcher)
        with_bonus = evaluate_requirements(jd, "ABAP developer with BTP.", resume_complete=True, semantic_matcher=semantic_matcher)
        self.assertEqual(without_bonus["mandatory_score"], 50)
        self.assertEqual(with_bonus["mandatory_score"], 50)
        self.assertEqual(with_bonus["match_score"], 60)
        responsibility = next(row for row in with_bonus["requirements"] if row["classification"] == "Responsibility")
        self.assertIsNone(responsibility["score_contribution"])
        self.assertEqual(with_bonus["responsibility_score"], 0)

    def test_profile_skill_is_partial_and_incomplete_absence_is_unverified(self):
        result = evaluate_requirements(
            "- Autodesk Revit\n- Commercial building systems",
            "",
            resume_complete=False,
            profile_skills=["Revit"],
        )
        self.assertEqual(result["requirements"][0]["evidence_status"], "PARTIAL_MATCH")
        self.assertEqual(result["requirements"][0]["evidence"], "Revit")
        self.assertEqual(result["requirements"][1]["evidence_status"], "UNVERIFIED")

    def test_five_evidence_statuses_and_contribution_reconciliation(self):
        jd = """- MicroStation
- Autodesk Revit
- commercial building systems
- Python
- Data privacy"""
        result = evaluate_requirements(
            jd,
            "MicroStation in production; Revit drafting; commercial site coordination.",
            resume_complete=True,
            semantic_matcher=lambda requirement, chunk: 0.72 if "commercial building systems" in requirement and "commercial site coordination" in chunk else 0.1,
            semantic_judge=lambda requirement, chunk, similarity: {
                "verdict": "partial" if "commercial building systems" in requirement and "commercial site coordination" in chunk else "none",
                "confidence": 0.9,
                "evidence_quote": chunk if "commercial building systems" in requirement and "commercial site coordination" in chunk else "",
                "reason": "Reviewed semantic evidence.",
            },
        )
        self.assertEqual([row["evidence_status"] for row in result["requirements"]], [
            "DIRECT_MATCH", "EQUIVALENT_MATCH", "PARTIAL_MATCH", "MISSING", "MISSING"
        ])
        incomplete = evaluate_requirements(jd, "MicroStation in production.", resume_complete=False, semantic_matcher=lambda requirement, chunk: 0.1)
        self.assertEqual(incomplete["requirements"][1]["evidence_status"], "UNVERIFIED")
        self.assertEqual(incomplete["requirements"][3]["evidence_status"], "UNVERIFIED")
        self.assertAlmostEqual(sum(row["score_contribution"] or 0 for row in result["requirements"]), result["match_score_unrounded"], places=3)

    def test_dates_merge_overlaps_and_separate_internship(self):
        resume = """Professional Experience
SOFTWARE ENGINEER, JAN 2020 - DEC 2022
Built software systems and engineering workflows.
QA Engineer, Jan 2022 - Dec 2023
Designed software testing systems.
Engineering Intern, Jun 2021 - Aug 2021
Supported software engineering tasks.
EDUCATION
Bachelor of Engineering"""
        result = calculate_experience(resume, ["software", "engineering"], date(2025, 1, 1))
        self.assertEqual(result["status"], "VERIFIED")
        self.assertEqual(result["total_professional_years"], 4.0)
        self.assertEqual(result["internship_years"], 0.25)
        self.assertEqual(result["relevant_years"], 4.0)

    def test_year_only_or_missing_dates_are_unverified(self):
        for resume in (
            "PROFESSIONAL EXPERIENCE\nEngineer, 2020 - 2022\nSoftware systems\nEDUCATION",
            "PROFESSIONAL EXPERIENCE\nSoftware Engineer\nBuilt software systems.\nEDUCATION",
        ):
            result = calculate_experience(resume, ["software", "engineering"], date(2025, 1, 1))
            self.assertEqual(result["status"], "UNVERIFIED")
            self.assertIsNone(result["total_professional_years"])

    def test_future_end_dates_and_till_date_are_capped_at_today(self):
        as_of = date(2026, 11, 24)
        future = calculate_experience("PROFESSIONAL EXPERIENCE\nABAP Developer, Jan 2020 - Dec 2026", ["abap"], as_of)
        present = calculate_experience("PROFESSIONAL EXPERIENCE\nABAP Developer, Jan 2020 - till date", ["abap"], as_of)
        self.assertEqual(future["total_professional_years"], 6.92)
        self.assertEqual(present["total_professional_years"], future["total_professional_years"])

    def test_experience_range_uses_relevant_dated_tenure_and_full_band(self):
        jd = """PRIMARY FUNCTION
- Deliver software engineering projects
REQUIRED EXPERIENCE
- 3-5 years of software engineering experience"""
        resume = """Professional Experience
Software Engineer, Jan 2020 - Dec 2023
Delivered software engineering projects.
EDUCATION
Bachelor of Engineering"""
        result = evaluate_requirements(jd, resume, resume_complete=True, role_title="Software Engineer", as_of=date(2025, 1, 1))
        experience = next(row for row in result["requirements"] if row["category"] == "minimum_experience")
        self.assertEqual(experience["evidence_status"], "DIRECT_MATCH")
        self.assertEqual(result["experience"]["total_professional_years"], 4.0)
        self.assertEqual(result["experience"]["relevant_years"], 4.0)
        self.assertAlmostEqual(sum(row["score_contribution"] or 0 for row in result["requirements"]), result["match_score_unrounded"], places=3)

    def test_stated_relevant_years_are_explicit_but_not_date_verified(self):
        result = evaluate_requirements(
            "REQUIRED EXPERIENCE\n- 5+ years of SAP ABAP experience",
            "ABAP Developer — approximately 11 years",
            resume_complete=True,
            semantic_matcher=lambda requirement, chunk: 0.1,
        )
        requirement = result["requirements"][0]
        self.assertEqual(requirement["evidence_status"], "DIRECT_MATCH")
        self.assertEqual(requirement["evidence_source"], "resume_stated_experience")
        self.assertIn("ABAP Developer", requirement["evidence"])
        self.assertIsNone(result["experience"]["total_professional_years"])


if __name__ == "__main__":
    unittest.main()
