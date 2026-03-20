import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

const MAX_SIZE_BYTES = 8 * 1024 * 1024 // 8MB base64 string limit

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!verifyToken(token || '')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const photos = await prisma.$queryRaw<{ id: string; filename: string; mimeType: string; createdAt: Date }[]>`
      SELECT id, filename, "mimeType", "createdAt" FROM "InterventionPhoto"
      WHERE "interventionId" = ${id}
      ORDER BY "createdAt" ASC
    `
    return NextResponse.json(photos)
  } catch (error) {
    console.error('Error fetching photos:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const payload = verifyToken(token || '')
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: interventionId } = await params
    const { filename, mimeType, data } = await request.json() as { filename: string; mimeType: string; data: string }

    if (!filename || !mimeType || !data) {
      return NextResponse.json({ error: 'filename, mimeType and data are required' }, { status: 400 })
    }
    if (!mimeType.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
    }
    if (data.length > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'Image too large (max 6MB)' }, { status: 400 })
    }

    const photoId = crypto.randomUUID()
    const now = new Date()

    await prisma.$executeRaw`
      INSERT INTO "InterventionPhoto" (id, "interventionId", filename, "mimeType", data, "createdAt", "createdById")
      VALUES (${photoId}, ${interventionId}, ${filename}, ${mimeType}, ${data}, ${now}::timestamptz, ${payload.userId})
    `

    return NextResponse.json({ id: photoId, filename, mimeType, createdAt: now }, { status: 201 })
  } catch (error) {
    console.error('Error uploading photo:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
