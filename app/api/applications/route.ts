import { NextRequest, NextResponse } from 'next/server'
import { dbHelpers } from '@/lib/database'
import { getCurrentUserId } from '@/lib/utils'

export async function GET(req: NextRequest) {
  try {
    const userId = getCurrentUserId(req)
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const filters = status ? { status } : {}
    const applications = await dbHelpers.getApplications(userId, filters)

    return NextResponse.json({ success: true, applications })
  } catch (error: any) {
    console.error('Error getting applications:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
