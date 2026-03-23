import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!verifyToken(token || '')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // PENDING | IN_REPAIR | REPAIRED | DELIVERED_CLIENT | WRITTEN_OFF | ACTIVE

    const activeOnly = !status || status === 'ACTIVE'
    const statusFilter = activeOnly
      ? `AND j.status IN ('PENDING', 'IN_REPAIR')`
      : status === 'ALL' ? '' : `AND j.status = '${status.replace(/'/g, "''")}'`

    const jobs = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        j.id, j.reference, j."itemId", j."serialNumberId", j.quantity, j.status,
        j.problem, j."workNotes",
        j."sentAt", j."completedAt", j."deliveredToClientId",
        j."sentById", j."completedById", j."createdAt", j."updatedAt",
        wi."itemName", wi."partNumber", wi."tracksSerialNumbers",
        sn."serialNumber" AS "snNumber",
        sb.name AS "sentByName",
        cb.name AS "completedByName",
        cl.name AS "clientName",
        (SELECT COUNT(*) FROM "RepairJobPhoto" p WHERE p."jobId" = j.id)::int AS "photoCount"
      FROM "PartRepairJob" j
      JOIN "WarehouseItem" wi ON wi.id = j."itemId"
      LEFT JOIN "SerialNumberStock" sn ON sn.id = j."serialNumberId"
      LEFT JOIN "User" sb ON sb.id = j."sentById"
      LEFT JOIN "User" cb ON cb.id = j."completedById"
      LEFT JOIN "Client" cl ON cl.id = j."deliveredToClientId"
      WHERE 1=1 ${statusFilter}
      ORDER BY
        CASE j.status WHEN 'IN_REPAIR' THEN 0 WHEN 'PENDING' THEN 1 ELSE 2 END,
        j."sentAt" ASC
    `)

    return NextResponse.json(jobs)
  } catch (error) {
    console.error('Error fetching repair jobs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
