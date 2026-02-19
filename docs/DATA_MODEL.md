# earnOS data model

Single-word labels only. Categories map 1:1 to schema (tables/columns). Granular: one fact per row.

---

## Schema mapping (category → table/column)

| Category    | Schema |
|------------|--------|
| Contact    | `profiles.identity` (name, email, phone, location, links) |
| Summary    | `profiles.summary` |
| Additional | `profiles.additional` |
| Experience | `experience` + `bullets` |
| Education  | `education` |
| Achievements | `achievements` |
| Skills     | `skills` |
| Languages  | `languages` |

---

## Contact

`profiles.identity` (JSONB): name, email, phone, location, links[]. Each link: `{ label, url }`.

---

## Summary

`profiles.summary` (TEXT). Single block by design.

---

## Experience

Table `experience`: id, user_id, company, title, dates, sort_order.  
Table `bullets`: id, experience_id → experience(id), text, sort_order. One row per position; one row per accomplishment.

---

## Education

Table `education`: id, user_id, institution, degree, field_of_study, dates, sort_order.

---

## Achievements

Table `achievements`: id, user_id, title, issuer, date, sort_order.

---

## Skills

Table `skills`: id, user_id, name, sort_order.

---

## Languages

Table `languages`: id, user_id, language, level, sort_order.

---

## Additional

`profiles.additional` (JSONB): [{ id, title, content[] }]. Flexible sections.
