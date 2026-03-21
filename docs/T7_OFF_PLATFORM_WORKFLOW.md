# T7 — Off-platform workflow (eOS as hub)

Real job searches include roles found **outside** earnOS. This flow treats eOS as the hub: bring the JD in (text or screenshot), get a **qualification / fit** answer against your Data profile, optionally **save a listing stub** for T6 tracking and T1 cover letter context, then use the same apply and tailor paths as in-platform listings.

## Conventions

### `job_listings.source`

- Use **`off_platform`** for roles you found elsewhere and imported or extracted into eOS (including screenshot → text flows).
- **`manual`** remains valid for quick “log application” style entries (see `POST /api/jobs/log-manual`).
- Aggregator/discover flows may use values such as **`jsearch`** (see sync-discover).

### `job_listings.raw` (optional JSON)

Suggested shape for imports:

```json
{
  "origin": "off_platform",
  "import_method": "form | vision_extract | api",
  "note": "optional user note"
}
```

**Parity rule:** one `job_listings` row = one trackable opportunity. After the row exists, T6 (`application_events`, apply columns) and fit/cover-letter flows treat it like any other listing for your user.

## End-to-end sequence (API)

### 1. Create a listing stub

**Option A — Generic create**

`POST /api/jobs` with JSON body, e.g.:

```json
{
  "source": "off_platform",
  "title": "Senior Engineer",
  "company": "Example Corp",
  "url": "https://example.com/jobs/123",
  "location": "Remote",
  "remote": true,
  "description": "<full JD text>",
  "raw": { "origin": "off_platform", "import_method": "form" }
}
```

**Option B — Import helper (event logged)**

`POST /api/jobs/import-off-platform` — same fields as above (title + company required; description optional). Inserts the row and appends `application_events` with `event_type: imported_external`.

**Option C — Screenshot / images already in Storage**

Upload images via `POST /api/cover-letter/upload` (form field `image`), then:

`POST /api/jobs/extract-from-images` with `{ "storage_paths": ["<userId>/<uuid>.png"] }` (paths must be under your auth user id). The server extracts title, company, and JD body via vision, inserts `source: off_platform`, `raw.import_method: vision_extract`, and returns `{ listing, fit? }` if `run_fit: true`.

### 2. Qualification (fit)

- **By payload:** `POST /api/jobs/fit` with `{ "title", "company", "description", "snippet", ... }` (same shape as the job board fit UI).
- **By saved listing:** `POST /api/jobs/<listing_id>/fit` — loads the row for the current user and runs the same fit logic (avoids client drift).

Requires completed **Data** profile and `OPENAI_API_KEY`.

### 3. Tracking (T6)

Use `PATCH /api/jobs/<id>` for notes/status as needed, and `POST /api/jobs/<id>/apply-event` for outbound clicks, decisions, pipeline stages, etc. Same as native listings.

### 4. Cover letter (T1)

- **Today:** Cover Letter tab — paste or attach JD image; profile is injected server-side.
- **With listing link:** Create or patch a chat with `job_listing_id` set to your stub so the UI can show “attached” context and deep-links stay consistent. See `cover_letter_chats.job_listing_id` in `backend/schema.sql`.

### 5. First-class UI

- **Jobs:** “Add external job” opens a form → `import-off-platform` or `extract-from-images` + optional fit.
- **Cover Letter:** Choose a tracked listing to attach (`job_listing_id` on create/PATCH).

## Related docs

- [OFF_PLATFORM_PRIVACY.md](./OFF_PLATFORM_PRIVACY.md) — what is stored and sent to the LLM.
- [DATA_MODEL.md](./DATA_MODEL.md) — job listings / sources subsection.
