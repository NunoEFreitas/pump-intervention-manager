import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// GET — all parts currently with technicians (own stock + in-transit client parts)
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!verifyToken(token || '')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        sn.id,
        sn."itemId",
        wi."itemName",
        wi."partNumber",
        sn."serialNumber",
        sn."faultDescription",
        sn.location,
        sn."isClientPart",
        sn."preSwapped",
        sn."clientPartStatus",
        sn."technicianId",
        tech.name AS "technicianName",
        sn."interventionId",
        inv.reference AS "interventionReference",
        cl.name AS "clientName"
      FROM "SerialNumberStock" sn
      JOIN "WarehouseItem" wi ON wi.id = sn."itemId"
      LEFT JOIN "User" tech ON tech.id = sn."technicianId"
      LEFT JOIN "Intervention" inv ON inv.id = sn."interventionId"
      LEFT JOIN "Client" cl ON cl.id = inv."clientId"
      WHERE (
        -- Own technician stock
        (sn.location = 'TECHNICIAN' AND sn."isClientPart" = false)
        OR
        -- Client parts in transit (collected, not yet at warehouse)
        (sn."isClientPart" = true AND sn."clientPartStatus" = 'IN_TRANSIT')
      )
      ORDER BY tech.name ASC, wi."itemName" ASC
    `

    // Also fetch bulk (non-SN) technician stock
    const bulkRows = await prisma.$queryRaw<any[]>`
      SELECT
        ts."technicianId",
        tech.name AS "technicianName",
        ts."itemId",
        wi."itemName",
        wi."partNumber",
        ts.quantity
      FROM "TechnicianStock" ts
      JOIN "WarehouseItem" wi ON wi.id = ts."itemId"
      JOIN "User" tech ON tech.id = ts."technicianId"
      WHERE ts.quantity > 0
        AND wi."tracksSerialNumbers" = false
      ORDER BY tech.name ASC, wi."itemName" ASC
    `

    // Repaired/swapped parts assigned to a tech for client delivery
    const returningRows = await prisma.$queryRaw<any[]>`
      SELECT
        sn.id,
        sn."itemId",
        wi."itemName",
        wi."partNumber",
        sn."serialNumber",
        sn."clientItemSn",
        sn."faultDescription",
        sn."clientPartStatus",
        sn."sentOutTechnicianId" AS "technicianId",
        tech.name AS "technicianName",
        sn."interventionId",
        inv.reference AS "interventionReference",
        cl.name AS "clientName"
      FROM "SerialNumberStock" sn
      JOIN "WarehouseItem" wi ON wi.id = sn."itemId"
      LEFT JOIN "User" tech ON tech.id = sn."sentOutTechnicianId"
      LEFT JOIN "Intervention" inv ON inv.id = sn."interventionId"
      LEFT JOIN "Client" cl ON cl.id = inv."clientId"
      WHERE sn."clientPartStatus" = 'RETURNING'
        AND sn."sentOutTechnicianId" IS NOT NULL
      ORDER BY tech.name ASC, wi."itemName" ASC
    `

    return NextResponse.json({ serialized: rows, bulk: bulkRows, returning: returningRows })
  } catch (error) {
    console.error('Error fetching technician stock overview:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
