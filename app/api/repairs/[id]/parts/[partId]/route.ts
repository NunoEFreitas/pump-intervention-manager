import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; partId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const payload = verifyToken(token || '')
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: jobId, partId } = await params

    // Fetch the part record
    const partRows = await prisma.$queryRaw<{ id: string; jobId: string; itemId: string; quantity: number; itemName: string }[]>`
      SELECT p.id, p."jobId", p."itemId", p.quantity, wi."itemName"
      FROM "RepairJobPart" p
      JOIN "WarehouseItem" wi ON wi.id = p."itemId"
      WHERE p.id = ${partId} AND p."jobId" = ${jobId}
    `
    const part = partRows[0]
    if (!part) return NextResponse.json({ error: 'Part not found' }, { status: 404 })

    // Verify job is still active
    const jobRows = await prisma.$queryRaw<{ reference: string | null; status: string }[]>`
      SELECT reference, status FROM "PartRepairJob" WHERE id = ${jobId}
    `
    const job = jobRows[0]
    if (!job) return NextResponse.json({ error: 'Repair job not found' }, { status: 404 })
    if (job.status !== 'PENDING' && job.status !== 'IN_REPAIR') {
      return NextResponse.json({ error: 'Cannot remove parts from a completed repair job' }, { status: 400 })
    }

    const now = new Date()

    // Return quantity to main warehouse
    await prisma.$executeRaw`
      UPDATE "WarehouseItem"
      SET "mainWarehouse" = "mainWarehouse" + ${part.quantity}, "updatedAt" = ${now}::timestamptz
      WHERE id = ${part.itemId}
    `

    // Create ADD_STOCK movement
    const movNote = job.reference
      ? `[${job.reference}] Peça devolvida ao stock (remoção de reparação)`
      : 'Peça devolvida ao stock (remoção de reparação)'

    await prisma.$executeRaw`
      INSERT INTO "ItemMovement" (id, "itemId", "movementType", quantity, notes, "createdById", "createdAt")
      VALUES (${crypto.randomUUID()}, ${part.itemId}, 'ADD_STOCK', ${part.quantity}, ${movNote}, ${payload.userId}, ${now}::timestamptz)
    `

    // Delete the part record
    await prisma.$executeRaw`DELETE FROM "RepairJobPart" WHERE id = ${partId}`

    await prisma.$executeRaw`
      INSERT INTO "RepairHistory" (id, "jobId", "eventType", description, "performedById", "performedAt")
      VALUES (${crypto.randomUUID()}, ${jobId}, 'PART_REMOVED', ${`Peça removida: ${part.itemName} ×${part.quantity}`}, ${payload.userId}, ${now}::timestamptz)
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing repair part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
