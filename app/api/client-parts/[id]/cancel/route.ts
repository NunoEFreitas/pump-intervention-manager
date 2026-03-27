import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const payload = verifyToken(token || '')
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: serialNumberId } = await params

    const [clientPart] = await prisma.$queryRaw<any[]>`
      SELECT id, "itemId", "clientPartStatus", location FROM "SerialNumberStock"
      WHERE id = ${serialNumberId}
        AND "isClientPart" = true
        AND location = 'CLIENT_WAREHOUSE'
        AND ("clientPartStatus" IS NULL OR "clientPartStatus" IN ('IN_TRANSIT', 'PENDING'))
    `
    if (!clientPart) {
      return NextResponse.json({ error: 'Peça não encontrada ou já foi processada' }, { status: 404 })
    }

    const now = new Date()

    await prisma.$executeRaw`
      DELETE FROM "SerialNumberStock" WHERE id = ${serialNumberId}
    `

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error cancelling client part collection:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
