import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; workOrderId: string }> }
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workOrderId } = await params

  const pdfs = await (prisma as any).$queryRaw`
    SELECT id, "workOrderId", "clientSignature", "techSignature", "createdAt"
    FROM "WorkOrderPDF"
    WHERE "workOrderId" = ${workOrderId}
    ORDER BY "createdAt" DESC
  `

  return NextResponse.json(pdfs)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; workOrderId: string }> }
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = verifyToken(token || '')
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workOrderId } = await params
  const { clientSignature, techSignature } = await request.json()

  const id = crypto.randomUUID()

  await (prisma as any).$executeRaw`
    INSERT INTO "WorkOrderPDF" (id, "workOrderId", "clientSignature", "techSignature", "createdAt")
    VALUES (${id}, ${workOrderId}, ${clientSignature ?? null}, ${techSignature ?? null}, NOW())
  `

  const [pdf] = await (prisma as any).$queryRaw`
    SELECT id, "workOrderId", "clientSignature", "techSignature", "createdAt"
    FROM "WorkOrderPDF"
    WHERE id = ${id}
  `

  return NextResponse.json(pdf, { status: 201 })
}
