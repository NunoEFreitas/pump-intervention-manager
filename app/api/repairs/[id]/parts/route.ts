import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!verifyToken(token || '')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: jobId } = await params

    const parts = await prisma.$queryRaw<{
      id: string
      jobId: string
      itemId: string
      quantity: number
      notes: string | null
      addedById: string
      addedAt: Date
      itemName: string
      partNumber: string
      addedByName: string
    }[]>`
      SELECT
        p.id, p."jobId", p."itemId", p.quantity, p.notes,
        p."addedById", p."addedAt",
        wi."itemName", wi."partNumber",
        u.name AS "addedByName"
      FROM "RepairJobPart" p
      JOIN "WarehouseItem" wi ON wi.id = p."itemId"
      JOIN "User" u ON u.id = p."addedById"
      WHERE p."jobId" = ${jobId}
      ORDER BY p."addedAt" ASC
    `

    return NextResponse.json(parts)
  } catch (error) {
    console.error('Error fetching repair parts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const payload = verifyToken(token || '')
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: jobId } = await params
    const { itemId, quantity, notes } = await request.json()

    const parsedQty = parseInt(quantity)
    if (!itemId || !Number.isInteger(parsedQty) || parsedQty < 1) {
      return NextResponse.json({ error: 'itemId and a positive integer quantity are required' }, { status: 400 })
    }

    // Verify job exists and is active
    const jobRows = await prisma.$queryRaw<{ id: string; reference: string | null; status: string }[]>`
      SELECT id, reference, status FROM "PartRepairJob" WHERE id = ${jobId}
    `
    const job = jobRows[0]
    if (!job) return NextResponse.json({ error: 'Repair job not found' }, { status: 404 })
    if (job.status !== 'PENDING' && job.status !== 'IN_REPAIR') {
      return NextResponse.json({ error: 'Can only add parts to active repair jobs' }, { status: 400 })
    }

    // Verify item and check stock
    const itemRows = await prisma.$queryRaw<{ id: string; itemName: string; partNumber: string; mainWarehouse: number }[]>`
      SELECT id, "itemName", "partNumber", "mainWarehouse" FROM "WarehouseItem" WHERE id = ${itemId}
    `
    const item = itemRows[0]
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    if (item.mainWarehouse < parsedQty) {
      return NextResponse.json({ error: `Stock insuficiente. Disponível: ${item.mainWarehouse}` }, { status: 400 })
    }

    const now = new Date()
    const partId = crypto.randomUUID()
    const movId = crypto.randomUUID()

    // Deduct from main warehouse
    await prisma.$executeRaw`
      UPDATE "WarehouseItem"
      SET "mainWarehouse" = "mainWarehouse" - ${parsedQty}, "updatedAt" = ${now}::timestamptz
      WHERE id = ${itemId}
    `

    // Create USE movement referencing the repair job
    const movNote = job.reference
      ? `[${job.reference}] ${notes || 'Utilizado em reparação'}`
      : (notes || 'Utilizado em reparação')

    await prisma.$executeRaw`
      INSERT INTO "ItemMovement" (id, "itemId", "movementType", quantity, notes, "createdById", "createdAt")
      VALUES (${movId}, ${itemId}, 'USE', ${parsedQty}, ${movNote}, ${payload.userId}, ${now}::timestamptz)
    `

    // Create RepairJobPart record
    await prisma.$executeRaw`
      INSERT INTO "RepairJobPart" (id, "jobId", "itemId", quantity, notes, "addedById", "addedAt")
      VALUES (${partId}, ${jobId}, ${itemId}, ${parsedQty}, ${notes || null}, ${payload.userId}, ${now}::timestamptz)
    `

    return NextResponse.json({
      id: partId,
      jobId,
      itemId,
      quantity: parsedQty,
      notes: notes || null,
      addedById: payload.userId,
      addedAt: now,
      itemName: item.itemName,
      partNumber: item.partNumber,
    }, { status: 201 })
  } catch (error) {
    console.error('Error adding repair part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
