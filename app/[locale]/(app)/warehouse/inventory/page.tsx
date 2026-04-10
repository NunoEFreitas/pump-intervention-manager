'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

interface Session {
  id: string
  type: 'WAREHOUSE' | 'TECHNICIAN'
  technicianName: string | null
  status: 'OPEN' | 'PENDING_APPROVAL' | 'CLOSED' | 'CANCELLED'
  createdByName: string
  createdAt: string
  closedAt: string | null
  totalItems: number
  countedItems: number
  discrepancies: number
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Em contagem',
  PENDING_APPROVAL: 'Aguarda aprovação',
  CLOSED: 'Fechada',
  CANCELLED: 'Cancelada',
}
const STATUS_COLOR: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
  CLOSED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
}

export default function InventoryListPage() {
  const router = useRouter()
  const locale = useLocale()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchSessions() }, [])

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/inventory', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setSessions(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventário</h1>
          <p className="text-gray-600 mt-1">Contagens e verificação de stock</p>
        </div>
        <button
          onClick={() => router.push(`/${locale}/warehouse/inventory/new`)}
          className="btn btn-primary"
        >
          + Nova Contagem
        </button>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-500">A carregar...</div>
      ) : sessions.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500 text-lg">Nenhuma contagem realizada ainda.</p>
          <button
            onClick={() => router.push(`/${locale}/warehouse/inventory/new`)}
            className="btn btn-primary mt-4"
          >
            Iniciar primeira contagem
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Data</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Tipo</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Estado</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Artigos</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Contados</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Divergências</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Criado por</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {sessions.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/${locale}/warehouse/inventory/${s.id}`)}>
                  <td className="px-4 py-3 text-gray-800">
                    {new Date(s.createdAt).toLocaleDateString('pt-PT')}
                    <div className="text-xs text-gray-400">{new Date(s.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td className="px-4 py-3">
                    {s.type === 'WAREHOUSE' ? (
                      <span className="font-medium text-gray-800">Armazém</span>
                    ) : (
                      <div>
                        <span className="font-medium text-gray-800">Técnico</span>
                        <div className="text-xs text-gray-500">{s.technicianName}</div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[s.status]}`}>
                      {STATUS_LABEL[s.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{s.totalItems}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={s.countedItems === s.totalItems ? 'text-green-700 font-medium' : 'text-gray-700'}>
                      {s.countedItems} / {s.totalItems}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.discrepancies > 0 ? (
                      <span className="text-red-600 font-semibold">{s.discrepancies}</span>
                    ) : s.countedItems > 0 ? (
                      <span className="text-green-600">0</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.createdByName}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={e => { e.stopPropagation(); router.push(`/${locale}/warehouse/inventory/${s.id}`) }}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      Abrir →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
