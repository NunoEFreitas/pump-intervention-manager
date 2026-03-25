'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

interface Technician { id: string; name: string }

export default function NewInventoryPage() {
  const router = useRouter()
  const locale = useLocale()
  const [type, setType] = useState<'WAREHOUSE' | 'TECHNICIAN'>('WAREHOUSE')
  const [technicianId, setTechnicianId] = useState('')
  const [notes, setNotes] = useState('')
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch('/api/technicians', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setTechnicians(Array.isArray(data) ? data : []))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (type === 'TECHNICIAN' && !technicianId) { setError('Seleciona um técnico'); return }
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type, technicianId: type === 'TECHNICIAN' ? technicianId : undefined, notes }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao criar sessão'); setLoading(false); return }
      router.push(`/${locale}/dashboard/warehouse/inventory/${data.id}`)
    } catch {
      setError('Erro de rede')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <button onClick={() => router.push(`/${locale}/dashboard/warehouse`)} className="text-blue-600 hover:text-blue-800 mb-4 text-sm">
        ← Voltar
      </button>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nova Contagem de Inventário</h1>

      <form onSubmit={handleSubmit} className="card space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de contagem *</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setType('WAREHOUSE')}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${type === 'WAREHOUSE' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="font-semibold text-gray-900">Armazém Principal</div>
              <div className="text-xs text-gray-500 mt-1">Contagem do stock central</div>
            </button>
            <button
              type="button"
              onClick={() => setType('TECHNICIAN')}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${type === 'TECHNICIAN' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="font-semibold text-gray-900">Stock Técnico</div>
              <div className="text-xs text-gray-500 mt-1">Contagem do stock de um técnico</div>
            </button>
          </div>
        </div>

        {type === 'TECHNICIAN' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Técnico *</label>
            <select
              className="input text-gray-800"
              value={technicianId}
              onChange={e => setTechnicianId(e.target.value)}
              required
            >
              <option value="">Selecionar técnico...</option>
              {technicians.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
          <textarea
            className="input text-gray-800"
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Observações sobre esta contagem..."
          />
        </div>

        {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{error}</div>}

        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800">
          Ao criar, o sistema regista automaticamente o stock atual como referência para comparação.
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn btn-primary flex-1">
            {loading ? 'A criar...' : 'Iniciar Contagem'}
          </button>
          <button type="button" onClick={() => router.push(`/${locale}/dashboard/warehouse`)} className="btn btn-secondary">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
