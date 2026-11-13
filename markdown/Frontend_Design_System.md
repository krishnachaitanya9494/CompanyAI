# CompanyAI Agent — Frontend Design System (`Frontend_Design_System.md`)

## 1. Technology Stack
- **React 18** + **Vite 5** (JavaScript / JSX)
- **Tailwind CSS 3** (`frontend/tailwind.config.js` + `frontend/src/index.css`)
- **Icons:** `lucide-react`
- **Motion:** CSS keyframes + React Bits components (`BlurText`, `Counter`, `SpotlightCard`, `LatticeLoader`, `ShinyText`, `AnimatedList`, `Magnet`, `GlareHover`, `GradientText`, `AnimatedContent`) respecting `prefers-reduced-motion`.

---

## 2. Typography System
- **Headings (`font-display`):** `Plus Jakarta Sans`
- **Body, Tables, Forms, Nav (`font-sans`):** `Inter`
- **Numeric / KPI / Technical (`font-mono`):** `JetBrains Mono` (`tabular-nums`)

### Centralized Scale (`tailwind.config.js` & `index.css`)
- **Main Page Titles (`PageHeader.jsx`):** `28–32px`
- **Section Headings (`h2`):** `22–24px`
- **Card / Modal Headings (`h3`, `Modal.jsx`):** `18–20px`
- **KPI Values (`MetricCard.jsx`):** `30–36px`
- **KPI Labels:** `14–16px`
- **Table Headers / Body:** `14–15px` / `15–16px` (`>= 14px` in Compact Mode)
- **Form Labels / Inputs / Buttons / Nav / Tabs:** `15–16px` (`16px` on inputs/selects/textareas)
- **Badges & Helper Text:** `13–14px`

---

## 3. Themes & Display Density
- **Light & Dark Themes:** Class-based (`html.dark`), persisted in `localStorage` (`companyai-theme`).
- **Display Density (`data-density` on `<html>`):**
  - **Comfortable (Default):** Generous card padding (`1.25rem`), section gaps (`1.5rem`), and table padding (`0.75rem 1rem`).
  - **Compact:** Tighter card padding (`0.875rem`), section gaps (`1rem`), and table padding (`0.45rem 0.75rem`) while preserving `>= 14px` readable body and table text.
  - Controlled in **Settings** (`SettingsPage.jsx`) and persisted in `localStorage` (`companyai-density`).
