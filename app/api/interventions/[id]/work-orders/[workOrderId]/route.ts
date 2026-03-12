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
  const { description, timeSpent, km, equipmentId, interventionType, transportGuide, startDate, startTime, endDate, endTime, fromAddress } = await request.json()

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
        "fromAddress"         = ${fromAddress || null}
    WHERE id = ${workOrderId}
  `

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
