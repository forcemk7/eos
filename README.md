## eOS – Resume builder (job search + AI coach next)

**Goal:** Build something that gets used every job-search session and compounds into an offer. Resume builder is the foundation; job search + apply is where the needle moves; AI coach makes the whole flow less painful.

### Current: Resume builder

**Data model (DB first):** One profile per user. Single-word categories: Contact, Summary, Additional on `profiles`; Experience in `experience` + `bullets`; Education, Achievements, Skills, Languages in their own tables. Order via `sort_order`. Resumes are *views* assembled from this data.

- **Upload + digitize** — Drop PDF or DOCX. AI parses into structured sections (contact, summary, experience, skills).
- **Edit in-browser** — Update any section. Version history: every save is a snapshot; restore any version.
- **LLM suggestions** — Suggestions appear inline at each section; accept or reject each edit (no “request” step).
- **Real-time layout mirror** — See the same resume data in different templates live; switch view without overwriting. Multiple parallel “presentations” of one dataset.
- **Export PDF** — Export from the currently selected layout.

### Planned

- **Job search** — Stream listings from other platforms into the app; one place to browse without signing up everywhere.
- **Quick apply** — TBD (e.g. open job + copy tailored materials; platform-specific flows later).
- **AI coach** — Real-time AI interview (audio) → transcript → feed into resume, job/role search, cover letter, interview prep.

### Running the app

**Requirements:** Node.js 18+, `.env.local` with:
- `OPENAI_API_KEY` — resume parsing and suggestions
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` — Supabase anon key

```bash
npm install
npm run dev
```
Open `http://localhost:3000`. Sign up, upload a resume, edit and use suggestions/layouts.

### Supabase

1. **Auth** — Enable Email auth.
2. **Database** — Run `backend/schema.sql` (only `resumes` and storage are required for the current app).
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
  schema.sql                — Supabase schema
lib/
  exportResumePdf.ts        — PDF export (templates)
  applyResumeSuggestion.ts  — Apply a suggestion to resume data
```
