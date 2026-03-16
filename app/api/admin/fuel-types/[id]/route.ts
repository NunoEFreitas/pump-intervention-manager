import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/middleware'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = await requireAdmin(request)
  if (authCheck instanceof NextResponse) return authCheck

  const { id } = await params
  try {
    const { translations } = await request.json()
    if (!translations || typeof translations !== 'object') {
      return NextResponse.json({ error: 'translations is required' }, { status: 400 })
    }
    await prisma.$executeRaw`
      UPDATE "FuelType" SET translations = ${JSON.stringify(translations)}::jsonb WHERE id = ${id}
    `
    const [updated] = await prisma.$queryRaw<{ id: string; translations: unknown; createdAt: Date }[]>`
      SELECT id, translations, "createdAt" FROM "FuelType" WHERE id = ${id}
    `
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating fuel type:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = await requireAdmin(request)
  if (authCheck instanceof NextResponse) return authCheck

  const { id } = await params
  try {
    await prisma.$executeRaw`DELETE FROM "FuelType" WHERE id = ${id}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting fuel type:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
