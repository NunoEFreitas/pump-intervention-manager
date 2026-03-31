'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface RepairJob {
  id: string
  reference: string | null
  type: 'STOCK' | 'CLIENT'
  itemId: string
  serialNumberId: string | null
  clientPartId: string | null
  interventionId: string | null
  interventionReference: string | null
  quantity: number
  status: string
  problem: string | null
  clientItemSn: string | null
  conditionDescription: string | null
  hasAccessories: boolean
  accessoriesDescription: string | null
  workNotes: string | null
  repairedByTechId: string | null
  repairedByTechName: string | null
  quoteAmount: number | null
  quoteNotes: string | null
  quoteStatus: string | null
  quotedAt: string | null
  sentAt: string
  completedAt: string | null
  deliveredToClientId: string | null
  locationId: string | null
  locationName: string | null
  locationCity: string | null
  itemName: string
  partNumber: string
  tracksSerialNumbers: boolean
  snExample: string | null
  mainWarehouse: number
  snNumber: string | null
  sentByName: string | null
  completedByName: string | null
  clientName: string | null
  clientPhone: string | null
  clientEmail: string | null
  clientVat: string | null
}

interface HistoryEntry {
  id: string
  eventType: string
  description: string
  performedById: string
  performedByName: string | null
  performedAt: string
}

interface Technician { id: string; name: string }

interface Photo { id: string; filename: string; mimeType: string; createdAt: string }
interface RepairPart { id: string; itemId: string; quantity: number; notes: string | null; addedAt: string; itemName: string; partNumber: string; addedByName: string }
interface WarehouseItem { id: string; itemName: string; partNumber: string; mainWarehouse: number }
interface PhotoData extends Photo { data: string }

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Criada',
  IN_REPAIR: 'Em Progresso',
  QUOTE: 'Orçamento',
  OVM: 'Sujeito a OVM',
  REPAIRED: 'Devolvido ao Stock',
  NOT_REPAIRED: 'Não Reparado',
  WRITTEN_OFF: 'Abate',
  RETURNED_TO_CLIENT: 'Reparado',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  IN_REPAIR: 'bg-blue-100 text-blue-800',
  QUOTE: 'bg-yellow-100 text-yellow-800',
  OVM: 'bg-purple-100 text-purple-800',
  REPAIRED: 'bg-green-100 text-green-800',
  NOT_REPAIRED: 'bg-red-100 text-red-800',
  WRITTEN_OFF: 'bg-red-100 text-red-800',
  RETURNED_TO_CLIENT: 'bg-green-100 text-green-800',
}

const QUOTE_STATUS_LABELS: Record<string, string> = {
  PENDING_CLIENT: 'Pendente de aprovação',
  ACCEPTED: 'Aceite',
  REJECTED: 'Rejeitado',
}

export default function RepairDetailPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const jobId = params.id as string

  const [job, setJob] = useState<RepairJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [workNotes, setWorkNotes] = useState('')
  const [problem, setProblem] = useState('')
  const [conditionDesc, setConditionDesc] = useState('')
  const [hasAccessories, setHasAccessories] = useState(false)
  const [accessoriesDesc, setAccessoriesDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [techLoading, setTechLoading] = useState(false)

  const [photos, setPhotos] = useState<Photo[]>([])
  const [photoMap, setPhotoMap] = useState<Record<string, string>>({})
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null)
  const photoObserverRef = useRef<IntersectionObserver | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  const [history, setHistory] = useState<HistoryEntry[]>([])

  const [parts, setParts] = useState<RepairPart[]>([])
  const [showAddPart, setShowAddPart] = useState(false)
  const [warehouseItems, setWarehouseItems] = useState<WarehouseItem[]>([])
  const [partSearch, setPartSearch] = useState('')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [partQty, setPartQty] = useState(1)
  const [partNotes, setPartNotes] = useState('')
  const [partAdding, setPartAdding] = useState(false)
  const [partError, setPartError] = useState('')

  // Complete modal (STOCK: choose stock/destruction; CLIENT: repaired/not)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [completeNotes, setCompleteNotes] = useState('')

  // Swap modal (CLIENT jobs only)
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [swapSnOptions, setSwapSnOptions] = useState<Array<{ id: string; serialNumber: string }>>([])
  const [swapSnLoading, setSwapSnLoading] = useState(false)
  const [swapReplacementSnId, setSwapReplacementSnId] = useState('')
  const [swapClientSnMode, setSwapClientSnMode] = useState<'auto' | 'manual'>('auto')
  const [swapClientSnValue, setSwapClientSnValue] = useState('')
  const [swapNotes, setSwapNotes] = useState('')
  const [swapError, setSwapError] = useState('')
  const [swapSubmitting, setSwapSubmitting] = useState(false)

  // Quote form
  const [showQuoteForm, setShowQuoteForm] = useState(false)
  const [quoteAmountInput, setQuoteAmountInput] = useState('')
  const [quoteNotesInput, setQuoteNotesInput] = useState('')
  const [quoteFormError, setQuoteFormError] = useState('')
  const [quoteSubmitting, setQuoteSubmitting] = useState(false)

  const token = () => localStorage.getItem('token') || ''

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/repairs/${jobId}`, { headers: { Authorization: `Bearer ${token()}` } })
      if (!res.ok) throw new Error('Not found')
      const data: RepairJob = await res.json()
      setJob(data)
      setWorkNotes(data.workNotes ?? '')
      setProblem(data.problem ?? '')
      setConditionDesc(data.conditionDescription ?? '')
      setHasAccessories(data.hasAccessories ?? false)
      setAccessoriesDesc(data.accessoriesDescription ?? '')
    } catch { setError('Erro ao carregar reparação') }
    finally { setLoading(false) }
  }, [jobId])

  useEffect(() => { fetchJob() }, [fetchJob])

  useEffect(() => {
    setTechLoading(true)
    fetch('/api/technicians', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(d => setTechnicians(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setTechLoading(false))
  }, [])

  const fetchPhotos = useCallback(async () => {
    try {
      const res = await fetch(`/api/repairs/${jobId}/photos`, { headers: { Authorization: `Bearer ${token()}` } })
      setPhotos(Array.isArray(await res.json()) ? await res.clone().json() : [])
    } catch { /* non-blocking */ }
  }, [jobId])

  useEffect(() => { fetchPhotos() }, [fetchPhotos])

  const fetchParts = useCallback(async () => {
    try {
      const res = await fetch(`/api/repairs/${jobId}/parts`, { headers: { Authorization: `Bearer ${token()}` } })
      const d = await res.json()
      setParts(Array.isArray(d) ? d : [])
    } catch { /* non-blocking */ }
  }, [jobId])

  useEffect(() => { fetchParts() }, [fetchParts])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/repairs/${jobId}/history`, { headers: { Authorization: `Bearer ${token()}` } })
      const d = await res.json()
      setHistory(Array.isArray(d) ? d : [])
    } catch { /* non-blocking */ }
  }, [jobId])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const fetchWarehouseItems = async () => {
    try {
      const res = await fetch('/api/warehouse?limit=100', { headers: { Authorization: `Bearer ${token()}` } })
      const d = await res.json()
      const list = Array.isArray(d) ? d : (d.items ?? [])
      setWarehouseItems(list.map((i: any) => ({ id: i.id, itemName: i.itemName, partNumber: i.partNumber, mainWarehouse: i.mainWarehouse })))
    } catch { /* ignore */ }
  }

  useEffect(() => {
    photoObserverRef.current?.disconnect()
    photoObserverRef.current = new IntersectionObserver(async (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const el = entry.target as HTMLElement
        const pid = el.dataset.photoId
        if (!pid || photoMap[pid]) continue
        photoObserverRef.current?.unobserve(el)
        try {
          const res = await fetch(`/api/repairs/${jobId}/photos/${pid}`, { headers: { Authorization: `Bearer ${token()}` } })
          const d: PhotoData = await res.json()
          setPhotoMap(prev => ({ ...prev, [pid]: `data:${d.mimeType};base64,${d.data}` }))
        } catch { /* ignore */ }
      }
    }, { rootMargin: '200px' })
    document.querySelectorAll('[data-photo-id]').forEach(el => photoObserverRef.current?.observe(el))
    return () => photoObserverRef.current?.disconnect()
  }, [photos, jobId, photoMap])

  const scheduleSave = (field: string, value: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true)
      try {
        await fetch(`/api/repairs/${jobId}`, { method: 'PUT', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value }) })
      } finally { setSaving(false) }
    }, 800)
  }

  const uploadPhotos = async (files: FileList) => {
    setPhotoError('')
    const toUpload = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (!toUpload.length) return
    if (toUpload.some(f => f.size > 6 * 1024 * 1024)) { setPhotoError('Cada foto deve ter no máximo 6MB.'); return }
    setPhotoUploading(true)
    try {
      for (const file of toUpload) {
        const b64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve((reader.result as string).split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        await fetch(`/api/repairs/${jobId}/photos`, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, mimeType: file.type, data: b64 }) })
      }
      await fetchPhotos()
    } catch { setPhotoError('Erro ao carregar foto.') }
    finally { setPhotoUploading(false) }
  }

  const deletePhoto = async (photoId: string) => {
    await fetch(`/api/repairs/${jobId}/photos/${photoId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } })
    setPhotos(prev => prev.filter(p => p.id !== photoId))
    setPhotoMap(prev => { const n = { ...prev }; delete n[photoId]; return n })
  }

  const TERMINAL_ACTIONS = ['return_to_stock', 'send_to_destruction', 'complete_repaired', 'complete_not_repaired', 'ovm_not_approved']

  const doAction = async (body: Record<string, unknown>) => {
    setActionLoading(true); setActionError('')
    try {
      const res = await fetch(`/api/repairs/${jobId}`, { method: 'PUT', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erro') }
      if (TERMINAL_ACTIONS.includes(body.action as string)) {
        router.push(`/${locale}/dashboard/repairs`)
      } else {
        await Promise.all([fetchJob(), fetchHistory()])
      }
    } catch (e: unknown) { setActionError(e instanceof Error ? e.message : 'Erro ao executar ação') }
    finally { setActionLoading(false) }
  }

  const openSwapModal = async () => {
    if (!job) return
    setSwapReplacementSnId(''); setSwapClientSnMode(job.snExample && !job.clientItemSn ? 'auto' : 'manual'); setSwapClientSnValue(job.clientItemSn || ''); setSwapNotes(''); setSwapError('')
    setShowSwapModal(true)
    if (job.tracksSerialNumbers) {
      setSwapSnLoading(true)
      try {
        const data = await fetch(
          `/api/warehouse/items/${job.itemId}/serial-numbers?status=AVAILABLE&location=MAIN_WAREHOUSE`,
          { headers: { Authorization: `Bearer ${token()}` } }
        ).then(r => r.json())
        setSwapSnOptions(Array.isArray(data) ? data.filter((s: any) => !s.isClientPart) : [])
      } catch { setSwapSnOptions([]) } finally { setSwapSnLoading(false) }
    }
  }

  const handleConfirmSwap = async () => {
    if (!job?.clientPartId) return
    setSwapSubmitting(true); setSwapError('')
    try {
      const body: Record<string, any> = { notes: swapNotes }
      if (job.tracksSerialNumbers) {
        body.replacementSnId = swapReplacementSnId
        body.clientSnMode = swapClientSnMode
        if (swapClientSnMode === 'manual') body.clientSnValue = swapClientSnValue
      }
      const res = await fetch(`/api/client-parts/${job.clientPartId}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setSwapError(data.error || 'Erro ao processar troca'); return }
      setShowSwapModal(false)
      router.push(`/${locale}/dashboard/repairs/${data.repairJobId}`)
    } catch { setSwapError('Erro inesperado') }
    finally { setSwapSubmitting(false) }
  }

  const handleStart = () => doAction({ action: 'start' })

  const handleCancelClientRepair = async () => {
    if (!job?.clientPartId) return
    if (!confirm('Cancelar esta reparação? A peça voltará ao estado Pendente na intervenção.')) return
    setActionLoading(true); setActionError('')
    try {
      const res = await fetch(`/api/client-parts/${job.clientPartId}/cancel-repair`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erro') }
      // Repair job was deleted — go back to the intervention
      if (job.interventionId) {
        router.push(`/${locale}/dashboard/interventions/${job.interventionId}`)
      } else {
        router.push(`/${locale}/dashboard/repairs`)
      }
    } catch (e: unknown) { setActionError(e instanceof Error ? e.message : 'Erro ao cancelar reparação') }
    finally { setActionLoading(false) }
  }
  const handleAcceptQuote = () => doAction({ action: 'accept_quote' })
  const handleRejectQuote = async () => { await doAction({ action: 'reject_quote' }) }
  const handleSendToOvm = () => doAction({ action: 'send_to_ovm' })
  const handleReturnFromOvm = () => doAction({ action: 'return_from_ovm' })
  const handleOvmFailed = () => doAction({ action: 'ovm_not_approved' })

  const handleCompleteStock = async (destination: 'stock' | 'destruction') => {
    const action = destination === 'stock' ? 'return_to_stock' : 'send_to_destruction'
    await doAction({ action, workNotes: completeNotes || workNotes })
    setShowCompleteModal(false)
  }

  const handleCompleteClient = async (repaired: boolean) => {
    const action = repaired ? 'complete_repaired' : 'complete_not_repaired'
    await doAction({ action, workNotes: completeNotes || workNotes })
    setShowCompleteModal(false)
  }

  const handleSubmitQuote = async () => {
    setQuoteFormError('')
    const amount = parseFloat(quoteAmountInput)
    if (isNaN(amount) || amount < 0) { setQuoteFormError('Valor inválido'); return }
    if (!quoteNotesInput.trim()) { setQuoteFormError('Descrição obrigatória'); return }
    setQuoteSubmitting(true)
    try {
      const res = await fetch(`/api/repairs/${jobId}`, { method: 'PUT', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create_quote', quoteAmount: amount, quoteNotes: quoteNotesInput }) })
      if (!res.ok) { const e = await res.json(); setQuoteFormError(e.error || 'Erro ao criar orçamento'); return }
      setShowQuoteForm(false)
      await Promise.all([fetchJob(), fetchHistory()])
    } finally { setQuoteSubmitting(false) }
  }

  const handleOpenPdf = () => {
    const t = token()
    window.open(`/api/repairs/${jobId}/quote-pdf?token=${encodeURIComponent(t)}`, '_blank')
  }

  const handleAddPart = async () => {
    if (!selectedItemId || partQty < 1) return
    setPartAdding(true); setPartError('')
    try {
      const res = await fetch(`/api/repairs/${jobId}/parts`, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: selectedItemId, quantity: partQty, notes: partNotes || undefined }) })
      const d = await res.json()
      if (!res.ok) { setPartError(d.error || 'Erro ao adicionar peça'); return }
      await Promise.all([fetchParts(), fetchHistory()]); setShowAddPart(false)
    } catch { setPartError('Erro ao adicionar peça') }
    finally { setPartAdding(false) }
  }

  const handleRemovePart = async (partId: string) => {
    await fetch(`/api/repairs/${jobId}/parts/${partId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } })
    await Promise.all([fetchParts(), fetchHistory()])
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
  if (error || !job) return <div className="px-4 sm:px-0"><div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{error || 'Não encontrado'}</div></div>

  const isActive = ['PENDING', 'IN_REPAIR', 'QUOTE', 'OVM'].includes(job.status)
  const isTerminal = !isActive

  // STOCK timeline
  const stockTimeline = job.status === 'WRITTEN_OFF'
    ? ['PENDING', 'IN_REPAIR', 'WRITTEN_OFF']
    : ['PENDING', 'IN_REPAIR', 'REPAIRED']

  // CLIENT timeline
  const clientTimeline = (() => {
    const base = ['PENDING', 'IN_REPAIR']
    if (job.quoteAmount !== null) base.push('QUOTE')
    if (['OVM', 'NOT_REPAIRED', 'RETURNED_TO_CLIENT'].includes(job.status) || job.status === 'OVM') {
      if (!base.includes('OVM')) base.push('OVM')
    }
    if (job.status === 'NOT_REPAIRED') { base.push('NOT_REPAIRED'); return base }
    base.push('RETURNED_TO_CLIENT')
    return base
  })()

  const timeline = job.type === 'CLIENT' ? clientTimeline : stockTimeline
  const timelineOrder = [...timeline]
  const currentIdx = timelineOrder.indexOf(job.status)

  return (
    <div className="px-4 sm:px-0">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <button onClick={() => router.push(`/${locale}/dashboard/repairs`)} className="mt-1 text-gray-400 hover:text-gray-600 transition-colors shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {job.type === 'CLIENT' && <span className="text-xs font-bold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">CLIENTE</span>}
            {job.reference && <span className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${job.type === 'CLIENT' ? 'text-orange-700 bg-orange-50' : 'text-blue-600 bg-blue-50'}`}>{job.reference}</span>}
            <h1 className="text-xl font-bold text-gray-900">{job.itemName}</h1>
            <span className="text-sm text-gray-500">{job.partNumber}</span>
            {job.snNumber && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">SN: {job.snNumber}</span>}
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[job.status] ?? 'bg-gray-100 text-gray-600'}`}>{STATUS_LABELS[job.status] ?? job.status}</span>
            {saving && <span className="text-xs text-gray-400">A guardar...</span>}
          </div>
        </div>
      </div>

      {actionError && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{actionError}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Client info card — CLIENT type only */}
          {(job.type === 'CLIENT' && job.clientName) || job.locationName ? (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-orange-700 mb-3 uppercase tracking-wide">Cliente / Localização</h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {job.clientName && <div className="col-span-2"><dt className="text-orange-600 text-xs">Cliente</dt><dd className="font-semibold text-gray-900">{job.clientName}</dd></div>}
                {job.clientVat && <div><dt className="text-orange-600 text-xs">NIF</dt><dd className="font-medium text-gray-900">{job.clientVat}</dd></div>}
                {job.clientPhone && <div><dt className="text-orange-600 text-xs">Telefone</dt><dd className="font-medium text-gray-900">{job.clientPhone}</dd></div>}
                {job.clientEmail && <div className="col-span-2"><dt className="text-orange-600 text-xs">Email</dt><dd className="font-medium text-gray-900">{job.clientEmail}</dd></div>}
                {job.locationName && (
                  <div className="col-span-2 pt-1 mt-1 border-t border-orange-200">
                    <dt className="text-orange-600 text-xs">Localização</dt>
                    <dd className="font-semibold text-gray-900">{job.locationName}{job.locationCity ? ` — ${job.locationCity}` : ''}</dd>
                  </div>
                )}
              </dl>
            </div>
          ) : null}

          {/* Info card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Informação</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
              <div><dt className="text-gray-500 text-xs">Criada em</dt><dd className="font-medium text-gray-900">{new Date(job.sentAt).toLocaleDateString('pt-PT')}</dd></div>
              {job.sentByName && <div><dt className="text-gray-500 text-xs">Criada por</dt><dd className="font-medium text-gray-900">{job.sentByName}</dd></div>}
              {job.completedAt && <div><dt className="text-gray-500 text-xs">Concluída em</dt><dd className="font-medium text-gray-900">{new Date(job.completedAt).toLocaleDateString('pt-PT')}</dd></div>}
              {job.completedByName && <div><dt className="text-gray-500 text-xs">Concluída por</dt><dd className="font-medium text-gray-900">{job.completedByName}</dd></div>}
              <div>
                <dt className="text-gray-500 text-xs">Técnico responsável</dt>
                <dd>
                  {techLoading ? (
                    <span className="text-sm text-gray-400">A carregar...</span>
                  ) : (
                    <select
                      disabled={isTerminal}
                      value={job.repairedByTechId ?? ''}
                      onChange={async e => {
                        const val = e.target.value
                        setJob(prev => prev ? { ...prev, repairedByTechId: val || null, repairedByTechName: technicians.find(t => t.id === val)?.name ?? null } : prev)
                        await fetch(`/api/repairs/${jobId}`, { method: 'PUT', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ repairedByTechId: val || null }) })
                      }}
                      className="input w-full text-gray-800 text-sm disabled:bg-transparent disabled:border-transparent disabled:px-0 disabled:shadow-none mt-0.5"
                    >
                      <option value="">— Não atribuído —</option>
                      {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  )}
                </dd>
              </div>
              {job.snNumber && <div><dt className="text-gray-500 text-xs">Número de série</dt><dd className="font-semibold font-mono text-gray-900">{job.snNumber}</dd></div>}
              {job.type === 'CLIENT' && job.interventionId && (
                <div>
                  <dt className="text-gray-500 text-xs">Intervenção</dt>
                  <dd className="font-medium">
                    <button
                      onClick={() => router.push(`/${locale}/dashboard/interventions/${job.interventionId}`)}
                      className="text-blue-600 hover:text-blue-800 hover:underline font-mono text-sm"
                    >
                      {job.interventionReference ?? job.interventionId}
                    </button>
                  </dd>
                </div>
              )}
              {job.type === 'CLIENT' && (
                <div className="col-span-2">
                  <dt className="text-gray-500 text-xs">Nº série do artigo do cliente</dt>
                  <dd className="font-semibold font-mono text-gray-900">
                    <input
                      type="text"
                      disabled={isTerminal}
                      defaultValue={job.clientItemSn ?? ''}
                      onBlur={e => { if (e.target.value !== (job.clientItemSn ?? '')) fetch(`/api/repairs/${jobId}`, { method: 'PUT', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ clientItemSn: e.target.value }) }) }}
                      className="input text-gray-900 font-mono w-full mt-0.5 disabled:bg-transparent disabled:border-transparent disabled:px-0 disabled:shadow-none"
                      placeholder="—"
                    />
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Problem */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Detalhes da Avaria</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Problema</label>
                <textarea rows={3} disabled={isTerminal} value={problem} onChange={e => { setProblem(e.target.value); scheduleSave('problem', e.target.value) }} className="input text-gray-800 w-full resize-none disabled:bg-gray-50 disabled:text-gray-500" placeholder="Descrição do problema..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado do artigo</label>
                <textarea rows={3} disabled={isTerminal} value={conditionDesc} onChange={e => { setConditionDesc(e.target.value); scheduleSave('conditionDescription', e.target.value) }} className="input text-gray-800 w-full resize-none disabled:bg-gray-50 disabled:text-gray-500" placeholder="Estado do artigo na entrada..." />
              </div>
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  disabled={isTerminal}
                  checked={hasAccessories}
                  onChange={async e => {
                    const val = e.target.checked
                    setHasAccessories(val)
                    await fetch(`/api/repairs/${jobId}`, { method: 'PUT', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ hasAccessories: val }) })
                  }}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Acessórios incluídos</span>
              </label>
              {hasAccessories && (
                <textarea rows={2} disabled={isTerminal} value={accessoriesDesc} onChange={e => { setAccessoriesDesc(e.target.value); scheduleSave('accessoriesDescription', e.target.value) }} className="input text-gray-800 w-full resize-none disabled:bg-gray-50 disabled:text-gray-500" placeholder="Descreva os acessórios..." />
              )}
            </div>
          </div>

          {/* Quote card (when quote exists) */}
          {job.quoteAmount !== null && (
            <div className={`bg-white rounded-xl border-2 p-5 ${job.quoteStatus === 'ACCEPTED' ? 'border-green-300' : job.quoteStatus === 'REJECTED' ? 'border-red-300' : 'border-yellow-300'}`}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Orçamento</h2>
                <div className="flex items-center gap-2">
                  {job.quoteStatus && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${job.quoteStatus === 'ACCEPTED' ? 'bg-green-100 text-green-800' : job.quoteStatus === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {QUOTE_STATUS_LABELS[job.quoteStatus] ?? job.quoteStatus}
                    </span>
                  )}
                  <button onClick={handleOpenPdf} className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 transition-colors flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    PDF
                  </button>
                </div>
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl font-bold text-gray-900">€{parseFloat(String(job.quoteAmount)).toFixed(2)}</span>
              </div>
              {job.quotedAt && <p className="text-xs text-gray-400 mb-3">Criado em {new Date(job.quotedAt).toLocaleDateString('pt-PT')}</p>}
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.quoteNotes}</p>
            </div>
          )}

          {/* Work notes */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Notas de Trabalho</h2>
            <textarea rows={6} disabled={isTerminal} value={workNotes} onChange={e => { setWorkNotes(e.target.value); scheduleSave('workNotes', e.target.value) }} className="input text-gray-800 w-full resize-none disabled:bg-gray-50 disabled:text-gray-500" placeholder="Registo do trabalho realizado, peças substituídas, observações..." />
          </div>

          {/* Parts used */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Peças Utilizadas {parts.length > 0 && <span className="ml-1 text-gray-400 font-normal">({parts.length})</span>}</h2>
              {isActive && (
                <button onClick={() => { setPartSearch(''); setSelectedItemId(''); setPartQty(1); setPartNotes(''); setPartError(''); fetchWarehouseItems(); setShowAddPart(true) }} className="btn btn-secondary text-sm flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Adicionar Peça
                </button>
              )}
            </div>
            {parts.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">Sem peças registadas</p> : (
              <div className="space-y-2">
                {parts.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 truncate">{p.itemName}</span>
                        <span className="text-xs text-gray-400">{p.partNumber}</span>
                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">×{p.quantity}</span>
                      </div>
                      {p.notes && <p className="text-xs text-gray-500 mt-0.5">{p.notes}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">Por {p.addedByName} · {new Date(p.addedAt).toLocaleDateString('pt-PT')}</p>
                    </div>
                    {isActive && <button onClick={() => handleRemovePart(p.id)} className="shrink-0 text-red-500 hover:text-red-700 text-xs font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors">Remover</button>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Photos */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Fotos {photos.length > 0 && <span className="ml-1 text-gray-400 font-normal">({photos.length})</span>}</h2>
              <button onClick={() => photoInputRef.current?.click()} disabled={photoUploading} className="btn btn-secondary text-sm flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {photoUploading ? 'A carregar...' : 'Adicionar'}
              </button>
              <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => e.target.files && uploadPhotos(e.target.files)} />
            </div>
            <p className="text-xs text-gray-400 mb-3">Tamanho máximo por foto: 6MB</p>
            {photoError && <p className="text-sm text-red-600 mb-3">{photoError}</p>}
            {photos.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">Sem fotos</p> : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map(photo => (
                  <div key={photo.id} className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden" data-photo-id={photo.id}>
                    {photoMap[photo.id] ? (
                      <img src={photoMap[photo.id]} alt={photo.filename} className="w-full h-full object-cover cursor-pointer" onClick={() => setLightboxPhoto(photoMap[photo.id])} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400" /></div>
                    )}
                    <button onClick={() => deletePhoto(photo.id)} className="absolute top-1.5 right-1.5 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-700 shadow">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* History */}
          {history.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Histórico</h2>
              <ol className="relative border-l border-gray-200 space-y-4 ml-2">
                {history.map((entry) => {
                  const iconColor =
                    entry.eventType === 'CREATED' ? 'bg-gray-400' :
                    entry.eventType === 'PART_ADDED' ? 'bg-blue-500' :
                    entry.eventType === 'PART_REMOVED' ? 'bg-amber-500' :
                    entry.eventType === 'QUOTE_CREATED' ? 'bg-yellow-500' :
                    entry.eventType === 'QUOTE_ACCEPTED' ? 'bg-green-500' :
                    entry.eventType === 'QUOTE_REJECTED' ? 'bg-red-500' :
                    'bg-blue-600'
                  return (
                    <li key={entry.id} className="ml-4">
                      <span className={`absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border-2 border-white ${iconColor}`} />
                      <p className="text-sm text-gray-800">{entry.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {entry.performedByName ?? 'Sistema'} · {new Date(entry.performedAt).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </li>
                  )
                })}
              </ol>
            </div>
          )}
        </div>

        {/* ── Right column: actions + timeline ────────────────────────────── */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Ações</h2>
            <div className="space-y-3">

              {/* PENDING: start */}
              {job.status === 'PENDING' && (
                <button onClick={handleStart} disabled={actionLoading} className="w-full btn bg-blue-600 hover:bg-blue-700 text-white text-sm">
                  Iniciar Reparação
                </button>
              )}

              {/* IN_REPAIR — STOCK */}
              {job.type !== 'CLIENT' && job.status === 'IN_REPAIR' && (
                <button onClick={() => { setCompleteNotes(''); setShowCompleteModal(true) }} disabled={actionLoading} className="w-full btn bg-green-600 hover:bg-green-700 text-white text-sm">
                  Concluir Reparação
                </button>
              )}

              {/* IN_REPAIR — CLIENT */}
              {job.type === 'CLIENT' && job.status === 'IN_REPAIR' && (
                <>
                  {!job.quoteAmount && (
                    <button onClick={() => { setQuoteAmountInput(''); setQuoteNotesInput(''); setQuoteFormError(''); setShowQuoteForm(true) }} disabled={actionLoading} className="w-full btn bg-yellow-500 hover:bg-yellow-600 text-white text-sm">
                      Criar Orçamento
                    </button>
                  )}
                  <button onClick={handleSendToOvm} disabled={actionLoading} className="w-full btn bg-purple-600 hover:bg-purple-700 text-white text-sm">
                    Enviar para OVM
                  </button>
                  <button onClick={() => { setCompleteNotes(''); setShowCompleteModal(true) }} disabled={actionLoading} className="w-full btn bg-green-600 hover:bg-green-700 text-white text-sm">
                    Concluir Reparação
                  </button>
                </>
              )}

              {/* Trocar / Cancelar — CLIENT, active statuses */}
              {job.type === 'CLIENT' && job.clientPartId && ['PENDING', 'IN_REPAIR'].includes(job.status) && (
                <>
                  <button onClick={openSwapModal} disabled={actionLoading} className="w-full btn bg-indigo-600 hover:bg-indigo-700 text-white text-sm">
                    Trocar ao Cliente
                  </button>
                  {job.status === 'PENDING' && (
                    <button onClick={handleCancelClientRepair} disabled={actionLoading} className="w-full btn bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-sm">
                      Cancelar Reparação
                    </button>
                  )}
                </>
              )}

              {/* QUOTE state — CLIENT */}
              {job.status === 'QUOTE' && (
                <>
                  <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">A aguardar aprovação do cliente.</p>
                  <button onClick={handleAcceptQuote} disabled={actionLoading} className="w-full btn bg-green-600 hover:bg-green-700 text-white text-sm">
                    Aceitar Orçamento
                  </button>
                  <button onClick={handleRejectQuote} disabled={actionLoading} className="w-full btn bg-red-500 hover:bg-red-600 text-white text-sm">
                    Rejeitar Orçamento
                  </button>
                  <button onClick={handleOpenPdf} className="w-full btn btn-secondary text-sm flex items-center justify-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Gerar PDF do Orçamento
                  </button>
                </>
              )}

              {/* OVM state — CLIENT */}
              {job.status === 'OVM' && (
                <>
                  <p className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded p-2">A aguardar inspeção da entidade reguladora (OVM).</p>
                  <button onClick={handleReturnFromOvm} disabled={actionLoading} className="w-full btn bg-blue-600 hover:bg-blue-700 text-white text-sm">
                    Conforme — Continuar Reparação
                  </button>
                  <button onClick={handleOvmFailed} disabled={actionLoading} className="w-full btn bg-red-500 hover:bg-red-600 text-white text-sm">
                    Não Conforme
                  </button>
                </>
              )}

              {isTerminal && (
                <p className="text-sm text-gray-500 text-center py-2">Esta reparação está concluída.</p>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Progresso</h2>
            <ol className="space-y-2">
              {timeline.map((s, i) => {
                const done = timelineOrder.indexOf(s) <= currentIdx
                const color = job.type === 'CLIENT' ? 'bg-orange-500' : 'bg-blue-600'
                return (
                  <li key={s} className="flex items-center gap-2.5 text-sm">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${done ? `${color} text-white` : 'bg-gray-100 text-gray-400'}`}>
                      {done ? '✓' : i + 1}
                    </span>
                    <span className={done ? 'text-gray-900 font-medium' : 'text-gray-400'}>{STATUS_LABELS[s] ?? s}</span>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxPhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxPhoto(null)}>
          <img src={lightboxPhoto} alt="Foto" className="max-h-full max-w-full rounded-lg shadow-2xl" />
          <button className="absolute top-4 right-4 text-white text-3xl font-light hover:text-gray-300" onClick={() => setLightboxPhoto(null)}>×</button>
        </div>
      )}

      {/* Add part modal */}
      {showAddPart && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Adicionar Peça</h3>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Pesquisar peça</label>
              <input type="text" className="input text-gray-800 w-full" placeholder="Nome ou número de referência..." value={partSearch} onChange={e => setPartSearch(e.target.value)} autoFocus />
            </div>
            <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto mb-4">
              {warehouseItems.filter(i => { if (!partSearch) return true; const s = partSearch.toLowerCase(); return i.itemName.toLowerCase().includes(s) || i.partNumber.toLowerCase().includes(s) }).map(i => (
                <button key={i.id} onClick={() => setSelectedItemId(i.id)} className={`w-full text-left px-3 py-2 text-sm border-b last:border-0 hover:bg-gray-50 transition-colors ${selectedItemId === i.id ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-800'}`}>
                  <span>{i.itemName}</span>
                  <span className="text-gray-400 ml-1.5 text-xs">{i.partNumber}</span>
                  <span className={`ml-2 text-xs font-semibold ${i.mainWarehouse > 0 ? 'text-green-600' : 'text-red-500'}`}>Stock: {i.mainWarehouse}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                <input type="number" min={1} className="input text-gray-800 w-full" value={partQty} onChange={e => setPartQty(Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <input type="text" className="input text-gray-800 w-full" placeholder="Observação..." value={partNotes} onChange={e => setPartNotes(e.target.value)} />
              </div>
            </div>
            {partError && <p className="text-sm text-red-600 mb-3">{partError}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAddPart(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={handleAddPart} disabled={!selectedItemId || partAdding} className="btn btn-primary disabled:opacity-50">{partAdding ? 'A adicionar...' : 'Adicionar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Swap modal */}
      {showSwapModal && job && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Trocar Peça ao Cliente</h2>
              <p className="text-sm text-gray-500 mb-4">
                Uma unidade de <strong>{job.itemName}</strong> será retirada do stock normal e entregue ao técnico. A peça do cliente entra no nosso stock para reparação.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-800 space-y-1">
                <div>— 1 unidade do stock normal ({job.mainWarehouse} disponível)</div>
                <div>+ 1 unidade no stock do técnico</div>
                <div>Peça do cliente abre reparação de stock (REP-xxx)</div>
                {['PENDING', 'IN_REPAIR'].includes(job.status) && <div className="text-orange-700 font-medium">A reparação de cliente atual será fechada como Não Reparada.</div>}
              </div>

              {job.mainWarehouse < 1 && (
                <p className="text-sm text-red-600 bg-red-50 rounded p-3 mb-4">Sem stock disponível para substituição.</p>
              )}

              {job.tracksSerialNumbers && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Peça de substituição <span className="text-red-500">*</span>
                      <span className="text-xs font-normal text-gray-400 ml-1">— SN a entregar ao técnico</span>
                    </label>
                    {swapSnLoading ? (
                      <p className="text-sm text-gray-500 py-2">A carregar...</p>
                    ) : swapSnOptions.length === 0 ? (
                      <p className="text-sm text-red-600 bg-red-50 rounded p-3">Sem números de série disponíveis no armazém.</p>
                    ) : (
                      <div className="border rounded-lg max-h-36 overflow-y-auto divide-y divide-gray-100">
                        {swapSnOptions.map(sn => (
                          <label key={sn.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                            <input type="radio" name="swapReplacementSn" value={sn.id} checked={swapReplacementSnId === sn.id} onChange={() => setSwapReplacementSnId(sn.id)} className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-mono">{sn.serialNumber}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nº série da peça recebida
                      <span className="text-xs font-normal text-gray-400 ml-1">— como registar no nosso stock</span>
                    </label>
                    {job.snExample ? (
                      <>
                        <div className="flex gap-3 mb-2">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="swapClientSnMode" value="auto" checked={swapClientSnMode === 'auto'} onChange={() => setSwapClientSnMode('auto')} className="w-4 h-4 text-blue-600" />
                            <span className="text-sm">Auto-gerar ({job.snExample}-N)</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name="swapClientSnMode" value="manual" checked={swapClientSnMode === 'manual'} onChange={() => setSwapClientSnMode('manual')} className="w-4 h-4 text-blue-600" />
                            <span className="text-sm">Especificar</span>
                          </label>
                        </div>
                        {swapClientSnMode === 'auto' && (
                          <p className="text-xs text-gray-500 bg-gray-50 rounded p-2">
                            Gerado automaticamente com prefixo <strong>{job.snExample}</strong>.
                            {job.clientItemSn && <> SN do cliente (<span className="font-mono">{job.clientItemSn}</span>) será substituído.</>}
                          </p>
                        )}
                        {swapClientSnMode === 'manual' && (
                          <input type="text" className="input w-full text-sm font-mono" placeholder={`ex: ${job.snExample}-X`} value={swapClientSnValue} onChange={e => setSwapClientSnValue(e.target.value)} />
                        )}
                      </>
                    ) : (
                      <input type="text" className="input w-full text-sm font-mono" placeholder="ex: SN-001" value={swapClientSnValue} onChange={e => setSwapClientSnValue(e.target.value)} />
                    )}
                  </div>
                </>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea className="input w-full text-gray-800 resize-none" rows={2} placeholder="Observações..." value={swapNotes} onChange={e => setSwapNotes(e.target.value)} />
              </div>
              {swapError && <p className="text-sm text-red-600 mb-3">{swapError}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 pb-6">
              <button onClick={() => setShowSwapModal(false)} className="btn btn-secondary" disabled={swapSubmitting}>Cancelar</button>
              <button
                onClick={handleConfirmSwap}
                className="btn btn-primary"
                disabled={
                  swapSubmitting ||
                  job.mainWarehouse < 1 ||
                  (job.tracksSerialNumbers && (!swapReplacementSnId || swapSnOptions.length === 0)) ||
                  (job.tracksSerialNumbers && (swapClientSnMode === 'manual' || !job.snExample) && !swapClientSnValue.trim())
                }
              >
                {swapSubmitting ? 'A processar...' : 'Confirmar Troca'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete STOCK modal */}
      {showCompleteModal && job.type !== 'CLIENT' && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Concluir Reparação</h3>
            <p className="text-sm text-gray-500 mb-4">Escolha o destino da peça após a reparação.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas de trabalho (opcional)</label>
              <textarea rows={2} className="input text-gray-800 w-full resize-none" placeholder="O que foi feito..." value={completeNotes} onChange={e => setCompleteNotes(e.target.value)} />
            </div>
            <div className="space-y-2">
              <button onClick={() => handleCompleteStock('stock')} disabled={actionLoading} className="w-full btn bg-green-600 hover:bg-green-700 text-white text-sm">
                Devolver ao Stock Normal
              </button>
              <button onClick={() => handleCompleteStock('destruction')} disabled={actionLoading} className="w-full btn bg-red-600 hover:bg-red-700 text-white text-sm">
                Enviar para Destruição
              </button>
            </div>
            <button onClick={() => setShowCompleteModal(false)} className="mt-3 w-full btn btn-secondary text-sm" disabled={actionLoading}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Complete CLIENT modal */}
      {showCompleteModal && job.type === 'CLIENT' && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Concluir Reparação de Cliente</h3>
            <p className="text-sm text-gray-500 mb-4">Estado final da reparação.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas de trabalho (opcional)</label>
              <textarea rows={2} className="input text-gray-800 w-full resize-none" placeholder="O que foi feito..." value={completeNotes} onChange={e => setCompleteNotes(e.target.value)} />
            </div>
            <div className="space-y-2">
              <button onClick={() => handleCompleteClient(true)} disabled={actionLoading} className="w-full btn bg-green-600 hover:bg-green-700 text-white text-sm">
                Reparado
              </button>
              <button onClick={() => handleCompleteClient(false)} disabled={actionLoading} className="w-full btn bg-red-500 hover:bg-red-600 text-white text-sm">
                Não Reparado
              </button>
            </div>
            <button onClick={() => setShowCompleteModal(false)} className="mt-3 w-full btn btn-secondary text-sm" disabled={actionLoading}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Quote form modal */}
      {showQuoteForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Criar Orçamento</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor total (€) <span className="text-red-500">*</span></label>
                <input type="number" min="0" step="0.01" className="input text-gray-800 w-full" placeholder="0.00" value={quoteAmountInput} onChange={e => setQuoteAmountInput(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trabalho e materiais incluídos <span className="text-red-500">*</span></label>
                <textarea rows={5} className="input text-gray-800 w-full resize-none" placeholder="Descreva o trabalho e materiais incluídos no orçamento..." value={quoteNotesInput} onChange={e => setQuoteNotesInput(e.target.value)} />
              </div>
              {quoteFormError && <p className="text-sm text-red-600">{quoteFormError}</p>}
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setShowQuoteForm(false)} className="btn btn-secondary" disabled={quoteSubmitting}>Cancelar</button>
              <button onClick={handleSubmitQuote} disabled={quoteSubmitting || !quoteAmountInput || !quoteNotesInput.trim()} className="btn btn-primary disabled:opacity-50">{quoteSubmitting ? 'A criar...' : 'Criar Orçamento'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
