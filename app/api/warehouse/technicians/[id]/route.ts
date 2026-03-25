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

    // Fetch serial numbers for serialized items
    const stockDetails = await Promise.all(
      stocks.map(async (stock) => {
        let serialNumbers = undefined

        if (stock.tracksSerialNumbers) {
          const sns = await prisma.$queryRaw<Array<{ id: string; serialNumber: string }>>`
            SELECT id, "serialNumber"
            FROM "SerialNumberStock"
            WHERE "itemId" = ${stock.itemId}
              AND "technicianId" = ${id}
              AND location = 'TECHNICIAN'
            ORDER BY "serialNumber" ASC
          `
          serialNumbers = sns
        }

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
        }
      })
    )

    const totalItems = stocks.reduce((sum, stock) => sum + stock.quantity, 0)
    const totalValue = stocks.reduce((sum, stock) => sum + (stock.quantity * stock.value), 0)

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
