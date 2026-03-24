import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { generateRepairReference } from '@/lib/reference'

// POST — swap the client part:
//   SN-tracked items:
//     - replacementSnId: specific SN from warehouse to give to technician
//     - clientSnMode: 'auto' | 'manual' — what SN the client's part gets in our repair stock
//     - clientSnValue: if manual
//   Non-SN-tracked items:
//     - quantity movements only; client SN record is deleted
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
    const { notes, replacementSnId, clientSnMode, clientSnValue } = body

    const now = new Date()

    // 1. Fetch the client part + item info
    const [clientPart] = await prisma.$queryRaw<any[]>`
      SELECT sn.*, wi."itemName", wi."partNumber", wi."mainWarehouse", wi."repairStock",
             wi."tracksSerialNumbers", wi."snExample"
      FROM "SerialNumberStock" sn
      JOIN "WarehouseItem" wi ON wi.id = sn."itemId"
      WHERE sn.id = ${serialNumberId} AND sn."isClientPart" = true
    `
    if (!clientPart) return NextResponse.json({ error: 'Client part not found' }, { status: 404 })
    if (clientPart.clientPartStatus === 'SWAP' || clientPart.clientPartStatus === 'RESOLVED') {
      return NextResponse.json({ error: 'Client part already processed' }, { status: 400 })
    }
    if (!clientPart.technicianId) {
      return NextResponse.json({ error: 'No technician assigned to this part' }, { status: 400 })
    }
    if (clientPart.mainWarehouse < 1) {
      return NextResponse.json({ error: `Stock insuficiente para substituição. Disponível: ${clientPart.mainWarehouse}` }, { status: 400 })
    }

    const tracksSerialNumbers: boolean = clientPart.tracksSerialNumbers

    // --- SN-tracked validation ---
    let replacementSn: any = null
    if (tracksSerialNumbers) {
      if (!replacementSnId) {
        return NextResponse.json({ error: 'Deve selecionar o número de série da peça de substituição' }, { status: 400 })
      }
      const [rsn] = await prisma.$queryRaw<any[]>`
        SELECT * FROM "SerialNumberStock"
        WHERE id = ${replacementSnId}
          AND "itemId" = ${clientPart.itemId}
          AND location = 'MAIN_WAREHOUSE'
          AND status = 'AVAILABLE'
          AND "isClientPart" = false
      `
      if (!rsn) {
        return NextResponse.json({ error: 'Número de série de substituição inválido ou indisponível' }, { status: 400 })
      }
      replacementSn = rsn

      if (clientSnMode === 'manual') {
        if (!clientSnValue?.trim()) {
          return NextResponse.json({ error: 'Deve especificar o número de série da peça do cliente' }, { status: 400 })
        }
        // Check for duplicate (excluding the current record)
        const [dup] = await prisma.$queryRaw<any[]>`
          SELECT id FROM "SerialNumberStock"
          WHERE "itemId" = ${clientPart.itemId} AND "serialNumber" = ${clientSnValue.trim()} AND id != ${serialNumberId}
        `
        if (dup) {
          return NextResponse.json({ error: `Número de série ${clientSnValue.trim()} já existe` }, { status: 400 })
        }
      } else if (clientSnMode === 'auto') {
        if (!clientPart.snExample) {
          return NextResponse.json({ error: 'Sem prefixo de SN configurado para este artigo' }, { status: 400 })
        }
      }
    }

    // 2. Pre-generate repair reference
    const repairRef = await generateRepairReference()

    // 3. Deduct 1 from mainWarehouse
    await prisma.$executeRaw`
      UPDATE "WarehouseItem"
      SET "mainWarehouse" = "mainWarehouse" - 1,
          "updatedAt" = ${now}::timestamptz
      WHERE id = ${clientPart.itemId}
    `

    // 4. Upsert technician stock +1
    await prisma.$executeRaw`
      INSERT INTO "TechnicianStock" (id, "itemId", "technicianId", quantity, "createdAt", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${clientPart.itemId}, ${clientPart.technicianId}, 1, ${now}::timestamptz, ${now}::timestamptz)
      ON CONFLICT ("itemId", "technicianId")
      DO UPDATE SET quantity = "TechnicianStock".quantity + 1, "updatedAt" = ${now}::timestamptz
    `

    // 5. Movement: TRANSFER_TO_TECH
    const transferMovId = crypto.randomUUID()
    const transferNote = `[${repairRef}] Substituição de peça de cliente${notes ? ` — ${notes}` : ''}`
    await prisma.$executeRaw`
      INSERT INTO "ItemMovement" (id, "itemId", "movementType", quantity, "toUserId", notes, "createdById", "createdAt")
      VALUES (${transferMovId}, ${clientPart.itemId}, 'TRANSFER_TO_TECH', 1, ${clientPart.technicianId}, ${transferNote}, ${payload.userId}, ${now}::timestamptz)
    `

    if (tracksSerialNumbers && replacementSn) {
      // Move replacement SN to TECHNICIAN
      await prisma.$executeRaw`
        UPDATE "SerialNumberStock"
        SET location = 'TECHNICIAN',
            "technicianId" = ${clientPart.technicianId},
            status = 'AVAILABLE',
            "updatedAt" = ${now}::timestamptz
        WHERE id = ${replacementSnId}
      `
      // Link SN to TRANSFER_TO_TECH movement
      await prisma.$executeRaw`
        INSERT INTO "MovementSerialNumber" (id, "movementId", "serialNumberId")
        VALUES (${crypto.randomUUID()}, ${transferMovId}, ${replacementSnId})
      `
    }

    // 6. Client part leaves technician stock → decrement TechnicianStock
    await prisma.$executeRaw`
      UPDATE "TechnicianStock"
      SET quantity = quantity - 1, "updatedAt" = ${now}::timestamptz
      WHERE "itemId" = ${clientPart.itemId} AND "technicianId" = ${clientPart.technicianId}
    `

    // 6b. Client part enters repairStock
    await prisma.$executeRaw`
      UPDATE "WarehouseItem"
      SET "repairStock" = "repairStock" + 1,
          "updatedAt" = ${now}::timestamptz
      WHERE id = ${clientPart.itemId}
    `

    // 7. Movement: REPAIR_IN (from technician)
    const addMovId = crypto.randomUUID()
    const addNote = `[${repairRef}] Peça de cliente recebida para reparação de stock${notes ? ` — ${notes}` : ''}`
    await prisma.$executeRaw`
      INSERT INTO "ItemMovement" (id, "itemId", "movementType", quantity, "fromUserId", notes, "createdById", "createdAt")
      VALUES (${addMovId}, ${clientPart.itemId}, 'REPAIR_IN', 1, ${clientPart.technicianId}, ${addNote}, ${payload.userId}, ${now}::timestamptz)
    `

    // 8. Handle client's SN record
    let repairJobSnId: string | null = serialNumberId

    if (tracksSerialNumbers) {
      // Determine new SN value for the client's part
      let newSn: string = clientPart.serialNumber

      if (clientSnMode === 'auto') {
        const prefix = clientPart.snExample + '-'
        const allExisting = await prisma.$queryRaw<Array<{ serialNumber: string }>>`
          SELECT "serialNumber" FROM "SerialNumberStock" WHERE "itemId" = ${clientPart.itemId} AND id != ${serialNumberId}
        `
        const maxSuffix = allExisting.reduce((max, r) => {
          if (r.serialNumber.startsWith(prefix)) {
            const num = parseInt(r.serialNumber.slice(prefix.length))
            if (!isNaN(num) && num > max) return num
          }
          return max
        }, 0)
        newSn = `${clientPart.snExample}-${maxSuffix + 1}`
      } else if (clientSnMode === 'manual') {
        newSn = clientSnValue.trim()
      }

      // Update client's SN: set in repair stock, update SN if changed
      await prisma.$executeRaw`
        UPDATE "SerialNumberStock"
        SET location = 'REPAIR',
            "serialNumber" = ${newSn},
            "isClientPart" = false,
            "clientPartStatus" = 'SWAP',
            "updatedAt" = ${now}::timestamptz
        WHERE id = ${serialNumberId}
      `
      // Link client SN to REPAIR_IN movement
      await prisma.$executeRaw`
        INSERT INTO "MovementSerialNumber" (id, "movementId", "serialNumberId")
        VALUES (${crypto.randomUUID()}, ${addMovId}, ${serialNumberId})
      `
    } else {
      // Non-SN-tracked: delete the placeholder SN record
      await prisma.$executeRaw`
        DELETE FROM "SerialNumberStock" WHERE id = ${serialNumberId}
      `
      repairJobSnId = null
    }

    // 9. Open STOCK repair job
    const repairJobId = crypto.randomUUID()
    if (repairJobSnId) {
      await prisma.$executeRaw`
        INSERT INTO "PartRepairJob" (id, reference, type, "itemId", "serialNumberId", quantity, status, problem, "sentById", "sentAt", "createdAt", "updatedAt")
        VALUES (
          ${repairJobId}, ${repairRef}, 'STOCK', ${clientPart.itemId}, ${repairJobSnId},
          1, 'PENDING', ${notes || 'Peça recebida de cliente — reparação de stock'},
          ${payload.userId}, ${now}::timestamptz, ${now}::timestamptz, ${now}::timestamptz
        )
      `
    } else {
      await prisma.$executeRaw`
        INSERT INTO "PartRepairJob" (id, reference, type, "itemId", quantity, status, problem, "sentById", "sentAt", "createdAt", "updatedAt")
        VALUES (
          ${repairJobId}, ${repairRef}, 'STOCK', ${clientPart.itemId},
          1, 'PENDING', ${notes || 'Peça recebida de cliente — reparação de stock'},
          ${payload.userId}, ${now}::timestamptz, ${now}::timestamptz, ${now}::timestamptz
        )
      `
    }

    return NextResponse.json({ ok: true, repairReference: repairRef, repairJobId })
  } catch (error) {
    console.error('Error processing swap:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
