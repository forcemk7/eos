## eOS – Get hired faster

**Goal:** Build something that gets used every job-search session and compounds into an offer. Conceptual order: **Data** (base) → **Jobs** (listings) → **Resume** (tailor and apply). Job listings are the current next step; then resume builder refinements and apply from app.

### Current: Data + Jobs + Resume

**Data model (DB first):** One profile per user. Single-word categories: Contact, Summary, Additional on `profiles`; Experience in `experience` + `bullets`; Education, Achievements, Skills, Languages in their own tables. Order via `sort_order`. Resumes are *views* assembled from this data.

- **Upload + digitize** — Drop PDF or DOCX. AI parses into structured sections (contact, summary, experience, skills).
- **Edit in-browser** — Update any section. Version history: every save is a snapshot; restore any version.
- **LLM suggestions** — Suggestions appear inline at each section; accept or reject each edit (no “request” step).
- **Real-time layout mirror** — See the same resume data in different templates live; switch view without overwriting. Multiple parallel “presentations” of one dataset.
- **Export PDF** — Export from the currently selected layout.

### Planned

- **Job listings** — In progress: add jobs (manual or paste + AI extract), filter, curate. Next: more sources (aggregators), LLM match/relevance.
- **Resume builder** — General-purpose resume from profile data; choose sections and templates; LLM suggestions. Then: tailor per job, export.
- **Apply from app** — Use job + profile to prepare applications (resume slice, cover letter). AI coach for tailoring and next steps.

### Running the app

**Requirements:** Node.js 18+, `.env.local` with:
- `OPENAI_API_KEY` — resume parsing and suggestions
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` — Supabase anon key
- `RAPIDAPI_KEY` — job discovery (JSearch on RapidAPI). You must **subscribe** to the API (free “Basic” plan): open [JSearch](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch), click **Subscribe to Test**, choose **Basic** (200 requests/month). Then add your RapidAPI key to `.env.local` as `RAPIDAPI_KEY`.

```bash
npm install
npm run dev
```
Open `http://localhost:3000`. Sign up, upload a resume, edit and use suggestions/layouts.

### Supabase

1. **Auth** — Enable Email auth.
2. **Database** — Run `backend/schema.sql` on a fresh project, or apply incremental files under `backend/migrations/` (e.g. `20250320_t6_apply_tracking.sql` for job apply logging + `application_events`, `20250321_t5_match_loop.sql` for “Find a strong match” sessions/iterations, `20250322_t7_cover_letter_job_listing.sql` to link cover letter chats to `job_listings`). Re-run is safe where marked idempotent.
3. **Storage** — Bucket `resumes` with policies for authenticated upload/read under `{user_id}/`.

### Project layout

```
app/
  page.tsx                  — Auth, resume flow (upload or editor)
  components/
    ResumeUpload.tsx        — Upload and parse PDF/DOCX
    ResumeEditor.tsx        — Edit, inline suggestions, layout mirror, export
  api/
    resume/                 — GET/POST resume, GET by version
    resume/suggest/         — POST get LLM suggestions for current resume
    parse-resume/           — POST file upload and AI parse
backend/
  schema.sql                — Full Supabase schema (source of truth)
  migrations/               — Incremental SQL (e.g. T6 apply tracking)
lib/
  exportResumePdf.ts        — PDF export (templates)
  applyResumeSuggestion.ts  — Apply a suggestion to resume data
```
