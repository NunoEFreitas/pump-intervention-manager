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

  const workOrders = await (prisma as any).workOrder.findMany({
    where: { interventionId: id },
    include: {
      createdBy: { select: { id: true, name: true } },
      parts: {
        include: {
          item: { select: { id: true, itemName: true, partNumber: true, value: true, tracksSerialNumbers: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const woIds = workOrders.map((wo: any) => wo.id)

  // Fetch extra scalar fields
  const extraRows = woIds.length > 0
    ? await prisma.$queryRaw<{ id: string; reference: string | null; km: number | null; locationEquipmentId: string | null; interventionType: string | null; transportGuide: string | null; startDate: string | null; startTime: string | null; endDate: string | null; endTime: string | null; fromAddress: string | null; internal: boolean }[]>`
        SELECT wo.id, wo.reference, wo.km, wo."locationEquipmentId", wo."interventionType", wo."transportGuide", wo."startDate", wo."startTime", wo."endDate", wo."endTime", wo."fromAddress", wo."internal"
        FROM "WorkOrder" wo
        WHERE wo.id::text = ANY(${woIds}::text[])
      `
    : []
  const extraMap = Object.fromEntries(extraRows.map((r) => [r.id, r]))

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

  // Fetch usedById for parts
  const allPartIds = workOrders.flatMap((wo: any) => wo.parts.map((p: any) => p.id))
  const partUserRows = allPartIds.length > 0
    ? await prisma.$queryRaw<{ id: string; usedByName: string | null; createdAt: Date }[]>`
        SELECT wp.id, u.name AS "usedByName", wp."createdAt"
        FROM "WorkOrderPart" wp
        LEFT JOIN "User" u ON u.id = wp."usedById"
        WHERE wp.id::text = ANY(${allPartIds}::text[])
      `
    : []
  const partUserMap = Object.fromEntries(partUserRows.map((r) => [r.id, r]))

  const enriched = await Promise.all(
    workOrders.map(async (wo: any) => ({
      ...wo,
      reference: extraMap[wo.id]?.reference ?? null,
      km: extraMap[wo.id]?.km ?? null,
      locationEquipmentId: extraMap[wo.id]?.locationEquipmentId ?? null,
      interventionType: extraMap[wo.id]?.interventionType ?? null,
      transportGuide: extraMap[wo.id]?.transportGuide ?? null,
      startDate: extraMap[wo.id]?.startDate ?? null,
      startTime: extraMap[wo.id]?.startTime ?? null,
      endDate: extraMap[wo.id]?.endDate ?? null,
      endTime: extraMap[wo.id]?.endTime ?? null,
      fromAddress: extraMap[wo.id]?.fromAddress ?? null,
      internal: extraMap[wo.id]?.internal ?? false,
      vehicles: vehicleMap[wo.id] ?? [],
      helpers: helperMap[wo.id] ?? [],
      parts: await Promise.all(
        wo.parts.map(async (part: any) => {
          const partMeta = partUserMap[part.id]
          const enrichedPart = {
            ...part,
            usedByName: partMeta?.usedByName ?? null,
            createdAt: partMeta?.createdAt ?? part.createdAt,
          }
          if (part.item.tracksSerialNumbers && part.serialNumberIds.length > 0) {
            const serialNumbers = await prisma.serialNumberStock.findMany({
              where: { id: { in: part.serialNumberIds } },
              select: { id: true, serialNumber: true },
            })
            return { ...enrichedPart, serialNumbers }
          }
          return { ...enrichedPart, serialNumbers: [] }
        })
      ),
    }))
  )

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
  const { description, timeSpent, km, equipmentId, interventionType, transportGuide, startDate, startTime, endDate, endTime, fromAddress, internal, vehicleIds, helperIds } = await request.json()

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

  const workOrder = await (prisma as any).workOrder.create({
    data: {
      interventionId,
      description: description.trim(),
      timeSpent: timeSpent ? parseFloat(timeSpent) : null,
      createdById: payload.userId,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  })

  await prisma.$executeRaw`
    UPDATE "WorkOrder"
    SET reference             = ${reference},
        km                    = ${km !== undefined && km !== null && km !== '' ? parseFloat(km) : null},
        "locationEquipmentId" = ${equipmentId || null},
        "interventionType"    = ${interventionType || null},
        "transportGuide"      = ${transportGuide || null},
        "startDate"           = ${startDate || null},
        "startTime"           = ${startTime || null},
        "endDate"             = ${endDate || null},
        "endTime"             = ${endTime || null},
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

  return NextResponse.json({
    ...workOrder,
    reference,
    km: km ? parseFloat(km) : null,
    locationEquipmentId: equipmentId || null,
    interventionType: interventionType || null,
    transportGuide: transportGuide || null,
    startDate: startDate || null,
    startTime: startTime || null,
    endDate: endDate || null,
    endTime: endTime || null,
    fromAddress: fromAddress || null,
    internal: internal ? true : false,
    vehicles,
    helpers,
    parts: [],
  }, { status: 201 })
}
