import { NextRequest } from 'next/server'
import { streamText, generateText, convertToModelMessages } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import type { UIMessage } from 'ai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase/server'
import { assembleProfile } from '@/lib/profileDb'
import { buildProfileSummaryForLLM } from '@/lib/profileSummaryForLLM'

const BUCKET = 'cover-letter'
const SIGNED_URL_EXPIRY_SEC = 3600

const SYSTEM_PROMPT_COVER = `You help write professional, tailored cover letters. Use only the facts provided in the candidate profile; do not invent experience, skills, or qualifications. Address the role and company from the job listing. Output plain text only — no markdown, no JSON, no extra commentary. Keep it concise (one page when printed).`

const TITLE_SYSTEM = `You extract the company name and job title from the job listing (text and/or image). Reply with exactly one line in this format: Company Name - Job Title. Use the actual company and role from the listing. Examples: "B.F. Saul Company - Guest Service Agent", "Stripe - Senior Engineer". Maximum 60 characters. No other text or punctuation.`

/** Custom part type: client sends { type: 'data-storagePath', data: { storagePath } } for images we store. */
function isStoragePathPart(p: { type?: string; data?: unknown }): p is { type: string; data: { storagePath: string } } {
  return p.type === 'data-storagePath' && p.data != null && typeof (p.data as { storagePath?: string }).storagePath === 'string'
}

/** Replace data-storagePath parts with file parts (signed URL) so convertToModelMessages can use them. */
async function resolveStoragePathsInMessages(
  messages: UIMessage[],
  supabase: SupabaseClient
): Promise<UIMessage[]> {
  const out: UIMessage[] = []
  for (const msg of messages) {
    if (msg.role !== 'user' || !Array.isArray(msg.parts)) {
      out.push(msg)
      continue
    }
    const newParts: typeof msg.parts = []
    for (const part of msg.parts) {
      if (isStoragePathPart(part)) {
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(part.data.storagePath, SIGNED_URL_EXPIRY_SEC)
        if (data?.signedUrl) {
          newParts.push({ type: 'file', url: data.signedUrl, mediaType: 'image/png', filename: 'image' })
        }
      } else {
        newParts.push(part)
      }
    }
    out.push({ ...msg, parts: newParts })
  }
  return out
}

/** Convert last user message (SDK format) to our DB content shape for persistence. */
function userMessageToDbContent(msg: UIMessage): { parts: Array<{ type: string; text?: string; storagePath?: string }> } {
  const parts: Array<{ type: string; text?: string; storagePath?: string }> = []
  for (const p of msg.parts ?? []) {
    if (p.type === 'text' && 'text' in p && typeof (p as { text: string }).text === 'string') {
      parts.push({ type: 'text', text: (p as { text: string }).text })
    }
    if (isStoragePathPart(p)) {
      parts.push({ type: 'image', storagePath: p.data.storagePath })
    }
  }
  return { parts }
}

/** Extract plain text from assistant UI message for DB. */
function assistantMessageToDbContent(msg: UIMessage): { parts: Array<{ type: string; text: string }> } {
  const textParts = (msg.parts ?? [])
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text' && typeof (p as { text?: string }).text === 'string')
    .map((p) => (p as { text: string }).text)
  return { parts: [{ type: 'text', text: textParts.join('') }] }
}

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { user, supabase } = await createServerSupabase(req)
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  if (!process.env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured.' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  let body: { id?: string; messages?: UIMessage[] }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const chatId = typeof body.id === 'string' ? body.id : null
  const messages = Array.isArray(body.messages) ? body.messages : []
  if (!chatId || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'id and messages required.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const { data: chat, error: chatErr } = await supabase
    .from('cover_letter_chats')
    .select('id, title, job_listing_id')
    .eq('id', chatId)
    .eq('user_id', user.id)
    .single()

  if (chatErr || !chat) {
    return new Response(JSON.stringify({ error: 'Chat not found.' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
  }

  const profile = await assembleProfile(supabase, user.id)
  if (!profile) {
    return new Response(JSON.stringify({ error: 'Complete your Data first.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  const profileSummary = buildProfileSummaryForLLM(profile)

  let listingBlock = ''
  const jlId = (chat as { job_listing_id?: string | null }).job_listing_id
  if (jlId) {
    const { data: jl } = await supabase
      .from('job_listings')
      .select('title, company, url, location, remote, description, snippet')
      .eq('id', jlId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (jl) {
      const parts: string[] = []
      if (jl.title) parts.push(`Title: ${jl.title}`)
      if (jl.company) parts.push(`Company: ${jl.company}`)
      if (jl.url) parts.push(`URL: ${jl.url}`)
      if (jl.location) parts.push(`Location: ${jl.location}`)
      if (jl.remote) parts.push('Remote: Yes')
      const body = (jl.description as string | null)?.trim() || (jl.snippet as string | null)?.trim() || ''
      const max = 12_000
      if (body) {
        parts.push(
          '\nDescription:\n' + (body.length > max ? body.slice(0, max) + '\n[Truncated.]' : body)
        )
      }
      listingBlock = parts.join('\n')
    }
  }

  const resolvedMessages = await resolveStoragePathsInMessages(messages, supabase)
  const modelMessages = await convertToModelMessages(resolvedMessages)
  let systemContent = `${SYSTEM_PROMPT_COVER}\n\nCandidate profile:\n\n${profileSummary}`
  if (listingBlock) {
    systemContent += `\n\nRegistered job listing (use for role/company/requirements; user may also paste updates in the thread):\n${listingBlock}`
  }

  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: systemContent,
    messages: modelMessages,
  })

  const now = new Date().toISOString()
  const lastUserMessage = messages[messages.length - 1]
  const isFirstMessage = messages.length === 1

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: async (event) => {
      if (event.isAborted) return
      const responseMessage = event.responseMessage
      const userContent = userMessageToDbContent(lastUserMessage)
      const assistantContent = assistantMessageToDbContent(responseMessage)

      await supabase.from('cover_letter_messages').insert([
        { chat_id: chatId, role: 'user', content: userContent },
        { chat_id: chatId, role: 'assistant', content: assistantContent },
      ])
      await supabase.from('cover_letter_chats').update({ updated_at: now }).eq('id', chatId)

      if (isFirstMessage && !chat.title) {
        const lastUserResolved = resolvedMessages[resolvedMessages.length - 1]
        const titleMessages = await convertToModelMessages(lastUserResolved ? [lastUserResolved] : [])
        const { text } = await generateText({
          model: openai('gpt-4o-mini'),
          system: TITLE_SYSTEM,
          messages: titleMessages,
        })
        const suggestedTitle = text?.trim()?.slice(0, 60)
        if (suggestedTitle) {
          await supabase.from('cover_letter_chats').update({ title: suggestedTitle }).eq('id', chatId)
        }
      }
    },
  })
}
