import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessions = await prisma.$queryRaw<any[]>`
    SELECT
      s.id, s.type, s."technicianId", s.status, s.notes,
      s."createdById", s."closedById", s."createdAt", s."closedAt",
      u.name AS "createdByName",
      t.name AS "technicianName",
      COUNT(e.id)::int AS "totalItems",
      COUNT(e.id) FILTER (WHERE e."countedQty" IS NOT NULL)::int AS "countedItems",
      COUNT(e.id) FILTER (WHERE e."countedQty" IS NOT NULL AND e."countedQty" != e."expectedQty")::int AS "discrepancies"
    FROM "InventorySession" s
    LEFT JOIN "User" u ON u.id = s."createdById"
    LEFT JOIN "User" t ON t.id = s."technicianId"
    LEFT JOIN "InventoryEntry" e ON e."sessionId" = s.id
    GROUP BY s.id, u.name, t.name
    ORDER BY s."createdAt" DESC
  `

  return NextResponse.json(sessions)
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { type, technicianId, notes } = body

  if (type !== 'WAREHOUSE' && type !== 'TECHNICIAN') {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }
  if (type === 'TECHNICIAN' && !technicianId) {
    return NextResponse.json({ error: 'technicianId required for TECHNICIAN type' }, { status: 400 })
  }

  const sessionId = crypto.randomUUID()
  const now = new Date()

  await prisma.$executeRaw`
    INSERT INTO "InventorySession" (id, type, "technicianId", status, notes, "createdById", "createdAt")
    VALUES (${sessionId}, ${type}, ${technicianId || null}, 'OPEN', ${notes || null}, ${payload.userId}, ${now}::timestamptz)
  `

  // Snapshot current stock into entries
  if (type === 'WAREHOUSE') {
    // Non-serialized: mainWarehouse qty
    // Serialized: count of AVAILABLE SNs in MAIN_WAREHOUSE
    const items = await prisma.$queryRaw<Array<{
      id: string; tracksSerialNumbers: boolean; mainWarehouse: number; snCount: number
    }>>`
      SELECT wi.id, wi."tracksSerialNumbers", wi."mainWarehouse",
             COUNT(sn.id) FILTER (WHERE sn.location = 'MAIN_WAREHOUSE' AND sn.status = 'AVAILABLE')::int AS "snCount"
      FROM "WarehouseItem" wi
      LEFT JOIN "SerialNumberStock" sn ON sn."itemId" = wi.id
      GROUP BY wi.id
    `
    for (const item of items) {
      const expectedQty = item.tracksSerialNumbers ? item.snCount : item.mainWarehouse
      if (expectedQty > 0 || !item.tracksSerialNumbers) {
        await prisma.$executeRaw`
          INSERT INTO "InventoryEntry" (id, "sessionId", "itemId", "expectedQty")
          VALUES (${crypto.randomUUID()}, ${sessionId}, ${item.id}, ${expectedQty > 0 ? expectedQty : 0})
          ON CONFLICT DO NOTHING
        `
      }
    }
  } else {
    // TECHNICIAN
    const items = await prisma.$queryRaw<Array<{
      itemId: string; tracksSerialNumbers: boolean; techQty: number; snCount: number
    }>>`
      SELECT ts."itemId", wi."tracksSerialNumbers", ts.quantity AS "techQty",
             COUNT(sn.id) FILTER (WHERE sn.location = 'TECHNICIAN' AND sn."technicianId" = ${technicianId} AND sn.status = 'AVAILABLE')::int AS "snCount"
      FROM "TechnicianStock" ts
      JOIN "WarehouseItem" wi ON wi.id = ts."itemId"
      LEFT JOIN "SerialNumberStock" sn ON sn."itemId" = ts."itemId"
      WHERE ts."technicianId" = ${technicianId}
      GROUP BY ts."itemId", wi."tracksSerialNumbers", ts.quantity
    `
    for (const item of items) {
      const expectedQty = item.tracksSerialNumbers ? item.snCount : item.techQty
      await prisma.$executeRaw`
        INSERT INTO "InventoryEntry" (id, "sessionId", "itemId", "expectedQty")
        VALUES (${crypto.randomUUID()}, ${sessionId}, ${item.itemId}, ${expectedQty})
        ON CONFLICT DO NOTHING
      `
    }
  }

  return NextResponse.json({ id: sessionId })
}
