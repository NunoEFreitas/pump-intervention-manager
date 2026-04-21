import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { requireAdmin } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import type { LabelTemplates } from '@/lib/labelPrint'
import { DEFAULT_TEMPLATES } from '@/lib/labelPrint'

const KEY = 'label.templates'

export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!verifyToken(token || '')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const row = await (prisma as any).systemSetting.findUnique({ where: { key: KEY } })
  if (!row) return NextResponse.json(DEFAULT_TEMPLATES)

  try {
    return NextResponse.json(JSON.parse(row.value) as LabelTemplates)
  } catch {
    return NextResponse.json(DEFAULT_TEMPLATES)
  }
}

export async function PUT(request: NextRequest) {
  const authCheck = await requireAdmin(request)
  if (authCheck instanceof NextResponse) return authCheck

  const body = await request.json()

  await (prisma as any).systemSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(body) },
    update: { value: JSON.stringify(body) },
  })

  return NextResponse.json({ success: true })
}
