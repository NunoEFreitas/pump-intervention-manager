import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: interventionId } = await params

    const rows = await prisma.$queryRaw<Array<{
      id: string
      interventionId: string
      warehouseItemId: string
      itemName: string
      partNumber: string
      quantity: number
      notes: string | null
      status: string
      requesterName: string
      createdAt: Date
    }>>`
      SELECT
        pr.id,
        pr."interventionId",
        pr."warehouseItemId",
        wi."itemName",
        wi."partNumber",
        pr.quantity,
        pr.notes,
        pr.status,
        u.name AS "requesterName",
        pr."createdAt"
      FROM "PartRequest" pr
      JOIN "WarehouseItem" wi ON wi.id = pr."warehouseItemId"
      JOIN "User" u ON u.id = pr."requestedById"
      WHERE pr."interventionId" = ${interventionId}
      ORDER BY pr."createdAt" DESC
    `

    return NextResponse.json(rows)
  } catch (error) {
    console.error('Error fetching part requests:', error)
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
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: interventionId } = await params
    const data = await request.json()

    if (!data.warehouseItemId) {
      return NextResponse.json({ error: 'warehouseItemId is required' }, { status: 400 })
    }

    // Use the intervention's assigned technician, not the logged-in user
    const [intervention] = await prisma.$queryRaw<[{ assignedToId: string | null }]>`
      SELECT "assignedToId" FROM "Intervention" WHERE id = ${interventionId}
    `
    const requestedById = intervention?.assignedToId ?? payload.userId

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await prisma.$executeRaw`
      INSERT INTO "PartRequest" (id, "interventionId", "requestedById", "warehouseItemId", quantity, notes, status, "createdAt", "updatedAt")
      VALUES (
        ${id},
        ${interventionId},
        ${requestedById},
        ${data.warehouseItemId},
        ${data.quantity ?? 1},
        ${data.notes?.trim() || null},
        'PENDING',
        ${now}::timestamptz,
        ${now}::timestamptz
      )
    `

    // Set intervention status to PENDING_PARTS (unless already completed/cancelled)
    await prisma.$executeRaw`
      UPDATE "Intervention"
      SET status = 'PENDING_PARTS', "updatedAt" = ${now}::timestamptz
      WHERE id = ${interventionId}
        AND status NOT IN ('COMPLETED', 'CANCELED')
    `

    const [row] = await prisma.$queryRaw<Array<{
      id: string; interventionId: string; warehouseItemId: string
      itemName: string; partNumber: string; quantity: number
      notes: string | null; status: string; requesterName: string; createdAt: Date
    }>>`
      SELECT
        pr.id, pr."interventionId", pr."warehouseItemId",
        wi."itemName", wi."partNumber",
        pr.quantity, pr.notes, pr.status,
        u.name AS "requesterName", pr."createdAt"
      FROM "PartRequest" pr
      JOIN "WarehouseItem" wi ON wi.id = pr."warehouseItemId"
      JOIN "User" u ON u.id = pr."requestedById"
      WHERE pr.id = ${id}
    `

    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    console.error('Error creating part request:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
