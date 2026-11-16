# Job Descriptions & AI Matching — Intelligence Enhancement

## Overview

This document details the intelligence enhancements made to the **Job Descriptions & AI Matching** page (workspace: `JobsPage`, component: `JobDetail`). The enhancements add an **AI Intelligence tab** to each job detail, surfacing backend Phase 2C/2D talent-intelligence data that was previously unavailable in the UI: hiring difficulty predictions, supply/demand analysis, strategic sourcing recommendations, adjacent-skill alternatives, and vector-similar jobs.

---

## Files Created

### 1. `frontend/src/components/jobs/AIIntelligencePanel.jsx` (NEW)

**Purpose:** A dedicated intelligence panel for a single Job Description, displaying evidence-based hiring difficulty, candidate supply/demand, AI-generated sourcing strategies, and vector-similar job requisitions.

**Backend APIs consumed:**
| Endpoint | Service | Data Shown |
|---|---|---|
| `GET /api/intelligence/hiring-difficulty/jobs/{job_id}` | `intelligenceApi.getJobHiringDifficulty` | Difficulty score (0–100), classification, contributing factors, skill scarcity, supply/demand counts, location constraints, recruiter actions |
| `GET /api/intelligence/sourcing/jobs/{job_id}/recommendations` | `intelligenceApi.getJobSourcingRecommendations` | Prioritized sourcing strategies with evidence, confidence, related skills |
| `GET /api/ai/similar-jobs/{job_id}` | `aiApi.getSimilarJobs` | Vector-similar jobs via Nemotron embeddings with overlap % |

**Key UI sections:**
- **Difficulty Score KPI card** — score, confidence level, classification badge (Low / Moderate / High / Critical / Insufficient Data), total points earned/max
- **Four Supply & Demand MetricCards** — Fully Qualified, Skill-Qualified, Available ≤30 Days, Total in Database
- **Contributing Factors breakdown** — severity-chipped factor list with progress bars (points earned vs max) and information type
- **Candidate Supply panel** — qualified vs skill-qualified vs available vs total database counts
- **Location Constraints panel** — job location, work mode, location-restricted flag, non-local skill-matched count
- **Mandatory Skill Scarcity tags** — per-skill color-coded chips (Critical Shortage / Low Supply / Balanced / High Supply) with candidate counts
- **AI Sourcing Recommendations** — priority-ranked cards (Critical/High/Medium/Low) with title, reason, evidence, action type, confidence, and related skills
- **Similar Jobs (Vector Match)** — Nemotron embedding similarity list with overlap %, department, location, and navigate-to-job action
- **Suggested Recruiter Actions** — bullet list of actionable recommendations
- **Quick action bar** — "Open Talent Sourcing" button to jump to the sourcing tab

**Loading/Error handling:** Renders animated MetricCard skeletons while fetching; uses an AbortController to cancel in-flight requests on unmount or job switch; logs non-fatal fetch failures per-endpoint without blocking the panel.

---

## Files Modified

### 2. `frontend/src/components/jobs/JobDetail.jsx`

**Purpose:** Core job-detail view with sections for JD specifications, competencies, screening kit, sourcing ecosystem, boolean query generator, matching candidates, and now AI Intelligence.

**Changes:**

| Area | Change |
|---|---|
| **Imports** | Added `AIIntelligencePanel` import; merged `intelligenceApi` and `aiApi` into the existing `approvalApi` import from `../../api/client` |
| **Section toolbar** | Added 4th tab: `"4. AI Intelligence"` with badge `"Hiring Difficulty & Supply"` alongside JD Specifications, Talent Sourcing, and Candidates & Matching |
| **Section state** | Added `aiIntelligence: true` to initial `openSections` so the panel is expanded by default |
| **Section helpers** | Updated `shouldShowSection`, `toggleAllSections`, `isAllExpanded`, and `handleSelectViewFilter` to recognize the `aiIntelligence` key |
| **Props** | Added `onNavigateToJob` to destructured props |
| **Render** | Inserted new section `5.5. AI Talent Intelligence Section` between the Boolean generator and Matching Candidates sections; renders `AIIntelligencePanel` with `jobId`, `job`, an `onOpenSourcingTab` handler (switches to Sourcing tab), and `onNavigateToJob` |
| **MatchingCandidates usage** | Now passes `job={job}` prop down to enable adjacent-skills and digital-twin features |

---

### 3. `frontend/src/pages/JobsPage.jsx`

**Purpose:** Page-level container for the Jobs workspace — master job list (left column) and job detail / matching (right column), plus lazy-loaded modals.

**Changes:**
- Added `onNavigateToJob={(targetJobId) => setSelectedJobId(targetJobId)}` to the `JobDetail` JSX invocation, enabling the AI Intelligence panel to navigate to a different job requisition (e.g., from a vector-similar job card).

---

### 4. `frontend/src/components/jobs/MatchingCandidates.jsx`

**Purpose:** Renders ranked candidate cards with tier badges, match scores, requirement alignment, component scores, skill pills, and expandable evidence highlights.

**Changes:**

| Area | Change |
|---|---|
| **Props** | Added `job` prop to destructuring |
| **New helper `getDigitalTwinPersona`** | Infers a candidate archetype badge from component scores + match score: Strong Technical Fit / Domain Expert / Semantic Match / Potential Match / Emerging Talent, each with distinct color styling |
| **New helper `getAdjacentSkills`** | Filters candidate skills against JD required/preferred skills to surface adjacent/transferable skills (not in the JD), limited to 4 |
| **Candidate header row** | Added digital twin persona badge chip next to the tier badge |
| **Component scores** | Replaced flat percentage mini-bars with animated horizontal progress bars (Mandatory Skills / Experience Fit / Domain & Role / Semantic Relevance), color-coded fills with duration-700 transition |
| **Skills row** | Added an "Adjacent Skills" insight pill row when `job` is present and adjacent skills exist |

---

## Architecture Summary

```
JobsPage.jsx
└── JobDetail.jsx
    ├── Section 1: JD Specifications (summary, competencies, screeningKit)
    ├── Section 2: Talent Sourcing (boolean, companies)
    ├── Section 3: Candidates & Matching (matches) → MatchingCandidates.jsx
    └── Section 4: AI Intelligence (NEW)
        └── AIIntelligencePanel.jsx (NEW)
            ├── Hiring Difficulty Score (backend: intelligenceApi)
            ├── Supply & Demand KPIs
            ├── Location Constraints
            ├── Skill Scarcity Tags
            ├── AI Sourcing Recommendations
            ├── Similar Jobs (backend: aiApi)
            └── Suggested Recruiter Actions
```

MatchingCandidates.jsx now receives `job` context to compute digital-twin personas and adjacent-skill insights per candidate.

---

## Data Flow

1. User selects a job in `JobsPage` → `selectedJobId` updates
2. `JobDetail` mounts for the selected job
3. User clicks the **"4. AI Intelligence"** tab (or it loads expanded by default)
4. `AIIntelligencePanel` fires four parallel API calls guarded by an AbortController:
   - `intelligenceApi.getJobHiringDifficulty(jobId)`
   - `intelligenceApi.getJobSourcingRecommendations(jobId)`
   - `intelligenceApi.getJobSourcingAlternatives(jobId)` (stored in state, available for expansion)
   - `aiApi.getSimilarJobs(jobId, 5)`
5. Results render into KPI cards, factor breakdowns, recommendation cards, and similar-job lists
6. `onOpenSourcingTab` switches the view filter to `sourcing`; `onNavigateToJob` changes `selectedJobId` in `JobsPage`

---

## Build Verification

`npm run build` in `frontend/` completed successfully — 1659 modules transformed, zero errors, no warnings.

---

## Notes

- No git commit was made. Changes are uncommitted in the working tree.
- All backend endpoints already existed (`app/routers/intelligence.py`, `app/routers/ai.py`); this work wires them into the frontend UI for the first time on the Job Detail page.
- Dark mode is fully supported via Tailwind `dark:` variants throughout all new and modified components.
- The panel gracefully handles missing/insufficient data (e.g., jobs without structured skills return "Insufficient Data" with actionable guidance).
