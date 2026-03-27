import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { generateClientRepairReference } from '@/lib/reference'

// POST — open a CLIENT repair job for the client part
//   1. Generate REC-xxx reference
//   2. Create PartRepairJob with type=CLIENT linked to this serial number
//   3. Mark clientPartStatus = REPAIR
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const payload = verifyToken(token || '')
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: serialNumberId } = await params
    const body = await request.json()
    const { problem } = body

    const now = new Date()

    // Fetch the client part
    const [clientPart] = await prisma.$queryRaw<any[]>`
      SELECT sn.id, sn."itemId", sn."technicianId", sn."interventionId", sn."clientPartStatus", sn."serialNumber", sn.location,
             wi."itemName", wi."partNumber"
      FROM "SerialNumberStock" sn
      JOIN "WarehouseItem" wi ON wi.id = sn."itemId"
      WHERE sn.id = ${serialNumberId} AND sn."isClientPart" = true
    `
    if (!clientPart) return NextResponse.json({ error: 'Client part not found' }, { status: 404 })
    if (clientPart.clientPartStatus === 'REPAIR' || clientPart.clientPartStatus === 'RESOLVED') {
      return NextResponse.json({ error: 'Client part already has an active repair or is resolved' }, { status: 400 })
    }

    // Generate REC reference
    const repairRef = await generateClientRepairReference()

    // Create CLIENT repair job
    const repairJobId = crypto.randomUUID()
    await prisma.$executeRaw`
      INSERT INTO "PartRepairJob" (id, reference, type, "itemId", "serialNumberId", "clientPartId", "interventionId", quantity, status, problem, "sentById", "sentAt", "createdAt", "updatedAt")
      VALUES (
        ${repairJobId},
        ${repairRef},
        'CLIENT',
        ${clientPart.itemId},
        ${serialNumberId},
        ${serialNumberId},
        ${clientPart.interventionId || null},
        1,
        'PENDING',
        ${problem || null},
        ${payload.userId},
        ${now}::timestamptz,
        ${now}::timestamptz,
        ${now}::timestamptz
      )
    `

    // Update serial number: mark as in repair, link repair job
    await prisma.$executeRaw`
      UPDATE "SerialNumberStock"
      SET location = 'REPAIR',
          "clientPartStatus" = 'REPAIR',
          "clientRepairJobId" = ${repairJobId},
          "updatedAt" = ${now}::timestamptz
      WHERE id = ${serialNumberId}
    `

    // Part leaves technician's possession — decrement their stock count
    if (clientPart.technicianId) {
      await prisma.$executeRaw`
        UPDATE "TechnicianStock"
        SET quantity = quantity - 1, "updatedAt" = ${now}::timestamptz
        WHERE "itemId" = ${clientPart.itemId} AND "technicianId" = ${clientPart.technicianId}
      `
    }

    return NextResponse.json({ ok: true, repairReference: repairRef, repairJobId })
  } catch (error) {
    console.error('Error opening client repair:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
