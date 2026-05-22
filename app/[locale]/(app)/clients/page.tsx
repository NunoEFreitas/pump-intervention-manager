'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { printClientList } from '@/lib/clientsPrint'

interface Client {
  id: string
  reference: string | null
  name: string
  city: string
  phone: string
  email: string
  _count?: {
    interventions: number
  }
}

type SortKey = 'name' | 'city' | 'interventions'

export default function ClientsPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalClients, setTotalClients] = useState(0)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [sortBy, setSortBy] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tClients = useTranslations('clients')

  useEffect(() => {
    fetchClients(1, '')
  }, [])

  const fetchClients = async (page: number, search: string) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const p = new URLSearchParams({ page: String(page), search })
      const response = await fetch(`/api/clients?${p}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setClients(data.clients ?? [])
      setTotalPages(data.pages ?? 1)
      setTotalClients(data.total ?? 0)
      setCurrentPage(data.page ?? 1)
    } catch (error) {
      console.error('Error fetching clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => fetchClients(1, value), 350)
  }

  const goToPage = (page: number) => fetchClients(page, searchTerm)

  const handlePrintList = async () => {
    setPdfLoading(true)
    try {
      const token = localStorage.getItem('token')
      const [clientsRes, companyRes] = await Promise.all([
        fetch(`/api/clients?page=1&limit=1000&search=${encodeURIComponent(searchTerm)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/company', { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const clientsData = await clientsRes.json()
      const companyData = await companyRes.json()
      const company = {
        name: companyData.name || '',
        email: companyData.email || '',
        address: companyData.address || '',
        phones: Array.isArray(companyData.phones) ? companyData.phones : [],
        faxes: Array.isArray(companyData.faxes) ? companyData.faxes : [],
        logo: companyData.logo || '',
      }
      printClientList(clientsData.clients ?? [], company)
    } catch { /* ignore */ } finally { setPdfLoading(false) }
  }

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortDir(key === 'interventions' ? 'desc' : 'asc')
    }
  }

  const sortedClients = [...clients].sort((a, b) => {
    let cmp = 0
    if (sortBy === 'name') cmp = a.name.localeCompare(b.name)
    else if (sortBy === 'city') cmp = (a.city || '').localeCompare(b.city || '')
    else if (sortBy === 'interventions') cmp = (a._count?.interventions ?? 0) - (b._count?.interventions ?? 0)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => toggleSort(k)}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
        sortBy === k
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {label}
      {sortBy === k && (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {sortDir === 'desc'
            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
          }
        </svg>
      )}
    </button>
  )

  return (
    <div>
      {/* Page header */}
      <div className="px-4 sm:px-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{tClients('title')}</h1>
          <p className="text-gray-600">{tClients('subtitle')}</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={handlePrintList}
            disabled={pdfLoading}
            className="btn btn-secondary flex-1 sm:flex-none disabled:opacity-60"
          >
            {pdfLoading ? 'A gerar...' : 'PDF'}
          </button>
          <button
            onClick={() => router.push(`/${locale}/clients/new`)}
            className="btn btn-primary flex-1 sm:flex-none"
          >
            {tClients('addClient')}
          </button>
        </div>
      </div>

      {/* Search + sort */}
      <div className="card mb-6">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder={tClients('searchPlaceholder')}
            className="input min-w-0 flex-1"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          <div className="flex items-center gap-1 shrink-0">
            <SortBtn k="name" label="Nome" />
            <SortBtn k="city" label="Cidade" />
            <SortBtn k="interventions" label="Intervenções" />
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500 text-sm">{tClients('loadingClients')}</div>
        </div>
      ) : sortedClients.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600 mb-4">
            {searchTerm ? tClients('noClientsFound') : tClients('noClients')}
          </p>
          {!searchTerm && (
            <button
              onClick={() => router.push(`/${locale}/clients/new`)}
              className="btn btn-primary"
            >
              {tClients('addFirstClient')}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {sortedClients.map((client) => (
              <div
                key={client.id}
                onClick={() => router.push(`/${locale}/clients/${client.id}`)}
                className="card hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-[#1e3a5f] py-3 px-4"
              >
                <div className="flex items-center justify-between gap-3 min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
                    {client.reference && (
                      <span className="font-mono text-xs text-gray-400 shrink-0">{client.reference}</span>
                    )}
                    <span className="font-semibold text-gray-900 truncate">{client.name}</span>
                    {client.city && (
                      <span className="text-sm text-gray-500 truncate hidden sm:block">{client.city}</span>
                    )}
                    {client.phone && (
                      <span className="text-sm text-gray-500 truncate hidden md:block">{client.phone}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {(client._count?.interventions ?? 0) > 0 && (
                      <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                        {client._count!.interventions} {tClients('interventions')}
                      </span>
                    )}
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 px-1">
              <p className="text-sm text-gray-500">
                {totalClients} {totalClients === 1 ? 'cliente' : 'clientes'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Anterior
                </button>
                <span className="text-sm text-gray-600">{currentPage} / {totalPages}</span>
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages || loading}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Próximo →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
