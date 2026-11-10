# CompanyAI Agent — Modern Frontend UI Prototype

A modern, minimal, professional AI-first recruitment workspace prototype built with **React**, **Vite**, and **Tailwind CSS**.

---

## Design System & Philosophy

- **Aesthetic**: Inspired by Linear, Notion, and modern AI platforms.
- **Color Palette**:
  - Light neutral canvases (`#F8FAFC`, `#FFFFFF`)
  - Dark navy typography (`#0F172A`, `#1E293B`)
  - Subtle emerald green accents (`#10B981`, `#059669`, `#ECFDF5`)
- **Visuals**: Lucide icons, rounded cards, minimal subtle shadows, zero clutter.
- **Code Standards**: Every line of code is accompanied by clear explanatory comments.

---

## Features & Pages

1. **Dashboard**
   - KPI metrics: Total Candidates, Total Resumes, Active JDs, Pending Requests.
   - Recruitment pipeline funnel overview (Ingested, Screened, Shortlisted, Interviews, Offer).
   - AI Insights panel powered by Nemotron LLM.
   - Live activity feed.

2. **AI Assistant**
   - Natural language conversational talent queries.
   - Example 1-click prompt suggestion pills.
   - Candidate search results rendered directly as structured cards inside the chat.
   - Loading spinners, empty states, and reset chat capability.

3. **Candidates Directory**
   - Real-time search and multi-facet filtering (Location, Availability, Technical Skills).
   - Comprehensive candidate profile detail view with extracted skills, work history, and verifiable evidence quotes.
   - Resume document preview placeholder with simulated SHA-256 integrity digest and redaction badge.

4. **Job Descriptions & Matching**
   - Job listings matched against the actual JDs in `data/jds`.
   - Master-detail view with requirements and extracted responsibilities.
   - Interactive Nemotron JD Analyzer simulator with step-by-step progress tracking.
   - Real-time candidate matching and fit percentage ranking.

5. **Recruitment Requests**
   - Requisition tracking table with priority badges (Urgent, High, Medium, Low).
   - Recruiter assignment and SLA milestone tracking.
   - Requisition detail drawer with 1-click jump to linked Job Description.

---

## Quick Start (PowerShell)

```powershell
# 1. Navigate to the frontend directory
cd frontend

# 2. Run the development server
npm run dev
```

The prototype runs at `http://localhost:5173`.
