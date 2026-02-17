## eOS – Autonomous job application agent

**Problem:** Applying to jobs is a grind — open browser, visit platforms, recreate your resume, browse listings, write cover letters, submit, repeat. For dozens of roles across multiple platforms.

**Solution:** Upload your resume once. Configure your preferences (titles, keywords, locations). Add your platform credentials. An AI agent opens a real browser, logs into each platform, searches for matching roles, tailors your application, and submits — all autonomously. You review results in the dashboard.

### Features

**Dashboard (Next.js)**
1. **Upload + parse** — Drop a PDF or DOCX. AI extracts it into structured sections (contact, summary, experience, skills).
2. **Edit in-browser** — Update any section directly. No download/upload cycle.
3. **Version history** — Every save creates a snapshot. Restore any previous version.
4. **Tailor per job** — Paste a job description. AI rewrites your resume to match and generates a cover letter.
5. **PDF export** — One-click export for resume and cover letter.
6. **Application tracker** — Kanban board with drag-and-drop status updates (Applied / Interview / Offer / Rejected).
7. **Agent config** — Set job preferences (titles, keywords, locations, remote-only, max per run).
8. **Platform credentials** — Add login credentials for job platforms (encrypted at rest with Fernet).
9. **Activity log** — View history of all agent runs, actions, and results.

**Agent (Python)**
- Uses `browser-use` + OpenAI GPT-4o to control a real Chromium browser.
- Logs into job platforms (LinkedIn, Indeed, Glassdoor, Dice, Wellfound).
- Searches for roles matching your preferences.
- Applies using your resume data, writing tailored cover letters.
- Logs every action to the activity log. Saves successful applications to the tracker.
- Stops on CAPTCHA or 2FA — never tries to bypass.

### Running the dashboard

**Requirements:**
- Node.js 18+
- `.env.local` with:
  - `OPENAI_API_KEY` — for resume parsing and tailoring
  - `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` — Supabase anon key
  - `CREDENTIAL_KEY` — Fernet key for encrypting platform passwords (see below)

**Commands:**
```bash
npm install
npm run dev
```
Open `http://localhost:3000`. Sign up, upload a resume, configure preferences and credentials.

### Running the agent

**Requirements:**
- Python 3.11+
- Same `.env.local` as the dashboard (no service role key needed — the agent signs in as your user)

**Setup:**
```bash
cd agent
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
python -m playwright install chromium
```

**Generate a CREDENTIAL_KEY** (add to `.env.local`):
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Run:**
```bash
cd agent
python main.py --email you@example.com --password yourpass
# or for a specific platform:
python main.py --email you@example.com --password yourpass --platform linkedin
```

The agent signs in with your Supabase credentials (same account you use in the dashboard), opens a visible browser window, performs the job search and application flow, then logs results to Supabase. No service role key required — RLS applies normally.

### Supabase setup

1. **Auth** — Enable Email auth in the Supabase dashboard.
2. **Database** — Run `backend/schema.sql` in the SQL Editor. This creates all tables with row-level security:
   - `resumes` — resume versions
   - `applications` — application tracker
   - `job_preferences` — agent search config (one row per user)
   - `platform_credentials` — encrypted login credentials
   - `activity_log` — agent action history
3. **Storage** — Create a bucket named `resumes`. Add policies so authenticated users can upload/read files under their own `{user_id}/` prefix.

### Tech

- **Dashboard:** Next.js 14 (App Router), React, TypeScript, Supabase (Auth, Postgres, Storage), OpenAI, jsPDF
- **Agent:** Python, browser-use, Playwright, langchain-openai (GPT-4o), Fernet encryption

### Project layout

```
app/
  page.tsx                  — Main app: auth, tab navigation
  components/
    ResumeUpload.tsx        — First-step upload and parse
    ResumeEditor.tsx        — Edit resume sections, save versions, export PDF
    TailorView.tsx          — Paste JD, get tailored resume + cover letter
    TrackerTab.tsx          — Kanban application tracker
    PreferencesTab.tsx      — Job preferences form (agent config)
    CredentialsTab.tsx      — Platform credentials manager
    ActivityTab.tsx         — Agent activity log viewer
  api/
    resume/                 — GET/POST resume versions
    parse-resume/           — POST file upload and AI parse
    tailor/                 — POST resume + JD, get tailored output
    applications/           — GET/POST applications, PUT status updates
    job-preferences/        — GET/POST job search preferences
    platform-credentials/   — GET/POST/DELETE encrypted credentials
    encrypt/                — POST encrypt plaintext (Fernet)
    activity-log/           — GET agent activity entries
agent/
  main.py                   — Agent entry point, orchestrates per-platform runs
  config.py                 — Load resume, preferences, credentials from Supabase
  credentials.py            — Fernet encrypt/decrypt utilities
  requirements.txt          — Python dependencies
backend/
  schema.sql                — Full Supabase schema (safe to re-run)
```
