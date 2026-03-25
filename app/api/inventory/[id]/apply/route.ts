import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  const { approvals } = await request.json() as { approvals: { itemId: string; approved: boolean }[] }

  const [session] = await prisma.$queryRaw<any[]>`
    SELECT id, type, "technicianId", status FROM "InventorySession" WHERE id = ${sessionId}
  `
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.status !== 'PENDING_APPROVAL') {
    return NextResponse.json({ error: 'Session is not pending approval' }, { status: 400 })
  }

  const now = new Date()

  // Apply each approval decision
  for (const { itemId, approved } of approvals) {
    const [entry] = await prisma.$queryRaw<any[]>`
      SELECT e.id, e."expectedQty", e."countedQty", wi."tracksSerialNumbers"
      FROM "InventoryEntry" e
      JOIN "WarehouseItem" wi ON wi.id = e."itemId"
      WHERE e."sessionId" = ${sessionId} AND e."itemId" = ${itemId}
    `
    if (!entry) continue

    await prisma.$executeRaw`
      UPDATE "InventoryEntry" SET "correctionApproved" = ${approved} WHERE id = ${entry.id}
    `

    if (!approved || entry.countedQty === null || entry.countedQty === entry.expectedQty) continue

    const diff = entry.countedQty - entry.expectedQty
    const absDiff = Math.abs(diff)
    const movementId = crypto.randomUUID()

    // Apply correction to stock
    if (session.type === 'WAREHOUSE') {
      if (!entry.tracksSerialNumbers) {
        await prisma.$executeRaw`
          UPDATE "WarehouseItem"
          SET "mainWarehouse" = GREATEST(0, "mainWarehouse" + ${diff}), "updatedAt" = ${now}::timestamptz
          WHERE id = ${itemId}
        `
      }
      // For serialized items in warehouse, stock correction is informational only
      // (individual SN reconciliation requires manual action)
    } else {
      // TECHNICIAN
      if (!entry.tracksSerialNumbers) {
        await prisma.$executeRaw`
          UPDATE "TechnicianStock"
          SET quantity = GREATEST(0, quantity + ${diff}), "updatedAt" = ${now}::timestamptz
          WHERE "itemId" = ${itemId} AND "technicianId" = ${session.technicianId}
        `
      }
    }

    // Record movement
    await prisma.$executeRaw`
      INSERT INTO "ItemMovement" (id, "itemId", "movementType", quantity, notes, "createdById", "createdAt")
      VALUES (
        ${movementId}, ${itemId}, 'INVENTORY_ADJUSTMENT', ${absDiff},
        ${`Ajuste de inventário (sessão ${sessionId}): ${diff > 0 ? '+' : ''}${diff}`},
        ${payload.userId}, ${now}::timestamptz
      )
    `
  }

  // Close session
  await prisma.$executeRaw`
    UPDATE "InventorySession"
    SET status = 'CLOSED', "closedAt" = ${now}::timestamptz, "closedById" = ${payload.userId}
    WHERE id = ${sessionId}
  `

  return NextResponse.json({ ok: true })
}
