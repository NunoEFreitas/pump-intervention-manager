'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { printTechDaySchedule, printAllTechsDaySchedule } from '@/lib/techSchedulePrint'

const STATUS_META: Record<string, { label: string; dot: string; badge: string }> = {
  OPEN:               { label: 'Aberta',           dot: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  ASSIGNED:           { label: 'Atribuída',         dot: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  IN_PROGRESS:        { label: 'Em Curso',          dot: 'bg-indigo-500', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  PENDING_PARTS:      { label: 'Aguarda Peças',     dot: 'bg-rose-500',   badge: 'bg-rose-50 text-rose-700 border-rose-200' },
  QUALITY_ASSESSMENT: { label: 'Avaliação Qualid.', dot: 'bg-purple-500', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  COMPLETED:          { label: 'Concluída',         dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700 border-green-200' },
  CANCELED:           { label: 'Cancelada',         dot: 'bg-gray-400',   badge: 'bg-gray-50 text-gray-500 border-gray-200' },
}


interface ContactInfo {
  name: string
  address: string | null
  city: string | null
  postalCode: string | null
  phone: string | null
  contactPerson: string | null
}

interface Intervention {
  id: string
  reference: string | null
  status: string
  scheduledDate: string | null
  scheduledTime: string | null
  breakdown: string | null
  comments: string | null
  client: ContactInfo
  location: (ContactInfo & { id: string }) | null
  assignedTo: { id: string; name: string } | null
}

interface DashboardData {
  counters: { activeNow: number; scheduledToday: number; completedToday: number; needsPlanning: number }
  todayList: Intervention[]
  calendarInterventions: Intervention[]
  unassignedOpen: Intervention[]
  weekStart: string
  weekDayCounts: number[]
  techLoad: { id: string; name: string; count: number }[]
  upcoming: Intervention[]
  technicians: { id: string; name: string }[]
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.OPEN
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${m.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  )
}

function InterventionRow({ iv, onClick }: { iv: Intervention; onClick: () => void }) {
  const dest = iv.location?.city || iv.location?.name || iv.client.city || iv.client.name
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 cursor-pointer group transition-colors border border-transparent hover:border-gray-200"
    >
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_META[iv.status]?.dot ?? 'bg-gray-400'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 truncate">{iv.client.name}</span>
          {iv.reference && <span className="text-xs text-gray-400 font-mono">{iv.reference}</span>}
        </div>
        <div className="text-xs text-gray-500 truncate">
          {dest && <span>{dest}</span>}
          {iv.assignedTo && <span className="ml-2 text-gray-400">· {iv.assignedTo.name}</span>}
        </div>
      </div>
      <StatusBadge status={iv.status} />
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const locale = useLocale()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [view, setView] = useState<'board' | 'today'>('board')
  const [filterTechId, setFilterTechId] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [assigning, setAssigning] = useState(false)
  const [dropHover, setDropHover] = useState<{ techId: string; hour: number } | null>(null)
  const [calendarOffset, setCalendarOffset] = useState(0) // days offset from today
  const gridRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/dashboard/stats', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        setData(await res.json())
        setLastRefresh(new Date())
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const goTo = (id: string) => router.push(`/${locale}/interventions/${id}`)

  const assignIntervention = async (interventionId: string, techId: string, time: string) => {
    if (assigning) return
    setAssigning(true)
    try {
      const token = localStorage.getItem('token')
      const today = new Date().toISOString().slice(0, 10)
      await fetch(`/api/interventions/${interventionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assignedToId: techId, scheduledDate: today, scheduledTime: time, status: 'ASSIGNED' }),
      })
      await fetchData()
    } finally {
      setAssigning(false)
      setDraggingId(null)
    }
  }

  const todayLabel = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-400 animate-pulse">A carregar…</div>
      </div>
    )
  }

  if (!data) return null

  // Unique techs from all calendar interventions (for the filter select)
  const calendarTechs = Array.from(
    new Map(
      data.calendarInterventions
        .filter(iv => iv.assignedTo)
        .map(iv => [iv.assignedTo!.id, iv.assignedTo!])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name))

  // Group upcoming by date label
  const upcomingGroups: { label: string; date: string; items: Intervention[] }[] = []
  for (const iv of data.upcoming) {
    const d = iv.scheduledDate ? new Date(iv.scheduledDate) : null
    const label = d ? d.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'
    const dateKey = d ? d.toDateString() : '—'
    const g = upcomingGroups.find(g => g.date === dateKey)
    if (g) g.items.push(iv)
    else upcomingGroups.push({ label, date: dateKey, items: [iv] })
  }

  // Calendar: build 7 columns starting from today + calendarOffset
  const todayKey = new Date(new Date().setHours(0, 0, 0, 0)).toDateString()
  const calendarColumns = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + calendarOffset + i)
    d.setHours(0, 0, 0, 0)
    const key = d.toDateString()
    const items = data.calendarInterventions.filter(iv => {
      if (!iv.scheduledDate) return false
      const ivd = new Date(iv.scheduledDate)
      ivd.setHours(0, 0, 0, 0)
      if (ivd.toDateString() !== key) return false
      if (filterTechId) return iv.assignedTo?.id === filterTechId
      return true
    })
    return {
      date: d,
      isToday: key === todayKey,
      dayLabel: d.toLocaleDateString('pt-PT', { weekday: 'short' }),
      dateLabel: d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }),
      items,
    }
  })

  // Today view: hourly grid per technician
  const HOUR_START = 0   // 00:00
  const HOUR_END   = 24  // 24:00
  const PX_PER_HOUR = 64 // px height per hour slot
  const TOTAL_H = (HOUR_END - HOUR_START) * PX_PER_HOUR
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i)

  const todayItems = data.calendarInterventions.filter(iv => {
    if (!iv.scheduledDate) return false
    const ivd = new Date(iv.scheduledDate)
    ivd.setHours(0, 0, 0, 0)
    if (ivd.toDateString() !== todayKey) return false
    if (filterTechId) return iv.assignedTo?.id === filterTechId
    return true
  })

  // Build tech columns: all techs when no filter, else only filtered tech
  const techColBase: { id: string; name: string; items: Intervention[] }[] = filterTechId
    ? data.technicians
        .filter(t => t.id === filterTechId)
        .map(t => ({ ...t, items: [] }))
    : data.technicians.map(t => ({ ...t, items: [] }))

  const techMap = new Map(techColBase.map(t => [t.id, t]))
  for (const iv of todayItems) {
    const key = iv.assignedTo?.id
    if (key && techMap.has(key)) {
      techMap.get(key)!.items.push(iv)
    }
  }
  const techCols = Array.from(techMap.values())

  function ivTop(iv: Intervention): number {
    const t = iv.scheduledTime ?? (iv.scheduledDate ? new Date(iv.scheduledDate).toTimeString().slice(0, 5) : null)
    if (!t) return 0
    const [hh, mm] = t.split(':').map(Number)
    const mins = (hh - HOUR_START) * 60 + (mm || 0)
    return Math.max(0, Math.min(mins / 60 * PX_PER_HOUR, TOTAL_H - 4))
  }

  const STATUS_BG: Record<string, string> = {
    OPEN:               'bg-amber-50  border-amber-300  text-amber-900',
    ASSIGNED:           'bg-blue-50   border-blue-300   text-blue-900',
    IN_PROGRESS:        'bg-indigo-100 border-indigo-400 text-indigo-900',
    PENDING_PARTS:      'bg-rose-50   border-rose-300   text-rose-900',
    QUALITY_ASSESSMENT: 'bg-purple-50 border-purple-300 text-purple-900',
    COMPLETED:          'bg-green-50  border-green-300  text-green-900',
    CANCELED:           'bg-gray-50   border-gray-300   text-gray-500',
  }

  const nowMinutes = (() => {
    const n = new Date()
    return (n.getHours() - HOUR_START) * 60 + n.getMinutes()
  })()
  const nowTop = nowMinutes / 60 * PX_PER_HOUR

  const STATUS_BORDER: Record<string, string> = {
    OPEN:               'border-l-amber-400',
    ASSIGNED:           'border-l-blue-400',
    IN_PROGRESS:        'border-l-indigo-500',
    PENDING_PARTS:      'border-l-rose-500',
    QUALITY_ASSESSMENT: 'border-l-purple-500',
    COMPLETED:          'border-l-green-500',
    CANCELED:           'border-l-gray-300',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 capitalize">{todayLabel}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Atualizado às {lastRefresh.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setView('board')}
              title="Vista de painel"
              className={`px-2.5 py-1.5 transition-colors ${view === 'board' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setView('today')}
              title="Vista do dia — horário"
              className={`px-2.5 py-1.5 transition-colors ${view === 'today' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
          {view === 'today' && calendarTechs.length > 0 && (
            <select
              value={filterTechId}
              onChange={e => setFilterTechId(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            >
              <option value="">Todos os técnicos</option>
              {calendarTechs.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Atualizar
          </button>
        </div>
      </div>

      {view === 'today' && (
        <div className="flex gap-4 items-start">

          {/* Unassigned interventions panel */}
          {(data.unassignedOpen?.length ?? 0) > 0 && (
            <div className="w-52 shrink-0 card p-0 overflow-hidden">
              <div className="px-3 py-2 bg-amber-50 border-b border-amber-200">
                <p className="text-xs font-semibold text-amber-800">Sem Atribuição</p>
                <p className="text-xs text-amber-600">{data.unassignedOpen.length} interv. — arrastar para atribuir</p>
              </div>
              <div className="p-2 space-y-1.5 max-h-[75vh] overflow-y-auto">
                {data.unassignedOpen.map(iv => (
                  <div
                    key={iv.id}
                    draggable
                    onDragStart={e => { e.dataTransfer.setData('interventionId', iv.id); setDraggingId(iv.id) }}
                    onDragEnd={() => setDraggingId(null)}
                    onClick={() => goTo(iv.id)}
                    className={`rounded border px-2 py-1.5 cursor-grab active:cursor-grabbing text-xs select-none transition-opacity ${draggingId === iv.id ? 'opacity-40' : 'opacity-100'} bg-amber-50 border-amber-300 text-amber-900 hover:shadow-sm`}
                  >
                    <div className="font-semibold truncate">{iv.client.name}</div>
                    {iv.reference && <div className="font-mono text-amber-600 text-[10px]">{iv.reference}</div>}
                    {(iv.location?.city || iv.client.city) && (
                      <div className="text-amber-700 truncate">{iv.location?.city || iv.client.city}</div>
                    )}
                    {iv.breakdown && <div className="text-amber-600 truncate mt-0.5 italic">{iv.breakdown}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Time grid */}
          <div className="flex-1 card p-0 overflow-hidden min-w-0">
            {/* Single scroll container — both axes — so header and grid scroll together horizontally */}
            <div className="overflow-auto max-h-[75vh]" ref={gridRef}>
              <div className="flex flex-col" style={{ minWidth: `${56 + techCols.length * 128}px` }}>

                {/* Column headers — sticky vertically within the scroll container */}
                <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
                  <div className="w-14 shrink-0 border-r border-gray-200 flex items-center justify-center">
                    <button
                      onClick={() => printAllTechsDaySchedule(techCols, todayLabel)}
                      title="Imprimir agenda de todos os técnicos"
                      className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                    </button>
                  </div>
                  {techCols.length === 0 ? (
                    <div className="flex-1 px-4 py-2 text-xs text-gray-400">Nenhum técnico disponível.</div>
                  ) : techCols.map(tc => (
                    <div key={tc.id} className="flex-1 min-w-32 px-2 py-2 border-r border-gray-200 last:border-r-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="text-xs font-semibold text-gray-800 truncate">{tc.name}</div>
                        <button
                          onClick={() => printTechDaySchedule(tc.name, tc.items, todayLabel)}
                          title="Imprimir agenda"
                          className="shrink-0 p-0.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                        </button>
                      </div>
                      <div className="text-xs text-gray-400">{tc.items.length} interv.</div>
                    </div>
                  ))}
                </div>

                {/* Time grid body */}
                <div className="flex">
                  {/* Time gutter */}
                  <div className="w-14 shrink-0 border-r border-gray-200 select-none">
                    {hours.map(h => (
                      <div key={h} className="border-b border-gray-100 flex items-start justify-end pr-2 pt-1" style={{ height: PX_PER_HOUR }}>
                        <span className="text-xs text-gray-400 font-mono leading-none">{String(h).padStart(2,'0')}:00</span>
                      </div>
                    ))}
                  </div>

                  {/* Tech columns */}
                  {techCols.map(tc => (
                  <div
                    key={tc.id}
                    className="flex-1 min-w-32 border-r border-gray-200 last:border-r-0 relative"
                    onDragOver={e => {
                      e.preventDefault()
                      const colRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      const relY = e.clientY - colRect.top
                      const hour = Math.floor(relY / PX_PER_HOUR) + HOUR_START
                      setDropHover({ techId: tc.id, hour: Math.max(HOUR_START, Math.min(hour, HOUR_END - 1)) })
                    }}
                    onDragLeave={() => setDropHover(null)}
                    onDrop={e => {
                      e.preventDefault()
                      setDropHover(null)
                      const ivId = e.dataTransfer.getData('interventionId')
                      if (!ivId) return
                      const colRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      const relY = e.clientY - colRect.top
                      const totalMins = Math.round((relY / PX_PER_HOUR) * 60 / 15) * 15
                      const hh = HOUR_START + Math.floor(totalMins / 60)
                      const mm = totalMins % 60
                      const time = `${String(Math.min(hh, HOUR_END - 1)).padStart(2,'0')}:${String(mm).padStart(2,'0')}`
                      assignIntervention(ivId, tc.id, time)
                    }}
                  >
                    {/* Hour lines — highlight hovered slot */}
                    {hours.map(h => (
                      <div
                        key={h}
                        className={`border-b border-gray-100 transition-colors ${dropHover?.techId === tc.id && dropHover.hour === h ? 'bg-blue-100 border-blue-300' : ''}`}
                        style={{ height: PX_PER_HOUR }}
                      />
                    ))}

                    {/* Now line */}
                    {nowMinutes >= 0 && nowMinutes <= (HOUR_END - HOUR_START) * 60 && (
                      <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: nowTop }}>
                        <div className="flex items-center">
                          <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                          <div className="flex-1 h-px bg-red-400" />
                        </div>
                      </div>
                    )}

                    {/* Intervention blocks */}
                    {tc.items.map(iv => (
                      <div
                        key={iv.id}
                        onClick={() => goTo(iv.id)}
                        className={`absolute left-1 right-1 rounded border cursor-pointer hover:shadow-md transition-shadow overflow-hidden ${STATUS_BG[iv.status] ?? STATUS_BG.OPEN}`}
                        style={{ top: ivTop(iv) + 2, minHeight: 52, maxHeight: PX_PER_HOUR - 6 }}
                        title={`${iv.client.name}${iv.scheduledTime ? ' — ' + iv.scheduledTime : ''}`}
                      >
                        <div className="px-1.5 py-1 h-full flex flex-col justify-between">
                          <div>
                            {iv.scheduledTime && (
                              <div className="text-xs font-bold tabular-nums leading-none mb-0.5">{iv.scheduledTime}</div>
                            )}
                            <div className="text-xs font-semibold leading-tight truncate">{iv.client.name}</div>
                            {(iv.location?.city || iv.client.city) && (
                              <div className="text-xs opacity-70 truncate leading-tight">{iv.location?.city || iv.client.city}</div>
                            )}
                          </div>
                          <div className={`text-xs font-medium truncate ${STATUS_META[iv.status]?.badge.split(' ')[1] ?? ''}`}>
                            {STATUS_META[iv.status]?.label}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'board' && <>
      {/* Counter strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Em Curso Agora',  value: data.counters.activeNow,      color: 'text-indigo-600', bg: 'bg-indigo-50',  border: 'border-indigo-100', status: 'IN_PROGRESS' },
          { label: 'Agendadas Hoje',  value: data.counters.scheduledToday, color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-100',   status: 'ASSIGNED' },
          { label: 'Concluídas Hoje', value: data.counters.completedToday, color: 'text-green-600',  bg: 'bg-green-50',   border: 'border-green-100',  status: 'COMPLETED' },
          { label: 'Sem Agendamento', value: data.counters.needsPlanning,  color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-100',  status: 'OPEN' },
        ].map(c => (
          <div
            key={c.label}
            onClick={() => router.push(`/${locale}/interventions?status=${c.status}`)}
            className={`${c.bg} border ${c.border} rounded-xl px-4 py-3 cursor-pointer hover:shadow-sm transition-shadow`}
          >
            <div className={`text-3xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Weekly calendar — full width */}
      <div className="space-y-5">
        <div className="card p-0 overflow-hidden">
          {/* Calendar header with navigation */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
            <button
              onClick={() => setCalendarOffset(o => o - 7)}
              disabled={calendarOffset <= -28}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-900">
                {calendarColumns[0].date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}
                {' — '}
                {calendarColumns[6].date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}
              </h2>
              {calendarOffset !== 0 && (
                <button
                  onClick={() => setCalendarOffset(0)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 rounded px-2 py-0.5 hover:bg-indigo-50 transition-colors"
                >
                  Hoje
                </button>
              )}
            </div>
            <button
              onClick={() => setCalendarOffset(o => o + 7)}
              disabled={calendarOffset >= 84}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          {/* Calendar grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[560px] grid grid-cols-7">
              {/* Day headers */}
              {calendarColumns.map((col, i) => (
                <div
                  key={i}
                  className={`px-2 py-2.5 text-center border-r last:border-r-0 border-gray-100 ${col.isToday ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-600'}`}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{col.dayLabel}</div>
                  <div className={`text-base font-bold leading-tight mt-0.5 ${col.isToday ? 'text-white' : 'text-gray-900'}`}>{col.date.getDate()}</div>
                </div>
              ))}
              {/* Day columns */}
              {calendarColumns.map((col, i) => (
                <div
                  key={i}
                  className={`min-h-52 p-1.5 space-y-1 border-r last:border-r-0 border-t ${col.isToday ? 'border-indigo-100 bg-indigo-50/20' : 'border-gray-100 bg-white'}`}
                >
                  {col.items.length === 0 ? (
                    <div className="h-8 flex items-center justify-center">
                      <span className="text-xs text-gray-200">—</span>
                    </div>
                  ) : (
                    col.items.map(iv => (
                      <div
                        key={iv.id}
                        onClick={() => goTo(iv.id)}
                        className={`border-l-2 ${STATUS_BORDER[iv.status] ?? 'border-l-gray-300'} bg-white rounded-r px-1.5 py-1 cursor-pointer hover:shadow-sm transition-shadow`}
                      >
                        <div className="text-[11px] font-semibold text-gray-900 truncate leading-tight">{iv.client.name}</div>
                        {iv.scheduledTime && (
                          <div className="text-[10px] text-gray-400 font-mono">{iv.scheduledTime}</div>
                        )}
                        {iv.assignedTo
                          ? <div className="text-[10px] text-indigo-500 truncate">{iv.assignedTo.name}</div>
                          : <div className="text-[10px] text-amber-500">⚠ Por atribuir</div>
                        }
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Today's interventions — below calendar */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Hoje</h2>
            <span className="text-xs text-gray-400">{data.todayList.length} interv.</span>
          </div>
          {data.todayList.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Nenhuma intervenção para hoje.</div>
          ) : (
            <div className="p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-0.5">
              {data.todayList.map(iv => (
                <InterventionRow key={iv.id} iv={iv} onClick={() => goTo(iv.id)} />
              ))}
            </div>
          )}
          {(data.unassignedOpen?.length ?? 0) > 0 && (
            <div
              onClick={() => router.push(`/${locale}/interventions?status=OPEN`)}
              className="px-4 py-2.5 border-t border-amber-100 bg-amber-50 flex items-center gap-2 cursor-pointer hover:bg-amber-100 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-xs text-amber-700 font-medium">{data.unassignedOpen.length} sem atribuição</span>
            </div>
          )}
        </div>

      </div>
      </>}
    </div>
  )
}
