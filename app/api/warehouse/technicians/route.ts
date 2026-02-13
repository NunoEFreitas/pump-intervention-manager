import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// GET all technicians with their stock
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all technicians
    const technicians = await prisma.user.findMany({
      where: {
        role: 'TECHNICIAN',
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: { name: 'asc' },
    })

    // Get stock for each technician
    const techniciansWithStock = await Promise.all(
      technicians.map(async (tech) => {
        const stocks = await prisma.technicianStock.findMany({
          where: {
            technicianId: tech.id,
            quantity: { gt: 0 },
          },
          include: {
            item: {
              select: {
                itemName: true,
                value: true,
              },
            },
          },
        })

        const totalItems = stocks.reduce((sum, stock) => sum + stock.quantity, 0)
        const totalValue = stocks.reduce((sum, stock) => sum + (stock.quantity * stock.item.value), 0)

        return {
          ...tech,
          totalItems,
          totalValue,
          stockItems: stocks.map(s => ({
            itemName: s.item.itemName,
            quantity: s.quantity,
          })),
        }
      })
    )

    return NextResponse.json(techniciansWithStock)
  } catch (error) {
    console.error('Error fetching technicians with stock:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
