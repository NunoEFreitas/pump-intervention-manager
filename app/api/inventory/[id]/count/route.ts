import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  const { itemId, countedQty, serialNumberIds } = await request.json()

  const [session] = await prisma.$queryRaw<any[]>`
    SELECT id, status FROM "InventorySession" WHERE id = ${sessionId}
  `
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  if (session.status !== 'OPEN') return NextResponse.json({ error: 'Session is not open' }, { status: 400 })

  const [entry] = await prisma.$queryRaw<any[]>`
    SELECT id, "itemId" FROM "InventoryEntry" WHERE "sessionId" = ${sessionId} AND "itemId" = ${itemId}
  `
  if (!entry) return NextResponse.json({ error: 'Item not in session' }, { status: 404 })

  await prisma.$executeRaw`
    UPDATE "InventoryEntry"
    SET "countedQty" = ${countedQty}, "correctionApproved" = NULL
    WHERE id = ${entry.id}
  `

  // For serialized items, replace found SNs
  if (Array.isArray(serialNumberIds)) {
    await prisma.$executeRaw`DELETE FROM "InventoryEntrySerial" WHERE "entryId" = ${entry.id}`
    for (const snId of serialNumberIds) {
      await prisma.$executeRaw`
        INSERT INTO "InventoryEntrySerial" (id, "entryId", "serialNumberId")
        VALUES (${crypto.randomUUID()}, ${entry.id}, ${snId})
        ON CONFLICT DO NOTHING
      `
    }
  }

  return NextResponse.json({ ok: true })
}
