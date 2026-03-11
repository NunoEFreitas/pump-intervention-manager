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

    const [extra] = await prisma.$queryRaw<Array<{
      autoSn: boolean
      snExample: string | null
      equipmentTypeId: string | null
      brandId: string | null
    }>>`
      SELECT "autoSn", "snExample", "equipmentTypeId", "brandId" FROM "WarehouseItem" WHERE id = ${id}
    `

    let typeName: string | null = null
    let brandName: string | null = null
    if (extra?.equipmentTypeId) {
      const t = await prisma.equipmentType.findUnique({ where: { id: extra.equipmentTypeId }, select: { name: true } })
      typeName = t?.name ?? null
    }
    if (extra?.brandId) {
      const b = await prisma.equipmentBrand.findUnique({ where: { id: extra.brandId }, select: { name: true } })
      brandName = b?.name ?? null
    }

    return NextResponse.json({ ...item, ...(extra ?? {}), typeName, brandName })
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

    const itemName = [typeName, brandName, data.partNumber].filter(Boolean).join(' ') || data.itemName
    const newAutoSn = data.autoSn === true || data.autoSn === 'true'
    const newSnExample = newAutoSn ? (data.snExample || null) : null

    const item = await prisma.warehouseItem.update({
      where: { id },
      data: {
        itemName,
        partNumber: data.partNumber,
        value: parseFloat(data.value),
      },
    })

    await prisma.$executeRaw`
      UPDATE "WarehouseItem"
      SET "autoSn" = ${newAutoSn}, "snExample" = ${newSnExample},
          "equipmentTypeId" = ${equipmentTypeId}, "brandId" = ${brandId}
      WHERE id = ${id}
    `

    return NextResponse.json({ ...item, autoSn: newAutoSn, snExample: newSnExample, equipmentTypeId, brandId, typeName, brandName })
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
