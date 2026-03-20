'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface LocationEquipment {
  id: string
  model: string
  serialNumber: string | null
  equipmentType: { name: string }
  brand: { name: string }
}

interface PortalLocation {
  id: string
  name: string
  address: string | null
  city: string | null
  postalCode: string | null
  phone: string | null
  contactPerson: string | null
  equipment: LocationEquipment[]
}

interface ClientData {
  id: string
  name: string
  vatNumber: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  phone: string | null
  email: string | null
  country: string | null
  district: string | null
  contract: boolean
  contractDate: string | null
  locations: PortalLocation[]
}

interface PortalIntervention {
  id: string
  reference: string | null
  status: string
  scheduledDate: string | null
  breakdown: string
  createdAt: string
  assignedTo: { name: string } | null
  location: { id: string; name: string; city: string | null } | null
}

const STATUS_COLOR: Record<string, string> = {
  OPEN: 'bg-yellow-100 text-yellow-800',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-orange-100 text-orange-800',
  PENDING_PARTS: 'bg-rose-100 text-rose-800',
  QUALITY_ASSESSMENT: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELED: 'bg-gray-100 text-gray-700',
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Aberto',
  ASSIGNED: 'Atribuído',
  IN_PROGRESS: 'Em Progresso',
  PENDING_PARTS: 'Aguarda Peças',
  QUALITY_ASSESSMENT: 'Avaliação Qualidade',
  COMPLETED: 'Concluído',
  CANCELED: 'Cancelado',
}

const emptyLocationForm = {
  name: '',
  country: '',
  district: '',
  address: '',
  city: '',
  postalCode: '',
  phone: '',
  contactPerson: '',
  notes: '',
}

const emptyInterventionForm = {
  breakdown: '',
  locationId: '',
}

export default function PortalPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string

  const [client, setClient] = useState<ClientData | null>(null)
  const [interventions, setInterventions] = useState<PortalIntervention[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')

  // Location form
  const [showLocationForm, setShowLocationForm] = useState(false)
  const [locationForm, setLocationForm] = useState(emptyLocationForm)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState('')

  // Intervention form
  const [showInterventionForm, setShowInterventionForm] = useState(false)
  const [interventionForm, setInterventionForm] = useState(emptyInterventionForm)
  const [interventionLoading, setInterventionLoading] = useState(false)
  const [interventionError, setInterventionError] = useState('')

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const u = JSON.parse(userStr)
      if (u.role !== 'CLIENT') {
        router.replace(`/${locale}/dashboard`)
        return
      }
      setUserEmail(u.email || '')
    } else {
      router.replace(`/${locale}`)
      return
    }

    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      const [meRes, intRes] = await Promise.all([
        fetch('/api/portal/me', { headers }),
        fetch('/api/portal/interventions', { headers }),
      ])
      if (!meRes.ok) {
        if (meRes.status === 403) {
          router.replace(`/${locale}/dashboard`)
          return
        }
      }
      const meData = await meRes.json()
      const intData = await intRes.json()
      setClient(meData)
      setInterventions(Array.isArray(intData) ? intData : [])
    } catch (err) {
      console.error('Error loading portal data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push(`/${locale}`)
  }

  const handleLocationFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setLocationForm({ ...locationForm, [e.target.name]: e.target.value })
  }

  const submitLocation = async () => {
    if (!locationForm.name.trim()) return
    setLocationLoading(true)
    setLocationError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/portal/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(locationForm),
      })
      if (!res.ok) {
        const data = await res.json()
        setLocationError(data.error || 'Erro ao criar localização')
        return
      }
      setShowLocationForm(false)
      setLocationForm(emptyLocationForm)
      fetchAll()
    } catch {
      setLocationError('Erro de rede')
    } finally {
      setLocationLoading(false)
    }
  }

  const submitIntervention = async () => {
    if (!interventionForm.breakdown.trim()) return
    setInterventionLoading(true)
    setInterventionError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/portal/interventions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          breakdown: interventionForm.breakdown,
          locationId: interventionForm.locationId || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setInterventionError(data.error || 'Erro ao criar intervenção')
        return
      }
      setShowInterventionForm(false)
      setInterventionForm(emptyInterventionForm)
      fetchAll()
    } catch {
      setInterventionError('Erro de rede')
    } finally {
      setInterventionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">A carregar...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple top bar */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <span className="text-lg font-semibold text-gray-800">Portal de Cliente</span>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-gray-600">{userEmail}</span>
            <button
              onClick={handleLogout}
              className="btn btn-secondary text-sm"
            >
              Sair
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 space-y-6">

        {/* Section 1 — Client info */}
        {client && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">{client.name}</h2>
              {client.contract && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Contrato ativo
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {client.vatNumber && (
                <div>
                  <span className="font-medium text-gray-600">NIF:</span>
                  <p className="text-gray-800">{client.vatNumber}</p>
                </div>
              )}
              {client.address && (
                <div>
                  <span className="font-medium text-gray-600">Morada:</span>
                  <p className="text-gray-800">{client.address}</p>
                </div>
              )}
              {client.city && (
                <div>
                  <span className="font-medium text-gray-600">Cidade:</span>
                  <p className="text-gray-800">{client.city}</p>
                </div>
              )}
              {client.postalCode && (
                <div>
                  <span className="font-medium text-gray-600">Código Postal:</span>
                  <p className="text-gray-800">{client.postalCode}</p>
                </div>
              )}
              {client.phone && (
                <div>
                  <span className="font-medium text-gray-600">Telefone:</span>
                  <p className="text-gray-800">{client.phone}</p>
                </div>
              )}
              {client.email && (
                <div>
                  <span className="font-medium text-gray-600">Email:</span>
                  <p className="text-gray-800">{client.email}</p>
                </div>
              )}
              {client.contractDate && (
                <div>
                  <span className="font-medium text-gray-600">Data do Contrato:</span>
                  <p className="text-gray-800">{new Date(client.contractDate).toLocaleDateString('pt-PT')}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section 2 — Locations */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              Localizações {client ? `(${client.locations.length})` : ''}
            </h2>
            <button
              onClick={() => { setShowLocationForm(true); setLocationError('') }}
              className="btn btn-primary text-sm"
            >
              + Adicionar Localização
            </button>
          </div>

          {/* Inline add location form */}
          {showLocationForm && (
            <div className="border rounded-lg p-4 mb-4 bg-gray-50 space-y-3">
              <h3 className="font-medium text-gray-800 text-sm">Nova Localização</h3>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  name="name"
                  className="input text-gray-800"
                  value={locationForm.name}
                  onChange={handleLocationFormChange}
                  placeholder="Nome da localização"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Morada</label>
                  <input type="text" name="address" className="input text-gray-800" value={locationForm.address} onChange={handleLocationFormChange} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Cidade</label>
                  <input type="text" name="city" className="input text-gray-800" value={locationForm.city} onChange={handleLocationFormChange} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Código Postal</label>
                  <input type="text" name="postalCode" className="input text-gray-800" value={locationForm.postalCode} onChange={handleLocationFormChange} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Telefone</label>
                  <input type="tel" name="phone" className="input text-gray-800" value={locationForm.phone} onChange={handleLocationFormChange} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Pessoa de Contacto</label>
                  <input type="text" name="contactPerson" className="input text-gray-800" value={locationForm.contactPerson} onChange={handleLocationFormChange} />
                </div>
              </div>
              {locationError && (
                <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{locationError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={submitLocation}
                  disabled={locationLoading || !locationForm.name.trim()}
                  className="btn btn-primary text-sm"
                >
                  {locationLoading ? 'A guardar...' : 'Guardar'}
                </button>
                <button
                  onClick={() => { setShowLocationForm(false); setLocationForm(emptyLocationForm) }}
                  className="btn btn-secondary text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {client && client.locations.length === 0 && !showLocationForm ? (
            <p className="text-sm text-gray-500 py-2">Sem localizações registadas.</p>
          ) : (
            <div className="space-y-3">
              {client?.locations.map((loc) => (
                <div key={loc.id} className="border rounded-lg p-4">
                  <p className="font-semibold text-gray-900">{loc.name}</p>
                  <div className="text-sm text-gray-600 mt-1 space-y-0.5">
                    {loc.address && <p>{loc.address}</p>}
                    {loc.city && <p>{loc.city}{loc.postalCode ? ` — ${loc.postalCode}` : ''}</p>}
                    {loc.phone && <p>{loc.phone}</p>}
                    {loc.contactPerson && <p>{loc.contactPerson}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3 — Interventions */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              Intervenções ({interventions.length})
            </h2>
            <button
              onClick={() => { setShowInterventionForm(true); setInterventionError('') }}
              className="btn btn-primary text-sm"
            >
              + Nova Intervenção
            </button>
          </div>

          {/* Inline new intervention form */}
          {showInterventionForm && (
            <div className="border rounded-lg p-4 mb-4 bg-gray-50 space-y-3">
              <h3 className="font-medium text-gray-800 text-sm">Nova Intervenção</h3>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Avaria / Descrição *</label>
                <textarea
                  rows={4}
                  className="input text-gray-800"
                  value={interventionForm.breakdown}
                  onChange={(e) => setInterventionForm({ ...interventionForm, breakdown: e.target.value })}
                  placeholder="Descreva a avaria ou problema..."
                />
              </div>
              {client && client.locations.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Localização (opcional)</label>
                  <select
                    className="input text-gray-800"
                    value={interventionForm.locationId}
                    onChange={(e) => setInterventionForm({ ...interventionForm, locationId: e.target.value })}
                  >
                    <option value="">— Sem localização específica —</option>
                    {client.locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}{loc.city ? ` — ${loc.city}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {interventionError && (
                <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{interventionError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={submitIntervention}
                  disabled={interventionLoading || !interventionForm.breakdown.trim()}
                  className="btn btn-primary text-sm"
                >
                  {interventionLoading ? 'A enviar...' : 'Enviar'}
                </button>
                <button
                  onClick={() => { setShowInterventionForm(false); setInterventionForm(emptyInterventionForm) }}
                  className="btn btn-secondary text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {interventions.length === 0 && !showInterventionForm ? (
            <p className="text-sm text-gray-500 py-2">Sem intervenções registadas.</p>
          ) : (
            <div className="space-y-3">
              {interventions.map((iv) => (
                <div key={iv.id} className="border rounded-lg p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {iv.reference && (
                      <span className="text-xs font-mono text-gray-500">{iv.reference}</span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[iv.status] || 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABEL[iv.status] || iv.status}
                    </span>
                    {iv.scheduledDate && (
                      <span className="text-xs text-gray-500">
                        {new Date(iv.scheduledDate).toLocaleDateString('pt-PT')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 line-clamp-2">{iv.breakdown}</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-gray-500">
                    {iv.location && (
                      <span>{iv.location.name}{iv.location.city ? ` — ${iv.location.city}` : ''}</span>
                    )}
                    {iv.assignedTo && (
                      <span>Técnico: {iv.assignedTo.name}</span>
                    )}
                    <span>{new Date(iv.createdAt).toLocaleDateString('pt-PT')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
