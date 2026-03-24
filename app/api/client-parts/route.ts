import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// GET — list all client parts in our possession pending a decision
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!verifyToken(token || '')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status') // PENDING | SWAP | REPAIR | RESOLVED | ALL
    const showAll = statusFilter === 'ALL'
    const resolvedOnly = statusFilter === 'RESOLVED'

    const parts = await prisma.$queryRaw<any[]>`
      SELECT
        sn.id,
        sn."itemId",
        sn."serialNumber",
        sn.location,
        sn.status,
        sn."clientPartStatus",
        sn."clientRepairJobId",
        sn."interventionId",
        sn."pickedUpById",
        sn."technicianId",
        sn."createdAt",
        wi."itemName",
        wi."partNumber",
        wi."tracksSerialNumbers",
        wi."mainWarehouse",
        wi."snExample",
        pu.name AS "pickedUpByName",
        tech.name AS "technicianName",
        i.reference AS "interventionReference",
        cl.name AS "clientName",
        rj.reference AS "repairReference",
        rj.status AS "repairStatus"
      FROM "SerialNumberStock" sn
      JOIN "WarehouseItem" wi ON wi.id = sn."itemId"
      LEFT JOIN "User" pu ON pu.id = sn."pickedUpById"
      LEFT JOIN "User" tech ON tech.id = sn."technicianId"
      LEFT JOIN "Intervention" i ON i.id = sn."interventionId"
      LEFT JOIN "Client" cl ON cl.id = i."clientId"
      LEFT JOIN "PartRepairJob" rj ON rj.id = sn."clientRepairJobId"
      WHERE sn."isClientPart" = true
        AND (
          ${showAll}::boolean = true
          OR (${resolvedOnly}::boolean = true AND sn."clientPartStatus" = 'RESOLVED')
          OR (${showAll}::boolean = false AND ${resolvedOnly}::boolean = false
              AND (sn."clientPartStatus" IS NULL OR sn."clientPartStatus" IN ('PENDING', 'SWAP', 'REPAIR')))
        )
      ORDER BY sn."createdAt" DESC
    `

    return NextResponse.json(parts)
  } catch (error) {
    console.error('Error fetching client parts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
