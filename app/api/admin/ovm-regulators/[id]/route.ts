import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/middleware'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdmin(request)
  if (authCheck instanceof NextResponse) return authCheck

  const { id } = await params
  const { name } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  await prisma.$executeRaw`UPDATE "OvmRegulator" SET name = ${name.trim()} WHERE id = ${id}`
  return NextResponse.json({ id, name: name.trim() })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdmin(request)
  if (authCheck instanceof NextResponse) return authCheck

  const { id } = await params
  await prisma.$executeRaw`DELETE FROM "OvmRegulator" WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
