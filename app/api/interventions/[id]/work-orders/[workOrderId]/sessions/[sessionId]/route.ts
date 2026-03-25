import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// DELETE — remove a session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; workOrderId: string; sessionId: string }> }
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workOrderId, sessionId } = await params
  const now = new Date()

  await prisma.$executeRaw`DELETE FROM "WorkOrderSession" WHERE id = ${sessionId} AND "workOrderId" = ${workOrderId}`

  // Recalculate timeSpent
  await prisma.$executeRaw`
    UPDATE "WorkOrder"
    SET "timeSpent" = (
      SELECT NULLIF(COALESCE(SUM(duration), 0), 0) FROM "WorkOrderSession" WHERE "workOrderId" = ${workOrderId} AND duration IS NOT NULL
    ),
    "updatedAt" = ${now}::timestamptz
    WHERE id = ${workOrderId}
  `

  return NextResponse.json({ ok: true })
}
