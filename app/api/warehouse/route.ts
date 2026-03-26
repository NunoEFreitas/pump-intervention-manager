import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// GET all warehouse items (paginated + search)
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const offset = (page - 1) * limit

    const searchLike = `%${search.toLowerCase()}%`

    const [countRows, items, extraFields, clientPartsCounts] = await Promise.all([
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS count FROM "WarehouseItem"
        WHERE LOWER("itemName") LIKE ${searchLike} OR LOWER("partNumber") LIKE ${searchLike}
      `,
      prisma.$queryRaw<Array<{
        id: string
        itemName: string
        partNumber: string
        value: number
        mainWarehouse: number
        repairStock: number
        destructionStock: number
        tracksSerialNumbers: boolean
        autoSn: boolean
        snExample: string | null
        equipmentTypeId: string | null
        brandId: string | null
        equipmentTypeName: string | null
        brandName: string | null
        createdAt: Date
        updatedAt: Date
      }>>`
        SELECT w.id, w."itemName", w."partNumber", w.value, w."mainWarehouse", w."repairStock", w."destructionStock",
               w."tracksSerialNumbers", w."autoSn", w."snExample", w."equipmentTypeId", w."brandId",
               w."ean13", w."createdAt", w."updatedAt",
               et.name AS "equipmentTypeName", eb.name AS "brandName"
        FROM "WarehouseItem" w
        LEFT JOIN "EquipmentType" et ON et.id = w."equipmentTypeId"
        LEFT JOIN "EquipmentBrand" eb ON eb.id = w."brandId"
        WHERE LOWER(w."itemName") LIKE ${searchLike} OR LOWER(w."partNumber") LIKE ${searchLike}
        ORDER BY w."createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      prisma.$queryRaw<Array<{
        itemId: string
        technicianId: string
        technicianName: string
        quantity: number
      }>>`
        SELECT ts."itemId", ts."technicianId", u.name AS "technicianName", ts.quantity
        FROM "TechnicianStock" ts
        JOIN "User" u ON u.id = ts."technicianId"
        WHERE ts."itemId" IN (
          SELECT id FROM "WarehouseItem"
          WHERE LOWER("itemName") LIKE ${searchLike} OR LOWER("partNumber") LIKE ${searchLike}
          ORDER BY "createdAt" DESC
          LIMIT ${limit} OFFSET ${offset}
        )
      `,
      prisma.$queryRaw<Array<{ itemId: string; count: bigint }>>`
        SELECT "itemId", COUNT(*)::bigint AS count
        FROM "SerialNumberStock"
        WHERE "isClientPart" = true
          AND ("clientPartStatus" IS NULL OR "clientPartStatus" NOT IN ('RESOLVED'))
          AND "itemId" IN (
            SELECT id FROM "WarehouseItem"
            WHERE LOWER("itemName") LIKE ${searchLike} OR LOWER("partNumber") LIKE ${searchLike}
            ORDER BY "createdAt" DESC
            LIMIT ${limit} OFFSET ${offset}
          )
        GROUP BY "itemId"
      `,
    ])

    const total = Number(countRows[0].count)
    const pages = Math.ceil(total / limit)

    // Group technician stocks by itemId
    const techMap = new Map<string, Array<{ technician: { id: string; name: string }; quantity: number }>>()
    for (const ts of extraFields) {
      if (!techMap.has(ts.itemId)) techMap.set(ts.itemId, [])
      techMap.get(ts.itemId)!.push({ technician: { id: ts.technicianId, name: ts.technicianName }, quantity: ts.quantity })
    }

    const clientPartsMap = new Map<string, number>()
    for (const cp of clientPartsCounts) {
      clientPartsMap.set(cp.itemId, Number(cp.count))
    }

    const itemsWithTotals = items.map(item => {
      const techStocks = techMap.get(item.id) ?? []
      const totalTechnicianStock = techStocks.reduce((s, ts) => s + ts.quantity, 0)
      const clientPartsCount = clientPartsMap.get(item.id) ?? 0
      return {
        ...item,
        technicianStocks: techStocks,
        totalTechnicianStock,
        clientPartsCount,
        totalStock: item.mainWarehouse + totalTechnicianStock,
      }
    })

    return NextResponse.json({ items: itemsWithTotals, total, page, pages, limit })
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

    if (!data.partNumber) {
      return NextResponse.json(
        { error: 'Part number is required' },
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

    const itemName = data.itemName?.trim() || [typeName, brandName, data.partNumber].filter(Boolean).join(' ')
    const tracksSerialNumbers = data.tracksSerialNumbers === true || data.tracksSerialNumbers === 'true'
    const autoSn = tracksSerialNumbers && (data.autoSn === true || data.autoSn === 'true')
    const snExample = autoSn ? (data.snExample || null) : null
    const ean13 = data.ean13?.trim() || null

    const initialStock = tracksSerialNumbers ? 0 : (parseInt(data.mainWarehouse) || 0)

    const item = await prisma.warehouseItem.create({
      data: {
        itemName,
        partNumber: data.partNumber,
        value: data.value !== undefined && data.value !== '' ? parseFloat(data.value) : 0,
        mainWarehouse: initialStock,
        tracksSerialNumbers,
      },
    })

    await prisma.$executeRaw`
      UPDATE "WarehouseItem"
      SET "autoSn" = ${autoSn}, "snExample" = ${snExample},
          "equipmentTypeId" = ${equipmentTypeId}, "brandId" = ${brandId},
          "ean13" = ${ean13}
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
