import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { generateWorkOrderReference } from '@/lib/reference'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const woRows = await prisma.$queryRaw<any[]>`
    SELECT
      wo.id, wo."interventionId", wo.description, wo."timeSpent", wo."createdById", wo."createdAt", wo."updatedAt",
      u.id AS "createdById_", u.name AS "createdByName"
    FROM "WorkOrder" wo
    JOIN "User" u ON u.id = wo."createdById"
    WHERE wo."interventionId" = ${id}
    ORDER BY wo."createdAt" ASC
  `

  const woIds = woRows.map((wo: any) => wo.id)

  // Fetch parts per work order
  const partRows = woIds.length > 0
    ? await prisma.$queryRaw<any[]>`
        SELECT
          wp.id, wp."workOrderId", wp."itemId", wp.quantity, wp."serialNumberIds", wp."usedById", wp."createdAt",
          wi."itemName", wi."partNumber", wi.value, wi."tracksSerialNumbers"
        FROM "WorkOrderPart" wp
        JOIN "WarehouseItem" wi ON wi.id = wp."itemId"
        WHERE wp."workOrderId"::text = ANY(${woIds}::text[])
        ORDER BY wp."createdAt" ASC
      `
    : []
  const partMap: Record<string, any[]> = {}
  for (const p of partRows) {
    if (!partMap[p.workOrderId]) partMap[p.workOrderId] = []
    partMap[p.workOrderId].push(p)
  }

  // Enrich parts with usedByName
  const allPartIds = partRows.map((p: any) => p.id)
  const partUserRows = allPartIds.length > 0
    ? await prisma.$queryRaw<{ id: string; usedByName: string | null }[]>`
        SELECT wp.id, u.name AS "usedByName"
        FROM "WorkOrderPart" wp
        LEFT JOIN "User" u ON u.id = wp."usedById"
        WHERE wp.id::text = ANY(${allPartIds}::text[])
      `
    : []
  const partUserMap = Object.fromEntries(partUserRows.map((r) => [r.id, r]))

  const workOrders = woRows.map((wo: any) => ({
    id: wo.id,
    interventionId: wo.interventionId,
    description: wo.description,
    timeSpent: wo.timeSpent,
    createdById: wo.createdById,
    createdAt: wo.createdAt,
    updatedAt: wo.updatedAt,
    createdBy: { id: wo.createdById_, name: wo.createdByName },
    parts: (partMap[wo.id] ?? []).map((p: any) => ({
      ...p,
      usedByName: partUserMap[p.id]?.usedByName ?? null,
      item: { id: p.itemId, itemName: p.itemName, partNumber: p.partNumber, value: p.value, tracksSerialNumbers: p.tracksSerialNumbers },
      serialNumbers: [],
    })),
  }))

  // Fetch extra scalar fields
  const extraRows = woIds.length > 0
    ? await prisma.$queryRaw<{ id: string; reference: string | null; km: number | null; locationEquipmentId: string | null; interventionType: string | null; transportGuide: string | null; fromAddress: string | null; internal: boolean }[]>`
        SELECT wo.id, wo.reference, wo.km, wo."locationEquipmentId", wo."interventionType", wo."transportGuide", wo."fromAddress", wo."internal"
        FROM "WorkOrder" wo
        WHERE wo.id::text = ANY(${woIds}::text[])
      `
    : []
  const extraMap = Object.fromEntries(extraRows.map((r) => [r.id, r]))

  // Fetch sessions per work order
  const sessionRows = woIds.length > 0
    ? await prisma.$queryRaw<{ id: string; workOrderId: string; startDate: string | null; startTime: string | null; endDate: string | null; endTime: string | null; duration: number | null; createdAt: Date }[]>`
        SELECT id, "workOrderId", "startDate", "startTime", "endDate", "endTime", duration, "createdAt"
        FROM "WorkOrderSession"
        WHERE "workOrderId"::text = ANY(${woIds}::text[])
        ORDER BY "createdAt" ASC
      `
    : []
  const sessionMap: Record<string, typeof sessionRows> = {}
  for (const r of sessionRows) {
    if (!sessionMap[r.workOrderId]) sessionMap[r.workOrderId] = []
    sessionMap[r.workOrderId].push(r)
  }

  // Fetch vehicles per work order
  const vehicleRows = woIds.length > 0
    ? await prisma.$queryRaw<{ workOrderId: string; vehicleId: string; plateNumber: string; brand: string | null; model: string | null }[]>`
        SELECT wov."workOrderId", wov."vehicleId", cv."plateNumber", cv.brand, cv.model
        FROM "WorkOrderVehicle" wov
        JOIN "CompanyVehicle" cv ON cv.id = wov."vehicleId"
        WHERE wov."workOrderId"::text = ANY(${woIds}::text[])
      `
    : []
  const vehicleMap: Record<string, typeof vehicleRows> = {}
  for (const r of vehicleRows) {
    if (!vehicleMap[r.workOrderId]) vehicleMap[r.workOrderId] = []
    vehicleMap[r.workOrderId].push(r)
  }

  // Fetch helpers per work order
  const helperRows = woIds.length > 0
    ? await prisma.$queryRaw<{ workOrderId: string; userId: string; name: string }[]>`
        SELECT woh."workOrderId", woh."userId", u.name
        FROM "WorkOrderHelper" woh
        JOIN "User" u ON u.id = woh."userId"
        WHERE woh."workOrderId"::text = ANY(${woIds}::text[])
      `
    : []
  const helperMap: Record<string, typeof helperRows> = {}
  for (const r of helperRows) {
    if (!helperMap[r.workOrderId]) helperMap[r.workOrderId] = []
    helperMap[r.workOrderId].push(r)
  }

  // Enrich parts with serial numbers
  const enrichedParts: Record<string, any[]> = {}
  for (const wo of workOrders) {
    enrichedParts[wo.id] = await Promise.all(
      wo.parts.map(async (part: any) => {
        if (part.tracksSerialNumbers && part.serialNumberIds?.length > 0) {
          const serialNumbers = await prisma.$queryRaw<{ id: string; serialNumber: string }[]>`
            SELECT id, "serialNumber" FROM "SerialNumberStock"
            WHERE id::text = ANY(${part.serialNumberIds}::text[])
          `
          return { ...part, serialNumbers }
        }
        return { ...part, serialNumbers: [] }
      })
    )
  }

  const enriched = workOrders.map((wo: any) => ({
    ...wo,
    reference: extraMap[wo.id]?.reference ?? null,
    km: extraMap[wo.id]?.km ?? null,
    locationEquipmentId: extraMap[wo.id]?.locationEquipmentId ?? null,
    interventionType: extraMap[wo.id]?.interventionType ?? null,
    transportGuide: extraMap[wo.id]?.transportGuide ?? null,
    fromAddress: extraMap[wo.id]?.fromAddress ?? null,
    internal: extraMap[wo.id]?.internal ?? false,
    sessions: sessionMap[wo.id] ?? [],
    vehicles: vehicleMap[wo.id] ?? [],
    helpers: helperMap[wo.id] ?? [],
    parts: enrichedParts[wo.id] ?? [],
  }))

  return NextResponse.json(enriched)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: interventionId } = await params
  const { description, timeSpent, km, equipmentId, interventionType, transportGuide, fromAddress, internal, vehicleIds, helperIds } = await request.json()

  if (!description?.trim()) {
    return NextResponse.json({ error: 'Description is required' }, { status: 400 })
  }

  const reference = await generateWorkOrderReference()

  // Auto-advance status from ASSIGNED → IN_PROGRESS when a work order is created
  await prisma.$executeRaw`
    UPDATE "Intervention"
    SET status = 'IN_PROGRESS'
    WHERE id = ${interventionId} AND status = 'ASSIGNED'
  `

  const workOrderId = crypto.randomUUID()
  const now = new Date()
  await prisma.$executeRaw`
    INSERT INTO "WorkOrder" (id, "interventionId", description, "timeSpent", "createdById", "createdAt", "updatedAt")
    VALUES (${workOrderId}, ${interventionId}, ${description.trim()}, ${timeSpent ? parseFloat(timeSpent) : null}, ${payload.userId}, ${now}::timestamptz, ${now}::timestamptz)
  `
  const workOrder = { id: workOrderId, interventionId, description: description.trim(), timeSpent: timeSpent ? parseFloat(timeSpent) : null, createdById: payload.userId, createdAt: now, updatedAt: now }

  await prisma.$executeRaw`
    UPDATE "WorkOrder"
    SET reference             = ${reference},
        km                    = ${km !== undefined && km !== null && km !== '' ? parseFloat(km) : null},
        "locationEquipmentId" = ${equipmentId || null},
        "interventionType"    = ${interventionType || null},
        "transportGuide"      = ${transportGuide || null},
        "fromAddress"         = ${fromAddress || null},
        "internal"            = ${internal ? true : false}
    WHERE id = ${workOrder.id}
  `

  const safeVehicleIds: string[] = Array.isArray(vehicleIds) ? vehicleIds.filter(Boolean) : []
  for (const vehicleId of safeVehicleIds) {
    const vid = crypto.randomUUID()
    await prisma.$executeRaw`INSERT INTO "WorkOrderVehicle" (id, "workOrderId", "vehicleId", "createdAt") VALUES (${vid}, ${workOrder.id}, ${vehicleId}, NOW()) ON CONFLICT DO NOTHING`
  }

  const safeHelperIds: string[] = Array.isArray(helperIds) ? helperIds.filter(Boolean) : []
  for (const userId of safeHelperIds) {
    const hid = crypto.randomUUID()
    await prisma.$executeRaw`INSERT INTO "WorkOrderHelper" (id, "workOrderId", "userId", "createdAt") VALUES (${hid}, ${workOrder.id}, ${userId}, NOW()) ON CONFLICT DO NOTHING`
  }

  const vehicles = safeVehicleIds.length > 0
    ? await prisma.$queryRaw<{ workOrderId: string; vehicleId: string; plateNumber: string; brand: string | null; model: string | null }[]>`
        SELECT wov."workOrderId", wov."vehicleId", cv."plateNumber", cv.brand, cv.model
        FROM "WorkOrderVehicle" wov JOIN "CompanyVehicle" cv ON cv.id = wov."vehicleId"
        WHERE wov."workOrderId" = ${workOrder.id}
      `
    : []

  const helpers = safeHelperIds.length > 0
    ? await prisma.$queryRaw<{ workOrderId: string; userId: string; name: string }[]>`
        SELECT woh."workOrderId", woh."userId", u.name
        FROM "WorkOrderHelper" woh JOIN "User" u ON u.id = woh."userId"
        WHERE woh."workOrderId" = ${workOrder.id}
      `
    : []

  const [createdBy] = await prisma.$queryRaw<{ id: string; name: string }[]>`SELECT id, name FROM "User" WHERE id = ${payload.userId}`

  return NextResponse.json({
    ...workOrder,
    reference,
    km: km ? parseFloat(km) : null,
    locationEquipmentId: equipmentId || null,
    interventionType: interventionType || null,
    transportGuide: transportGuide || null,
    fromAddress: fromAddress || null,
    sessions: [],
    internal: internal ? true : false,
    createdBy: createdBy ?? { id: payload.userId, name: '' },
    vehicles,
    helpers,
    parts: [],
  }, { status: 201 })
}
