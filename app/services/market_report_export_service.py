"""Professional Blue-and-White PDF & Word Exporter for Market Intelligence Reports.

Generates paginated, recruiter-friendly PDF (via PyMuPDF Story + header/footer pass)
and Word (.docx via python-docx) documents with:
- Clean blue-and-white corporate styling
- Repeating table headers across pages
- Non-splitting table rows
- Clickable external source URLs
- Running headers, footers, page numbers, and requisition metadata
"""

from __future__ import annotations

import html as html_lib
import io
from typing import Any, Dict, List

import fitz  # PyMuPDF
from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn
from docx.opc.constants import RELATIONSHIP_TYPE
from docx.shared import Inches, Pt, RGBColor


def _esc(val: Any) -> str:
    """Escape HTML special characters safely for PDF Story rendering."""
    return html_lib.escape(str(val if val is not None else ""))


def _build_pdf_html(report: Dict[str, Any]) -> str:
    """Render the structured report dictionary into clean, paginated blue-and-white HTML."""
    meta = report.get("report_metadata") or {}
    sec_a = report.get("section_a_job_overview") or {}
    sec_b = report.get("section_b_sourcing_strategy") or {}
    sec_c = report.get("section_c_target_companies") or {}
    sec_d = report.get("section_d_market_intelligence") or {}
    titles = report.get("suggested_job_titles") or {}
    skills = report.get("important_skills") or {}
    searches = report.get("recruiter_search_suggestions") or {}
    plan = report.get("recruiter_action_plan") or {}
    refs = report.get("source_references") or []

    # Section A responsibilities
    resp_items = "".join(f"<li>{_esc(r)}</li>" for r in (sec_a.get("responsibilities") or []))
    resp_html = f"<ul>{resp_items}</ul>" if resp_items else "<p>See full Job Description.</p>"

    # Section C target companies rows
    company_rows = []
    for idx, co in enumerate(sec_c.get("companies") or [], 1):
        company_rows.append(
            f"<tr>"
            f"<td>{idx}</td>"
            f"<td><b>{_esc(co.get('company_name'))}</b></td>"
            f"<td>{_esc(co.get('tier'))}</td>"
            f"<td>{_esc(co.get('industry_category'))}</td>"
            f"<td>{_esc(co.get('location'))}</td>"
            f"<td>{_esc(co.get('why_target'))}</td>"
            f"<td>{_esc(co.get('suggested_job_titles'))}</td>"
            f"<td>{_esc(co.get('important_skills'))}</td>"
            f"</tr>"
        )
    company_table_html = (
        f"""<table>
        <thead><tr>
          <th>#</th><th>Company Name</th><th>Tier</th><th>Industry / Category</th>
          <th>Location</th><th>Why Target</th><th>Suggested Job Titles</th><th>Important Skills</th>
        </tr></thead>
        <tbody>{''.join(company_rows)}</tbody>
        </table>"""
        if company_rows
        else "<p class='muted'>Market information not available for this section.</p>"
    )

    # Section D.1 Hiring Activity rows
    hiring_rows = []
    for post in sec_d.get("company_hiring_activity") or []:
        url = str(post.get("source_url") or "")
        link_html = f'<a href="{_esc(url)}">{_esc(post.get("source_name") or "Source")}</a>' if url else "N/A"
        hiring_rows.append(
            f"<tr>"
            f"<td><b>{_esc(post.get('company_name'))}</b></td>"
            f"<td>{_esc(post.get('job_title'))}</td>"
            f"<td>{_esc(post.get('location'))}</td>"
            f"<td>{_esc(post.get('experience_requirement'))}</td>"
            f"<td>{_esc(post.get('posted_date'))}</td>"
            f"<td>{_esc(post.get('vacancy_status'))}</td>"
            f"<td>{link_html}</td>"
            f"</tr>"
        )
    hiring_table_html = (
        f"""<table>
        <thead><tr>
          <th>Company</th><th>Job Title</th><th>Hiring Location</th><th>Experience</th>
          <th>Posted Date</th><th>Status</th><th>Source Link</th>
        </tr></thead>
        <tbody>{''.join(hiring_rows)}</tbody>
        </table>"""
        if hiring_rows
        else "<p class='muted'>Market information not available for this section.</p>"
    )

    # Section D.3 In-Demand Skills
    skill_analysis = sec_d.get("in_demand_skills") or {}
    add_market_skills = skills.get("additional_market_skills") or []
    add_skills_str = (
        ", ".join(f"{s['skill']} ({s['mentions']} postings)" for s in add_market_skills)
        if add_market_skills
        else "None observed across multiple postings"
    )

    # Section D.4 Location Intelligence
    loc_intel = sec_d.get("location_intelligence") or {}
    obs_locs = loc_intel.get("observed_hiring_locations") or []
    obs_locs_str = (
        ", ".join(f"{l['location']} ({l['postings_count']})" for l in obs_locs)
        if obs_locs
        else "Market information not available for this section."
    )

    # Section D.5 Salary
    salary_info = sec_d.get("salary_and_compensation") or {}
    if salary_info.get("available") and salary_info.get("entries"):
        sal_rows = "".join(
            f"<tr><td>{_esc(e.get('role'))}</td><td>{_esc(e.get('salary_range'))}</td>"
            f"<td>{_esc(e.get('location'))}</td><td>{_esc(e.get('classification'))}</td>"
            f"<td><a href='{_esc(e.get('source_url'))}'>{_esc(e.get('source_name'))}</a> ({_esc(e.get('published_date'))})</td></tr>"
            for e in salary_info["entries"]
        )
        salary_html = (
            f"<table><thead><tr><th>Role</th><th>Salary Range</th><th>Location</th><th>Type</th><th>Source & Date</th></tr></thead>"
            f"<tbody>{sal_rows}</tbody></table>"
        )
    else:
        salary_html = f"<p class='muted'>{_esc(salary_info.get('note') or 'Market information not available for this section.')}</p>"

    # Search strings
    naukri_q = (searches.get("naukri") or {}).get("query") or "N/A"
    linkedin_q = (searches.get("linkedin") or {}).get("query") or "N/A"
    xray_q = (searches.get("google_xray") or {}).get("query") or "N/A"

    # References
    ref_rows = "".join(
        f"<li><b>{_esc(r.get('source_name'))}</b> — {_esc(r.get('title'))} "
        f"(<a href='{_esc(r.get('source_url'))}'>{_esc(r.get('source_url'))}</a>) "
        f"| Published: {_esc(r.get('published_date'))} | Accessed: {_esc(r.get('accessed_date'))} "
        f"| <i>{_esc(r.get('evidence_type'))}</i></li>"
        for r in refs
    )

    return f"""<!DOCTYPE html>
<html>
<head>
<style>
  body {{ font-family: sans-serif; font-size: 9pt; color: #1e293b; line-height: 1.42; }}
  .banner {{ background: #1e3a8a; color: #ffffff; padding: 12pt 14pt; border-radius: 4pt; margin-bottom: 10pt; }}
  .banner h1 {{ margin: 0 0 4pt 0; font-size: 14pt; color: #ffffff; }}
  .banner p {{ margin: 0; font-size: 8.5pt; color: #dbeafe; }}
  h2 {{ color: #1e3a8a; font-size: 11.5pt; border-bottom: 1.5pt solid #2563eb; padding-bottom: 2pt; margin-top: 12pt; margin-bottom: 6pt; }}
  h3 {{ color: #1d4ed8; font-size: 9.5pt; margin-top: 8pt; margin-bottom: 3pt; }}
  .box {{ background: #f8fafc; border: 0.6pt solid #cbd5e1; border-left: 3pt solid #2563eb; padding: 7pt 9pt; margin-bottom: 8pt; }}
  .tag {{ display: inline-block; background: #dbeafe; color: #1e3a8a; font-size: 7.5pt; font-weight: bold; padding: 1pt 4pt; border-radius: 2pt; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 7.8pt; margin-bottom: 8pt; }}
  thead {{ display: table-header-group; }}
  tr {{ break-inside: avoid; page-break-inside: avoid; }}
  th {{ background: #1e3a8a; color: #ffffff; text-align: left; padding: 4pt 5pt; border: 0.5pt solid #cbd5e1; }}
  td {{ padding: 4pt 5pt; border: 0.5pt solid #cbd5e1; vertical-align: top; }}
  tr:nth-child(even) td {{ background: #f8fafc; }}
  .code {{ font-family: monospace; font-size: 7.8pt; background: #eff6ff; border: 0.5pt solid #bfdbfe; padding: 5pt; margin: 3pt 0 6pt 0; }}
  .muted {{ color: #64748b; font-style: italic; }}
  a {{ color: #1d4ed8; text-decoration: underline; }}
  ul, ol {{ margin: 3pt 0 6pt 14pt; padding: 0; }}
  li {{ margin-bottom: 2pt; }}
</style>
</head>
<body>
  <div class="banner">
    <h1>{_esc(meta.get('report_title'))}</h1>
    <p><b>Requisition ID:</b> {_esc(meta.get('requisition_id'))} &nbsp;|&nbsp;
       <b>Role:</b> {_esc(meta.get('job_title'))} &nbsp;|&nbsp;
       <b>Location:</b> {_esc(meta.get('job_location'))} &nbsp;|&nbsp;
       <b>Generated:</b> {_esc(meta.get('generated_date'))}</p>
  </div>
  <div class="box">{_esc(meta.get('overview_note'))}</div>

  <h2>Section A — Job Overview <span class="tag">Verified information</span></h2>
  <p>{_esc(sec_a.get('role_summary'))}</p>
  <table>
    <tbody>
      <tr><td><b>Job Title</b></td><td>{_esc(sec_a.get('title'))}</td><td><b>Requisition ID</b></td><td>{_esc(sec_a.get('requisition_code'))}</td></tr>
      <tr><td><b>Location</b></td><td>{_esc(sec_a.get('location'))}</td><td><b>Experience Required</b></td><td>{_esc(sec_a.get('experience_required'))}</td></tr>
      <tr><td><b>Employment Type</b></td><td>{_esc(sec_a.get('employment_type'))}</td><td><b>Industry / Domain</b></td><td>{_esc(sec_a.get('domain'))}</td></tr>
      <tr><td><b>Mandatory Skills</b></td><td colspan="3">{_esc(', '.join(sec_a.get('mandatory_skills') or []) or 'None specified')}</td></tr>
      <tr><td><b>Preferred Skills</b></td><td colspan="3">{_esc(', '.join(sec_a.get('preferred_skills') or []) or 'None specified')}</td></tr>
    </tbody>
  </table>
  <h3>Main Responsibilities</h3>
  {resp_html}

  <h2>Section B — Sourcing Strategy <span class="tag">Recruiter suggestion</span></h2>
  <div class="box">
    <p><b>Recommended Approach:</b> {_esc(sec_b.get('sourcing_approach'))}</p>
    <p><b>Direct vs. Transferable Experience:</b> {_esc(sec_b.get('direct_vs_transferable'))}</p>
    <p><b>Priority Locations:</b> {_esc(', '.join(sec_b.get('priority_locations') or []))}</p>
  </div>

  <h2>Section C — Target Companies ({_esc(sec_c.get('total_companies'))} Employers) <span class="tag">Recruiter suggestion</span></h2>
  {company_table_html}

  <h2>Section D — Real Market Intelligence</h2>
  <h3>1. Company Hiring Activity <span class="tag">Verified information</span></h3>
  {hiring_table_html}

  <h3>2. Market Hiring Trends <span class="tag">Market observation</span></h3>
  <p>{_esc((sec_d.get('market_hiring_trends') or {}).get('summary'))}</p>

  <h3>3. In-Demand Skills <span class="tag">Market observation</span></h3>
  <p><b>JD Skills Observed in Market:</b> {_esc(', '.join(f"{s['skill']} ({s['mentions']})" for s in (skill_analysis.get('jd_skills_observed_in_market') or [])) or 'N/A')}</p>
  <p><b>Additional Market Skills:</b> {_esc(add_skills_str)}</p>
  <p class="muted">{_esc(skill_analysis.get('sample_limitation_note'))} {_esc(skills.get('additional_skills_note'))}</p>

  <h3>4. Location Intelligence</h3>
  <p><b>Requested Location:</b> {_esc(loc_intel.get('requested_location'))} &nbsp;|&nbsp;
     <b>Remote Mentions:</b> {_esc(loc_intel.get('remote_mentions_count', 0))} of {_esc(loc_intel.get('total_postings_reviewed', 0))} postings</p>
  <p><b>Observed Hiring Locations:</b> {_esc(obs_locs_str)}</p>

  <h3>5. Salary and Compensation Information</h3>
  {salary_html}

  <h3>6. Competitor and Talent-Pool Insights <span class="tag">Recruiter suggestion</span></h3>
  <p>{_esc((sec_d.get('competitor_and_talent_pool_insights') or {}).get('summary'))}</p>

  <h2>Suggested Job Titles</h2>
  <p><b>Directly Matching:</b> {_esc(', '.join(titles.get('direct_titles') or []) or 'N/A')}</p>
  <p><b>Alternative Titles:</b> {_esc(', '.join(titles.get('alternative_titles') or []) or 'N/A')}</p>
  <p><b>Adjacent Industry Titles:</b> {_esc(', '.join(titles.get('adjacent_industry_titles') or []) or 'N/A')}</p>
  <p><b>Titles Observed in Market Postings:</b> {_esc(', '.join(titles.get('market_observed_titles') or []) or 'None observed')}</p>

  <h2>Recruiter Search Suggestions (Boolean)</h2>
  <p><b>Naukri Resdex:</b></p><div class="code">{_esc(naukri_q)}</div>
  <p><b>LinkedIn Recruiter:</b></p><div class="code">{_esc(linkedin_q)}</div>
  <p><b>Google X-Ray:</b></p><div class="code">{_esc(xray_q)}</div>

  <h2>Recruiter Action Plan</h2>
  <ol>
    <li><b>Prioritize First:</b> {_esc(', '.join(plan.get('prioritize_companies_first') or []))}</li>
    <li><b>Titles to Search:</b> {_esc(', '.join(plan.get('suggested_titles_to_search') or []))}</li>
    <li><b>Core Skills Focus:</b> {_esc(', '.join(plan.get('important_skills_focus') or []))}</li>
    <li><b>Priority Locations:</b> {_esc(', '.join(plan.get('priority_locations') or []))}</li>
    <li><b>Adjacent Industries:</b> {_esc(', '.join(plan.get('adjacent_industries') or []))}</li>
  </ol>
  <div class="box"><b>Recruiter Notes:</b> {_esc(plan.get('recruiter_notes') or 'No recruiter notes recorded.')}</div>

  <h2>Source References &amp; Freshness</h2>
  <p class="muted">Research performed on: {_esc(meta.get('research_performed_date'))}</p>
  {f'<ul>{ref_rows}</ul>' if ref_rows else '<p class="muted">No external source links were retrieved.</p>'}
</body>
</html>"""


def generate_market_report_pdf(report: Dict[str, Any]) -> bytes:
    """Generate a paginated, blue-and-white PDF with running headers, footers, and page numbers."""
    meta = report.get("report_metadata") or {}
    story_html = _build_pdf_html(report)

    raw_buf = io.BytesIO()
    mediabox = fitz.paper_rect("a4")
    content_rect = mediabox + (36, 46, -36, -42)
    story = fitz.Story(html=story_html)
    writer = fitz.DocumentWriter(raw_buf)
    more = True
    while more:
        device = writer.begin_page(mediabox)
        more, _ = story.place(content_rect)
        story.draw(device, None)
        writer.end_page()
    writer.close()

    # Stamp clean running header and footer with page numbers on every page.
    pdf_doc = fitz.open(stream=raw_buf.getvalue(), filetype="pdf")
    total_pages = len(pdf_doc)
    header_text = f"CompanyAI Market Intelligence Report  |  {meta.get('requisition_id', '')} — {meta.get('job_title', '')}"
    footer_left = f"Generated: {meta.get('generated_date', '')}  |  Location: {meta.get('job_location', '')}"

    for idx, page in enumerate(pdf_doc, 1):
        w = page.rect.width
        h = page.rect.height
        page.insert_text((36, 26), header_text[:95], fontsize=7.5, color=(0.12, 0.23, 0.54))
        page.draw_line((36, 32), (w - 36, 32), color=(0.8, 0.85, 0.92), width=0.5)
        page.draw_line((36, h - 30), (w - 36, h - 30), color=(0.8, 0.85, 0.92), width=0.5)
        page.insert_text((36, h - 18), footer_left[:90], fontsize=7.5, color=(0.39, 0.45, 0.55))
        page.insert_text((w - 86, h - 18), f"Page {idx} of {total_pages}", fontsize=7.5, color=(0.39, 0.45, 0.55))

    out_buf = io.BytesIO()
    pdf_doc.save(out_buf)
    pdf_doc.close()
    return out_buf.getvalue()


def _set_cell_bg(cell, hex_color: str) -> None:
    """Apply background shading to a python-docx table cell."""
    shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    cell._tc.get_or_add_tcPr().append(shading)


def _repeat_header_row(row) -> None:
    """Mark a Word table row as repeating header across page breaks."""
    tr_pr = row._tr.get_or_add_trPr()
    tr_pr.append(OxmlElement("w:tblHeader"))
    tr_pr.append(OxmlElement("w:cantSplit"))


def _prevent_row_split(row) -> None:
    """Prevent a Word table row from splitting mid-row across page breaks."""
    row._tr.get_or_add_trPr().append(OxmlElement("w:cantSplit"))


def _add_hyperlink(paragraph, text: str, url: str) -> None:
    """Insert a clickable blue hyperlink into a python-docx paragraph."""
    if not url or not url.startswith(("http://", "https://")):
        paragraph.add_run(text)
        return
    part = paragraph.part
    r_id = part.relate_to(url, RELATIONSHIP_TYPE.HYPERLINK, is_external=True)
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), r_id)
    new_run = OxmlElement("w:r")
    r_pr = OxmlElement("w:rPr")
    color = OxmlElement("w:color")
    color.set(qn("w:val"), "1D4ED8")
    underline = OxmlElement("w:u")
    underline.set(qn("w:val"), "single")
    sz = OxmlElement("w:sz")
    sz.set(qn("w:val"), "17")  # 8.5pt
    r_pr.append(color)
    r_pr.append(underline)
    r_pr.append(sz)
    new_run.append(r_pr)
    text_el = OxmlElement("w:t")
    text_el.text = text
    new_run.append(text_el)
    hyperlink.append(new_run)
    paragraph._p.append(hyperlink)


def _add_page_number_fields(paragraph) -> None:
    """Append 'Page X of Y' XML fields to a python-docx footer paragraph."""
    paragraph.add_run("Page ")
    for field_name in ("PAGE", "NUMPAGES"):
        if field_name == "NUMPAGES":
            paragraph.add_run(" of ")
        run = paragraph.add_run()
        fld_begin = OxmlElement("w:fldChar")
        fld_begin.set(qn("w:fldCharType"), "begin")
        instr = OxmlElement("w:instrText")
        instr.set(qn("xml:space"), "preserve")
        instr.text = f" {field_name} "
        fld_end = OxmlElement("w:fldChar")
        fld_end.set(qn("w:fldCharType"), "end")
        run._r.append(fld_begin)
        run._r.append(instr)
        run._r.append(fld_end)


def generate_market_report_word(report: Dict[str, Any]) -> bytes:
    """Generate a formatted, blue-and-white Word (.docx) Market Intelligence Report."""
    meta = report.get("report_metadata") or {}
    sec_a = report.get("section_a_job_overview") or {}
    sec_b = report.get("section_b_sourcing_strategy") or {}
    sec_c = report.get("section_c_target_companies") or {}
    sec_d = report.get("section_d_market_intelligence") or {}
    titles = report.get("suggested_job_titles") or {}
    skills = report.get("important_skills") or {}
    searches = report.get("recruiter_search_suggestions") or {}
    plan = report.get("recruiter_action_plan") or {}
    refs = report.get("source_references") or []

    doc = Document()
    for section in doc.sections:
        section.top_margin = Inches(0.75)
        section.bottom_margin = Inches(0.75)
        section.left_margin = Inches(0.7)
        section.right_margin = Inches(0.7)

        hdr_p = section.header.paragraphs[0]
        hdr_run = hdr_p.add_run(
            f"CompanyAI Market Intelligence Report  |  {meta.get('requisition_id', '')} — {meta.get('job_title', '')}"
        )
        hdr_run.font.size = Pt(8)
        hdr_run.font.color.rgb = RGBColor(30, 58, 138)

        ftr_p = section.footer.paragraphs[0]
        ftr_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        ftr_run = ftr_p.add_run(f"Generated: {meta.get('generated_date', '')}   |   ")
        ftr_run.font.size = Pt(8)
        ftr_run.font.color.rgb = RGBColor(100, 116, 139)
        _add_page_number_fields(ftr_p)

    def add_section_heading(text: str) -> None:
        h = doc.add_heading(text, level=2)
        for run in h.runs:
            run.font.color.rgb = RGBColor(30, 58, 138)
            run.font.size = Pt(13)

    def add_styled_table(headers: List[str], rows: List[List[Any]]) -> None:
        table = doc.add_table(rows=1, cols=len(headers))
        table.style = "Table Grid"
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        _repeat_header_row(table.rows[0])
        for idx, h_text in enumerate(headers):
            cell = table.rows[0].cells[idx]
            _set_cell_bg(cell, "1E3A8A")
            cell.text = h_text
            for p in cell.paragraphs:
                for r in p.runs:
                    r.bold = True
                    r.font.size = Pt(8.5)
                    r.font.color.rgb = RGBColor(255, 255, 255)
        for r_idx, row_vals in enumerate(rows):
            row = table.add_row()
            _prevent_row_split(row)
            bg = "F8FAFC" if r_idx % 2 == 1 else "FFFFFF"
            for c_idx, val in enumerate(row_vals):
                cell = row.cells[c_idx]
                _set_cell_bg(cell, bg)
                if isinstance(val, tuple) and len(val) == 2 and str(val[1]).startswith("http"):
                    p = cell.paragraphs[0]
                    _add_hyperlink(p, str(val[0]), str(val[1]))
                else:
                    cell.text = str(val or "")
                    for p in cell.paragraphs:
                        for r in p.runs:
                            r.font.size = Pt(8.5)

    # Title Banner
    title_h = doc.add_heading(meta.get("report_title") or "Market Intelligence Report", level=1)
    for run in title_h.runs:
        run.font.color.rgb = RGBColor(30, 58, 138)

    meta_p = doc.add_paragraph()
    meta_p.add_run(
        f"Requisition ID: {meta.get('requisition_id', '')}  |  "
        f"Location: {meta.get('job_location', '')}  |  "
        f"Generated: {meta.get('generated_date', '')}\n"
    ).bold = True
    meta_p.add_run(meta.get("overview_note") or "")

    # Section A
    add_section_heading("Section A — Job Overview [Verified information]")
    doc.add_paragraph(sec_a.get("role_summary") or "")
    add_styled_table(
        ["Field", "Details"],
        [
            ["Job Title", sec_a.get("title")],
            ["Requisition ID", sec_a.get("requisition_code")],
            ["Job Location", sec_a.get("location")],
            ["Experience Required", sec_a.get("experience_required")],
            ["Employment Type", sec_a.get("employment_type")],
            ["Industry / Domain", sec_a.get("domain")],
            ["Mandatory Skills", ", ".join(sec_a.get("mandatory_skills") or []) or "None specified"],
            ["Preferred Skills", ", ".join(sec_a.get("preferred_skills") or []) or "None specified"],
        ],
    )
    if sec_a.get("responsibilities"):
        doc.add_paragraph("Main Responsibilities:").runs[0].bold = True
        for r in sec_a["responsibilities"]:
            doc.add_paragraph(r, style="List Bullet")

    # Section B
    add_section_heading("Section B — Sourcing Strategy [Recruiter suggestion]")
    doc.add_paragraph(sec_b.get("sourcing_approach") or "")
    doc.add_paragraph(f"Direct vs. Transferable Experience: {sec_b.get('direct_vs_transferable', '')}")
    doc.add_paragraph(f"Priority Locations: {', '.join(sec_b.get('priority_locations') or [])}")

    # Section C
    add_section_heading(f"Section C — Target Companies ({sec_c.get('total_companies', 0)}) [Recruiter suggestion]")
    co_rows = [
        [
            c.get("company_name"),
            c.get("tier"),
            c.get("industry_category"),
            c.get("location"),
            c.get("why_target"),
            c.get("suggested_job_titles"),
            c.get("important_skills"),
        ]
        for c in (sec_c.get("companies") or [])
    ]
    if co_rows:
        add_styled_table(
            ["Company Name", "Tier", "Industry/Category", "Location", "Why Target", "Suggested Job Titles", "Important Skills"],
            co_rows,
        )
    else:
        doc.add_paragraph("Market information not available for this section.")

    # Section D
    add_section_heading("Section D — Real Market Intelligence")
    hiring_rows = [
        [
            p.get("company_name"),
            p.get("job_title"),
            p.get("location"),
            p.get("experience_requirement"),
            p.get("posted_date"),
            p.get("vacancy_status"),
            (p.get("source_name") or "Link", p.get("source_url") or ""),
        ]
        for p in (sec_d.get("company_hiring_activity") or [])
    ]
    doc.add_paragraph("1. Company Hiring Activity [Verified information]").runs[0].bold = True
    if hiring_rows:
        add_styled_table(
            ["Company", "Job Title", "Location", "Experience", "Posted Date", "Status", "Source Link"],
            hiring_rows,
        )
    else:
        doc.add_paragraph("Market information not available for this section.")

    doc.add_paragraph("2. Market Hiring Trends [Market observation]").runs[0].bold = True
    doc.add_paragraph((sec_d.get("market_hiring_trends") or {}).get("summary") or "Market information not available for this section.")

    skill_analysis = sec_d.get("in_demand_skills") or {}
    doc.add_paragraph("3. In-Demand Skills").runs[0].bold = True
    add_ms = ", ".join(f"{s['skill']} ({s['mentions']} postings)" for s in (skills.get("additional_market_skills") or []))
    doc.add_paragraph(f"Additional Market Skills: {add_ms or 'None observed across multiple postings'}")
    doc.add_paragraph(f"{skill_analysis.get('sample_limitation_note', '')} {skills.get('additional_skills_note', '')}")

    loc_intel = sec_d.get("location_intelligence") or {}
    doc.add_paragraph("4. Location Intelligence").runs[0].bold = True
    obs_locs = ", ".join(f"{l['location']} ({l['postings_count']})" for l in (loc_intel.get("observed_hiring_locations") or []))
    doc.add_paragraph(
        f"Requested Location: {loc_intel.get('requested_location', '')}  |  "
        f"Observed Hiring Locations: {obs_locs or 'Market information not available for this section.'}"
    )

    sal_info = sec_d.get("salary_and_compensation") or {}
    doc.add_paragraph("5. Salary and Compensation Information").runs[0].bold = True
    if sal_info.get("available") and sal_info.get("entries"):
        sal_rows = [
            [
                e.get("role"),
                e.get("salary_range"),
                e.get("location"),
                e.get("classification"),
                (f"{e.get('source_name')} ({e.get('published_date')})", e.get("source_url") or ""),
            ]
            for e in sal_info["entries"]
        ]
        add_styled_table(["Role", "Salary Range", "Location", "Type", "Source & Date"], sal_rows)
    else:
        doc.add_paragraph(sal_info.get("note") or "Market information not available for this section.")

    doc.add_paragraph("6. Competitor and Talent-Pool Insights [Recruiter suggestion]").runs[0].bold = True
    doc.add_paragraph((sec_d.get("competitor_and_talent_pool_insights") or {}).get("summary") or "")

    # Suggested Job Titles & Boolean Searches
    add_section_heading("Suggested Job Titles")
    doc.add_paragraph(f"Directly Matching: {', '.join(titles.get('direct_titles') or []) or 'N/A'}")
    doc.add_paragraph(f"Alternative Titles: {', '.join(titles.get('alternative_titles') or []) or 'N/A'}")
    doc.add_paragraph(f"Adjacent Industry Titles: {', '.join(titles.get('adjacent_industry_titles') or []) or 'N/A'}")
    doc.add_paragraph(f"Market Observed Titles: {', '.join(titles.get('market_observed_titles') or []) or 'None observed'}")

    add_section_heading("Recruiter Search Suggestions (Boolean)")
    for label, key in [("Naukri Resdex", "naukri"), ("LinkedIn Recruiter", "linkedin"), ("Google X-Ray", "google_xray")]:
        p = doc.add_paragraph()
        p.add_run(f"{label}: ").bold = True
        p.add_run((searches.get(key) or {}).get("query") or "N/A")

    # Action Plan & References
    add_section_heading("Recruiter Action Plan")
    doc.add_paragraph(f"1. Prioritize Companies First: {', '.join(plan.get('prioritize_companies_first') or [])}")
    doc.add_paragraph(f"2. Suggested Job Titles: {', '.join(plan.get('suggested_titles_to_search') or [])}")
    doc.add_paragraph(f"3. Important Skills Focus: {', '.join(plan.get('important_skills_focus') or [])}")
    doc.add_paragraph(f"4. Priority Locations: {', '.join(plan.get('priority_locations') or [])}")
    doc.add_paragraph(f"5. Adjacent Industries: {', '.join(plan.get('adjacent_industries') or [])}")
    doc.add_paragraph(f"6. Recruiter Notes: {plan.get('recruiter_notes') or 'No recruiter notes recorded.'}")

    add_section_heading("Source References & Freshness")
    doc.add_paragraph(f"Research performed on: {meta.get('research_performed_date', '')}")
    for ref in refs:
        p = doc.add_paragraph(style="List Bullet")
        p.add_run(f"{ref.get('source_name')} — {ref.get('title')} (")
        _add_hyperlink(p, str(ref.get("source_url")), str(ref.get("source_url")))
        p.add_run(f") | Published: {ref.get('published_date')} | Accessed: {ref.get('accessed_date')} | {ref.get('evidence_type')}")

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
