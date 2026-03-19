import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { sendEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { to, subject, body, isHtml, attachments, cc } = await request.json()

    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'to, subject and body are required' }, { status: 400 })
    }

    await sendEmail({ to, subject, body, isHtml, attachments, cc })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send email'
    console.error('Email send error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
