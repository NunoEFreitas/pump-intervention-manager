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
            technician: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: { movements: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Fetch new fields not yet in Prisma client via raw SQL
    const extraFields = await prisma.$queryRaw<Array<{ id: string; autoSn: boolean; snExample: string | null }>>`
      SELECT id, "autoSn", "snExample" FROM "WarehouseItem"
    `
    const extraMap = new Map(extraFields.map(f => [f.id, f]))

    // Calculate total technician stock for each item
    const itemsWithTotals = items.map(item => ({
      ...item,
      ...extraMap.get(item.id),
      totalTechnicianStock: item.technicianStocks.reduce((sum, ts) => sum + ts.quantity, 0),
      totalStock: item.mainWarehouse + item.technicianStocks.reduce((sum, ts) => sum + ts.quantity, 0),
    }))

    return NextResponse.json(itemsWithTotals)
  } catch (error) {
    console.error('Error fetching warehouse items:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
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

    // Check if user is ADMIN or SUPERVISOR
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true },
    })

    if (user?.role === 'TECHNICIAN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data = await request.json()

    if (!data.itemName || !data.partNumber || data.value === undefined) {
      return NextResponse.json(
        { error: 'Item name, part number, and value are required' },
        { status: 400 }
      )
    }

    const tracksSerialNumbers = data.tracksSerialNumbers === true || data.tracksSerialNumbers === 'true'
    const autoSn = tracksSerialNumbers && (data.autoSn === true || data.autoSn === 'true')
    const snExample = autoSn ? (data.snExample?.trim() || null) : null

    if (autoSn && !snExample) {
      return NextResponse.json(
        { error: 'SN example is required when automatic SN generation is enabled' },
        { status: 400 }
      )
    }

    const initialStock = tracksSerialNumbers ? 0 : (parseInt(data.mainWarehouse) || 0)

    // Create without new fields (Prisma client binary not yet updated)
    const item = await prisma.warehouseItem.create({
      data: {
        itemName: data.itemName,
        partNumber: data.partNumber,
        value: parseFloat(data.value),
        mainWarehouse: initialStock,
        tracksSerialNumbers,
      },
    })

    // Set new fields via raw SQL
    await prisma.$executeRaw`
      UPDATE "WarehouseItem" SET "autoSn" = ${autoSn}, "snExample" = ${snExample} WHERE id = ${item.id}
    `

    // If initial stock is added (only for non-serialized items), create a movement record
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

    return NextResponse.json({ ...item, autoSn, snExample }, { status: 201 })
  } catch (error) {
    console.error('Error creating warehouse item:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
