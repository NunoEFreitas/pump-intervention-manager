import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

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
        
        // Update technician stock
        await prisma.technicianStock.update({
          where: { id: techStock.id },
          data: { quantity: techStock.quantity - quantity },
        })
        
        // Update main warehouse
        await prisma.warehouseItem.update({
          where: { id: data.itemId },
          data: { mainWarehouse: item.mainWarehouse + quantity },
        })
        break
        
      case 'USE':
        if (!data.fromUserId) {
          return NextResponse.json(
            { error: 'Technician ID required for usage' },
            { status: 400 }
          )
        }
        
        const useTechStock = await prisma.technicianStock.findUnique({
          where: {
            itemId_technicianId: {
              itemId: data.itemId,
              technicianId: data.fromUserId,
            },
          },
        })
        
        if (!useTechStock || useTechStock.quantity < quantity) {
          return NextResponse.json(
            { error: 'Insufficient stock with technician' },
            { status: 400 }
          )
        }
        
        // Update technician stock
        await prisma.technicianStock.update({
          where: { id: useTechStock.id },
          data: { quantity: useTechStock.quantity - quantity },
        })
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

    // Create movement record
    const movement = await prisma.itemMovement.create({
      data: {
        itemId: data.itemId,
        movementType: data.movementType,
        quantity,
        fromUserId: data.fromUserId || null,
        toUserId: data.toUserId || null,
        notes: data.notes || null,
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

    return NextResponse.json(movement, { status: 201 })
  } catch (error) {
    console.error('Error creating stock movement:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
