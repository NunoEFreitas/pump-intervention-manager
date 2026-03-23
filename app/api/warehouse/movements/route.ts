import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { generateRepairReference } from '@/lib/reference'

// POST create stock movement (add, remove, transfer, use)
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    const payload = verifyToken(token || '')
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()

    if (!data.itemId || !data.movementType || !data.quantity) {
      return NextResponse.json(
        { error: 'Item ID, movement type, and quantity are required' },
        { status: 400 }
      )
    }

    const quantity = parseInt(data.quantity)
    if (!Number.isInteger(quantity) || quantity < 1) {
      return NextResponse.json({ error: 'Quantity must be a positive integer' }, { status: 400 })
    }
    
    // Get current item state
    const item = await prisma.warehouseItem.findUnique({
      where: { id: data.itemId },
      include: {
        technicianStocks: true,
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Validate and perform the movement
    let updateData: any = {}
    
    switch (data.movementType) {
      case 'ADD_STOCK':
        updateData = {
          mainWarehouse: item.mainWarehouse + quantity,
        }
        break
        
      case 'REMOVE_STOCK':
        if (item.mainWarehouse < quantity) {
          return NextResponse.json(
            { error: 'Insufficient stock in main warehouse' },
            { status: 400 }
          )
        }
        updateData = {
          mainWarehouse: item.mainWarehouse - quantity,
        }
        break
        
      case 'TRANSFER_TO_TECH':
        if (!data.toUserId) {
          return NextResponse.json(
            { error: 'Technician ID required for transfer' },
            { status: 400 }
          )
        }
        if (item.mainWarehouse < quantity) {
          return NextResponse.json(
            { error: 'Insufficient stock in main warehouse' },
            { status: 400 }
          )
        }
        
        // Update main warehouse
        await prisma.warehouseItem.update({
          where: { id: data.itemId },
          data: { mainWarehouse: item.mainWarehouse - quantity },
        })
        
        // Update or create technician stock
        const existingTechStock = await prisma.technicianStock.findUnique({
          where: {
            itemId_technicianId: {
              itemId: data.itemId,
              technicianId: data.toUserId,
            },
          },
        })
        
        if (existingTechStock) {
          await prisma.technicianStock.update({
            where: { id: existingTechStock.id },
            data: { quantity: existingTechStock.quantity + quantity },
          })
        } else {
          await prisma.technicianStock.create({
            data: {
              itemId: data.itemId,
              technicianId: data.toUserId,
              quantity,
            },
          })
        }
        break
        
      case 'TRANSFER_FROM_TECH':
        if (!data.fromUserId) {
          return NextResponse.json(
            { error: 'Technician ID required for return transfer' },
            { status: 400 }
          )
        }
        
        const techStock = await prisma.technicianStock.findUnique({
          where: {
            itemId_technicianId: {
              itemId: data.itemId,
              technicianId: data.fromUserId,
            },
          },
        })
        
        if (!techStock || techStock.quantity < quantity) {
          return NextResponse.json(
            { error: 'Insufficient stock with technician' },
            { status: 400 }
          )
        }
        
        // Update technician stock — delete record if it reaches 0
        const newTechQty = techStock.quantity - quantity
        if (newTechQty <= 0) {
          await prisma.technicianStock.delete({ where: { id: techStock.id } })
        } else {
          await prisma.technicianStock.update({
            where: { id: techStock.id },
            data: { quantity: newTechQty },
          })
        }

        // Update main warehouse
        await prisma.warehouseItem.update({
          where: { id: data.itemId },
          data: { mainWarehouse: item.mainWarehouse + quantity },
        })
        break
        
      case 'USE':
        // Deduct directly from main warehouse — createdById records who consumed it
        if (item.mainWarehouse < quantity) {
          return NextResponse.json(
            { error: 'Insufficient stock in main warehouse' },
            { status: 400 }
          )
        }
        updateData = {
          mainWarehouse: item.mainWarehouse - quantity,
        }
        break

      case 'REPAIR_IN':
        if (item.mainWarehouse < quantity) {
          return NextResponse.json(
            { error: 'Insufficient stock in main warehouse' },
            { status: 400 }
          )
        }
        updateData = {
          mainWarehouse: item.mainWarehouse - quantity,
          repairStock: (item as any).repairStock + quantity,
        }
        break

      case 'REPAIR_OUT':
        if ((item as any).repairStock < quantity) {
          return NextResponse.json(
            { error: 'Insufficient items in repair' },
            { status: 400 }
          )
        }
        updateData = {
          repairStock: (item as any).repairStock - quantity,
          mainWarehouse: item.mainWarehouse + quantity,
        }
        break

      default:
        return NextResponse.json(
          { error: 'Invalid movement type' },
          { status: 400 }
        )
    }

    // Update main warehouse if needed (for ADD_STOCK and REMOVE_STOCK)
    if (Object.keys(updateData).length > 0) {
      await prisma.warehouseItem.update({
        where: { id: data.itemId },
        data: updateData,
      })
    }

    // Pre-generate repair references so they can be included in movement notes
    const repairRefs: string[] = []
    if (data.movementType === 'REPAIR_IN') {
      for (let i = 0; i < quantity; i++) {
        repairRefs.push(await generateRepairReference())
      }
    }

    const repairRefTag = repairRefs.length > 0 ? `[${repairRefs.join(', ')}]` : null
    const movementNotes = repairRefTag
      ? (data.notes ? `${repairRefTag} ${data.notes}` : repairRefTag)
      : (data.notes || null)

    // Create movement record
    const movement = await prisma.itemMovement.create({
      data: {
        itemId: data.itemId,
        movementType: data.movementType,
        quantity,
        fromUserId: data.fromUserId || null,
        toUserId: data.toUserId || null,
        notes: movementNotes,
        createdById: payload.userId,
      },
      include: {
        item: true,
        fromUser: {
          select: { id: true, name: true },
        },
        toUser: {
          select: { id: true, name: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    })

    // Auto-create PartRepairJob entries for non-SN REPAIR_IN (refs already generated above)
    if (data.movementType === 'REPAIR_IN') {
      const now = new Date()
      for (let i = 0; i < quantity; i++) {
        const jobId = crypto.randomUUID()
        await prisma.$executeRaw`
          INSERT INTO "PartRepairJob" (id, reference, "itemId", quantity, status, problem, "sentAt", "sentById", "createdAt", "updatedAt")
          VALUES (${jobId}, ${repairRefs[i]}, ${data.itemId}, 1, 'PENDING', ${data.notes || null}, ${now}::timestamptz, ${payload.userId}, ${now}::timestamptz, ${now}::timestamptz)
        `
      }
    }

    return NextResponse.json(movement, { status: 201 })
  } catch (error) {
    console.error('Error creating stock movement:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
