import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { generateRepairReference, generateClientRepairReference } from '@/lib/reference'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!verifyToken(token || '')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // PENDING | IN_REPAIR | QUOTE | REPAIRED | NOT_REPAIRED | WRITTEN_OFF | RETURNED_TO_CLIENT | ACTIVE | ALL

    const ALLOWED_STATUSES = ['PENDING', 'IN_REPAIR', 'QUOTE', 'OVM', 'REPAIRED', 'NOT_REPAIRED', 'WRITTEN_OFF', 'RETURNED_TO_CLIENT'] as const
    type ValidStatus = typeof ALLOWED_STATUSES[number]

    let jobs: any[]

    if (!status || status === 'ACTIVE') {
      jobs = await prisma.$queryRaw<any[]>`
        SELECT
          j.id, j.reference, j.type, j."itemId", j."serialNumberId", j.quantity, j.status,
          j.problem, j."workNotes",
          j."sentAt", j."completedAt", j."deliveredToClientId",
          j."sentById", j."completedById", j."createdAt", j."updatedAt",
          wi."itemName", wi."partNumber", wi."tracksSerialNumbers",
          sn."serialNumber" AS "snNumber",
          sb.name AS "sentByName",
          cb.name AS "completedByName",
          COALESCE(cl.name, icl.name) AS "clientName",
          (SELECT COUNT(*) FROM "RepairJobPhoto" p WHERE p."jobId" = j.id)::int AS "photoCount"
        FROM "PartRepairJob" j
        JOIN "WarehouseItem" wi ON wi.id = j."itemId"
        LEFT JOIN "SerialNumberStock" sn ON sn.id = j."serialNumberId"
        LEFT JOIN "User" sb ON sb.id = j."sentById"
        LEFT JOIN "User" cb ON cb.id = j."completedById"
        LEFT JOIN "Client" cl ON cl.id = j."deliveredToClientId"
        LEFT JOIN "Intervention" inv ON inv.id = j."interventionId"
        LEFT JOIN "Client" icl ON icl.id = inv."clientId"
        WHERE j.status IN ('PENDING', 'IN_REPAIR', 'QUOTE', 'OVM')
        ORDER BY
          CASE j.status WHEN 'IN_REPAIR' THEN 0 WHEN 'OVM' THEN 1 WHEN 'QUOTE' THEN 2 WHEN 'PENDING' THEN 3 ELSE 4 END,
          j."sentAt" ASC
      `
    } else if (status === 'ALL') {
      jobs = await prisma.$queryRaw<any[]>`
        SELECT
          j.id, j.reference, j.type, j."itemId", j."serialNumberId", j.quantity, j.status,
          j.problem, j."workNotes",
          j."sentAt", j."completedAt", j."deliveredToClientId",
          j."sentById", j."completedById", j."createdAt", j."updatedAt",
          wi."itemName", wi."partNumber", wi."tracksSerialNumbers",
          sn."serialNumber" AS "snNumber",
          sb.name AS "sentByName",
          cb.name AS "completedByName",
          COALESCE(cl.name, icl.name) AS "clientName",
          (SELECT COUNT(*) FROM "RepairJobPhoto" p WHERE p."jobId" = j.id)::int AS "photoCount"
        FROM "PartRepairJob" j
        JOIN "WarehouseItem" wi ON wi.id = j."itemId"
        LEFT JOIN "SerialNumberStock" sn ON sn.id = j."serialNumberId"
        LEFT JOIN "User" sb ON sb.id = j."sentById"
        LEFT JOIN "User" cb ON cb.id = j."completedById"
        LEFT JOIN "Client" cl ON cl.id = j."deliveredToClientId"
        LEFT JOIN "Intervention" inv ON inv.id = j."interventionId"
        LEFT JOIN "Client" icl ON icl.id = inv."clientId"
        ORDER BY
          CASE j.status WHEN 'IN_REPAIR' THEN 0 WHEN 'PENDING' THEN 1 ELSE 2 END,
          j."sentAt" ASC
      `
    } else if (ALLOWED_STATUSES.includes(status as ValidStatus)) {
      jobs = await prisma.$queryRaw<any[]>`
        SELECT
          j.id, j.reference, j.type, j."itemId", j."serialNumberId", j.quantity, j.status,
          j.problem, j."workNotes",
          j."sentAt", j."completedAt", j."deliveredToClientId",
          j."sentById", j."completedById", j."createdAt", j."updatedAt",
          wi."itemName", wi."partNumber", wi."tracksSerialNumbers",
          sn."serialNumber" AS "snNumber",
          sb.name AS "sentByName",
          cb.name AS "completedByName",
          COALESCE(cl.name, icl.name) AS "clientName",
          (SELECT COUNT(*) FROM "RepairJobPhoto" p WHERE p."jobId" = j.id)::int AS "photoCount"
        FROM "PartRepairJob" j
        JOIN "WarehouseItem" wi ON wi.id = j."itemId"
        LEFT JOIN "SerialNumberStock" sn ON sn.id = j."serialNumberId"
        LEFT JOIN "User" sb ON sb.id = j."sentById"
        LEFT JOIN "User" cb ON cb.id = j."completedById"
        LEFT JOIN "Client" cl ON cl.id = j."deliveredToClientId"
        LEFT JOIN "Intervention" inv ON inv.id = j."interventionId"
        LEFT JOIN "Client" icl ON icl.id = inv."clientId"
        WHERE j.status = ${status}
        ORDER BY
          CASE j.status WHEN 'IN_REPAIR' THEN 0 WHEN 'PENDING' THEN 1 ELSE 2 END,
          j."sentAt" ASC
      `
    } else {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
    }

    return NextResponse.json(jobs)
  } catch (error) {
    console.error('Error fetching repair jobs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const payload = verifyToken(token || '')
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { type, itemId, clientId, locationId, problem, serialNumberId, conditionDescription, hasAccessories, accessoriesDescription, clientItemSn } = await request.json()

    if (!type || !itemId || !problem?.trim()) {
      return NextResponse.json({ error: 'Campos obrigatórios em falta' }, { status: 400 })
    }
    if (type !== 'STOCK' && type !== 'CLIENT') {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    }

    const now = new Date()

    const [item] = await prisma.$queryRaw<any[]>`
      SELECT id, "itemName", "mainWarehouse", "repairStock", "tracksSerialNumbers"
      FROM "WarehouseItem" WHERE id = ${itemId}
    `
    if (!item) return NextResponse.json({ error: 'Artigo não encontrado' }, { status: 404 })

    const repairJobId = crypto.randomUUID()

    if (type === 'STOCK') {
      if (item.tracksSerialNumbers) {
        if (!serialNumberId) {
          return NextResponse.json({ error: 'Deve selecionar o número de série' }, { status: 400 })
        }
        const [sn] = await prisma.$queryRaw<any[]>`
          SELECT id FROM "SerialNumberStock"
          WHERE id = ${serialNumberId} AND "itemId" = ${itemId}
            AND location = 'MAIN_WAREHOUSE' AND status = 'AVAILABLE' AND "isClientPart" = false
        `
        if (!sn) return NextResponse.json({ error: 'Número de série inválido ou indisponível' }, { status: 400 })
      } else {
        if (item.mainWarehouse < 1) return NextResponse.json({ error: 'Sem stock disponível no armazém principal' }, { status: 400 })
      }

      const repairRef = await generateRepairReference()

      await prisma.$executeRaw`
        UPDATE "WarehouseItem"
        SET "mainWarehouse" = "mainWarehouse" - 1,
            "repairStock" = "repairStock" + 1,
            "updatedAt" = ${now}::timestamptz
        WHERE id = ${itemId}
      `

      const movId = crypto.randomUUID()
      await prisma.$executeRaw`
        INSERT INTO "ItemMovement" (id, "itemId", "movementType", quantity, notes, "createdById", "createdAt")
        VALUES (${movId}, ${itemId}, 'REPAIR_IN', 1, ${`[${repairRef}] ${problem.trim()}`}, ${payload.userId}, ${now}::timestamptz)
      `

      const condDesc = conditionDescription?.trim() || null
      const hasAcc: boolean = !!hasAccessories
      const accDesc = accessoriesDescription?.trim() || null
      const locId = locationId || null

      if (item.tracksSerialNumbers && serialNumberId) {
        await prisma.$executeRaw`
          UPDATE "SerialNumberStock"
          SET location = 'REPAIR', "updatedAt" = ${now}::timestamptz
          WHERE id = ${serialNumberId}
        `
        await prisma.$executeRaw`
          INSERT INTO "MovementSerialNumber" (id, "movementId", "serialNumberId")
          VALUES (${crypto.randomUUID()}, ${movId}, ${serialNumberId})
        `
        await prisma.$executeRaw`
          INSERT INTO "PartRepairJob" (id, reference, type, "itemId", "serialNumberId", "locationId", quantity, status, problem, "conditionDescription", "hasAccessories", "accessoriesDescription", "sentById", "sentAt", "createdAt", "updatedAt")
          VALUES (${repairJobId}, ${repairRef}, 'STOCK', ${itemId}, ${serialNumberId}, ${locId}, 1, 'PENDING', ${problem.trim()}, ${condDesc}, ${hasAcc}, ${accDesc}, ${payload.userId}, ${now}::timestamptz, ${now}::timestamptz, ${now}::timestamptz)
        `
      } else {
        await prisma.$executeRaw`
          INSERT INTO "PartRepairJob" (id, reference, type, "itemId", "locationId", quantity, status, problem, "conditionDescription", "hasAccessories", "accessoriesDescription", "sentById", "sentAt", "createdAt", "updatedAt")
          VALUES (${repairJobId}, ${repairRef}, 'STOCK', ${itemId}, ${locId}, 1, 'PENDING', ${problem.trim()}, ${condDesc}, ${hasAcc}, ${accDesc}, ${payload.userId}, ${now}::timestamptz, ${now}::timestamptz, ${now}::timestamptz)
        `
      }

      await prisma.$executeRaw`
        INSERT INTO "RepairHistory" (id, "jobId", "eventType", description, "performedById", "performedAt")
        VALUES (${crypto.randomUUID()}, ${repairJobId}, 'CREATED', ${`Reparação criada — ${item.itemName} (${repairRef})`}, ${payload.userId}, ${now}::timestamptz)
      `

      return NextResponse.json({ ok: true, repairJobId, reference: repairRef })
    } else {
      // CLIENT type — no stock movement
      const repairRef = await generateClientRepairReference()
      const resolvedClientId = clientId || null
      const condDesc = conditionDescription?.trim() || null
      const hasAcc: boolean = !!hasAccessories
      const accDesc = accessoriesDescription?.trim() || null
      const clientSn = clientItemSn?.trim() || null

      const locId = locationId || null
      await prisma.$executeRaw`
        INSERT INTO "PartRepairJob" (id, reference, type, "itemId", "locationId", quantity, status, problem, "conditionDescription", "hasAccessories", "accessoriesDescription", "clientItemSn", "deliveredToClientId", "sentById", "sentAt", "createdAt", "updatedAt")
        VALUES (${repairJobId}, ${repairRef}, 'CLIENT', ${itemId}, ${locId}, 1, 'PENDING', ${problem.trim()}, ${condDesc}, ${hasAcc}, ${accDesc}, ${clientSn}, ${resolvedClientId}, ${payload.userId}, ${now}::timestamptz, ${now}::timestamptz, ${now}::timestamptz)
      `

      await prisma.$executeRaw`
        INSERT INTO "RepairHistory" (id, "jobId", "eventType", description, "performedById", "performedAt")
        VALUES (${crypto.randomUUID()}, ${repairJobId}, 'CREATED', ${`Reparação criada — ${item.itemName} (${repairRef})`}, ${payload.userId}, ${now}::timestamptz)
      `

      return NextResponse.json({ ok: true, repairJobId, reference: repairRef })
    }
  } catch (error) {
    console.error('Error creating repair job:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
