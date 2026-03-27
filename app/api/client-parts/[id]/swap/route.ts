import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { generateRepairReference } from '@/lib/reference'

// POST — swap the client part:
//   - Marks client part as SWAP (stays in CLIENT_WAREHOUSE)
//   - Deducts 1 unit from main warehouse stock (replacement given to client)
//   - For SN-tracked: records which replacement SN was used (moved to USED)
//   - Opens a STOCK repair job for the client's broken part
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
      SELECT sn.id, sn."itemId", sn."serialNumber", sn."faultDescription", sn."clientPartStatus",
             sn."clientRepairJobId", sn."interventionId", sn."technicianId",
             wi."itemName", wi."partNumber", wi."mainWarehouse",
             wi."tracksSerialNumbers", wi."snExample"
      FROM "SerialNumberStock" sn
      JOIN "WarehouseItem" wi ON wi.id = sn."itemId"
      WHERE sn.id = ${serialNumberId} AND sn."isClientPart" = true
    `
    if (!clientPart) return NextResponse.json({ error: 'Client part not found' }, { status: 404 })
    if (!clientPart.clientPartStatus || clientPart.clientPartStatus === 'IN_TRANSIT') {
      return NextResponse.json({ error: 'Peça ainda não deu entrada — use "Dar Entrada" primeiro' }, { status: 400 })
    }
    if (clientPart.clientPartStatus === 'SWAP' || clientPart.clientPartStatus === 'RESOLVED' || clientPart.clientPartStatus === 'RETURNING') {
      return NextResponse.json({ error: 'Client part already processed' }, { status: 400 })
    }

    // If part is in REPAIR status, close the open repair job as NOT_REPAIRED first
    if (clientPart.clientPartStatus === 'REPAIR' && clientPart.clientRepairJobId) {
      await prisma.$executeRaw`
        UPDATE "PartRepairJob"
        SET status = 'NOT_REPAIRED',
            "completedAt" = ${now}::timestamptz,
            "completedById" = ${payload.userId},
            "updatedAt" = ${now}::timestamptz
        WHERE id = ${clientPart.clientRepairJobId}
      `
      await prisma.$executeRaw`
        UPDATE "SerialNumberStock"
        SET "clientRepairJobId" = NULL, "clientPartStatus" = NULL, "updatedAt" = ${now}::timestamptz
        WHERE id = ${serialNumberId}
      `
      clientPart.clientPartStatus = null
      clientPart.clientRepairJobId = null
    }

    if (clientPart.mainWarehouse < 1) {
      return NextResponse.json({ error: `Stock insuficiente para substituição. Disponível: ${clientPart.mainWarehouse}` }, { status: 400 })
    }

    const tracksSerialNumbers: boolean = clientPart.tracksSerialNumbers
    const interventionId: string | null = clientPart.interventionId ?? null

    // --- SN-tracked: validate replacement SN and client SN assignment ---
    let replacementSn: any = null
    if (tracksSerialNumbers) {
      if (!replacementSnId) {
        return NextResponse.json({ error: 'Deve selecionar o número de série da peça de substituição' }, { status: 400 })
      }
      const [rsn] = await prisma.$queryRaw<any[]>`
        SELECT id, "itemId", "serialNumber", location, status FROM "SerialNumberStock"
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

    // 2. Generate repair reference
    const repairRef = await generateRepairReference()

    // 3. Deduct 1 from mainWarehouse (replacement going to client)
    await prisma.$executeRaw`
      UPDATE "WarehouseItem"
      SET "mainWarehouse" = "mainWarehouse" - 1,
          "updatedAt" = ${now}::timestamptz
      WHERE id = ${clientPart.itemId}
    `

    // 4. Movement: REMOVE_STOCK (replacement given to client)
    const replMovId = crypto.randomUUID()
    const replNote = `[${repairRef}] Substituição de peça de cliente${notes ? ` — ${notes}` : ''}`
    await prisma.$executeRaw`
      INSERT INTO "ItemMovement" (id, "itemId", "movementType", quantity, notes, "createdById", "createdAt")
      VALUES (${replMovId}, ${clientPart.itemId}, 'REMOVE_STOCK', 1, ${replNote}, ${payload.userId}, ${now}::timestamptz)
    `

    // 5. For SN-tracked: mark replacement SN as USED and assign SN to client part
    if (tracksSerialNumbers && replacementSn) {
      // Replacement SN exits stock as USED (given to client)
      await prisma.$executeRaw`
        UPDATE "SerialNumberStock"
        SET location = 'USED', status = 'IN_USE', "updatedAt" = ${now}::timestamptz
        WHERE id = ${replacementSnId}
      `
      await prisma.$executeRaw`
        INSERT INTO "MovementSerialNumber" (id, "movementId", "serialNumberId")
        VALUES (${crypto.randomUUID()}, ${replMovId}, ${replacementSnId})
      `

      // Assign a SN to the client's broken part (for STOCK repair tracking)
      let newSn: string = clientPart.serialNumber ?? ''
      if (clientSnMode === 'auto') {
        const prefix = clientPart.snExample + '-'
        const allExisting = await prisma.$queryRaw<Array<{ serialNumber: string }>>`
          SELECT "serialNumber" FROM "SerialNumberStock" WHERE "itemId" = ${clientPart.itemId} AND id != ${serialNumberId}
        `
        const maxSuffix = allExisting.reduce((max: number, r: { serialNumber: string }) => {
          if (r.serialNumber?.startsWith(prefix)) {
            const num = parseInt(r.serialNumber.slice(prefix.length))
            if (!isNaN(num) && num > max) return num
          }
          return max
        }, 0)
        newSn = `${clientPart.snExample}-${maxSuffix + 1}`
      } else if (clientSnMode === 'manual') {
        newSn = clientSnValue.trim()
      }

      await prisma.$executeRaw`
        UPDATE "SerialNumberStock"
        SET "serialNumber" = ${newSn}, "updatedAt" = ${now}::timestamptz
        WHERE id = ${serialNumberId}
      `
    }

    // 6. Mark client part as SWAP — stays in CLIENT_WAREHOUSE
    await prisma.$executeRaw`
      UPDATE "SerialNumberStock"
      SET "clientPartStatus" = 'SWAP',
          "updatedAt" = ${now}::timestamptz
      WHERE id = ${serialNumberId}
    `

    // 7. Open STOCK repair job linked to the client part SN
    const repairJobId = crypto.randomUUID()
    const interventionRef = interventionId
      ? (await prisma.$queryRaw<Array<{ reference: string }>>`SELECT reference FROM "Intervention" WHERE id = ${interventionId}`)[0]?.reference
      : null
    const baseProblem = clientPart.faultDescription || notes || 'Sem descrição'
    const repairProblem = interventionRef ? `[${interventionRef}] ${baseProblem}` : baseProblem
    await prisma.$executeRaw`
      INSERT INTO "PartRepairJob" (id, reference, type, "itemId", "serialNumberId", "interventionId", quantity, status, problem, "sentById", "sentAt", "createdAt", "updatedAt")
      VALUES (
        ${repairJobId}, ${repairRef}, 'STOCK', ${clientPart.itemId}, ${serialNumberId}, ${interventionId},
        1, 'PENDING', ${repairProblem},
        ${payload.userId}, ${now}::timestamptz, ${now}::timestamptz, ${now}::timestamptz
      )
    `

    return NextResponse.json({ ok: true, repairReference: repairRef, repairJobId })
  } catch (error) {
    console.error('Error processing swap:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
