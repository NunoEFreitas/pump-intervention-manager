import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/middleware'

const KEYS = ['company.name', 'company.email', 'company.address', 'company.phones', 'company.faxes', 'company.logo']

export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await (prisma as any).systemSetting.findMany({
    where: { key: { in: KEYS } },
  })
  const map: Record<string, string> = {}
  for (const row of rows) map[row.key] = row.value
  return NextResponse.json({
    name: map['company.name'] || '',
    email: map['company.email'] || '',
    address: map['company.address'] || '',
    phones: JSON.parse(map['company.phones'] || '[]'),
    faxes: JSON.parse(map['company.faxes'] || '[]'),
    logo: map['company.logo'] || '',
  })
}

export async function PUT(request: NextRequest) {
  const authCheck = await requireAdmin(request)
  if (authCheck instanceof NextResponse) return authCheck

  const { name, email, address, phones, faxes, logo } = await request.json()

  const upserts: Record<string, string> = {
    'company.name': name ?? '',
    'company.email': email ?? '',
    'company.address': address ?? '',
    'company.phones': JSON.stringify(Array.isArray(phones) ? phones : []),
    'company.faxes': JSON.stringify(Array.isArray(faxes) ? faxes : []),
  }
  if (logo !== undefined) upserts['company.logo'] = logo

  for (const [key, value] of Object.entries(upserts)) {
    await (prisma as any).systemSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    })
  }

  return NextResponse.json({ success: true })
}
