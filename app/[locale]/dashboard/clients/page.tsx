'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

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
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tClients = useTranslations('clients')

  useEffect(() => {
    fetchClients(1, '')
  }, [])

  const fetchClients = async (page: number, search: string) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams({ page: String(page), search })
      const response = await fetch(`/api/clients?${params}`, {
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

  return (
    <div>
      <div className="px-4 sm:px-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{tClients('title')}</h1>
          <p className="text-gray-600">{tClients('subtitle')}</p>
        </div>
        <button
          onClick={() => router.push(`/${locale}/dashboard/clients/new`)}
          className="btn btn-primary w-full sm:w-auto"
        >
          {tClients('addClient')}
        </button>
      </div>

      <div className="card mb-6">
        <input
          type="text"
          placeholder={tClients('searchPlaceholder')}
          className="input"
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">{tClients('loadingClients')}</div>
        </div>
      ) : clients.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600 mb-4">
            {searchTerm ? tClients('noClientsFound') : tClients('noClients')}
          </p>
          {!searchTerm && (
            <button
              onClick={() => router.push(`/${locale}/dashboard/clients/new`)}
              className="btn btn-primary"
            >
              {tClients('addFirstClient')}
            </button>
          )}
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <div
              key={client.id}
              className="card hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(`/${locale}/dashboard/clients/${client.id}`)}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  {client.reference && (
                    <p className="text-xs font-mono text-gray-500 mb-0.5">{client.reference}</p>
                  )}
                  <h3 className="text-lg font-semibold text-gray-900">
                    {client.name}
                  </h3>
                </div>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  {client._count?.interventions || 0} {tClients('interventions')}
                </span>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600">
                {client.city && (
                  <div className="flex items-center">
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {client.city}
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center">
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {client.phone}
                  </div>
                )}
                {client.email && (
                  <div className="flex items-center">
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {client.email}
                  </div>
                )}
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
                className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
              <span className="text-sm text-gray-700">{currentPage} / {totalPages}</span>
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages || loading}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
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
