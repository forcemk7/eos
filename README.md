## eOS – Resume in the cloud

**Problem:** Storing and editing resumes/CVs in Google Drive or a random folder is a pain — download, edit, re-upload, no history, no structure.

**Solution:** A cloud-native resume that’s **versioned** (like Git) and **editable in one place**. Upload what you have once; we parse it into a structured doc. Edit anytime, save new versions, restore any previous version. Export when you need a file (coming soon). Later: LLM-assisted edits per job/experiment and cover letters in the same system.

### What’s in the app today

1. **Upload** – First step: drop a PDF or DOCX resume. We parse it (AI) and save it as version 1.
2. **Edit** – Contact, summary, experience, skills — all editable in the browser. No download/upload.
3. **Version history** – Every “Save new version” creates a snapshot. Restore any version and keep editing.
4. **Export** – Planned: one-click PDF/DOCX when you need to send a file.

### Running it

- **Requirements:** Node.js; `.env.local` with:
  - `OPENAI_API_KEY` – for resume parsing
  - `NEXT_PUBLIC_SUPABASE_URL` – Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` – Supabase publishable key
- **Commands:**
  ```bash
  npm install
  npm run dev
  ```
- Open `http://localhost:3000`. Sign up or sign in, then upload a resume.

### Supabase setup

1. **Auth** – In the Supabase dashboard, enable Email auth (no extra config for dev).
2. **Storage** – Create a bucket named `resumes`. Add a policy so authenticated users can upload and read their own files, e.g.:
   - **Upload:** `(bucket_id = 'resumes') AND (auth.role() = 'authenticated') AND (storage.foldername(name))[1] = auth.uid()::text`
   - **Read:** same condition for SELECT.  
   (Files are stored as `{user_id}/{uuid}-{filename}`.)

### Tech

- Next.js 14 (App Router), React, TypeScript
- **Supabase** – Auth (email/password), Storage (uploaded resume files)
- SQLite (`earnos.db`) for resume versions and parsed data
- Parse: PDF/DOCX → text, then OpenAI → structured JSON (identity, summary, experience, skills)

### Project layout

- `app/page.tsx` – Single flow: upload **or** editor + version history
- `app/components/ResumeUpload.tsx` – First-step upload & parse
- `app/components/ResumeEditor.tsx` – Editable resume + version list + Save / Restore
- `app/api/resume/` – GET (list + current), POST (save new version)
- `app/api/resume/[id]/` – GET one version (for Restore)
- `app/api/parse-resume/` – POST file → parsed JSON

Other pieces (job preferences, tracker, life-rate calculator) exist in the repo but are not in the current UI; the product is focused on **one useful thing**: your resume, versioned and editable in the cloud.
