import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [session] = await prisma.$queryRaw<any[]>`
    SELECT id, status FROM "InventorySession" WHERE id = ${id}
  `
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.status !== 'OPEN') return NextResponse.json({ error: 'Session is not open' }, { status: 400 })

  await prisma.$executeRaw`
    UPDATE "InventorySession" SET status = 'PENDING_APPROVAL' WHERE id = ${id}
  `

  return NextResponse.json({ ok: true })
}
