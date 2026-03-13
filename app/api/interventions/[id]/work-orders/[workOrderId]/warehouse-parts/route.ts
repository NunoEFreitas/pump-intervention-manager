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

  const { workOrderId } = await params
  const { itemId, quantity, serialNumberIds } = await request.json()

  if (!itemId || !quantity || quantity < 1) {
    return NextResponse.json({ error: 'Item and quantity are required' }, { status: 400 })
  }

  const item = await prisma.warehouseItem.findUnique({ where: { id: itemId } })
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  const workOrderRef = await prisma.$queryRaw<{ reference: string | null }[]>`
    SELECT reference FROM "WorkOrder" WHERE id::text = ${workOrderId}
  `
  const woLabel = workOrderRef[0]?.reference || workOrderId

  if (item.tracksSerialNumbers) {
    if (!serialNumberIds || serialNumberIds.length !== quantity) {
      return NextResponse.json({ error: 'Serial numbers required for serialized items' }, { status: 400 })
    }
    // Verify all SNs are available in main warehouse
    const sns = await prisma.serialNumberStock.findMany({
      where: {
        id: { in: serialNumberIds },
        itemId,
        location: 'MAIN_WAREHOUSE',
        status: 'AVAILABLE',
      },
    })
    if (sns.length !== serialNumberIds.length) {
      return NextResponse.json({ error: 'Some serial numbers are not available in the warehouse' }, { status: 400 })
    }

    const part = await (prisma as any).workOrderPart.create({
      data: { workOrderId, itemId, quantity, serialNumberIds },
    })
    await prisma.$executeRaw`UPDATE "WorkOrderPart" SET "usedById" = ${payload.userId} WHERE id = ${part.id}`

    // Mark SNs as used
    await prisma.serialNumberStock.updateMany({
      where: { id: { in: serialNumberIds } },
      data: { location: 'USED', status: 'IN_USE', technicianId: null },
    })

    // Update mainWarehouse count
    const remaining = await prisma.serialNumberStock.count({
      where: { itemId, location: 'MAIN_WAREHOUSE', status: 'AVAILABLE' },
    })
    await prisma.warehouseItem.update({
      where: { id: itemId },
      data: { mainWarehouse: remaining },
    })

    await prisma.itemMovement.create({
      data: {
        itemId,
        movementType: 'USE',
        quantity,
        notes: `Used in work order ${woLabel} (from warehouse)`,
        createdById: payload.userId,
      },
    })

    return NextResponse.json(part, { status: 201 })
  }

  // Non-serialized
  if (item.mainWarehouse < quantity) {
    return NextResponse.json({ error: 'Insufficient warehouse stock' }, { status: 400 })
  }

  const part = await (prisma as any).workOrderPart.create({
    data: { workOrderId, itemId, quantity, serialNumberIds: [] },
  })
  await prisma.$executeRaw`UPDATE "WorkOrderPart" SET "usedById" = ${payload.userId} WHERE id = ${part.id}`

  await prisma.warehouseItem.update({
    where: { id: itemId },
    data: { mainWarehouse: { decrement: quantity } },
  })

  await prisma.itemMovement.create({
    data: {
      itemId,
      movementType: 'USE',
      quantity,
      notes: `Used in work order ${woLabel} (from warehouse)`,
      createdById: payload.userId,
    },
  })

  return NextResponse.json(part, { status: 201 })
}
