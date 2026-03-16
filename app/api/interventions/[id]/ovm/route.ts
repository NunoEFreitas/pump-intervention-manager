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

  const ovms = await (prisma as any).$queryRaw`
    SELECT id, "interventionId", data, "createdAt", "updatedAt"
    FROM "OVM"
    WHERE "interventionId" = ${id}
    ORDER BY "createdAt" DESC
  `

  return NextResponse.json(ovms)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data } = await request.json()

  const ovmId = crypto.randomUUID()
  const dataJson = JSON.stringify(data)

  await (prisma as any).$executeRaw`
    INSERT INTO "OVM" (id, "interventionId", data, "createdAt", "updatedAt")
    VALUES (${ovmId}, ${id}, ${dataJson}::jsonb, NOW(), NOW())
  `

  const [ovm] = await (prisma as any).$queryRaw`
    SELECT id, "interventionId", data, "createdAt", "updatedAt"
    FROM "OVM" WHERE id = ${ovmId}
  `

  return NextResponse.json(ovm, { status: 201 })
}
