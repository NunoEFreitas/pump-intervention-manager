import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const payload = verifyToken(token || '')
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userRows = await prisma.$queryRaw<{ clientId: string | null; role: string }[]>`
      SELECT "clientId", role FROM "User" WHERE id = ${payload.userId}
    `
    const user = userRows[0]
    if (!user || user.role !== 'CLIENT' || !user.clientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const clientId = user.clientId

    // CLIENT repairs linked either directly via deliveredToClientId
    // or via an intervention belonging to this client
    const repairs = await prisma.$queryRaw<any[]>`
      SELECT
        j.id,
        j.reference,
        j.status,
        j.problem,
        j."clientItemSn",
        j."sentAt",
        j."completedAt",
        j."quoteAmount",
        j."quoteNotes",
        j."quoteStatus",
        j."quotedAt",
        wi."itemName",
        wi."partNumber"
      FROM "PartRepairJob" j
      JOIN "WarehouseItem" wi ON wi.id = j."itemId"
      LEFT JOIN "Intervention" inv ON inv.id = j."interventionId"
      WHERE j.type = 'CLIENT'
        AND j.status NOT IN ('RETURNED_TO_CLIENT', 'NOT_REPAIRED', 'WRITTEN_OFF')
        AND (
          j."deliveredToClientId" = ${clientId}
          OR inv."clientId" = ${clientId}
        )
      ORDER BY j."sentAt" DESC
    `

    return NextResponse.json(repairs)
  } catch (error) {
    console.error('Error fetching portal repairs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
