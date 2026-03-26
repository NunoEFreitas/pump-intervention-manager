import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

function calcEan13CheckDigit(digits12: string): string {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits12[i]) * (i % 2 === 0 ? 1 : 3)
  }
  return String((10 - (sum % 10)) % 10)
}

function buildEan13(digits12: string): string {
  return digits12 + calcEan13CheckDigit(digits12)
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all existing EAN-13 codes
    const existing = await prisma.$queryRaw<Array<{ ean13: string }>>`
      SELECT "ean13" FROM "WarehouseItem" WHERE "ean13" IS NOT NULL
    `
    const usedSet = new Set(existing.map(r => r.ean13))

    // Use prefix "200" (GS1 internal-use range: 200–299) + 9 random digits
    // Retry until we find one not already in use
    let ean13: string | null = null
    for (let attempt = 0; attempt < 100; attempt++) {
      const rand9 = String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, '0')
      const digits12 = '200' + rand9
      const candidate = buildEan13(digits12)
      if (!usedSet.has(candidate)) {
        ean13 = candidate
        break
      }
    }

    if (!ean13) {
      return NextResponse.json({ error: 'Could not generate unique EAN-13' }, { status: 500 })
    }

    return NextResponse.json({ ean13 })
  } catch (error) {
    console.error('Error generating EAN-13:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
