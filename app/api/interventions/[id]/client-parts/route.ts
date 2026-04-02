import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { randomUUID } from 'crypto'

// GET client parts logged for this intervention
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: interventionId } = await params

    const parts = await prisma.$queryRaw<Array<{
      id: string
      serialNumber: string | null
      faultDescription: string | null
      clientPartStatus: string | null
      repairReference: string | null
      repairStatus: string | null
      itemId: string
      itemName: string
      partNumber: string
      createdAt: Date
      location: string
      pickedUpByName: string | null
      technicianName: string | null
      returnedToClientAt: Date | null
      returnedByName: string | null
      returnedRegisteredByName: string | null
      receivedAtWarehouseAt: Date | null
      receivedAtWarehouseByName: string | null
      sentOutAt: Date | null
      sentOutByName: string | null
      sentOutTechnicianName: string | null
    }>>`
      SELECT sn.id, sn."serialNumber", sn."faultDescription", sn."clientPartStatus",
             sn."preSwapped",
             rj.reference AS "repairReference", rj.status AS "repairStatus",
             sn."itemId", wi."itemName", wi."partNumber",
             sn."createdAt", sn."returnedToClientAt", sn."receivedAtWarehouseAt", sn."sentOutAt", sn.location,
             u.name AS "pickedUpByName",
             tech.name AS "technicianName",
             ru.name AS "returnedByName",
             rr.name AS "returnedRegisteredByName",
             rcv.name AS "receivedAtWarehouseByName",
             so.name AS "sentOutByName",
             sot.name AS "sentOutTechnicianName"
      FROM "SerialNumberStock" sn
      JOIN "WarehouseItem" wi ON wi.id = sn."itemId"
      LEFT JOIN "User" u ON u.id = sn."pickedUpById"
      LEFT JOIN "User" tech ON tech.id = sn."technicianId"
      LEFT JOIN "User" ru ON ru.id = sn."returnedToClientById"
      LEFT JOIN "User" rr ON rr.id = sn."returnedToClientRegisteredById"
      LEFT JOIN "User" rcv ON rcv.id = sn."receivedAtWarehouseById"
      LEFT JOIN "User" so ON so.id = sn."sentOutById"
      LEFT JOIN "User" sot ON sot.id = sn."sentOutTechnicianId"
      LEFT JOIN "PartRepairJob" rj ON rj.id = sn."clientRepairJobId"
      WHERE sn."interventionId" = ${interventionId}
      ORDER BY sn."createdAt" ASC
    `

    return NextResponse.json(parts)
  } catch (error) {
    console.error('Error fetching client parts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST log a client part taken from the client site into the tech's stock
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
    const { warehouseItemId, serialNumber, faultDescription, technicianId: requestedTechId } = await request.json()

    if (!warehouseItemId) {
      return NextResponse.json({ error: 'Warehouse item is required' }, { status: 400 })
    }

    // Fetch intervention
    const intervention = await prisma.intervention.findUnique({
      where: { id: interventionId },
      select: {
        id: true,
        assignedToId: true,
      },
    })

    if (!intervention) {
      return NextResponse.json({ error: 'Intervention not found' }, { status: 404 })
    }

    // Fetch requester role
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true },
    })

    // Verify requester is the assigned tech or admin/supervisor
    if (user?.role === 'TECHNICIAN' && payload.userId !== intervention.assignedToId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Resolve which technician receives the part
    // Non-technician users may override; technicians always use the assigned technician
    const resolvedTechId = user?.role === 'TECHNICIAN'
      ? intervention.assignedToId
      : (requestedTechId || intervention.assignedToId)

    if (!resolvedTechId) {
      return NextResponse.json({ error: 'Nenhum técnico selecionado ou atribuído à intervenção' }, { status: 400 })
    }

    const GENERIC_PN = '__GENERIC__'

    // Resolve item: support special '__GENERIC__' placeholder for uncatalogued parts
    let resolvedItemId = warehouseItemId
    let resolvedItemName = ''
    let resolvedPartNumber = ''
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
    } else {
      const warehouseItem = await prisma.warehouseItem.findUnique({
        where: { id: warehouseItemId },
        select: { id: true, itemName: true, partNumber: true },
      })
      if (!warehouseItem) {
        return NextResponse.json({ error: 'Warehouse item not found' }, { status: 404 })
      }
      resolvedItemName = warehouseItem.itemName
      resolvedPartNumber = warehouseItem.partNumber
    }

    const sn = serialNumber?.trim() || null
    const fd = faultDescription?.trim() || null
    const snId = randomUUID()

    // Create SerialNumberStock in CLIENT_WAREHOUSE — no technician stock impact
    await prisma.$executeRaw`
      INSERT INTO "SerialNumberStock" (id, "itemId", "serialNumber", "faultDescription", location, "technicianId", status, "isClientPart", "clientPartStatus", "interventionId", "pickedUpById", "createdAt", "updatedAt")
      VALUES (${snId}, ${resolvedItemId}, ${sn}, ${fd}, 'CLIENT_WAREHOUSE', ${resolvedTechId}, 'AVAILABLE', true, 'IN_TRANSIT', ${interventionId}, ${payload.userId}, NOW(), NOW())
    `

    const creator = await prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true } })
    const result = {
      id: snId,
      serialNumber: sn,
      faultDescription: fd,
      itemId: resolvedItemId,
      itemName: resolvedItemName,
      partNumber: resolvedPartNumber,
      createdAt: new Date(),
      location: 'CLIENT_WAREHOUSE',
      pickedUpByName: creator?.name ?? null,
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error adding client part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
