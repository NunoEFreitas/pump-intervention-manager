import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// GET parts used in an intervention
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

    const parts = await prisma.interventionPart.findMany({
      where: { interventionId: id },
      include: {
        item: {
          select: {
            id: true,
            itemName: true,
            partNumber: true,
            value: true,
            tracksSerialNumbers: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // For serialized items, fetch the actual serial numbers
    const partsWithSerialNumbers = await Promise.all(
      parts.map(async (part) => {
        if (part.item.tracksSerialNumbers && part.serialNumberIds.length > 0) {
          const serialNumbers = await prisma.serialNumberStock.findMany({
            where: {
              id: { in: part.serialNumberIds },
            },
            select: {
              id: true,
              serialNumber: true,
            },
          })

          return {
            ...part,
            serialNumbers,
          }
        }
        return part
      })
    )

    return NextResponse.json(partsWithSerialNumbers)
  } catch (error) {
    console.error('Error fetching intervention parts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST add parts to an intervention
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    const payload = verifyToken(token || '')
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: interventionId } = await params
    const data = await request.json()
    const { itemId, quantity, serialNumberIds } = data

    if (!itemId || !quantity) {
      return NextResponse.json(
        { error: 'Item and quantity are required' },
        { status: 400 }
      )
    }

    // Get intervention to verify technician
    const intervention = await prisma.intervention.findUnique({
      where: { id: interventionId },
      select: { assignedToId: true },
    })

    if (!intervention) {
      return NextResponse.json({ error: 'Intervention not found' }, { status: 404 })
    }

    // Get item to check if it tracks serial numbers
    const item = await prisma.warehouseItem.findUnique({
      where: { id: itemId },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Validate serial numbers for serialized items
    if (item.tracksSerialNumbers) {
      if (!serialNumberIds || serialNumberIds.length !== quantity) {
        return NextResponse.json(
          { error: 'Serial numbers required for serialized items' },
          { status: 400 }
        )
      }

      // Verify all serial numbers belong to the technician
      const sns = await prisma.serialNumberStock.findMany({
        where: {
          id: { in: serialNumberIds },
          itemId,
          technicianId: intervention.assignedToId,
          location: 'TECHNICIAN',
          status: 'AVAILABLE',
        },
      })

      if (sns.length !== serialNumberIds.length) {
        return NextResponse.json(
          { error: 'Some serial numbers are not available' },
          { status: 400 }
        )
      }
    } else {
      // For bulk items, check technician has enough stock
      const techStock = await prisma.technicianStock.findUnique({
        where: {
          itemId_technicianId: {
            itemId,
            technicianId: intervention.assignedToId,
          },
        },
      })

      if (!techStock || techStock.quantity < quantity) {
        return NextResponse.json(
          { error: 'Insufficient stock' },
          { status: 400 }
        )
      }
    }

    // Create intervention part record
    const interventionPart = await prisma.interventionPart.create({
      data: {
        interventionId,
        itemId,
        quantity,
        serialNumberIds: serialNumberIds || [],
      },
    })

    // Create item movement record (USE type)
    await prisma.itemMovement.create({
      data: {
        itemId,
        movementType: 'USE',
        quantity,
        fromUserId: intervention.assignedToId,
        notes: `Used in intervention ${interventionId}`,
        createdById: payload.userId,
      },
    })

    // Update stock
    if (item.tracksSerialNumbers) {
      // Update serial numbers to USED location and IN_USE status
      await prisma.serialNumberStock.updateMany({
        where: { id: { in: serialNumberIds } },
        data: {
          location: 'USED',
          status: 'IN_USE',
          technicianId: null,
        },
      })

      // Update technician stock count
      const remainingCount = await prisma.serialNumberStock.count({
        where: {
          itemId,
          technicianId: intervention.assignedToId,
          location: 'TECHNICIAN',
        },
      })

      await prisma.technicianStock.upsert({
        where: {
          itemId_technicianId: {
            itemId,
            technicianId: intervention.assignedToId,
          },
        },
        create: {
          itemId,
          technicianId: intervention.assignedToId,
          quantity: remainingCount,
        },
        update: {
          quantity: remainingCount,
        },
      })
    } else {
      // For bulk items, decrement technician stock
      await prisma.technicianStock.update({
        where: {
          itemId_technicianId: {
            itemId,
            technicianId: intervention.assignedToId,
          },
        },
        data: {
          quantity: {
            decrement: quantity,
          },
        },
      })
    }

    return NextResponse.json(interventionPart, { status: 201 })
  } catch (error) {
    console.error('Error adding intervention part:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
