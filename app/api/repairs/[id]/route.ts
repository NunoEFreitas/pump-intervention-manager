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
        j.id, j.reference, j.type, j."itemId", j."serialNumberId", j."clientPartId",
        j."interventionId",
        j.quantity, j.status, j.problem, j."clientItemSn", j."workNotes",
        j."conditionDescription", j."hasAccessories", j."accessoriesDescription",
        j."repairedByTechId",
        j."quoteAmount", j."quoteNotes", j."quoteStatus", j."quotedAt",
        j."sentAt", j."completedAt", j."deliveredToClientId",
        j."sentById", j."completedById", j."createdAt", j."updatedAt",
        wi."itemName", wi."partNumber", wi."tracksSerialNumbers", wi."snExample",
        wi."mainWarehouse", wi."repairStock", wi."destructionStock",
        sn."serialNumber" AS "snNumber",
        sb.name AS "sentByName",
        cb.name AS "completedByName",
        COALESCE(cl.name, icl.name) AS "clientName",
        COALESCE(cl.phone, icl.phone) AS "clientPhone",
        COALESCE(cl.email, icl.email) AS "clientEmail",
        COALESCE(cl."vatNumber", icl."vatNumber") AS "clientVat",
        rt.name AS "repairedByTechName",
        inv.reference AS "interventionReference"
      FROM "PartRepairJob" j
      JOIN "WarehouseItem" wi ON wi.id = j."itemId"
      LEFT JOIN "SerialNumberStock" sn ON sn.id = j."serialNumberId"
      LEFT JOIN "User" sb ON sb.id = j."sentById"
      LEFT JOIN "User" cb ON cb.id = j."completedById"
      LEFT JOIN "Client" cl ON cl.id = j."deliveredToClientId"
      LEFT JOIN "User" rt ON rt.id = j."repairedByTechId"
      LEFT JOIN "Intervention" inv ON inv.id = j."interventionId"
      LEFT JOIN "Client" icl ON icl.id = inv."clientId"
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

    const [job] = await prisma.$queryRaw<any[]>`
      SELECT j.*, wi."tracksSerialNumbers", wi."repairStock", wi."mainWarehouse", wi."destructionStock",
             sn."isClientPart" AS "snIsClientPart"
      FROM "PartRepairJob" j
      JOIN "WarehouseItem" wi ON wi.id = j."itemId"
      LEFT JOIN "SerialNumberStock" sn ON sn.id = j."serialNumberId"
      WHERE j.id = ${id}
    `
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // ── START REPAIR ────────────────────────────────────────────────────────
    if (data.action === 'start') {
      if (job.status !== 'PENDING') return NextResponse.json({ error: 'Reparação não está em estado Criada' }, { status: 400 })
      await prisma.$executeRaw`
        UPDATE "PartRepairJob" SET status = 'IN_REPAIR', "updatedAt" = ${now}::timestamptz WHERE id = ${id}
      `
      return NextResponse.json({ ok: true })
    }

    // ── RETURN TO STOCK (STOCK type only, from IN_REPAIR) ───────────────────
    if (data.action === 'return_to_stock') {
      if (job.type === 'CLIENT') return NextResponse.json({ error: 'Apenas para reparações de stock' }, { status: 400 })
      if (job.status !== 'IN_REPAIR') return NextResponse.json({ error: 'Reparação não está Em Progresso' }, { status: 400 })

      // Client part SNs are not tracked in repairStock — only update mainWarehouse
      const isClientPartSwap = job.snIsClientPart === true
      if (job.serialNumberId) {
        await prisma.$executeRaw`
          UPDATE "SerialNumberStock"
          SET location = 'MAIN_WAREHOUSE', status = 'AVAILABLE',
              "clientPartStatus" = CASE WHEN "isClientPart" = true THEN 'RESOLVED' ELSE "clientPartStatus" END,
              "updatedAt" = ${now}::timestamptz
          WHERE id = ${job.serialNumberId}
        `
      }
      if (isClientPartSwap) {
        await prisma.$executeRaw`
          UPDATE "WarehouseItem"
          SET "mainWarehouse" = "mainWarehouse" + ${job.quantity},
              "updatedAt" = ${now}::timestamptz
          WHERE id = ${job.itemId}
        `
      } else {
        await prisma.$executeRaw`
          UPDATE "WarehouseItem"
          SET "repairStock" = "repairStock" - ${job.quantity},
              "mainWarehouse" = "mainWarehouse" + ${job.quantity},
              "updatedAt" = ${now}::timestamptz
          WHERE id = ${job.itemId}
        `
      }
      const movId = crypto.randomUUID()
      const note = job.reference
        ? (data.workNotes ? `[${job.reference}] ${data.workNotes}` : `[${job.reference}]`)
        : (data.workNotes || null)
      await prisma.$executeRaw`
        INSERT INTO "ItemMovement" (id, "itemId", "movementType", quantity, notes, "createdById", "createdAt")
        VALUES (${movId}, ${job.itemId}, 'REPAIR_OUT', ${job.quantity}, ${note}, ${payload.userId}, ${now}::timestamptz)
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

    // ── SEND TO DESTRUCTION (STOCK type only, from IN_REPAIR) ───────────────
    if (data.action === 'send_to_destruction') {
      if (job.type === 'CLIENT') return NextResponse.json({ error: 'Apenas para reparações de stock' }, { status: 400 })
      if (job.status !== 'IN_REPAIR') return NextResponse.json({ error: 'Reparação não está Em Progresso' }, { status: 400 })

      const isClientPartSwapD = job.snIsClientPart === true
      if (job.serialNumberId) {
        await prisma.$executeRaw`
          UPDATE "SerialNumberStock"
          SET location = 'DESTRUCTION', status = 'DAMAGED',
              "clientPartStatus" = CASE WHEN "isClientPart" = true THEN 'RESOLVED' ELSE "clientPartStatus" END,
              "updatedAt" = ${now}::timestamptz
          WHERE id = ${job.serialNumberId}
        `
      }
      if (isClientPartSwapD) {
        await prisma.$executeRaw`
          UPDATE "WarehouseItem"
          SET "destructionStock" = "destructionStock" + ${job.quantity},
              "updatedAt" = ${now}::timestamptz
          WHERE id = ${job.itemId}
        `
      } else {
        await prisma.$executeRaw`
          UPDATE "WarehouseItem"
          SET "repairStock" = "repairStock" - ${job.quantity},
              "destructionStock" = "destructionStock" + ${job.quantity},
              "updatedAt" = ${now}::timestamptz
          WHERE id = ${job.itemId}
        `
      }
      const movId = crypto.randomUUID()
      const note = job.reference
        ? (data.workNotes ? `[${job.reference}] ${data.workNotes}` : `[${job.reference}] Enviado para destruição`)
        : (data.workNotes || 'Enviado para destruição')
      await prisma.$executeRaw`
        INSERT INTO "ItemMovement" (id, "itemId", "movementType", quantity, notes, "createdById", "createdAt")
        VALUES (${movId}, ${job.itemId}, 'DESTRUCTION', ${job.quantity}, ${note}, ${payload.userId}, ${now}::timestamptz)
      `
      if (job.serialNumberId) {
        await prisma.$executeRaw`
          INSERT INTO "MovementSerialNumber" (id, "movementId", "serialNumberId")
          VALUES (${crypto.randomUUID()}, ${movId}, ${job.serialNumberId})
        `
      }
      await prisma.$executeRaw`
        UPDATE "PartRepairJob"
        SET status = 'WRITTEN_OFF', "workNotes" = ${data.workNotes || job.workNotes || null},
            "completedAt" = ${now}::timestamptz, "completedById" = ${payload.userId},
            "updatedAt" = ${now}::timestamptz
        WHERE id = ${id}
      `
      return NextResponse.json({ ok: true })
    }

    // ── CREATE QUOTE (CLIENT type only, from IN_REPAIR) ─────────────────────
    if (data.action === 'create_quote') {
      if (job.type !== 'CLIENT') return NextResponse.json({ error: 'Apenas para reparações de cliente' }, { status: 400 })
      if (job.status !== 'IN_REPAIR') return NextResponse.json({ error: 'Reparação não está Em Progresso' }, { status: 400 })
      const amount = parseFloat(data.quoteAmount)
      if (isNaN(amount) || amount < 0) return NextResponse.json({ error: 'Valor de orçamento inválido' }, { status: 400 })
      if (!data.quoteNotes?.trim()) return NextResponse.json({ error: 'Descrição do orçamento obrigatória' }, { status: 400 })
      await prisma.$executeRaw`
        UPDATE "PartRepairJob"
        SET status = 'QUOTE',
            "quoteAmount" = ${amount}::decimal,
            "quoteNotes" = ${data.quoteNotes.trim()},
            "quoteStatus" = 'PENDING_CLIENT',
            "quotedAt" = ${now}::timestamptz,
            "updatedAt" = ${now}::timestamptz
        WHERE id = ${id}
      `
      return NextResponse.json({ ok: true })
    }

    // ── ACCEPT QUOTE (CLIENT type only, from QUOTE) ──────────────────────────
    if (data.action === 'accept_quote') {
      if (job.status !== 'QUOTE') return NextResponse.json({ error: 'Reparação não está em estado Orçamento' }, { status: 400 })
      await prisma.$executeRaw`
        UPDATE "PartRepairJob"
        SET status = 'IN_REPAIR', "quoteStatus" = 'ACCEPTED', "updatedAt" = ${now}::timestamptz
        WHERE id = ${id}
      `
      return NextResponse.json({ ok: true })
    }

    // ── REJECT QUOTE (CLIENT type only, from QUOTE) ──────────────────────────
    if (data.action === 'reject_quote') {
      if (job.status !== 'QUOTE') return NextResponse.json({ error: 'Reparação não está em estado Orçamento' }, { status: 400 })
      await prisma.$executeRaw`
        UPDATE "PartRepairJob"
        SET status = 'NOT_REPAIRED', "quoteStatus" = 'REJECTED',
            "completedAt" = ${now}::timestamptz, "completedById" = ${payload.userId},
            "updatedAt" = ${now}::timestamptz
        WHERE id = ${id}
      `
      return NextResponse.json({ ok: true })
    }

    // ── COMPLETE REPAIRED (CLIENT type only, from IN_REPAIR) ────────────────
    if (data.action === 'complete_repaired') {
      if (job.type !== 'CLIENT') return NextResponse.json({ error: 'Apenas para reparações de cliente' }, { status: 400 })
      if (job.status !== 'IN_REPAIR') return NextResponse.json({ error: 'Reparação não está Em Progresso' }, { status: 400 })
      await prisma.$executeRaw`
        UPDATE "PartRepairJob"
        SET status = 'RETURNED_TO_CLIENT',
            "workNotes" = ${data.workNotes || job.workNotes || null},
            "completedAt" = ${now}::timestamptz, "completedById" = ${payload.userId},
            "updatedAt" = ${now}::timestamptz
        WHERE id = ${id}
      `
      return NextResponse.json({ ok: true })
    }

    // ── COMPLETE NOT REPAIRED (CLIENT type only, from IN_REPAIR) ────────────
    if (data.action === 'complete_not_repaired') {
      if (job.type !== 'CLIENT') return NextResponse.json({ error: 'Apenas para reparações de cliente' }, { status: 400 })
      if (job.status !== 'IN_REPAIR') return NextResponse.json({ error: 'Reparação não está Em Progresso' }, { status: 400 })
      await prisma.$executeRaw`
        UPDATE "PartRepairJob"
        SET status = 'NOT_REPAIRED',
            "workNotes" = ${data.workNotes || job.workNotes || null},
            "completedAt" = ${now}::timestamptz, "completedById" = ${payload.userId},
            "updatedAt" = ${now}::timestamptz
        WHERE id = ${id}
      `
      return NextResponse.json({ ok: true })
    }

    // ── SEND TO OVM (CLIENT type only, from IN_REPAIR) ───────────────────────
    if (data.action === 'send_to_ovm') {
      if (job.type !== 'CLIENT') return NextResponse.json({ error: 'Apenas para reparações de cliente' }, { status: 400 })
      if (job.status !== 'IN_REPAIR') return NextResponse.json({ error: 'Reparação não está Em Progresso' }, { status: 400 })
      await prisma.$executeRaw`
        UPDATE "PartRepairJob" SET status = 'OVM', "updatedAt" = ${now}::timestamptz WHERE id = ${id}
      `
      return NextResponse.json({ ok: true })
    }

    // ── RETURN FROM OVM — CONFORME (→ IN_REPAIR) ─────────────────────────────
    if (data.action === 'return_from_ovm') {
      if (job.type !== 'CLIENT') return NextResponse.json({ error: 'Apenas para reparações de cliente' }, { status: 400 })
      if (job.status !== 'OVM') return NextResponse.json({ error: 'Reparação não está em estado OVM' }, { status: 400 })
      await prisma.$executeRaw`
        UPDATE "PartRepairJob" SET status = 'IN_REPAIR', "updatedAt" = ${now}::timestamptz WHERE id = ${id}
      `
      return NextResponse.json({ ok: true })
    }

    // ── OVM NOT APPROVED (→ NOT_REPAIRED) ────────────────────────────────────
    if (data.action === 'ovm_not_approved') {
      if (job.type !== 'CLIENT') return NextResponse.json({ error: 'Apenas para reparações de cliente' }, { status: 400 })
      if (job.status !== 'OVM') return NextResponse.json({ error: 'Reparação não está em estado OVM' }, { status: 400 })
      await prisma.$executeRaw`
        UPDATE "PartRepairJob"
        SET status = 'NOT_REPAIRED',
            "completedAt" = ${now}::timestamptz, "completedById" = ${payload.userId},
            "updatedAt" = ${now}::timestamptz
        WHERE id = ${id}
      `
      return NextResponse.json({ ok: true })
    }

    // ── LEGACY: return_to_client alias → redirect to complete_repaired ────────
    if (data.action === 'return_to_client') {
      await prisma.$executeRaw`
        UPDATE "PartRepairJob"
        SET status = 'RETURNED_TO_CLIENT',
            "workNotes" = ${data.workNotes || job.workNotes || null},
            "completedAt" = ${now}::timestamptz, "completedById" = ${payload.userId},
            "updatedAt" = ${now}::timestamptz
        WHERE id = ${id}
      `
      return NextResponse.json({ ok: true })
    }

    // ── SAVE FIELDS ───────────────────────────────────────────────────────────
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
    if ('clientItemSn' in data) {
      await prisma.$executeRaw`
        UPDATE "PartRepairJob" SET "clientItemSn" = ${data.clientItemSn || null}, "updatedAt" = ${now}::timestamptz WHERE id = ${id}
      `
    }
    if ('conditionDescription' in data) {
      await prisma.$executeRaw`
        UPDATE "PartRepairJob" SET "conditionDescription" = ${data.conditionDescription || null}, "updatedAt" = ${now}::timestamptz WHERE id = ${id}
      `
    }
    if ('hasAccessories' in data) {
      const val: boolean = !!data.hasAccessories
      await prisma.$executeRaw`
        UPDATE "PartRepairJob" SET "hasAccessories" = ${val}, "updatedAt" = ${now}::timestamptz WHERE id = ${id}
      `
    }
    if ('accessoriesDescription' in data) {
      await prisma.$executeRaw`
        UPDATE "PartRepairJob" SET "accessoriesDescription" = ${data.accessoriesDescription || null}, "updatedAt" = ${now}::timestamptz WHERE id = ${id}
      `
    }
    if ('repairedByTechId' in data) {
      const techId: string | null = data.repairedByTechId || null
      await prisma.$executeRaw`
        UPDATE "PartRepairJob" SET "repairedByTechId" = ${techId}, "updatedAt" = ${now}::timestamptz WHERE id = ${id}
      `
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error updating repair job:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
