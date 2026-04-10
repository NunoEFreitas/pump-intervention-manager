'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'

interface Client {
  id: string
  name: string
  city?: string | null
}

interface ClientSelectorProps {
  value: string
  onChange: (clientId: string, client: Client | null) => void
  label: string
  required?: boolean
  /** Pre-populate with a known client (e.g. from URL param) */
  initialClient?: Client | null
}

export default function ClientSelector({ value, onChange, label, required = false, initialClient }: ClientSelectorProps) {
  const tClients = useTranslations('clients')
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<Client[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(initialClient ?? null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // When dropdown opens with no search yet, load first page
  useEffect(() => {
    if (isOpen) search('')
  }, [isOpen])

  // If a preselected value comes in without an initialClient, fetch the client name
  useEffect(() => {
    if (value && !selectedClient) {
      const token = localStorage.getItem('token')
      fetch(`/api/clients/${value}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setSelectedClient({ id: data.id, name: data.name, city: data.city }) })
        .catch(() => {})
    }
  }, [value])

  const search = useCallback(async (term: string) => {
    setSearching(true)
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams({ search: term, limit: '30' })
      const res = await fetch(`/api/clients?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setResults(Array.isArray(data) ? data : (data.clients ?? []))
    } catch { /* non-blocking */ }
    finally { setSearching(false) }
  }, [])

  const handleSearchInput = (term: string) => {
    setSearchTerm(term)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(term), 300)
  }

  const handleSelect = (client: Client) => {
    setSelectedClient(client)
    onChange(client.id, client)
    setIsOpen(false)
    setSearchTerm('')
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && '*'}
      </label>

      <div
        className="input cursor-pointer flex justify-between items-center text-gray-800"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedClient ? 'text-gray-900' : 'text-gray-500'}>
          {selectedClient ? selectedClient.name : tClients('selectClient')}
        </span>
        <svg
          className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-hidden">
          <div className="p-2 border-b">
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded text-gray-800"
              placeholder={tClients('searchClients')}
              value={searchTerm}
              onChange={(e) => handleSearchInput(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>

          <div className="overflow-y-auto max-h-52">
            {searching ? (
              <div className="px-4 py-3 text-gray-500 text-sm">A pesquisar...</div>
            ) : results.length === 0 ? (
              <div className="px-4 py-3 text-gray-500 text-sm">{tClients('noClientsInDropdown')}</div>
            ) : (
              results.map((client) => (
                <div
                  key={client.id}
                  className={`px-4 py-2 cursor-pointer hover:bg-blue-50 ${client.id === value ? 'bg-blue-100' : ''}`}
                  onClick={() => handleSelect(client)}
                >
                  <div className="text-gray-900 font-medium">{client.name}</div>
                  {client.city && <div className="text-sm text-gray-600">{client.city}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
