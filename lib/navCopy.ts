/** Shared navigation and workflow copy — keep sidebar, dashboard, and tab headers aligned. */

export type NavTabKey =
  | 'dashboard'
  | 'data'
  | 'jobs'
  | 'ai-jobs'
  | 'applications'
  | 'cover-letter'
  | 'resume'

export interface NavItemCopy {
  label: string
  subtitle: string
  /** Longer hint for native `title` / screen readers */
  title: string
}

export const navItemCopy: Record<NavTabKey, NavItemCopy> = {
  dashboard: {
    label: 'Dashboard',
    subtitle: 'Overview and shortcuts',
    title: 'Home: see what to do next and jump to any area.',
  },
  data: {
    label: 'Profile',
    subtitle: 'Structured fields & targets',
    title: 'Edit your profile data, links, experience, and target roles used for matching.',
  },
  resume: {
    label: 'Resume',
    subtitle: 'Upload, edit, tailor from jobs',
    title: 'Upload or replace your resume, edit your master version, or finish tailoring after you pick a job.',
  },
  jobs: {
    label: 'Job Board',
    subtitle: 'Search and browse listings',
    title: 'Search by keywords and location; open listings and apply on employer sites.',
  },
  'ai-jobs': {
    label: 'Recommended Jobs',
    subtitle: 'Matched to your profile',
    title: 'AI-generated search from your profile—roles picked to fit you, not manual search.',
  },
  'cover-letter': {
    label: 'Cover Letter',
    subtitle: 'Draft letters for applications',
    title: 'Generate and refine cover letters for specific roles.',
  },
  applications: {
    label: 'Applications',
    subtitle: 'Pipeline, stages, and history',
    title: 'Track where you applied, stages, and updates over time.',
  },
}

export const jobBoardPage = {
  title: 'Job Board',
  descriptionIdle:
    'Search roles by keyword and location. Results load when you search (cached 24h). Apply on each employer’s site.',
  descriptionSearched:
    'Apply on the employer site. Results refresh from the API once per search and are cached 24h.',
} as const

export const recommendedJobsPage = {
  title: 'Recommended Jobs',
  description:
    'Roles matched to your Profile. Search terms are generated from your profile data—refine Profile for better matches.',
} as const

export const dashboardPage = {
  description:
    'Follow the flow: set up Profile and Resume, discover roles, tailor and draft, then track applications.',
} as const

export const workflowGuideStrip = {
  storageKey: 'earnOS_workflow_guide_dismissed',
  text:
    'Workflow: Profile → Resume → Job Board or Recommended Jobs → tailor in Resume → Cover Letter → Applications.',
  dismiss: 'Dismiss',
} as const

/** Auth screen + one-time post–sign-in dashboard cue */
export const authCopy = {
  freshSignInStorageKey: 'earnOS_fresh_sign_in',
  signIn: {
    title: 'Sign in',
    description: 'Resume and job search in one workspace. After you sign in, you’ll land on your dashboard with a clear setup path.',
  },
  signUp: {
    title: 'Create account',
    description: 'Same workspace as sign-in—profile, resume, listings you save, and application tracking. Start from the dashboard and follow the workflow bar.',
  },
  scopeHeading: 'What stays in eOS',
  scopeItems: [
    'Profile fields, resume versions, and jobs you save or track',
    'Application pipeline and history tied to your account',
    'Attachments you add for cover letters or off-platform flows (private storage)',
  ],
  privacyOneLiner:
    'Your data is scoped to your account. AI-assisted features (job fit, cover letter, recommendations) only send relevant text when you run them—not in the background.',
  signupCheckEmail: 'Check your email to confirm your account, then sign in.',
  dashboardWelcome: {
    title: 'You’re in',
    body: 'Your dashboard is home base. Use the workflow bar at the top to set up Profile and Resume, then explore jobs, tailoring, and applications.',
    dismiss: 'Got it',
  },
} as const
