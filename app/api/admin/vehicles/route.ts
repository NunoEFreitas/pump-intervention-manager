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

export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const vehicles = await prisma.$queryRaw<{ id: string; plateNumber: string; brand: string | null; model: string | null; description: string | null; createdAt: Date }[]>`
    SELECT id, "plateNumber", brand, model, description, "createdAt" FROM "CompanyVehicle" ORDER BY "plateNumber" ASC
  `
  return NextResponse.json(vehicles)
}

export async function POST(request: NextRequest) {
  const payload = await requireAdmin(request)
  if (!payload) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { plateNumber, brand, model, description } = await request.json()
  if (!plateNumber?.trim()) return NextResponse.json({ error: 'Plate number is required' }, { status: 400 })

  const id = crypto.randomUUID()
  await prisma.$executeRaw`
    INSERT INTO "CompanyVehicle" (id, "plateNumber", brand, model, description, "createdAt")
    VALUES (${id}, ${plateNumber.trim().toUpperCase()}, ${brand || null}, ${model || null}, ${description || null}, NOW())
  `
  return NextResponse.json({ id, plateNumber: plateNumber.trim().toUpperCase(), brand: brand || null, model: model || null, description: description || null }, { status: 201 })
}
