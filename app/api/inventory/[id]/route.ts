import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [session] = await prisma.$queryRaw<any[]>`
    SELECT s.*, u.name AS "createdByName", t.name AS "technicianName"
    FROM "InventorySession" s
    LEFT JOIN "User" u ON u.id = s."createdById"
    LEFT JOIN "User" t ON t.id = s."technicianId"
    WHERE s.id = ${id}
  `
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const entries = await prisma.$queryRaw<any[]>`
    SELECT
      e.id, e."itemId", e."expectedQty", e."countedQty", e."correctionApproved", e.notes,
      wi."itemName", wi."partNumber", wi.value, wi."tracksSerialNumbers", wi."ean13"
    FROM "InventoryEntry" e
    JOIN "WarehouseItem" wi ON wi.id = e."itemId"
    WHERE e."sessionId" = ${id}
    ORDER BY wi."itemName" ASC
  `

  // For serialized items, fetch the SNs marked as found in this session
  const serials = await prisma.$queryRaw<Array<{ entryId: string; serialNumberId: string; serialNumber: string }>>`
    SELECT ies."entryId", ies."serialNumberId", sn."serialNumber"
    FROM "InventoryEntrySerial" ies
    JOIN "SerialNumberStock" sn ON sn.id = ies."serialNumberId"
    WHERE ies."entryId" IN (
      SELECT id FROM "InventoryEntry" WHERE "sessionId" = ${id}
    )
  `

  // For serialized items in WAREHOUSE sessions, also fetch expected SNs
  const expectedSns = session.type === 'WAREHOUSE'
    ? await prisma.$queryRaw<Array<{ itemId: string; id: string; serialNumber: string }>>`
        SELECT sn."itemId", sn.id, sn."serialNumber"
        FROM "SerialNumberStock" sn
        WHERE sn."itemId" IN (
          SELECT "itemId" FROM "InventoryEntry" WHERE "sessionId" = ${id}
        )
        AND sn.location = 'MAIN_WAREHOUSE' AND sn.status = 'AVAILABLE'
        ORDER BY sn."serialNumber" ASC
      `
    : await prisma.$queryRaw<Array<{ itemId: string; id: string; serialNumber: string }>>`
        SELECT sn."itemId", sn.id, sn."serialNumber"
        FROM "SerialNumberStock" sn
        WHERE sn."itemId" IN (
          SELECT "itemId" FROM "InventoryEntry" WHERE "sessionId" = ${id}
        )
        AND sn.location = 'TECHNICIAN' AND sn."technicianId" = ${session.technicianId}
        AND sn.status = 'AVAILABLE'
        ORDER BY sn."serialNumber" ASC
      `

  const snsByEntry = new Map<string, string[]>()
  for (const s of serials) {
    const list = snsByEntry.get(s.entryId) || []
    list.push(s.serialNumber)
    snsByEntry.set(s.entryId, list)
  }

  const snsByItem = new Map<string, Array<{ id: string; serialNumber: string }>>()
  for (const s of expectedSns) {
    const list = snsByItem.get(s.itemId) || []
    list.push({ id: s.id, serialNumber: s.serialNumber })
    snsByItem.set(s.itemId, list)
  }

  const enrichedEntries = entries.map((e: any) => ({
    ...e,
    foundSerialNumbers: snsByEntry.get(e.id) || [],
    expectedSerialNumbers: e.tracksSerialNumbers ? (snsByItem.get(e.itemId) || []) : [],
  }))

  return NextResponse.json({ ...session, entries: enrichedEntries })
}
