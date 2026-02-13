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

    // Get all stock items for this technician
    const stocks = await prisma.technicianStock.findMany({
      where: {
        technicianId: id,
      },
      include: {
        item: {
          select: {
            id: true,
            itemName: true,
            partNumber: true,
            serialNumber: true,
            value: true,
            mainWarehouse: true,
            tracksSerialNumbers: true,
          },
        },
      },
      orderBy: {
        item: {
          itemName: 'asc',
        },
      },
    })

    // Fetch serial numbers for serialized items
    const stockDetails = await Promise.all(
      stocks.map(async (stock) => {
        let serialNumbers = undefined

        if (stock.item.tracksSerialNumbers) {
          const sns = await prisma.serialNumberStock.findMany({
            where: {
              itemId: stock.item.id,
              technicianId: id,
              location: 'TECHNICIAN',
            },
            select: {
              id: true,
              serialNumber: true,
            },
            orderBy: {
              serialNumber: 'asc',
            },
          })
          serialNumbers = sns
        }

        return {
          itemId: stock.item.id,
          itemName: stock.item.itemName,
          partNumber: stock.item.partNumber,
          serialNumber: stock.item.serialNumber,
          value: stock.item.value,
          quantity: stock.quantity,
          totalValue: stock.quantity * stock.item.value,
          mainWarehouseStock: stock.item.mainWarehouse,
          tracksSerialNumbers: stock.item.tracksSerialNumbers,
          serialNumbers,
        }
      })
    )

    const totalItems = stocks.reduce((sum, stock) => sum + stock.quantity, 0)
    const totalValue = stocks.reduce((sum, stock) => sum + (stock.quantity * stock.item.value), 0)

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
