import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { randomUUID } from 'crypto'

// GET client parts logged for this intervention
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

    const parts = await prisma.$queryRaw<Array<{
      id: string
      serialNumber: string
      itemId: string
      itemName: string
      partNumber: string
      createdAt: Date
      location: string
      pickedUpByName: string | null
      usedAt: Date | null
      usedByName: string | null
    }>>`
      SELECT sn.id, sn."serialNumber", sn."itemId", wi."itemName", wi."partNumber",
             sn."createdAt", sn.location,
             u.name AS "pickedUpByName",
             wop."createdAt" AS "usedAt",
             used_by.name AS "usedByName"
      FROM "SerialNumberStock" sn
      JOIN "WarehouseItem" wi ON wi.id = sn."itemId"
      LEFT JOIN "User" u ON u.id = sn."pickedUpById"
      LEFT JOIN "WorkOrderPart" wop ON sn.id::text = ANY(wop."serialNumberIds")
      LEFT JOIN "User" used_by ON used_by.id = wop."usedById"
      WHERE sn."interventionId" = ${interventionId}
        AND sn."isClientPart" = true
      ORDER BY sn."createdAt" ASC
    `

    return NextResponse.json(parts)
  } catch (error) {
    console.error('Error fetching client parts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST log a client part taken from the client site into the tech's stock
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
    const { warehouseItemId, serialNumber } = await request.json()

    if (!warehouseItemId) {
      return NextResponse.json({ error: 'Warehouse item is required' }, { status: 400 })
    }
    if (!serialNumber?.trim()) {
      return NextResponse.json({ error: 'Serial number is required' }, { status: 400 })
    }

    // Fetch intervention with client reference
    const intervention = await prisma.intervention.findUnique({
      where: { id: interventionId },
      select: {
        id: true,
        assignedToId: true,
        client: { select: { id: true } },
      },
    })

    if (!intervention) {
      return NextResponse.json({ error: 'Intervention not found' }, { status: 404 })
    }

    if (!intervention.assignedToId) {
      return NextResponse.json({ error: 'Intervention has no assigned technician' }, { status: 400 })
    }

    // Verify requester is the assigned tech or admin/supervisor
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true },
    })
    if (user?.role === 'TECHNICIAN' && payload.userId !== intervention.assignedToId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify warehouse item exists
    const warehouseItem = await prisma.warehouseItem.findUnique({
      where: { id: warehouseItemId },
      select: { id: true, itemName: true, partNumber: true },
    })
    if (!warehouseItem) {
      return NextResponse.json({ error: 'Warehouse item not found' }, { status: 404 })
    }

    const sn = serialNumber.trim()
    const snId = randomUUID()
    const movId = randomUUID()

    const result = await prisma.$transaction(async (tx) => {
      // Create SerialNumberStock
      await tx.$executeRaw`
        INSERT INTO "SerialNumberStock" (id, "itemId", "serialNumber", location, "technicianId", status, "isClientPart", "interventionId", "pickedUpById", "createdAt", "updatedAt")
        VALUES (${snId}, ${warehouseItemId}, ${sn}, 'TECHNICIAN', ${intervention.assignedToId}, 'AVAILABLE', true, ${interventionId}, ${payload.userId}, NOW(), NOW())
      `

      // Add to technician stock count
      await tx.technicianStock.upsert({
        where: { itemId_technicianId: { itemId: warehouseItemId, technicianId: intervention.assignedToId! } },
        create: { itemId: warehouseItemId, technicianId: intervention.assignedToId!, quantity: 1 },
        update: { quantity: { increment: 1 } },
      })

      // Record movement — TRANSFER_TO_TECH with a note flagging it as a client part
      await tx.$executeRaw`
        INSERT INTO "ItemMovement" (id, "itemId", "movementType", quantity, "toUserId", notes, "createdById", "createdAt")
        VALUES (${movId}, ${warehouseItemId}, 'TRANSFER_TO_TECH', 1, ${intervention.assignedToId}, ${'CLIENT_PART:' + interventionId}, ${payload.userId}, NOW())
      `

      const creator = await tx.user.findUnique({ where: { id: payload.userId }, select: { name: true } })
      return {
        id: snId,
        serialNumber: sn,
        itemId: warehouseItemId,
        itemName: warehouseItem.itemName,
        partNumber: warehouseItem.partNumber,
        createdAt: new Date(),
        pickedUpByName: creator?.name ?? null,
      }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error adding client part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
