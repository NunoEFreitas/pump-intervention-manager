import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

type Params = { params: Promise<{ id: string; workOrderId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!verifyToken(token || '')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workOrderId } = await params

    const rows = await prisma.$queryRaw<Array<{
      repairJobId: string
      repairReference: string | null
      repairStatus: string
      clientItemName: string
      clientPartNumber: string
      partId: string
      itemId: string
      itemName: string
      partNumber: string
      quantity: number
      notes: string | null
      addedAt: string
    }>>`
      SELECT
        rj.id           AS "repairJobId",
        rj.reference    AS "repairReference",
        rj.status       AS "repairStatus",
        wi_c."itemName" AS "clientItemName",
        wi_c."partNumber" AS "clientPartNumber",
        rjp.id          AS "partId",
        rjp."itemId",
        wi."itemName",
        wi."partNumber",
        rjp.quantity,
        rjp.notes,
        rjp."addedAt"
      FROM "SerialNumberStock" sn
      JOIN "PartRepairJob"  rj  ON rj.id  = sn."clientRepairJobId"
      JOIN "RepairJobPart"  rjp ON rjp."jobId" = rj.id
      JOIN "WarehouseItem"  wi  ON wi.id   = rjp."itemId"
      JOIN "WarehouseItem"  wi_c ON wi_c.id = sn."itemId"
      WHERE sn."workOrderId" = ${workOrderId}
        AND sn."isClientPart" = true
        AND sn."clientRepairJobId" IS NOT NULL
      ORDER BY rj."createdAt" ASC, rjp."addedAt" ASC
    `

    // Group by repair job
    const jobMap = new Map<string, {
      repairJobId: string
      repairReference: string | null
      repairStatus: string
      clientItemName: string
      clientPartNumber: string
      parts: { id: string; itemId: string; itemName: string; partNumber: string; quantity: number; notes: string | null; addedAt: string }[]
    }>()

    for (const row of rows) {
      if (!jobMap.has(row.repairJobId)) {
        jobMap.set(row.repairJobId, {
          repairJobId: row.repairJobId,
          repairReference: row.repairReference,
          repairStatus: row.repairStatus,
          clientItemName: row.clientItemName,
          clientPartNumber: row.clientPartNumber,
          parts: [],
        })
      }
      jobMap.get(row.repairJobId)!.parts.push({
        id: row.partId,
        itemId: row.itemId,
        itemName: row.itemName,
        partNumber: row.partNumber,
        quantity: Number(row.quantity),
        notes: row.notes,
        addedAt: row.addedAt,
      })
    }

    return NextResponse.json(Array.from(jobMap.values()))
  } catch (error) {
    console.error('Error fetching WO repair parts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
