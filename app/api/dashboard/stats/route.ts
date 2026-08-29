import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const payload = token ? verifyToken(token) : null
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

    // Monday of current week
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1 // 0=Mon
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0)
    const weekEnd   = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)

    // +7 days for upcoming
    const upcomingEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8, 0, 0, 0)

    const include = {
      client:     { select: { id: true, name: true, address: true, city: true, postalCode: true, phone: true, contactPerson: true } },
      location:   { select: { id: true, name: true, address: true, city: true, postalCode: true, phone: true, contactPerson: true } },
      assignedTo: { select: { id: true, name: true } },
    }

    // All technicians (for today view columns)
    const technicians = await prisma.user.findMany({
      where: { role: 'TECHNICIAN' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    // Unassigned open interventions for today's drag-and-drop panel
    const unassignedOpen = await prisma.intervention.findMany({
      where: { status: 'OPEN', assignedToId: null },
      include,
      orderBy: { createdAt: 'asc' },
    })

    const activeNow = await prisma.intervention.findMany({
      where: { status: { in: ['IN_PROGRESS', 'QUALITY_ASSESSMENT'] } },
      include,
      orderBy: { scheduledDate: 'asc' },
    })

    const scheduledToday = await prisma.intervention.findMany({
      where: {
        status: 'ASSIGNED',
        scheduledDate: { gte: todayStart, lte: todayEnd },
      },
      include,
      orderBy: { scheduledDate: 'asc' },
    })

    const completedToday = await prisma.intervention.count({
      where: {
        status: 'COMPLETED',
        updatedAt: { gte: todayStart, lte: todayEnd },
      },
    })

    const needsPlanning = await prisma.intervention.count({
      where: { status: { in: ['OPEN', 'ASSIGNED'] }, scheduledDate: null },
    })

    // Em atraso: agendadas para um dia anterior a hoje e ainda por concluir
    // (ATRIBUÍDA / EM CURSO / AGUARDA PEÇAS). No próprio dia agendado não conta como atraso.
    // SQL raw com comparação em texto: não depende do enum InterventionStatus
    // do cliente Prisma gerado, que pode estar em cache desalinhado do schema.
    const overdueRows = await prisma.$queryRaw<Array<{
      id: string
      reference: string | null
      status: string
      scheduledDate: Date | null
      scheduledTime: string | null
      breakdown: string | null
      comments: string | null
      clientId: string
      clientName: string
      clientAddress: string | null
      clientCity: string | null
      clientPostalCode: string | null
      clientPhone: string | null
      clientContactPerson: string | null
      locationId: string | null
      locationName: string | null
      locationAddress: string | null
      locationCity: string | null
      locationPostalCode: string | null
      locationPhone: string | null
      locationContactPerson: string | null
      techId: string | null
      techName: string | null
    }>>`
      SELECT i.id::text AS id, i.reference, i.status::text AS status,
             i."scheduledDate", i."scheduledTime", i.breakdown, i.comments,
             c.id::text AS "clientId", c.name AS "clientName", c.address AS "clientAddress",
             c.city AS "clientCity", c."postalCode" AS "clientPostalCode",
             c.phone AS "clientPhone", c."contactPerson" AS "clientContactPerson",
             l.id::text AS "locationId", l.name AS "locationName", l.address AS "locationAddress",
             l.city AS "locationCity", l."postalCode" AS "locationPostalCode",
             l.phone AS "locationPhone", l."contactPerson" AS "locationContactPerson",
             u.id::text AS "techId", u.name AS "techName"
      FROM "Intervention" i
      JOIN "Client" c ON c.id = i."clientId"
      LEFT JOIN "CompanyLocation" l ON l.id = i."locationId"
      LEFT JOIN "User" u ON u.id = i."assignedToId"
      WHERE i.status::text IN ('ASSIGNED', 'IN_PROGRESS', 'PENDING_PARTS')
        AND i."scheduledDate" IS NOT NULL
        AND i."scheduledDate" < ${todayStart}::timestamptz
      ORDER BY i."scheduledDate" ASC
    `

    const DAY_MS = 24 * 60 * 60 * 1000
    const overdue = overdueRows.map(r => {
      const d = new Date(r.scheduledDate!)
      const scheduledDayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      return {
        id: r.id,
        reference: r.reference,
        status: r.status,
        scheduledDate: r.scheduledDate,
        scheduledTime: r.scheduledTime,
        breakdown: r.breakdown,
        comments: r.comments,
        client: {
          id: r.clientId, name: r.clientName, address: r.clientAddress, city: r.clientCity,
          postalCode: r.clientPostalCode, phone: r.clientPhone, contactPerson: r.clientContactPerson,
        },
        location: r.locationId
          ? {
              id: r.locationId, name: r.locationName ?? '', address: r.locationAddress, city: r.locationCity,
              postalCode: r.locationPostalCode, phone: r.locationPhone, contactPerson: r.locationContactPerson,
            }
          : null,
        assignedTo: r.techId ? { id: r.techId, name: r.techName ?? '' } : null,
        daysLate: Math.round((todayStart.getTime() - scheduledDayStart.getTime()) / DAY_MS),
      }
    })

    // This week interventions (for week bar + tech load)
    const weekInterventions = await prisma.intervention.findMany({
      where: {
        status: { notIn: ['CANCELED'] },
        scheduledDate: { gte: weekStart, lte: weekEnd },
      },
      include,
      orderBy: { scheduledDate: 'asc' },
    })

    // Week day counts (Mon=0 … Sun=6)
    const weekDayCounts = [0, 0, 0, 0, 0, 0, 0]
    for (const iv of weekInterventions) {
      if (!iv.scheduledDate) continue
      const d = new Date(iv.scheduledDate)
      const idx = d.getDay() === 0 ? 6 : d.getDay() - 1
      weekDayCounts[idx]++
    }

    // Technician load this week
    const techMap = new Map<string, { id: string; name: string; count: number }>()
    for (const iv of weekInterventions) {
      if (!iv.assignedTo) continue
      const t = techMap.get(iv.assignedTo.id)
      if (t) t.count++
      else techMap.set(iv.assignedTo.id, { id: iv.assignedTo.id, name: iv.assignedTo.name, count: 1 })
    }
    const techLoad = Array.from(techMap.values()).sort((a, b) => b.count - a.count)

    // Upcoming: tomorrow → +7 days
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0)
    const upcoming = await prisma.intervention.findMany({
      where: {
        status: { notIn: ['COMPLETED', 'CANCELED'] },
        scheduledDate: { gte: tomorrowStart, lte: upcomingEnd },
      },
      include,
      orderBy: { scheduledDate: 'asc' },
      take: 20,
    })

    // Calendar: -45 days to +120 days (janela larga para a navegação de 2 semanas)
    const calendarStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 45, 0, 0, 0)
    const calendarEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 120, 23, 59, 59)
    const calendarInterventions = await prisma.intervention.findMany({
      where: {
        status: { notIn: ['CANCELED'] },
        scheduledDate: { gte: calendarStart, lte: calendarEnd },
      },
      include,
      orderBy: { scheduledDate: 'asc' },
    })

    // Today's list = active + scheduled today
    const todayList = [
      ...activeNow,
      ...scheduledToday.filter(s => !activeNow.find(a => a.id === s.id)),
    ]

    // Augment all intervention lists with comments (stale Prisma client doesn't select it)
    const allIds = [...new Set([
      ...todayList, ...calendarInterventions, ...unassignedOpen, ...upcoming, ...weekInterventions,
    ].map(i => i.id))]
    const commentsRows = allIds.length > 0
      ? await prisma.$queryRaw<Array<{ id: string; comments: string | null }>>`
          SELECT id::text, comments FROM "Intervention" WHERE id::text = ANY(${allIds})
        `
      : []
    const commentsMap = new Map(commentsRows.map(r => [r.id, r.comments]))
    const withComments = (list: any[]) => list.map(i => ({ ...i, comments: commentsMap.get(i.id) ?? null }))

    return NextResponse.json({
      counters: {
        activeNow: activeNow.length,
        scheduledToday: scheduledToday.length,
        completedToday,
        needsPlanning,
        overdue: overdue.length,
      },
      overdue,
      todayList: withComments(todayList),
      calendarInterventions: withComments(calendarInterventions),
      unassignedOpen: withComments(unassignedOpen),
      weekStart: weekStart.toISOString(),
      weekDayCounts,
      techLoad,
      upcoming: withComments(upcoming),
      technicians,
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
