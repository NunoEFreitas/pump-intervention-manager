import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

async function requireAdmin(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return null
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true } })
  if (user?.role !== 'ADMIN') return null
  return payload
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await requireAdmin(request)
  if (!payload) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { plateNumber, brand, model, description } = await request.json()
  if (!plateNumber?.trim()) return NextResponse.json({ error: 'Plate number is required' }, { status: 400 })

  await prisma.$executeRaw`
    UPDATE "CompanyVehicle" SET "plateNumber" = ${plateNumber.trim().toUpperCase()}, brand = ${brand || null}, model = ${model || null}, description = ${description || null} WHERE id = ${id}
  `
  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await requireAdmin(request)
  if (!payload) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  await prisma.$executeRaw`DELETE FROM "WorkOrderVehicle" WHERE "vehicleId" = ${id}`
  await prisma.$executeRaw`DELETE FROM "CompanyVehicle" WHERE id = ${id}`
  return NextResponse.json({ success: true })
}
