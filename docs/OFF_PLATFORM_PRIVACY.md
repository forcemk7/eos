# Off-platform workflow — privacy boundaries

This document describes what user data leaves the device, where it is stored, and when it is sent to an LLM. It supports the T7 “eOS as hub” flow (external jobs: paste or screenshot JD, qualify, track, tailor).

## Summary

| Data | Stored in eOS | Sent to LLM? | Notes |
|------|---------------|--------------|--------|
| Profile (“CV” / Data tab) | Supabase (RLS-scoped to your account) | Yes, when you run **job fit** or **cover letter** | Assembled text summary built server-side from your profile tables |
| JD plain text | `job_listings.description` / `snippet`, and/or chat messages | Yes, when you run fit or cover-letter chat | Fit checks truncate very long text (see `lib/jobs/computeJobFit.ts`) |
| JD screenshots | Supabase Storage bucket `cover-letter` (private paths under your user id) | Yes, as time-limited signed URLs when used in chat or JD extraction | Same bucket as cover-letter attachments; not world-readable |
| Apply / pipeline events | `application_events` + columns on `job_listings` | No | Used for your timeline and reporting |

## What we do **not** require

The recommended path keeps JD + profile processing **inside** the earnOS backend (your OpenAI key + your Supabase project). You do not need to paste job content into third-party chat tools to use fit, tracking, or in-app cover letters.

## Your controls

- Delete a **job listing** to remove that stub and (via cascade) its `application_events` rows.
- Delete a **cover letter chat** to remove that thread; images in Storage may remain until you rely on a future cleanup policy—today, paths are only referenced from messages you delete with the chat (messages cascade-delete with the chat).
- Profile data is edited or cleared from the **Data** tab as today.

## Environment

LLM calls use `OPENAI_API_KEY` configured for your deployment. Supabase holds auth, relational data, and private file storage under Row Level Security policies aligned with `backend/schema.sql` and `backend/storage-cover-letter-policies.sql`.

This is descriptive product/engineering documentation, not legal advice.
