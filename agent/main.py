"""earnOS Agent — autonomous job application bot.

Usage:
    python main.py --email you@example.com --password yourpass
    python main.py --email you@example.com --password yourpass --platform linkedin

Requires .env.local in project root with:
    OPENAI_API_KEY=sk-...
    NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=eyJ...
    CREDENTIAL_KEY=<fernet-key>
"""

import argparse
import asyncio
import json
import os
import uuid

from dotenv import load_dotenv

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

from langchain_openai import ChatOpenAI
from browser_use import Agent, Browser, BrowserConfig

from config import (
    get_supabase_as_user,
    load_resume,
    load_job_preferences,
    load_platform_credentials,
    log_activity,
)


def build_task_prompt(
    resume: dict,
    prefs: dict,
    cred: dict,
) -> str:
    """Build the natural-language task for the browser agent."""

    titles = ", ".join(prefs["titles"]) if prefs["titles"] else "software engineer"
    locations = ", ".join(prefs["locations"]) if prefs["locations"] else "any location"
    remote_flag = " (remote only)" if prefs.get("remote_only") else ""
    keywords = ", ".join(prefs["keywords"]) if prefs["keywords"] else ""
    max_apps = prefs.get("max_applications_per_run", 5)

    name = resume.get("name", "the user") if resume else "the user"
    summary = resume.get("summary", "") if resume else ""
    experience_items = resume.get("experience", []) if resume else []
    experience_text = ""
    for exp in experience_items[:3]:
        company = exp.get("company", "")
        role = exp.get("title", "")
        experience_text += f"  - {role} at {company}\n"

    platform = cred["platform"]
    email = cred["email"]
    password = cred["password"]

    task = f"""You are an autonomous job application agent acting on behalf of {name}.

CANDIDATE PROFILE:
- Summary: {summary}
- Recent experience:
{experience_text}
GOAL: Find and apply to up to {max_apps} relevant job openings on {platform}.

STEPS:
1. Go to {_platform_url(platform)}.
2. Log in with email: {email} and password: {password}.
   - If there's a cookie/GDPR banner, accept it.
   - If 2FA or CAPTCHA appears, STOP and report it — do NOT try to bypass it.
3. Navigate to the job search section.
4. Search for roles matching: {titles}{remote_flag}.
   {f'Prefer postings mentioning: {keywords}.' if keywords else ''}
   {f'Preferred locations: {locations}.' if locations != 'any location' else ''}
5. For each promising job listing (up to {max_apps}):
   a. Open the listing.
   b. If there's a quick-apply / easy-apply option, use it.
   c. Fill in any required fields using the candidate profile above.
   d. If a cover letter field exists, write a brief, tailored 3-paragraph cover letter.
   e. Submit the application.
   f. Note the job title, company, and whether it was submitted successfully.
6. After finishing, provide a JSON summary of all applications attempted:
   [{{"title": "...", "company": "...", "url": "...", "status": "applied|failed|skipped", "notes": "..."}}]

IMPORTANT RULES:
- Never fabricate experience or skills not in the profile.
- If a form asks for info you don't have, skip that application.
- If you encounter a CAPTCHA or 2FA challenge, stop and report it.
- Be polite and professional in any text you write.
"""
    return task


def _platform_url(platform: str) -> str:
    urls = {
        "linkedin": "https://www.linkedin.com",
        "indeed": "https://www.indeed.com",
        "glassdoor": "https://www.glassdoor.com",
        "dice": "https://www.dice.com",
        "wellfound": "https://wellfound.com",
    }
    return urls.get(platform.lower(), f"https://www.{platform.lower()}.com")


async def run_agent_for_platform(
    user_id: str,
    run_id: str,
    resume: dict,
    prefs: dict,
    cred: dict,
    supabase,
):
    """Run browser-use agent for one platform."""
    platform = cred["platform"]
    log_activity(supabase, user_id, run_id, f"Starting agent for {platform}", platform)

    task = build_task_prompt(resume, prefs, cred)

    llm = ChatOpenAI(model="gpt-4o", temperature=0)

    browser = Browser(
        config=BrowserConfig(
            headless=False,
        )
    )

    agent = Agent(
        task=task,
        llm=llm,
        browser=browser,
        max_actions_per_step=5,
    )

    try:
        result = await agent.run(max_steps=100)

        final_text = result.final_result() if result.final_result() else ""

        log_activity(
            supabase, user_id, run_id,
            f"Agent finished for {platform}",
            platform,
            details={"result": final_text[:4000]},
            status="success",
        )

        _save_applications(supabase, user_id, platform, final_text)

    except Exception as e:
        log_activity(
            supabase, user_id, run_id,
            f"Agent error on {platform}: {str(e)[:500]}",
            platform,
            status="error",
        )
    finally:
        await browser.close()


def _save_applications(supabase, user_id: str, platform: str, result_text: str):
    """Parse the agent's JSON result and insert applications into the tracker."""
    try:
        start = result_text.find("[")
        end = result_text.rfind("]") + 1
        if start == -1 or end == 0:
            return
        apps = json.loads(result_text[start:end])
        for app in apps:
            supabase.table("applications").insert({
                "user_id": user_id,
                "title": app.get("title", ""),
                "company": app.get("company", ""),
                "url": app.get("url", ""),
                "status": "applied" if app.get("status") == "applied" else "failed",
                "notes": f"[auto-agent:{platform}] {app.get('notes', '')}",
            }).execute()
    except (json.JSONDecodeError, KeyError):
        pass


async def main():
    parser = argparse.ArgumentParser(description="earnOS Job Application Agent")
    parser.add_argument("--email", required=True, help="Your Supabase account email")
    parser.add_argument("--password", required=True, help="Your Supabase account password")
    parser.add_argument("--platform", default=None, help="Run for a specific platform only")
    args = parser.parse_args()

    run_id = str(uuid.uuid4())[:8]

    print("Signing in...")
    supabase, user_id = get_supabase_as_user(args.email, args.password)
    print(f"Authenticated as {user_id}")

    resume = load_resume(supabase, user_id)
    prefs = load_job_preferences(supabase, user_id)
    creds = load_platform_credentials(supabase, user_id)

    if not creds:
        print("No platform credentials found. Add them via the dashboard first.")
        return

    if args.platform:
        creds = [c for c in creds if c["platform"].lower() == args.platform.lower()]
        if not creds:
            print(f"No credentials found for platform: {args.platform}")
            return

    if not resume:
        print("Warning: No resume found. Agent will have limited context.")
        resume = {}

    print(f"Run {run_id}: Processing {len(creds)} platform(s)...")
    log_activity(supabase, user_id, run_id, f"Run started with {len(creds)} platform(s)")

    for cred in creds:
        print(f"  -> {cred['platform']}...")
        await run_agent_for_platform(user_id, run_id, resume, prefs, cred, supabase)

    log_activity(supabase, user_id, run_id, "Run complete")
    print(f"Run {run_id} complete.")


if __name__ == "__main__":
    asyncio.run(main())
