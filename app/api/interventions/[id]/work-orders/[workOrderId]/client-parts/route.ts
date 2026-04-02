import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { randomUUID } from 'crypto'

const GENERIC_PN = '__GENERIC__'

type Params = { params: Promise<{ id: string; workOrderId: string }> }

// GET — list client parts collected in this work order
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!verifyToken(token || '')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workOrderId } = await params

    const parts = await prisma.$queryRaw<any[]>`
      SELECT sn.id, sn."serialNumber", sn."clientItemSn", sn."faultDescription", sn."clientPartStatus",
             sn."preSwapped", sn."workOrderId",
             rj.reference AS "repairReference", rj.status AS "repairStatus",
             sn."itemId", wi."itemName", wi."partNumber",
             sn."createdAt", sn.location,
             u.name AS "pickedUpByName"
      FROM "SerialNumberStock" sn
      JOIN "WarehouseItem" wi ON wi.id = sn."itemId"
      LEFT JOIN "User" u ON u.id = sn."pickedUpById"
      LEFT JOIN "PartRepairJob" rj ON rj.id = sn."clientRepairJobId"
      WHERE sn."workOrderId" = ${workOrderId} AND sn."isClientPart" = true
      ORDER BY sn."createdAt" ASC
    `

    return NextResponse.json(parts)
  } catch (error) {
    console.error('Error fetching WO client parts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST — collect a client part at work order level
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const payload = verifyToken(token || '')
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: interventionId, workOrderId } = await params
    const { warehouseItemId, serialNumber, faultDescription, clientItemSn: rawClientItemSn, technicianId: requestedTechId, preSwapped } = await request.json()

    if (!warehouseItemId) return NextResponse.json({ error: 'Warehouse item is required' }, { status: 400 })

    // Fetch intervention to get assigned tech
    const intervention = await prisma.intervention.findUnique({
      where: { id: interventionId },
      select: { id: true, assignedToId: true },
    })
    if (!intervention) return NextResponse.json({ error: 'Intervention not found' }, { status: 404 })

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true },
    })
    if (user?.role === 'TECHNICIAN' && payload.userId !== intervention.assignedToId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const resolvedTechId = user?.role === 'TECHNICIAN'
      ? intervention.assignedToId
      : (requestedTechId || intervention.assignedToId)
    if (!resolvedTechId) {
      return NextResponse.json({ error: 'Nenhum técnico selecionado ou atribuído à intervenção' }, { status: 400 })
    }

    // Resolve item (supports __GENERIC__ placeholder)
    let resolvedItemId = warehouseItemId
    let resolvedItemName = ''
    let resolvedPartNumber = ''
    let resolvedTracksSerialNumbers = false

    if (warehouseItemId === GENERIC_PN) {
      const existing = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "WarehouseItem" WHERE "partNumber" = ${GENERIC_PN} LIMIT 1
      `
      if (existing.length > 0) {
        resolvedItemId = existing[0].id
      } else {
        resolvedItemId = randomUUID()
        await prisma.$executeRaw`
          INSERT INTO "WarehouseItem" (id, "itemName", "partNumber", value, "mainWarehouse", "repairStock", "destructionStock", "tracksSerialNumbers", "autoSn", "createdAt", "updatedAt")
          VALUES (${resolvedItemId}, 'Artigo Genérico', ${GENERIC_PN}, 0, 0, 0, 0, false, false, NOW(), NOW())
        `
      }
      resolvedItemName = 'Artigo Genérico'
      resolvedPartNumber = GENERIC_PN
      resolvedTracksSerialNumbers = false
    } else {
      const item = await prisma.warehouseItem.findUnique({
        where: { id: warehouseItemId },
        select: { id: true, itemName: true, partNumber: true, tracksSerialNumbers: true },
      })
      if (!item) return NextResponse.json({ error: 'Warehouse item not found' }, { status: 404 })
      resolvedItemName = item.itemName
      resolvedPartNumber = item.partNumber
      resolvedTracksSerialNumbers = item.tracksSerialNumbers
    }

    const sn = serialNumber?.trim() || null
    const fd = faultDescription?.trim() || null
    const clientItemSnVal = rawClientItemSn?.trim() || null
    const isPreSwapped = preSwapped === true

    const creator = await prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true } })

    // For preSwapped + known SN: UPDATE the existing tech stock entry instead of inserting
    // (avoids unique constraint on itemId+serialNumber and correctly marks that SN as given to client)
    if (isPreSwapped && sn) {
      const existing = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "SerialNumberStock"
        WHERE "itemId" = ${resolvedItemId}
          AND "serialNumber" = ${sn}
          AND "technicianId" = ${resolvedTechId}
          AND location = 'TECHNICIAN'
          AND "isClientPart" = false
        LIMIT 1
      `
      if (existing.length > 0) {
        const existingId = existing[0].id
        await prisma.$executeRaw`
          UPDATE "SerialNumberStock"
          SET location = 'CLIENT_WAREHOUSE',
              "isClientPart" = true,
              "clientPartStatus" = 'IN_TRANSIT',
              "preSwapped" = true,
              "interventionId" = ${interventionId},
              "workOrderId" = ${workOrderId},
              "pickedUpById" = ${payload.userId},
              "faultDescription" = ${fd},
              "clientItemSn" = ${clientItemSnVal},
              "updatedAt" = NOW()
          WHERE id = ${existingId}
        `
        await prisma.$executeRaw`
          UPDATE "TechnicianStock"
          SET quantity = quantity - 1, "updatedAt" = NOW()
          WHERE "itemId" = ${resolvedItemId} AND "technicianId" = ${resolvedTechId}
        `
        await prisma.itemMovement.create({
          data: {
            itemId: resolvedItemId,
            movementType: 'USE',
            quantity: 1,
            fromUserId: resolvedTechId,
            notes: `Sub. imediata — entregue ao cliente${fd ? `: ${fd}` : ''}${sn ? ` (SN: ${sn})` : ''}`,
            createdById: payload.userId,
          },
        })
        return NextResponse.json({
          id: existingId,
          serialNumber: sn,
          clientItemSn: clientItemSnVal,
          faultDescription: fd,
          itemId: resolvedItemId,
          itemName: resolvedItemName,
          partNumber: resolvedPartNumber,
          preSwapped: true,
          workOrderId,
          createdAt: new Date(),
          location: 'CLIENT_WAREHOUSE',
          pickedUpByName: creator?.name ?? null,
        }, { status: 201 })
      }
    }

    // Default: INSERT new record
    const snId = randomUUID()
    const clientPartStatus = 'IN_TRANSIT'

    await prisma.$executeRaw`
      INSERT INTO "SerialNumberStock" (
        id, "itemId", "serialNumber", "faultDescription",
        location, "technicianId", status,
        "isClientPart", "clientPartStatus",
        "interventionId", "workOrderId",
        "preSwapped", "clientItemSn", "pickedUpById",
        "createdAt", "updatedAt"
      )
      VALUES (
        ${snId}, ${resolvedItemId}, ${sn}, ${fd},
        'CLIENT_WAREHOUSE', ${resolvedTechId}, 'AVAILABLE',
        true, ${clientPartStatus}::"ClientPartStatus",
        ${interventionId}, ${workOrderId},
        ${isPreSwapped}, ${clientItemSnVal}, ${payload.userId},
        NOW(), NOW()
      )
    `

    if (isPreSwapped) {
      // Decrement TechnicianStock for non-SN items — SN items are decremented in the UPDATE path above
      if (!resolvedTracksSerialNumbers) {
        await prisma.$executeRaw`
          UPDATE "TechnicianStock"
          SET quantity = quantity - 1, "updatedAt" = NOW()
          WHERE "itemId" = ${resolvedItemId} AND "technicianId" = ${resolvedTechId} AND quantity > 0
        `
      }
      await prisma.itemMovement.create({
        data: {
          itemId: resolvedItemId,
          movementType: 'USE',
          quantity: 1,
          fromUserId: resolvedTechId,
          notes: `Sub. imediata — entregue ao cliente${fd ? `: ${fd}` : ''}${sn ? ` (SN: ${sn})` : ''}`,
          createdById: payload.userId,
        },
      })
    } else {
      await prisma.itemMovement.create({
        data: {
          itemId: resolvedItemId,
          movementType: 'TRANSFER_FROM_TECH',
          quantity: 1,
          fromUserId: resolvedTechId,
          notes: `Recolha de peça avariada de cliente${fd ? `: ${fd}` : ''}${sn ? ` (SN: ${sn})` : ''}`,
          createdById: payload.userId,
        },
      })
    }

    return NextResponse.json({
      id: snId,
      serialNumber: sn,
      clientItemSn: clientItemSnVal,
      faultDescription: fd,
      itemId: resolvedItemId,
      itemName: resolvedItemName,
      partNumber: resolvedPartNumber,
      preSwapped: isPreSwapped,
      workOrderId,
      createdAt: new Date(),
      location: 'CLIENT_WAREHOUSE',
      pickedUpByName: creator?.name ?? null,
    }, { status: 201 })
  } catch (error) {
    console.error('Error adding WO client part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
