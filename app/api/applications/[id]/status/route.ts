import { NextRequest, NextResponse } from 'next/server'
import { dbHelpers } from '@/lib/database'

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const { status } = await req.json()

    if (!['applied', 'interview', 'offer', 'rejected'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 })
    }

    await dbHelpers.updateApplicationStatus(id, status)
    return NextResponse.json({ success: true, application: { id, status } })
  } catch (error: any) {
    console.error('Error updating application:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
