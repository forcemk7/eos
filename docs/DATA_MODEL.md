# earnOS data model

Product layers (conceptual order): **Data** (base) → **Jobs** (listings, browse, filter) → **Resume** (extract from data, tailor, apply). Next step: Job Listings; then resume builder and apply from app.

Single-word labels only. Categories map 1:1 to schema (tables/columns). Granular: one fact per row. Typed fields (dates, enums) so the LLM parser and ingest can reliably update, ignore, or add.

---

## Schema mapping (category → table/column)

| Category    | Schema |
|------------|--------|
| Contact    | `profiles.identity` (name, email, phone, location only) |
| Links      | `profile_links` |
| Summary    | `profiles.summary` |
| Additional | `profiles.additional` |
| Experience | `experience` + `bullets` |
| Education  | `education` |
| Achievements | `achievements` |
| Skills     | `skills` |
| Languages  | `languages` |

---

## Contact

`profiles.identity` (JSONB): name, email, phone, location only. No links here.

---

## Links

`profile_links` table: id, user_id, url, sort_order. Dedicated section for any relevant URLs (LinkedIn, portfolio, GitHub, etc.). One row per URL. **kind** is inferred from URL for merge/dedup.

---

## Summary

`profiles.summary` (TEXT). Single block by design.

---

## Experience

Table `experience`: id, user_id, company, title, dates (TEXT, display), start_date (DATE), end_date (DATE), sort_order.  
Table `bullets`: id, experience_id → experience(id), text, sort_order. One row per position; one row per accomplishment. Display string comes from `dates` or is derived from start_date/end_date (e.g. "Present" when end_date is null).

---

## Education

Table `education`: id, user_id, institution, degree, field_of_study, dates (TEXT), start_date (DATE), end_date (DATE), sort_order.

---

## Achievements

Table `achievements`: id, user_id, title, issuer, date (TEXT, prefer ISO), sort_order.

---

## Skills

Table `skills`: id, user_id, name, sort_order.

---

## Languages

Table `languages`: id, user_id, language, level (TEXT), sort_order. **level** uses a controlled vocabulary: native | fluent | advanced | intermediate | basic | other (synonyms like "proficient" → advanced, "beginner" → basic).

---

## Additional

`profiles.additional` (JSONB): [{ id, title, content[] }]. Flexible sections.

---

## Merge semantics

When ingesting parsed data (e.g. new resume) into an existing profile, the app applies deterministic rules so the LLM only needs to output the canonical payload; the app decides update / ignore / add.

- **Identity:** For each field (name, email, phone, location): if current is non-empty, keep it; else set from incoming. **Links:** Kind is inferred from URL; match by kind (e.g. one LinkedIn); if same kind exists, update URL; else append.
- **Summary:** Overwrite with incoming if incoming is non-empty; otherwise keep current.
- **Experience:** Match by (company + title). If match: update dates (start_date, end_date, display) and append new bullets to that position. If no match: append as new experience.
- **Education:** Match by (institution + degree). If match: update dates and other fields. If no match: append.
- **Skills / Languages / Achievements:** Append if not already present. Dedup by: skill name; language+level; title+issuer+date.
- **Additional:** Merge by section title. If section exists, append new items to content[]; if new title, append new section.

See `mergeIntoProfile` in `lib/profileDb.ts` for implementation.
