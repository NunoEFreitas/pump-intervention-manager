import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; workOrderId: string }> }
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workOrderId } = await params
  const { description, timeSpent, km, equipmentId, interventionType, transportGuide, startDate, startTime, endDate, endTime, fromAddress, internal, vehicleIds, helperIds } = await request.json()

  if (!description?.trim()) {
    return NextResponse.json({ error: 'Description is required' }, { status: 400 })
  }

  await (prisma as any).workOrder.update({
    where: { id: workOrderId },
    data: {
      description: description.trim(),
      timeSpent: timeSpent !== undefined ? (timeSpent !== null && timeSpent !== '' ? parseFloat(timeSpent) : null) : undefined,
    },
  })

  await prisma.$executeRaw`
    UPDATE "WorkOrder"
    SET km                    = ${km !== undefined && km !== null && km !== '' ? parseFloat(km) : null},
        "locationEquipmentId" = ${equipmentId || null},
        "interventionType"    = ${interventionType || null},
        "transportGuide"      = ${transportGuide || null},
        "startDate"           = ${startDate || null},
        "startTime"           = ${startTime || null},
        "endDate"             = ${endDate || null},
        "endTime"             = ${endTime || null},
        "fromAddress"         = ${fromAddress || null},
        "internal"            = ${internal ? true : false}
    WHERE id = ${workOrderId}
  `

  // Replace vehicles: delete all then re-insert
  await prisma.$executeRaw`DELETE FROM "WorkOrderVehicle" WHERE "workOrderId" = ${workOrderId}`
  const safeVehicleIds: string[] = Array.isArray(vehicleIds) ? vehicleIds.filter(Boolean) : []
  for (const vehicleId of safeVehicleIds) {
    const vid = crypto.randomUUID()
    await prisma.$executeRaw`INSERT INTO "WorkOrderVehicle" (id, "workOrderId", "vehicleId", "createdAt") VALUES (${vid}, ${workOrderId}, ${vehicleId}, NOW()) ON CONFLICT DO NOTHING`
  }

  // Replace helpers: delete all then re-insert
  await prisma.$executeRaw`DELETE FROM "WorkOrderHelper" WHERE "workOrderId" = ${workOrderId}`
  const safeHelperIds: string[] = Array.isArray(helperIds) ? helperIds.filter(Boolean) : []
  for (const userId of safeHelperIds) {
    const hid = crypto.randomUUID()
    await prisma.$executeRaw`INSERT INTO "WorkOrderHelper" (id, "workOrderId", "userId", "createdAt") VALUES (${hid}, ${workOrderId}, ${userId}, NOW()) ON CONFLICT DO NOTHING`
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; workOrderId: string }> }
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workOrderId } = await params
  await (prisma as any).workOrder.delete({ where: { id: workOrderId } })
  return NextResponse.json({ success: true })
}
