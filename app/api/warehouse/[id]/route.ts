import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// GET single warehouse item with movements
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const item = await prisma.warehouseItem.findUnique({
      where: { id },
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
        movements: {
          include: {
            fromUser: {
              select: {
                id: true,
                name: true,
              },
            },
            toUser: {
              select: {
                id: true,
                name: true,
              },
            },
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
            serialNumbers: {
              include: {
                serialNumber: {
                  select: {
                    id: true,
                    serialNumber: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Fetch new fields not yet in Prisma client via raw SQL
    const [extra] = await prisma.$queryRaw<Array<{ autoSn: boolean; snExample: string | null }>>`
      SELECT "autoSn", "snExample" FROM "WarehouseItem" WHERE id = ${id}
    `

    return NextResponse.json({ ...item, ...(extra ?? {}) })
  } catch (error) {
    console.error('Error fetching warehouse item:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT update warehouse item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const data = await request.json()

    const item = await prisma.warehouseItem.update({
      where: { id },
      data: {
        itemName: data.itemName,
        partNumber: data.partNumber,
        value: parseFloat(data.value),
      },
    })

    // Update new fields via raw SQL
    const newAutoSn = data.autoSn === true || data.autoSn === 'true'
    const newSnExample = data.snExample?.trim() || null
    await prisma.$executeRaw`
      UPDATE "WarehouseItem" SET "autoSn" = ${newAutoSn}, "snExample" = ${newSnExample} WHERE id = ${id}
    `

    return NextResponse.json({ ...item, autoSn: newAutoSn, snExample: newSnExample })
  } catch (error) {
    console.error('Error updating warehouse item:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE warehouse item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    await prisma.warehouseItem.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Item deleted successfully' })
  } catch (error) {
    console.error('Error deleting warehouse item:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
