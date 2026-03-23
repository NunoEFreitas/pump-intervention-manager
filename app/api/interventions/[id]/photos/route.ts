import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { detectImageMime, stripDataUrl, MAX_PHOTO_BYTES } from '@/lib/photo-validation'

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

    if (!filename || !data) {
      return NextResponse.json({ error: 'filename and data are required' }, { status: 400 })
    }
    if (data.length > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: 'Image too large (max 8MB)' }, { status: 400 })
    }
    // Detect MIME from magic bytes — ignore client-supplied mimeType to prevent spoofing
    const detectedMime = detectImageMime(data)
    if (!detectedMime) {
      return NextResponse.json({ error: 'Only image files are allowed (JPEG, PNG, GIF, WebP, HEIC)' }, { status: 400 })
    }
    const safeData = stripDataUrl(data)

    const photoId = crypto.randomUUID()
    const now = new Date()

    await prisma.$executeRaw`
      INSERT INTO "InterventionPhoto" (id, "interventionId", filename, "mimeType", data, "createdAt", "createdById")
      VALUES (${photoId}, ${interventionId}, ${filename}, ${detectedMime}, ${safeData}, ${now}::timestamptz, ${payload.userId})
    `

    return NextResponse.json({ id: photoId, filename, mimeType: detectedMime, createdAt: now }, { status: 201 })
  } catch (error) {
    console.error('Error uploading photo:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
