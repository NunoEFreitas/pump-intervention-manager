import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// POST — add a session to a work order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; workOrderId: string }> }
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workOrderId } = await params
  const { startDate, startTime, endDate, endTime, duration } = await request.json()

  const now = new Date()
  const sessionId = crypto.randomUUID()

  const dur: number | null = duration !== undefined && duration !== null && duration !== ''
    ? parseFloat(duration)
    : null

  await prisma.$executeRaw`
    INSERT INTO "WorkOrderSession" (id, "workOrderId", "startDate", "startTime", "endDate", "endTime", duration, "createdAt", "updatedAt")
    VALUES (${sessionId}, ${workOrderId}, ${startDate || null}, ${startTime || null}, ${endDate || null}, ${endTime || null}, ${dur}, ${now}::timestamptz, ${now}::timestamptz)
  `

  // Recalculate and update timeSpent on WorkOrder
  await prisma.$executeRaw`
    UPDATE "WorkOrder"
    SET "timeSpent" = (
      SELECT COALESCE(SUM(duration), 0) FROM "WorkOrderSession" WHERE "workOrderId" = ${workOrderId} AND duration IS NOT NULL
    ),
    "updatedAt" = ${now}::timestamptz
    WHERE id = ${workOrderId}
  `

  const [session] = await prisma.$queryRaw<any[]>`
    SELECT id, "startDate", "startTime", "endDate", "endTime", duration, "createdAt"
    FROM "WorkOrderSession" WHERE id = ${sessionId}
  `

  return NextResponse.json(session, { status: 201 })
}
