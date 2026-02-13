import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// GET serial numbers for an item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const {id} = await params

    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const location = searchParams.get('location')
    const technicianId = searchParams.get('technicianId')
    const status = searchParams.get('status')

    const where: any = {
      itemId: id,
    }

    if (location) {
      where.location = location
    }

    if (technicianId) {
      where.technicianId = technicianId
    }

    if (status) {
      where.status = status
    }

    const serialNumbers = await prisma.serialNumberStock.findMany({
      where,
      include: {
        technician: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        serialNumber: 'asc',
      },
    })

    return NextResponse.json(serialNumbers)
  } catch (error) {
    console.error('Error fetching serial numbers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Add serial numbers (when adding stock)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const{ id} = await params
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    const payload = verifyToken(token || '')
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { serialNumbers, location, technicianId } = data

    if (!serialNumbers || !Array.isArray(serialNumbers) || serialNumbers.length === 0) {
      return NextResponse.json(
        { error: 'Serial numbers array is required' },
        { status: 400 }
      )
    }

    // Check if item tracks serial numbers
    const item = await prisma.warehouseItem.findUnique({
      where: { id: id },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    if (!item.tracksSerialNumbers) {
      return NextResponse.json(
        { error: 'This item does not track serial numbers' },
        { status: 400 }
      )
    }

    // Check for duplicate serial numbers within this item
    const existing = await prisma.serialNumberStock.findMany({
      where: {
        itemId: id,
        serialNumber: { in: serialNumbers },
      },
    })

    if (existing.length > 0) {
      return NextResponse.json(
        {
          error: `Serial numbers already exist: ${existing.map(e => e.serialNumber).join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Create serial number records
    const created = await prisma.serialNumberStock.createMany({
      data: serialNumbers.map((sn: string) => ({
        itemId: id,
        serialNumber: sn.trim(),
        location: location || 'MAIN_WAREHOUSE',
        technicianId: location === 'TECHNICIAN' ? technicianId : null,
        status: 'AVAILABLE',
      })),
    })

    return NextResponse.json(
      { created: created.count, message: `${created.count} serial numbers added` },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error adding serial numbers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
