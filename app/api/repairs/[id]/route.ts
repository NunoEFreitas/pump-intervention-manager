import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!verifyToken(token || '')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const [job] = await prisma.$queryRaw<any[]>`
      SELECT
        j.id, j.reference, j."itemId", j."serialNumberId", j.quantity, j.status,
        j.problem, j."workNotes",
        j."sentAt", j."completedAt", j."deliveredToClientId",
        j."sentById", j."completedById", j."createdAt", j."updatedAt",
        wi."itemName", wi."partNumber", wi."tracksSerialNumbers",
        wi."mainWarehouse", wi."repairStock",
        sn."serialNumber" AS "snNumber",
        sb.name AS "sentByName",
        cb.name AS "completedByName",
        cl.name AS "clientName"
      FROM "PartRepairJob" j
      JOIN "WarehouseItem" wi ON wi.id = j."itemId"
      LEFT JOIN "SerialNumberStock" sn ON sn.id = j."serialNumberId"
      LEFT JOIN "User" sb ON sb.id = j."sentById"
      LEFT JOIN "User" cb ON cb.id = j."completedById"
      LEFT JOIN "Client" cl ON cl.id = j."deliveredToClientId"
      WHERE j.id = ${id}
    `

    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(job)
  } catch (error) {
    console.error('Error fetching repair job:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const payload = verifyToken(token || '')
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const data = await request.json()
    const now = new Date()

    // Fetch current job state
    const [job] = await prisma.$queryRaw<any[]>`
      SELECT j.*, wi."tracksSerialNumbers", wi."repairStock", wi."mainWarehouse"
      FROM "PartRepairJob" j
      JOIN "WarehouseItem" wi ON wi.id = j."itemId"
      WHERE j.id = ${id}
    `
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // ── START REPAIR ────────────────────────────────────────────────────────
    if (data.action === 'start') {
      await prisma.$executeRaw`
        UPDATE "PartRepairJob" SET status = 'IN_REPAIR', "updatedAt" = ${now}::timestamptz WHERE id = ${id}
      `
      return NextResponse.json({ ok: true })
    }

    // ── RETURN TO STOCK ─────────────────────────────────────────────────────
    if (data.action === 'return_to_stock') {
      if (job.tracksSerialNumbers && job.serialNumberId) {
        await prisma.$executeRaw`
          UPDATE "SerialNumberStock"
          SET location = 'MAIN_WAREHOUSE', status = 'AVAILABLE', "updatedAt" = ${now}::timestamptz
          WHERE id = ${job.serialNumberId}
        `
      }
      await prisma.$executeRaw`
        UPDATE "WarehouseItem"
        SET "repairStock" = "repairStock" - ${job.quantity},
            "mainWarehouse" = "mainWarehouse" + ${job.quantity},
            "updatedAt" = ${now}::timestamptz
        WHERE id = ${job.itemId}
      `
      const movId = crypto.randomUUID()
      const repairOutNote = job.reference
        ? (data.workNotes ? `[${job.reference}] ${data.workNotes}` : `[${job.reference}]`)
        : (data.workNotes || null)
      await prisma.$executeRaw`
        INSERT INTO "ItemMovement" (id, "itemId", "movementType", quantity, notes, "createdById", "createdAt")
        VALUES (${movId}, ${job.itemId}, 'REPAIR_OUT', ${job.quantity}, ${repairOutNote}, ${payload.userId}, ${now}::timestamptz)
      `
      if (job.serialNumberId) {
        await prisma.$executeRaw`
          INSERT INTO "MovementSerialNumber" (id, "movementId", "serialNumberId")
          VALUES (${crypto.randomUUID()}, ${movId}, ${job.serialNumberId})
        `
      }
      await prisma.$executeRaw`
        UPDATE "PartRepairJob"
        SET status = 'REPAIRED', "workNotes" = ${data.workNotes || job.workNotes || null},
            "completedAt" = ${now}::timestamptz, "completedById" = ${payload.userId},
            "updatedAt" = ${now}::timestamptz
        WHERE id = ${id}
      `
      return NextResponse.json({ ok: true })
    }

    // ── SEND TO CLIENT ───────────────────────────────────────────────────────
    if (data.action === 'deliver_to_client') {
      if (!data.clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

      if (job.tracksSerialNumbers && job.serialNumberId) {
        await prisma.$executeRaw`
          UPDATE "SerialNumberStock"
          SET location = 'USED', status = 'IN_USE', "updatedAt" = ${now}::timestamptz
          WHERE id = ${job.serialNumberId}
        `
      }
      await prisma.$executeRaw`
        UPDATE "WarehouseItem"
        SET "repairStock" = "repairStock" - ${job.quantity},
            "updatedAt" = ${now}::timestamptz
        WHERE id = ${job.itemId}
      `
      const movId = crypto.randomUUID()
      await prisma.$executeRaw`
        INSERT INTO "ItemMovement" (id, "itemId", "movementType", quantity, notes, "createdById", "createdAt")
        VALUES (${movId}, ${job.itemId}, 'REMOVE_STOCK', ${job.quantity}, ${'Enviado para cliente após reparação'}, ${payload.userId}, ${now}::timestamptz)
      `
      await prisma.$executeRaw`
        UPDATE "PartRepairJob"
        SET status = 'DELIVERED_CLIENT', "workNotes" = ${data.workNotes || job.workNotes || null},
            "deliveredToClientId" = ${data.clientId},
            "completedAt" = ${now}::timestamptz, "completedById" = ${payload.userId},
            "updatedAt" = ${now}::timestamptz
        WHERE id = ${id}
      `
      return NextResponse.json({ ok: true })
    }

    // ── WRITE OFF ────────────────────────────────────────────────────────────
    if (data.action === 'write_off') {
      if (job.tracksSerialNumbers && job.serialNumberId) {
        await prisma.$executeRaw`
          UPDATE "SerialNumberStock"
          SET status = 'DAMAGED', location = 'USED', "updatedAt" = ${now}::timestamptz
          WHERE id = ${job.serialNumberId}
        `
      }
      await prisma.$executeRaw`
        UPDATE "WarehouseItem"
        SET "repairStock" = "repairStock" - ${job.quantity}, "updatedAt" = ${now}::timestamptz
        WHERE id = ${job.itemId}
      `
      await prisma.$executeRaw`
        UPDATE "PartRepairJob"
        SET status = 'WRITTEN_OFF', "workNotes" = ${data.workNotes || job.workNotes || null},
            "completedAt" = ${now}::timestamptz, "completedById" = ${payload.userId},
            "updatedAt" = ${now}::timestamptz
        WHERE id = ${id}
      `
      return NextResponse.json({ ok: true })
    }

    // ── SAVE NOTES ────────────────────────────────────────────────────────────
    if ('workNotes' in data) {
      await prisma.$executeRaw`
        UPDATE "PartRepairJob" SET "workNotes" = ${data.workNotes || null}, "updatedAt" = ${now}::timestamptz WHERE id = ${id}
      `
    }
    if ('problem' in data) {
      await prisma.$executeRaw`
        UPDATE "PartRepairJob" SET problem = ${data.problem || null}, "updatedAt" = ${now}::timestamptz WHERE id = ${id}
      `
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error updating repair job:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
