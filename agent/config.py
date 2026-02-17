"""Load user config from Supabase: resume, job preferences, platform credentials.

Uses the anon key + user sign-in (not the service role key) so RLS applies normally.
"""

import os
from supabase import create_client, Client
from credentials import decrypt


def get_supabase_as_user(email: str, password: str) -> tuple[Client, str]:
    """Sign in as a real user with the public anon key. Returns (client, user_id)."""
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY")

    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and "
            "SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY) "
            "are required in .env.local"
        )

    client = create_client(url, key)
    auth_response = client.auth.sign_in_with_password({"email": email, "password": password})
    user_id = auth_response.user.id
    return client, user_id


def load_resume(supabase: Client, user_id: str) -> dict | None:
    """Load latest resume parsed_data for the user."""
    result = (
        supabase.table("resumes")
        .select("parsed_data")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]["parsed_data"]
    return None


def load_job_preferences(supabase: Client, user_id: str) -> dict:
    """Load job preferences. Returns defaults if none saved."""
    result = (
        supabase.table("job_preferences")
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if result.data:
        row = result.data[0]
        return {
            "titles": row.get("titles") or [],
            "keywords": row.get("keywords") or [],
            "locations": row.get("locations") or [],
            "remote_only": row.get("remote_only", False),
            "max_applications_per_run": row.get("max_applications_per_run", 10),
        }
    return {
        "titles": [],
        "keywords": [],
        "locations": [],
        "remote_only": False,
        "max_applications_per_run": 10,
    }


def load_platform_credentials(supabase: Client, user_id: str) -> list[dict]:
    """Load and decrypt platform credentials for the user."""
    result = (
        supabase.table("platform_credentials")
        .select("platform, email, encrypted_password")
        .eq("user_id", user_id)
        .execute()
    )
    creds = []
    for row in result.data:
        creds.append({
            "platform": row["platform"],
            "email": row["email"],
            "password": decrypt(row["encrypted_password"]),
        })
    return creds


def log_activity(
    supabase: Client,
    user_id: str,
    run_id: str,
    action: str,
    platform: str = "",
    details: dict | None = None,
    status: str = "info",
):
    """Write an entry to the activity_log table."""
    supabase.table("activity_log").insert({
        "user_id": user_id,
        "run_id": run_id,
        "action": action,
        "platform": platform,
        "details": details or {},
        "status": status,
    }).execute()
