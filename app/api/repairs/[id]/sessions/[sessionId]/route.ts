import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// DELETE — remove a session from a repair job
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: jobId, sessionId } = await params
  const now = new Date()

  await prisma.$executeRaw`DELETE FROM "RepairSession" WHERE id = ${sessionId} AND "jobId" = ${jobId}`

  // Recalculate totalHours
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

  return NextResponse.json({ ok: true })
}
