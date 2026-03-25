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

    const [itemRows, techRows, movementRows, extraRows] = await Promise.all([
      prisma.$queryRaw<any[]>`
        SELECT id, "itemName", "partNumber", "ean13", value, "mainWarehouse", "repairStock", "destructionStock",
               "tracksSerialNumbers", "autoSn", "snExample", "equipmentTypeId", "brandId",
               "createdAt", "updatedAt"
        FROM "WarehouseItem" WHERE id = ${id}
      `,
      prisma.$queryRaw<any[]>`
        SELECT ts."technicianId", ts.quantity,
               u.id AS "uid", u.name AS "uname", u.email AS "uemail"
        FROM "TechnicianStock" ts
        JOIN "User" u ON u.id = ts."technicianId"
        WHERE ts."itemId" = ${id}
      `,
      prisma.$queryRaw<any[]>`
        SELECT m.id, m."movementType", m.quantity, m.notes, m."createdAt",
               m."fromUserId", fu.name AS "fromUserName",
               m."toUserId", tu.name AS "toUserName",
               m."createdById", cu.name AS "createdByName"
        FROM "ItemMovement" m
        LEFT JOIN "User" fu ON fu.id = m."fromUserId"
        LEFT JOIN "User" tu ON tu.id = m."toUserId"
        LEFT JOIN "User" cu ON cu.id = m."createdById"
        WHERE m."itemId" = ${id}
        ORDER BY m."createdAt" DESC
      `,
      prisma.$queryRaw<any[]>`
        SELECT wi."equipmentTypeId", wi."brandId",
               et.name AS "typeName", eb.name AS "brandName"
        FROM "WarehouseItem" wi
        LEFT JOIN "EquipmentType" et ON et.id = wi."equipmentTypeId"
        LEFT JOIN "EquipmentBrand" eb ON eb.id = wi."brandId"
        WHERE wi.id = ${id}
      `,
    ])

    if (!itemRows.length) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const item = itemRows[0]
    const extra = extraRows[0] ?? {}

    // Fetch serial numbers per movement (join via ItemMovement to avoid ANY uuid cast issues)
    const snByMovement: Map<string, any[]> = new Map()
    const snRows = await prisma.$queryRaw<any[]>`
      SELECT msn."movementId", sn.id AS "snId", sn."serialNumber"
      FROM "MovementSerialNumber" msn
      JOIN "SerialNumberStock" sn ON sn.id = msn."serialNumberId"
      JOIN "ItemMovement" m ON m.id = msn."movementId"
      WHERE m."itemId" = ${id}
    `
    for (const row of snRows) {
      if (!snByMovement.has(row.movementId)) snByMovement.set(row.movementId, [])
      snByMovement.get(row.movementId)!.push({ serialNumber: { id: row.snId, serialNumber: row.serialNumber } })
    }

    const movements = movementRows.map(m => ({
      ...m,
      fromUser: m.fromUserId ? { id: m.fromUserId, name: m.fromUserName } : null,
      toUser: m.toUserId ? { id: m.toUserId, name: m.toUserName } : null,
      createdBy: m.createdById ? { id: m.createdById, name: m.createdByName } : null,
      serialNumbers: snByMovement.get(m.id) ?? [],
    }))

    const technicianStocks = techRows.map(ts => ({
      technicianId: ts.technicianId,
      quantity: ts.quantity,
      technician: { id: ts.uid, name: ts.uname, email: ts.uemail },
    }))

    return NextResponse.json({
      ...item,
      technicianStocks,
      movements,
      typeName: extra.typeName ?? null,
      brandName: extra.brandName ?? null,
    })
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

    const computedName = [typeName, brandName, data.partNumber].filter(Boolean).join(' ')
    const itemName = data.itemName?.trim() || computedName
    const newTracksSerialNumbers = data.tracksSerialNumbers === true || data.tracksSerialNumbers === 'true'
    const newAutoSn = newTracksSerialNumbers && (data.autoSn === true || data.autoSn === 'true')
    const newSnExample = newAutoSn ? (data.snExample || null) : null

    const ean13 = data.ean13?.trim() || null

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
          "equipmentTypeId" = ${equipmentTypeId}, "brandId" = ${brandId},
          "tracksSerialNumbers" = ${newTracksSerialNumbers},
          "ean13" = ${ean13}
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
