import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// POST - Create movement with serial numbers
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    const payload = verifyToken(token || '')
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { itemId, movementType, serialNumberIds, toUserId, fromUserId, notes } = data

    if (!itemId || !movementType || !serialNumberIds || !Array.isArray(serialNumberIds)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate that all serial numbers exist and are available
    const serialNumbers = await prisma.serialNumberStock.findMany({
      where: {
        id: { in: serialNumberIds },
        itemId,
      },
    })

    if (serialNumbers.length !== serialNumberIds.length) {
      return NextResponse.json(
        { error: 'Some serial numbers not found' },
        { status: 404 }
      )
    }

    // Check availability based on operation type
    if (movementType === 'TRANSFER_TO_TECH' || movementType === 'REMOVE_STOCK') {
      // Must be in main warehouse
      const notInWarehouse = serialNumbers.filter(sn => sn.location !== 'MAIN_WAREHOUSE')
      if (notInWarehouse.length > 0) {
        return NextResponse.json(
          { error: 'Some serial numbers are not in main warehouse' },
          { status: 400 }
        )
      }
    } else if (movementType === 'TRANSFER_FROM_TECH' || movementType === 'USE') {
      // Must be with the specified technician
      const notWithTech = serialNumbers.filter(
        sn => sn.location !== 'TECHNICIAN' || sn.technicianId !== fromUserId
      )
      if (notWithTech.length > 0) {
        return NextResponse.json(
          { error: 'Some serial numbers are not assigned to this technician' },
          { status: 400 }
        )
      }
    }

    // Create the movement record
    const movement = await prisma.itemMovement.create({
      data: {
        itemId,
        movementType,
        quantity: serialNumberIds.length,
        fromUserId,
        toUserId,
        notes,
        createdById: payload.userId,
      },
    })

    // Link serial numbers to movement
    await prisma.movementSerialNumber.createMany({
      data: serialNumberIds.map((snId: string) => ({
        movementId: movement.id,
        serialNumberId: snId,
      })),
    })

    // Update serial number locations
    if (movementType === 'TRANSFER_TO_TECH') {
      await prisma.serialNumberStock.updateMany({
        where: { id: { in: serialNumberIds } },
        data: {
          location: 'TECHNICIAN',
          technicianId: toUserId,
        },
      })
      // Update technician stock count
      await updateTechnicianStock(itemId, toUserId)
    } else if (movementType === 'TRANSFER_FROM_TECH') {
      await prisma.serialNumberStock.updateMany({
        where: { id: { in: serialNumberIds } },
        data: {
          location: 'MAIN_WAREHOUSE',
          technicianId: null,
        },
      })
      // Update technician stock count
      await updateTechnicianStock(itemId, fromUserId)
    } else if (movementType === 'REMOVE_STOCK') {
      await prisma.serialNumberStock.updateMany({
        where: { id: { in: serialNumberIds } },
        data: {
          status: 'LOST',
          location: 'USED',
        },
      })
    } else if (movementType === 'USE') {
      await prisma.serialNumberStock.updateMany({
        where: { id: { in: serialNumberIds } },
        data: {
          location: 'USED',
          status: 'IN_USE',
          technicianId: null,
        },
      })
      // Update technician stock count
      await updateTechnicianStock(itemId, fromUserId)
    }

    return NextResponse.json(movement, { status: 201 })
  } catch (error) {
    console.error('Error creating serialized movement:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to update technician stock counts
async function updateTechnicianStock(itemId: string, technicianId: string | undefined) {
  if (!technicianId) return

  // Count serial numbers for this technician
  const count = await prisma.serialNumberStock.count({
    where: {
      itemId,
      technicianId,
      location: 'TECHNICIAN',
    },
  })

  // Update or create technician stock record
  await prisma.technicianStock.upsert({
    where: {
      itemId_technicianId: {
        itemId,
        technicianId,
      },
    },
    create: {
      itemId,
      technicianId,
      quantity: count,
    },
    update: {
      quantity: count,
    },
  })
}
