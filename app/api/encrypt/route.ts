import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, jsonWithCookies } from '@/lib/supabase/server'
import crypto from 'crypto'

const CREDENTIAL_KEY = process.env.CREDENTIAL_KEY

export async function POST(req: NextRequest) {
  const { user, response } = await createServerSupabase(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!CREDENTIAL_KEY) {
    return NextResponse.json(
      { success: false, error: 'CREDENTIAL_KEY not configured on server.' },
      { status: 500 }
    )
  }

  try {
    const { plaintext } = await req.json()
    if (!plaintext) {
      return NextResponse.json({ success: false, error: 'plaintext is required' }, { status: 400 })
    }

    // Fernet-compatible encryption using Node.js crypto
    // Fernet uses AES-128-CBC with HMAC-SHA256
    const keyBytes = Buffer.from(CREDENTIAL_KEY, 'base64url')
    const signingKey = keyBytes.subarray(0, 16)
    const encryptionKey = keyBytes.subarray(16, 32)

    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-128-cbc', encryptionKey, iv)
    let encrypted = cipher.update(plaintext, 'utf8')
    encrypted = Buffer.concat([encrypted, cipher.final()])

    const version = Buffer.from([0x80])
    const timestamp = Buffer.alloc(8)
    timestamp.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000)))

    const payload = Buffer.concat([version, timestamp, iv, encrypted])
    const hmac = crypto.createHmac('sha256', signingKey).update(payload).digest()
    const token = Buffer.concat([payload, hmac]).toString('base64url')

    return jsonWithCookies({ success: true, encrypted: token }, response)
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
