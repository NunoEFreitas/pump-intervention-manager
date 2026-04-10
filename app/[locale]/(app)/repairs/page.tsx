'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface RepairJob {
  id: string
  reference: string | null
  type: 'STOCK' | 'CLIENT'
  itemId: string
  serialNumberId: string | null
  quantity: number
  status: string
  problem: string | null
  workNotes: string | null
  sentAt: string
  completedAt: string | null
  itemName: string
  partNumber: string
  tracksSerialNumbers: boolean
  snNumber: string | null
  sentByName: string | null
  completedByName: string | null
  clientName: string | null
  photoCount: number
}

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
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  IN_REPAIR: 'bg-blue-100 text-blue-800 border-blue-300',
  QUOTE: 'bg-orange-100 text-orange-800 border-orange-300',
  OVM: 'bg-purple-100 text-purple-800 border-purple-300',
  REPAIRED: 'bg-green-100 text-green-800 border-green-300',
  NOT_REPAIRED: 'bg-gray-100 text-gray-700 border-gray-300',
  WRITTEN_OFF: 'bg-red-100 text-red-800 border-red-300',
  RETURNED_TO_CLIENT: 'bg-green-100 text-green-800 border-green-300',
}

const STATUS_BORDER: Record<string, string> = {
  PENDING: 'border-l-yellow-400',
  IN_REPAIR: 'border-l-blue-500',
  QUOTE: 'border-l-orange-400',
  OVM: 'border-l-purple-500',
  REPAIRED: 'border-l-green-500',
  NOT_REPAIRED: 'border-l-gray-400',
  WRITTEN_OFF: 'border-l-red-400',
  RETURNED_TO_CLIENT: 'border-l-green-500',
}

const FILTER_OPTIONS = [
  { value: 'ACTIVE', label: 'Ativas' },
  { value: 'ALL', label: 'Todas' },
  { value: 'PENDING', label: 'Criadas' },
  { value: 'IN_REPAIR', label: 'Em Progresso' },
  { value: 'QUOTE', label: 'Orçamento' },
  { value: 'OVM', label: 'Sujeito a OVM' },
  { value: 'REPAIRED', label: 'Devolvido ao Stock' },
  { value: 'NOT_REPAIRED', label: 'Não Reparado' },
  { value: 'WRITTEN_OFF', label: 'Abate' },
  { value: 'RETURNED_TO_CLIENT', label: 'Reparado' },
]

interface WarehouseItemOption {
  id: string
  itemName: string
  partNumber: string
  tracksSerialNumbers: boolean
  mainWarehouse: number
}

interface Client {
  id: string
  name: string
}

interface SnOption {
  id: string
  serialNumber: string
}

export default function RepairsPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string

  const [jobs, setJobs] = useState<RepairJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('ACTIVE')
  const [search, setSearch] = useState('')

  // ── Create Repair Modal ──────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false)
  const [crType, setCrType] = useState<'STOCK' | 'CLIENT'>('STOCK')
  const [crClientId, setCrClientId] = useState('')
  const [crClients, setCrClients] = useState<Client[]>([])
  const [crItemSearch, setCrItemSearch] = useState('')
  const [crItemOptions, setCrItemOptions] = useState<WarehouseItemOption[]>([])
  const [crItemLoading, setCrItemLoading] = useState(false)
  const [crSelectedItem, setCrSelectedItem] = useState<WarehouseItemOption | null>(null)
  const [crSnOptions, setCrSnOptions] = useState<SnOption[]>([])
  const [crSnLoading, setCrSnLoading] = useState(false)
  const [crSnId, setCrSnId] = useState('')
  const [crClientSn, setCrClientSn] = useState('')
  const [crProblem, setCrProblem] = useState('')
  const [crCondition, setCrCondition] = useState('')
  const [crHasAccessories, setCrHasAccessories] = useState(false)
  const [crAccessories, setCrAccessories] = useState('')
  const [crLocationId, setCrLocationId] = useState('')
  const [crLocations, setCrLocations] = useState<{ id: string; name: string; city: string | null }[]>([])
  const [crSubmitting, setCrSubmitting] = useState(false)
  const [crError, setCrError] = useState('')
  const itemSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchJobs = async (filter: string) => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/repairs?status=${filter}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch')
      setJobs(await res.json())
    } catch {
      setError('Erro ao carregar reparações')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs(statusFilter)
  }, [statusFilter])

  const openCreateModal = async () => {
    setShowCreate(true)
    setCrType('STOCK'); setCrClientId(''); setCrItemSearch(''); setCrItemOptions([])
    setCrSelectedItem(null); setCrSnOptions([]); setCrSnId(''); setCrClientSn('')
    setCrProblem(''); setCrCondition(''); setCrHasAccessories(false); setCrAccessories('')
    setCrLocationId(''); setCrLocations([]); setCrError('')
    const token = localStorage.getItem('token')
    const data = await fetch('/api/clients?limit=200', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
    setCrClients(Array.isArray(data.clients) ? data.clients : [])
  }

  const searchItems = async (q: string) => {
    setCrItemLoading(true)
    try {
      const token = localStorage.getItem('token')
      const data = await fetch(`/api/warehouse?search=${encodeURIComponent(q)}&limit=20&minStock=1`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
      setCrItemOptions(Array.isArray(data.items) ? data.items : [])
    } catch { setCrItemOptions([]) } finally { setCrItemLoading(false) }
  }

  const handleItemSearchChange = (value: string) => {
    setCrItemSearch(value)
    setCrSelectedItem(null); setCrSnOptions([]); setCrSnId('')
    if (itemSearchDebounce.current) clearTimeout(itemSearchDebounce.current)
    if (value.trim().length > 0) itemSearchDebounce.current = setTimeout(() => searchItems(value), 300)
    else setCrItemOptions([])
  }

  const selectItem = async (item: WarehouseItemOption) => {
    setCrSelectedItem(item); setCrItemSearch(item.itemName); setCrItemOptions([])
    setCrSnId(''); setCrSnOptions([])
    if (item.tracksSerialNumbers && crType === 'STOCK') {
      setCrSnLoading(true)
      try {
        const token = localStorage.getItem('token')
        const data = await fetch(`/api/warehouse/items/${item.id}/serial-numbers?status=AVAILABLE&location=MAIN_WAREHOUSE`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
        setCrSnOptions(Array.isArray(data) ? data.filter((s: any) => !s.isClientPart) : [])
      } catch { setCrSnOptions([]) } finally { setCrSnLoading(false) }
    }
  }

  const handleCrClientChange = async (clientId: string) => {
    setCrClientId(clientId)
    setCrLocationId('')
    setCrLocations([])
    if (!clientId) return
    try {
      const token = localStorage.getItem('token')
      const data = await fetch(`/api/clients/${clientId}/locations`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
      setCrLocations(Array.isArray(data) ? data : [])
    } catch { /* ignore */ }
  }

  const handleCreateSubmit = async () => {
    if (!crSelectedItem || !crProblem.trim()) { setCrError('Preencha todos os campos obrigatórios'); return }
    if (crType === 'STOCK' && crSelectedItem.tracksSerialNumbers && !crSnId) { setCrError('Selecione o número de série'); return }
    setCrSubmitting(true); setCrError('')
    try {
      const token = localStorage.getItem('token')
      const body: Record<string, any> = { type: crType, itemId: crSelectedItem.id, problem: crProblem }
      if (crClientId) body.clientId = crClientId
      if (crLocationId) body.locationId = crLocationId
      if (crType === 'CLIENT' && crClientSn.trim()) body.clientItemSn = crClientSn.trim()
      if (crType === 'STOCK' && crSelectedItem.tracksSerialNumbers) body.serialNumberId = crSnId
      if (crCondition.trim()) body.conditionDescription = crCondition.trim()
      body.hasAccessories = crHasAccessories
      if (crHasAccessories && crAccessories.trim()) body.accessoriesDescription = crAccessories.trim()
      const res = await fetch('/api/repairs', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { setCrError(data.error || 'Erro ao criar reparação'); return }
      setShowCreate(false)
      router.push(`/${locale}/repairs/${data.repairJobId}`)
    } finally { setCrSubmitting(false) }
  }

  const filtered = jobs.filter(j => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      j.itemName.toLowerCase().includes(s) ||
      j.partNumber.toLowerCase().includes(s) ||
      (j.snNumber?.toLowerCase().includes(s) ?? false) ||
      (j.problem?.toLowerCase().includes(s) ?? false)
    )
  })

  return (
    <div className="px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reparações</h1>
          <p className="text-sm text-gray-500 mt-1">Peças enviadas para reparação</p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary shrink-0">
          + Criar Reparação
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-6">
        <input
          type="text"
          placeholder="Pesquisar peça, fornecedor, problema..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input text-gray-800 w-full"
        />
        <div className="flex gap-2 flex-wrap">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                statusFilter === opt.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{error}</div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          {search ? 'Nenhum resultado para a pesquisa.' : 'Nenhuma reparação encontrada.'}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(job => (
            <div
              key={job.id}
              onClick={() => router.push(`/${locale}/repairs/${job.id}`)}
              className={`bg-white rounded-lg border border-gray-200 border-l-4 ${STATUS_BORDER[job.status] ?? 'border-l-gray-300'} p-4 cursor-pointer hover:shadow-md transition-shadow`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {job.type === 'CLIENT' && (
                      <span className="text-xs font-bold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">CLIENTE</span>
                    )}
                    {job.reference && (
                      <span className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${job.type === 'CLIENT' ? 'text-orange-700 bg-orange-50' : 'text-blue-600 bg-blue-50'}`}>{job.reference}</span>
                    )}
                    <span className="font-semibold text-gray-900 truncate">{job.itemName}</span>
                    <span className="text-xs text-gray-500">{job.partNumber}</span>
                    {job.snNumber && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                        SN: {job.snNumber}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                    {job.problem && (
                      <span className="truncate max-w-xs">
                        <span className="text-gray-400">Problema:</span> {job.problem}
                      </span>
                    )}
                    {job.sentByName && (
                      <span>
                        <span className="text-gray-400">Enviado por:</span> {job.sentByName}
                      </span>
                    )}
                    <span>
                      <span className="text-gray-400">Data:</span>{' '}
                      {new Date(job.sentAt).toLocaleDateString('pt-PT')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {job.photoCount > 0 && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {job.photoCount}
                    </span>
                  )}
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_COLORS[job.status] ?? 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                    {STATUS_LABELS[job.status] ?? job.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* ── Create Repair Modal ─────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Criar Reparação</h2>


              {/* Item search */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Artigo <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="input w-full text-gray-800"
                  placeholder="Pesquisar artigo..."
                  value={crItemSearch}
                  onChange={e => handleItemSearchChange(e.target.value)}
                  autoComplete="off"
                />
                {crItemLoading && <p className="text-xs text-gray-400 mt-1">A procurar...</p>}
                {crItemOptions.length > 0 && !crSelectedItem && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {crItemOptions.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectItem(item)}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        <div className="text-sm font-medium text-gray-900">{item.itemName}</div>
                        <div className="text-xs text-gray-500 flex gap-2">
                          <span className="font-mono">{item.partNumber}</span>
                          {item.tracksSerialNumbers && <span className="text-purple-600">SN Tracked</span>}
                          {crType === 'STOCK' && <span className="text-blue-600">Stock: {item.mainWarehouse}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {crSelectedItem && (
                  <div className="mt-1 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="text-sm text-blue-900 font-medium flex-1">{crSelectedItem.itemName}</span>
                    <button type="button" onClick={() => { setCrSelectedItem(null); setCrItemSearch(''); setCrSnOptions([]); setCrSnId('') }} className="text-xs text-blue-500 hover:text-blue-700">✕</button>
                  </div>
                )}
              </div>

              {/* SN selection — STOCK + SN-tracked */}
              {crType === 'STOCK' && crSelectedItem?.tracksSerialNumbers && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Número de série <span className="text-red-500">*</span></label>
                  {crSnLoading ? (
                    <p className="text-sm text-gray-500">A carregar...</p>
                  ) : crSnOptions.length === 0 ? (
                    <p className="text-sm text-red-600 bg-red-50 rounded p-3">Sem números de série disponíveis no armazém principal.</p>
                  ) : (
                    <div className="border rounded-lg max-h-36 overflow-y-auto divide-y divide-gray-100">
                      {crSnOptions.map(sn => (
                        <label key={sn.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                          <input type="radio" name="crSn" value={sn.id} checked={crSnId === sn.id} onChange={() => setCrSnId(sn.id)} className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-mono">{sn.serialNumber}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Problem */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição de avaria <span className="text-red-500">*</span></label>
                <textarea
                  className="input w-full text-gray-800 resize-none"
                  rows={3}
                  placeholder="Descreva o problema..."
                  value={crProblem}
                  onChange={e => setCrProblem(e.target.value)}
                />
              </div>

              {/* Condition */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado do artigo</label>
                <textarea
                  className="input w-full text-gray-800 resize-none"
                  rows={2}
                  placeholder="Descreva o estado do artigo na entrada..."
                  value={crCondition}
                  onChange={e => setCrCondition(e.target.value)}
                />
              </div>

              {/* Accessories */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input type="checkbox" checked={crHasAccessories} onChange={e => setCrHasAccessories(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm font-medium text-gray-700">Acessórios incluídos</span>
                </label>
                {crHasAccessories && (
                  <textarea
                    className="input w-full text-gray-800 resize-none"
                    rows={2}
                    placeholder="Descreva os acessórios..."
                    value={crAccessories}
                    onChange={e => setCrAccessories(e.target.value)}
                  />
                )}
              </div>

              {crError && <p className="text-sm text-red-600">{crError}</p>}
            </div>

            <div className="flex justify-end gap-3 px-6 pb-6">
              <button onClick={() => setShowCreate(false)} className="btn btn-secondary" disabled={crSubmitting}>Cancelar</button>
              <button
                onClick={handleCreateSubmit}
                className="btn btn-primary"
                disabled={crSubmitting || !crSelectedItem || !crProblem.trim() || (crType === 'STOCK' && crSelectedItem?.tracksSerialNumbers && !crSnId)}
              >
                {crSubmitting ? 'A criar...' : 'Criar Reparação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
