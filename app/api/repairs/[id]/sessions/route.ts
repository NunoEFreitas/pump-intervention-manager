import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// POST — add a session to a repair job
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: jobId } = await params
  const { startDate, startTime, endDate, endTime, duration } = await request.json()

  const now = new Date()
  const sessionId = crypto.randomUUID()

  const dur: number | null = duration !== undefined && duration !== null && duration !== ''
    ? parseFloat(duration)
    : null

  await prisma.$executeRaw`
    INSERT INTO "RepairSession" (id, "jobId", "startDate", "startTime", "endDate", "endTime", duration, "createdAt", "updatedAt")
    VALUES (${sessionId}, ${jobId}, ${startDate || null}, ${startTime || null}, ${endDate || null}, ${endTime || null}, ${dur}, ${now}::timestamptz, ${now}::timestamptz)
  `

  // Recalculate and update totalHours on PartRepairJob
  await prisma.$executeRaw`
    UPDATE "PartRepairJob"
    SET "totalHours" = (
      SELECT NULLIF(COALESCE(SUM(duration), 0), 0)
      FROM "RepairSession"
      WHERE "jobId" = ${jobId} AND duration IS NOT NULL
    ),
    "updatedAt" = ${now}::timestamptz
    WHERE id = ${jobId}
  `

  const [session] = await prisma.$queryRaw<any[]>`
    SELECT id, "startDate", "startTime", "endDate", "endTime", duration, "createdAt"
    FROM "RepairSession" WHERE id = ${sessionId}
  `

  return NextResponse.json(session, { status: 201 })
}
