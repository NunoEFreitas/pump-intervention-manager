import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ovmId: string }> }
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ovmId } = await params
  const { data } = await request.json()
  const dataJson = JSON.stringify(data)

  await (prisma as any).$executeRaw`
    UPDATE "OVM"
    SET data = ${dataJson}::jsonb, "updatedAt" = NOW()
    WHERE id = ${ovmId}
  `

  const [ovm] = await (prisma as any).$queryRaw`
    SELECT id, "interventionId", data, "createdAt", "updatedAt"
    FROM "OVM" WHERE id = ${ovmId}
  `

  return NextResponse.json(ovm)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ovmId: string }> }
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ovmId } = await params

  await (prisma as any).$executeRaw`DELETE FROM "OVM" WHERE id = ${ovmId}`

  return NextResponse.json({ ok: true })
}
