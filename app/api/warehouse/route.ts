import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// GET all warehouse items
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const items = await prisma.warehouseItem.findMany({
      include: {
        technicianStocks: {
          include: {
            technician: { select: { id: true, name: true, email: true } },
          },
        },
        _count: { select: { movements: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const extraFields = await prisma.$queryRaw<Array<{
      id: string
      autoSn: boolean
      snExample: string | null
      equipmentTypeId: string | null
      brandId: string | null
    }>>`
      SELECT id, "autoSn", "snExample", "equipmentTypeId", "brandId" FROM "WarehouseItem"
    `
    const extraMap = new Map(extraFields.map(f => [f.id, f]))

    const itemsWithTotals = items.map(item => ({
      ...item,
      ...extraMap.get(item.id),
      totalTechnicianStock: item.technicianStocks.reduce((sum, ts) => sum + ts.quantity, 0),
      totalStock: item.mainWarehouse + item.technicianStocks.reduce((sum, ts) => sum + ts.quantity, 0),
    }))

    return NextResponse.json(itemsWithTotals)
  } catch (error) {
    console.error('Error fetching warehouse items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST create new warehouse item
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    const payload = verifyToken(token || '')
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true },
    })

    if (user?.role === 'TECHNICIAN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data = await request.json()

    if (!data.partNumber || data.value === undefined) {
      return NextResponse.json(
        { error: 'Part number and value are required' },
        { status: 400 }
      )
    }

    const equipmentTypeId: string | null = data.equipmentTypeId || null
    const brandId: string | null = data.brandId || null

    let typeName = ''
    let brandName = ''
    if (equipmentTypeId) {
      const t = await prisma.equipmentType.findUnique({ where: { id: equipmentTypeId }, select: { name: true } })
      typeName = t?.name || ''
    }
    if (brandId) {
      const b = await prisma.equipmentBrand.findUnique({ where: { id: brandId }, select: { name: true } })
      brandName = b?.name || ''
    }

    const itemName = [typeName, brandName, data.partNumber].filter(Boolean).join(' ')
    const tracksSerialNumbers = data.tracksSerialNumbers === true || data.tracksSerialNumbers === 'true'
    const autoSn = tracksSerialNumbers && (data.autoSn === true || data.autoSn === 'true')
    const snExample = autoSn ? (data.snExample || null) : null

    const initialStock = tracksSerialNumbers ? 0 : (parseInt(data.mainWarehouse) || 0)

    const item = await prisma.warehouseItem.create({
      data: {
        itemName,
        partNumber: data.partNumber,
        value: parseFloat(data.value),
        mainWarehouse: initialStock,
        tracksSerialNumbers,
      },
    })

    await prisma.$executeRaw`
      UPDATE "WarehouseItem"
      SET "autoSn" = ${autoSn}, "snExample" = ${snExample},
          "equipmentTypeId" = ${equipmentTypeId}, "brandId" = ${brandId}
      WHERE id = ${item.id}
    `

    if (initialStock > 0 && !tracksSerialNumbers) {
      await prisma.itemMovement.create({
        data: {
          itemId: item.id,
          movementType: 'ADD_STOCK',
          quantity: initialStock,
          createdById: payload.userId,
          notes: 'Initial stock',
        },
      })
    }

    return NextResponse.json({ ...item, autoSn, snExample, equipmentTypeId, brandId }, { status: 201 })
  } catch (error) {
    console.error('Error creating warehouse item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
