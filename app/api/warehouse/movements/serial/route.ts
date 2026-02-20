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
    } else if (movementType === 'TRANSFER_FROM_TECH') {
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
    // For USE: any available serial number can be consumed — no location restriction

    // Create the movement record
    const movement = await prisma.itemMovement.create({
      data: {
        itemId,
        movementType,
        quantity: serialNumberIds.length,
        fromUserId: fromUserId || null,
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
      await updateTechnicianStock(itemId, toUserId)
      // Decrement main warehouse counter (all transferred items came from there)
      await prisma.warehouseItem.update({
        where: { id: itemId },
        data: { mainWarehouse: { decrement: serialNumberIds.length } },
      })
    } else if (movementType === 'TRANSFER_FROM_TECH') {
      await prisma.serialNumberStock.updateMany({
        where: { id: { in: serialNumberIds } },
        data: {
          location: 'MAIN_WAREHOUSE',
          technicianId: null,
        },
      })
      await updateTechnicianStock(itemId, fromUserId)
      // Increment main warehouse counter
      await prisma.warehouseItem.update({
        where: { id: itemId },
        data: { mainWarehouse: { increment: serialNumberIds.length } },
      })
    } else if (movementType === 'REMOVE_STOCK') {
      await prisma.serialNumberStock.updateMany({
        where: { id: { in: serialNumberIds } },
        data: {
          status: 'LOST',
          location: 'USED',
        },
      })
      // Decrement main warehouse counter (all removed items came from there)
      await prisma.warehouseItem.update({
        where: { id: itemId },
        data: { mainWarehouse: { decrement: serialNumberIds.length } },
      })
    } else if (movementType === 'USE') {
      // Count items coming from each source before clearing locations
      const fromMainWarehouse = serialNumbers.filter(sn => sn.location === 'MAIN_WAREHOUSE').length
      const affectedTechIds = [
        ...new Set(
          serialNumbers
            .filter(sn => sn.technicianId)
            .map(sn => sn.technicianId as string)
        ),
      ]

      await prisma.serialNumberStock.updateMany({
        where: { id: { in: serialNumberIds } },
        data: {
          location: 'USED',
          status: 'IN_USE',
          technicianId: null,
        },
      })

      // Update stock count for every technician who had items consumed
      for (const techId of affectedTechIds) {
        await updateTechnicianStock(itemId, techId)
      }

      // Decrement main warehouse counter for items that came from there
      if (fromMainWarehouse > 0) {
        await prisma.warehouseItem.update({
          where: { id: itemId },
          data: { mainWarehouse: { decrement: fromMainWarehouse } },
        })
      }
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

  // Remove the record entirely if the technician has no more stock
  if (count === 0) {
    await prisma.technicianStock.deleteMany({
      where: { itemId, technicianId },
    })
  } else {
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
}
