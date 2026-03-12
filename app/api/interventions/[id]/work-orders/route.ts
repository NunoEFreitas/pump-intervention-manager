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

  // Fetch new fields via raw SQL (Prisma client may be stale)
  const woIds = workOrders.map((wo: any) => wo.id)
  const extraRows = woIds.length > 0
    ? await prisma.$queryRaw<{ id: string; reference: string | null; km: number | null; locationEquipmentId: string | null; interventionType: string | null; transportGuide: string | null; startDate: string | null; startTime: string | null; endDate: string | null; endTime: string | null; fromAddress: string | null }[]>`
        SELECT id, reference, km, "locationEquipmentId", "interventionType", "transportGuide", "startDate", "startTime", "endDate", "endTime", "fromAddress" FROM "WorkOrder" WHERE id::text = ANY(${woIds}::text[])
      `
    : []
  const extraMap = Object.fromEntries(extraRows.map((r) => [r.id, r]))

  // Fetch usedById + usedByName for all WorkOrderParts
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

  // Enrich serialized parts with actual SN values
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
  const { description, timeSpent, km, equipmentId, interventionType, transportGuide, startDate, startTime, endDate, endTime, fromAddress } = await request.json()

  if (!description?.trim()) {
    return NextResponse.json({ error: 'Description is required' }, { status: 400 })
  }

  const reference = await generateWorkOrderReference()

  const workOrder = await (prisma as any).workOrder.create({
    data: {
      interventionId,
      description: description.trim(),
      timeSpent: timeSpent ? parseFloat(timeSpent) : null,
      createdById: payload.userId,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
    },
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
        "fromAddress"         = ${fromAddress || null}
    WHERE id = ${workOrder.id}
  `

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
    parts: [],
  }, { status: 201 })
}
