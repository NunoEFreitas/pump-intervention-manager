import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// GET specific technician with their complete stock details
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

    // Get technician details
    const technician = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    })

    if (!technician || technician.role !== 'TECHNICIAN') {
      return NextResponse.json({ error: 'Technician not found' }, { status: 404 })
    }

    // Get all stock items for this technician via raw SQL (Prisma client may be stale)
    const stocks = await prisma.$queryRaw<Array<{
      quantity: number
      itemId: string
      itemName: string
      partNumber: string
      value: number
      mainWarehouse: number
      tracksSerialNumbers: boolean
      ean13: string | null
    }>>`
      SELECT ts.quantity,
             wi.id AS "itemId",
             wi."itemName",
             wi."partNumber",
             wi.value,
             wi."mainWarehouse",
             wi."tracksSerialNumbers",
             wi."ean13"
      FROM "TechnicianStock" ts
      JOIN "WarehouseItem" wi ON wi.id = ts."itemId"
      WHERE ts."technicianId" = ${id}
      ORDER BY wi."itemName" ASC
    `

    // Fetch client parts for this technician (all items)
    const clientPartRows = await prisma.$queryRaw<Array<{
      id: string
      itemId: string
      serialNumber: string | null
      faultDescription: string | null
      clientPartStatus: string | null
      interventionReference: string | null
    }>>`
      SELECT sn.id, sn."itemId", sn."serialNumber", sn."faultDescription", sn."clientPartStatus",
             inv.reference AS "interventionReference"
      FROM "SerialNumberStock" sn
      LEFT JOIN "Intervention" inv ON inv.id = sn."interventionId"
      WHERE sn."technicianId" = ${id}
        AND sn."isClientPart" = true
        AND sn.location = 'TECHNICIAN'
        AND (sn."clientPartStatus" IS NULL OR sn."clientPartStatus" = 'PENDING')
    `

    // Group client parts by itemId
    const clientPartsByItem: Record<string, typeof clientPartRows> = {}
    for (const cp of clientPartRows) {
      if (!clientPartsByItem[cp.itemId]) clientPartsByItem[cp.itemId] = []
      clientPartsByItem[cp.itemId].push(cp)
    }

    // Build a map of own-stock items
    const stockMap = new Map(stocks.map(s => [s.itemId, s]))

    // Collect all unique itemIds: own stock + client parts
    const allItemIds = Array.from(new Set([
      ...stocks.map(s => s.itemId),
      ...clientPartRows.map(cp => cp.itemId),
    ]))

    // Fetch item info for client-part-only items (not in TechnicianStock)
    const clientOnlyItemIds = allItemIds.filter(id => !stockMap.has(id))
    let clientOnlyItems: Array<{ itemId: string; itemName: string; partNumber: string; value: number; mainWarehouse: number; tracksSerialNumbers: boolean; ean13: string | null }> = []
    if (clientOnlyItemIds.length > 0) {
      for (const itemId of clientOnlyItemIds) {
        const [wi] = await prisma.$queryRaw<typeof clientOnlyItems>`
          SELECT id AS "itemId", "itemName", "partNumber", value, "mainWarehouse", "tracksSerialNumbers", "ean13"
          FROM "WarehouseItem" WHERE id = ${itemId}
        `
        if (wi) clientOnlyItems.push(wi)
      }
    }

    // Merge all items
    const allItems = [
      ...stocks.map(s => ({ itemId: s.itemId, itemName: s.itemName, partNumber: s.partNumber, value: s.value, mainWarehouse: s.mainWarehouse, tracksSerialNumbers: s.tracksSerialNumbers, ean13: s.ean13, quantity: s.quantity })),
      ...clientOnlyItems.map(i => ({ ...i, quantity: 0 })),
    ]

    // Fetch serial numbers for serialized items (own stock only, exclude client parts)
    const stockDetails = await Promise.all(
      allItems.map(async (stock) => {
        let serialNumbers = undefined

        if (stock.tracksSerialNumbers) {
          const sns = await prisma.$queryRaw<Array<{ id: string; serialNumber: string }>>`
            SELECT id, "serialNumber"
            FROM "SerialNumberStock"
            WHERE "itemId" = ${stock.itemId}
              AND "technicianId" = ${id}
              AND location = 'TECHNICIAN'
              AND "isClientPart" = false
            ORDER BY "serialNumber" ASC
          `
          serialNumbers = sns
        }

        const clientParts = clientPartsByItem[stock.itemId] ?? []

        return {
          itemId: stock.itemId,
          itemName: stock.itemName,
          partNumber: stock.partNumber,
          value: stock.value,
          quantity: stock.quantity,
          totalValue: stock.quantity * stock.value,
          mainWarehouseStock: stock.mainWarehouse,
          tracksSerialNumbers: stock.tracksSerialNumbers,
          ean13: stock.ean13,
          serialNumbers,
          clientParts,
        }
      })
    )

    const totalItems = stockDetails.reduce((sum, s) => sum + s.quantity, 0)
    const totalValue = stockDetails.reduce((sum, s) => sum + s.totalValue, 0)

    return NextResponse.json({
      ...technician,
      totalItems,
      totalValue,
      stocks: stockDetails,
    })
  } catch (error) {
    console.error('Error fetching technician stock:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
