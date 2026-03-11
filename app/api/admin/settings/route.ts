import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/middleware'

export async function GET(request: NextRequest) {
  const authCheck = await requireAdmin(request)
  if (authCheck instanceof NextResponse) return authCheck

  const rows = await (prisma as any).systemSetting.findMany()
  const settings: Record<string, string> = {}
  for (const row of rows) settings[row.key] = row.value
  return NextResponse.json(settings)
}

export async function PUT(request: NextRequest) {
  const authCheck = await requireAdmin(request)
  if (authCheck instanceof NextResponse) return authCheck

  const body = await request.json()
  const allowed = ['clientPrefix', 'projectPrefix']

  for (const key of allowed) {
    if (key in body) {
      await (prisma as any).systemSetting.upsert({
        where: { key },
        create: { key, value: body[key] ?? '' },
        update: { value: body[key] ?? '' },
      })
    }
  }

  const rows = await (prisma as any).systemSetting.findMany()
  const settings: Record<string, string> = {}
  for (const row of rows) settings[row.key] = row.value
  return NextResponse.json(settings)
}
