import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { dbHelpers } from '@/lib/database'
import { getCurrentUserId } from '@/lib/utils'

export async function GET(req: NextRequest) {
  try {
    const userId = getCurrentUserId(req)
    const preferences = await dbHelpers.getPreferences(userId)

    if (!preferences) {
      return NextResponse.json({ success: true, preferences: null })
    }

    return NextResponse.json({ success: true, preferences })
  } catch (error: any) {
    console.error('Error getting preferences:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = getCurrentUserId(req)
    const preferences = await req.json()
    const id = uuidv4()

    const saved = await dbHelpers.savePreferences(id, userId, preferences)
    return NextResponse.json({ success: true, preferences: saved })
  } catch (error: any) {
    console.error('Error saving preferences:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
