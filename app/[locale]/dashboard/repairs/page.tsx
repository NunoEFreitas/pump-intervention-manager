'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface RepairJob {
  id: string
  reference: string | null
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
  PENDING: 'Pendente',
  IN_REPAIR: 'Em Reparação',
  REPAIRED: 'Reparado',
  DELIVERED_CLIENT: 'Entregue a Cliente',
  WRITTEN_OFF: 'Abatido',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  IN_REPAIR: 'bg-blue-100 text-blue-800 border-blue-300',
  REPAIRED: 'bg-green-100 text-green-800 border-green-300',
  DELIVERED_CLIENT: 'bg-purple-100 text-purple-800 border-purple-300',
  WRITTEN_OFF: 'bg-red-100 text-red-800 border-red-300',
}

const STATUS_BORDER: Record<string, string> = {
  PENDING: 'border-l-yellow-400',
  IN_REPAIR: 'border-l-blue-500',
  REPAIRED: 'border-l-green-500',
  DELIVERED_CLIENT: 'border-l-purple-500',
  WRITTEN_OFF: 'border-l-red-400',
}

const FILTER_OPTIONS = [
  { value: 'ACTIVE', label: 'Ativas' },
  { value: 'ALL', label: 'Todas' },
  { value: 'PENDING', label: 'Pendentes' },
  { value: 'IN_REPAIR', label: 'Em Reparação' },
  { value: 'REPAIRED', label: 'Reparadas' },
  { value: 'WRITTEN_OFF', label: 'Abatidas' },
]

export default function RepairsPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string

  const [jobs, setJobs] = useState<RepairJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('ACTIVE')
  const [search, setSearch] = useState('')

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
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
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
        <input
          type="text"
          placeholder="Pesquisar peça, fornecedor, problema..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input text-gray-800 sm:w-72"
        />
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
              onClick={() => router.push(`/${locale}/dashboard/repairs/${job.id}`)}
              className={`bg-white rounded-lg border border-gray-200 border-l-4 ${STATUS_BORDER[job.status] ?? 'border-l-gray-300'} p-4 cursor-pointer hover:shadow-md transition-shadow`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {job.reference && (
                      <span className="text-xs font-mono font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{job.reference}</span>
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
    </div>
  )
}
