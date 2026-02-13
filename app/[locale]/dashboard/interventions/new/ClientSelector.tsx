'use client'

import { useState, useRef, useEffect } from 'react'

interface Client {
  id: string
  name: string
  city?: string | null
}

interface ClientSelectorProps {
  clients: Client[]
  value: string
  onChange: (clientId: string) => void
  label: string
  required?: boolean
}

export default function ClientSelector({ clients, value, onChange, label, required = false }: ClientSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedClient = clients.find(c => c.id === value)

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.city && client.city.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (clientId: string) => {
    onChange(clientId)
    setIsOpen(false)
    setSearchTerm('')
  }

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
          {selectedClient ? selectedClient.name : 'Select a client...'}
        </span>
        <svg
          className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
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
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>

          <div className="overflow-y-auto max-h-52">
            {filteredClients.length === 0 ? (
              <div className="px-4 py-3 text-gray-500 text-sm">No clients found</div>
            ) : (
              filteredClients.map((client) => (
                <div
                  key={client.id}
                  className={`px-4 py-2 cursor-pointer hover:bg-blue-50 ${
                    client.id === value ? 'bg-blue-100' : ''
                  }`}
                  onClick={() => handleSelect(client.id)}
                >
                  <div className="text-gray-900 font-medium">{client.name}</div>
                  {client.city && (
                    <div className="text-sm text-gray-600">{client.city}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
