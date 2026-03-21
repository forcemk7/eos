import OpenAI from 'openai'

const EXTRACT_SYSTEM = `You extract structured job posting data from one or more images (screenshots of job descriptions).

Output only valid JSON, no markdown. Use exactly this shape:
{
  "title": string,
  "company": string,
  "description": string,
  "url": string | null,
  "location": string | null,
  "remote": boolean
}

Rules:
- title: job title as shown; if unclear use a short descriptive title.
- company: employer name; if unclear use "Unknown company".
- description: full posting text you can read (requirements, responsibilities, benefits). Concatenate multiple images in reading order. Plain text only, no markdown.
- url: only if visibly printed in the image; else null.
- location: city/region if stated; else null.
- remote: true if the posting clearly states remote/hybrid/WFH friendly; false if unclear or on-site only.`

export interface ExtractedJobListing {
  title: string
  company: string
  description: string
  url: string | null
  location: string | null
  remote: boolean
}

function safeParseExtracted(raw: string | null | undefined): ExtractedJobListing {
  if (!raw?.trim()) throw new Error('Empty extraction response.')
  const parsed = JSON.parse(raw) as Record<string, unknown>
  const title = typeof parsed.title === 'string' ? parsed.title.trim() : ''
  const company = typeof parsed.company === 'string' ? parsed.company.trim() : ''
  const description = typeof parsed.description === 'string' ? parsed.description.trim() : ''
  if (!title && !company && !description) {
    throw new Error('Could not read job title, company, or description from image(s).')
  }
  return {
    title: title || 'Untitled role',
    company: company || 'Unknown company',
    description: description || '(No description extracted.)',
    url: typeof parsed.url === 'string' && parsed.url.trim() ? parsed.url.trim() : null,
    location: typeof parsed.location === 'string' && parsed.location.trim() ? parsed.location.trim() : null,
    remote: Boolean(parsed.remote),
  }
}

/** Vision extract from signed HTTPS image URLs (e.g. Supabase signed URLs). */
export async function extractJobListingFromImageUrls(
  openai: OpenAI,
  imageUrls: string[]
): Promise<ExtractedJobListing> {
  if (imageUrls.length === 0) throw new Error('At least one image URL is required.')

  const content: OpenAI.Chat.ChatCompletionContentPart[] = [
    {
      type: 'text',
      text: 'Extract the job posting from these images into the required JSON object.',
    },
    ...imageUrls.map(
      (url): OpenAI.Chat.ChatCompletionContentPart => ({
        type: 'image_url',
        image_url: { url, detail: 'high' },
      })
    ),
  ]

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: EXTRACT_SYSTEM },
      { role: 'user', content },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 8192,
  })

  const raw = response.choices[0]?.message?.content?.trim()
  return safeParseExtracted(raw)
}
