import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

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

  // Enrich serialized parts with actual SN values
  const enriched = await Promise.all(
    workOrders.map(async (wo: any) => ({
      ...wo,
      parts: await Promise.all(
        wo.parts.map(async (part: any) => {
          if (part.item.tracksSerialNumbers && part.serialNumberIds.length > 0) {
            const serialNumbers = await prisma.serialNumberStock.findMany({
              where: { id: { in: part.serialNumberIds } },
              select: { id: true, serialNumber: true },
            })
            return { ...part, serialNumbers }
          }
          return { ...part, serialNumbers: [] }
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
  const { description, timeSpent } = await request.json()

  if (!description?.trim()) {
    return NextResponse.json({ error: 'Description is required' }, { status: 400 })
  }

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

  return NextResponse.json({ ...workOrder, parts: [] }, { status: 201 })
}
