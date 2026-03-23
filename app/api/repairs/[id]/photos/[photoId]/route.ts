import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!verifyToken(token || '')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { photoId } = await params

    const rows = await prisma.$queryRaw<{ id: string; filename: string; mimeType: string; data: string }[]>`
      SELECT id, filename, "mimeType", data FROM "RepairJobPhoto" WHERE id = ${photoId}
    `
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(rows[0])
  } catch (error) {
    console.error('Error fetching repair photo:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const payload = verifyToken(token || '')
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { photoId } = await params

    await prisma.$executeRaw`DELETE FROM "RepairJobPhoto" WHERE id = ${photoId}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting repair photo:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
