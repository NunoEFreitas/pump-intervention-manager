import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/middleware'
import { randomUUID } from 'crypto'

export async function GET(request: NextRequest) {
  const authCheck = await requireAdmin(request)
  if (authCheck instanceof NextResponse) return authCheck

  const rows = await prisma.$queryRaw<{ id: string; name: string; createdAt: Date }[]>`
    SELECT id, name, "createdAt" FROM "OvmRegulator" ORDER BY "createdAt" ASC
  `
  return NextResponse.json(rows)
}

export async function POST(request: NextRequest) {
  const authCheck = await requireAdmin(request)
  if (authCheck instanceof NextResponse) return authCheck

  const { name } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const id = randomUUID()
  const now = new Date().toISOString()
  await prisma.$executeRaw`
    INSERT INTO "OvmRegulator" (id, name, "createdAt")
    VALUES (${id}, ${name.trim()}, ${now}::timestamptz)
  `
  return NextResponse.json({ id, name: name.trim(), createdAt: now }, { status: 201 })
}
