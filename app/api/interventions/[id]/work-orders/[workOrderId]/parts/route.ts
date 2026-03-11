import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; workOrderId: string }> }
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: interventionId, workOrderId } = await params
  const { itemId, quantity, serialNumberIds } = await request.json()

  if (!itemId || !quantity) {
    return NextResponse.json({ error: 'Item and quantity are required' }, { status: 400 })
  }

  const intervention = await prisma.intervention.findUnique({
    where: { id: interventionId },
    select: { assignedToId: true },
  })
  if (!intervention) return NextResponse.json({ error: 'Intervention not found' }, { status: 404 })

  const item = await prisma.warehouseItem.findUnique({ where: { id: itemId } })
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  if (item.tracksSerialNumbers) {
    if (!serialNumberIds || serialNumberIds.length !== quantity) {
      return NextResponse.json({ error: 'Serial numbers required for serialized items' }, { status: 400 })
    }
    const sns = await prisma.serialNumberStock.findMany({
      where: {
        id: { in: serialNumberIds },
        itemId,
        technicianId: intervention.assignedToId,
        location: 'TECHNICIAN',
        status: 'AVAILABLE',
      },
    })
    if (sns.length !== serialNumberIds.length) {
      return NextResponse.json({ error: 'Some serial numbers are not available' }, { status: 400 })
    }
  } else {
    const techStock = await prisma.technicianStock.findUnique({
      where: { itemId_technicianId: { itemId, technicianId: intervention.assignedToId! } },
    })
    if (!techStock || techStock.quantity < quantity) {
      return NextResponse.json({ error: 'Insufficient stock' }, { status: 400 })
    }
  }

  const part = await (prisma as any).workOrderPart.create({
    data: { workOrderId, itemId, quantity, serialNumberIds: serialNumberIds || [] },
  })

  await prisma.itemMovement.create({
    data: {
      itemId,
      movementType: 'USE',
      quantity,
      fromUserId: intervention.assignedToId,
      notes: `Used in work order ${workOrderId}`,
      createdById: payload.userId,
    },
  })

  if (item.tracksSerialNumbers) {
    await prisma.serialNumberStock.updateMany({
      where: { id: { in: serialNumberIds } },
      data: { location: 'USED', status: 'IN_USE', technicianId: null },
    })
    const remainingCount = await prisma.serialNumberStock.count({
      where: { itemId, technicianId: intervention.assignedToId, location: 'TECHNICIAN' },
    })
    await prisma.technicianStock.upsert({
      where: { itemId_technicianId: { itemId, technicianId: intervention.assignedToId! } },
      create: { itemId, technicianId: intervention.assignedToId!, quantity: remainingCount },
      update: { quantity: remainingCount },
    })
  } else {
    await prisma.technicianStock.update({
      where: { itemId_technicianId: { itemId, technicianId: intervention.assignedToId! } },
      data: { quantity: { decrement: quantity } },
    })
  }

  return NextResponse.json(part, { status: 201 })
}
