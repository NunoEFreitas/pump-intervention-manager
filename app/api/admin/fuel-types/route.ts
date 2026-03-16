import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/middleware'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const types = await prisma.$queryRaw<{ id: string; translations: unknown; createdAt: Date }[]>`
      SELECT id, translations, "createdAt" FROM "FuelType" ORDER BY "createdAt" ASC
    `
    return NextResponse.json(types)
  } catch (error) {
    console.error('Error fetching fuel types:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authCheck = await requireAdmin(request)
  if (authCheck instanceof NextResponse) return authCheck

  try {
    const { translations } = await request.json()
    if (!translations || typeof translations !== 'object') {
      return NextResponse.json({ error: 'translations is required' }, { status: 400 })
    }
    const id = crypto.randomUUID()
    await prisma.$executeRaw`
      INSERT INTO "FuelType" (id, translations, "createdAt") VALUES (${id}, ${JSON.stringify(translations)}::jsonb, NOW())
    `
    const [created] = await prisma.$queryRaw<{ id: string; translations: unknown; createdAt: Date }[]>`
      SELECT id, translations, "createdAt" FROM "FuelType" WHERE id = ${id}
    `
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('Error creating fuel type:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
