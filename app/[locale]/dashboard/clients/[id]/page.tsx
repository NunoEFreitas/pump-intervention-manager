'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface LocationEquipment {
  id: string
  equipmentTypeId: string
  brandId: string
  model: string
  equipmentType: { name: string }
  brand: { name: string }
}

interface CompanyLocation {
  id: string
  name: string
  address: string | null
  city: string | null
  postalCode: string | null
  phone: string | null
  contactPerson: string | null
  notes: string | null
  equipment: LocationEquipment[]
}

interface Client {
  id: string
  name: string
  clientType: 'PRIVATE' | 'COMPANY'
  address: string
  city: string
  postalCode: string
  phone: string
  email: string
  contactPerson: string
  notes: string
  locations: CompanyLocation[]
  interventions: Intervention[]
}

interface Intervention {
  id: string
  status: string
  workDone: string | null
  timeSpent: number | null
  description: string | null
  scheduledDate: string
  scheduledTime: string
  createdAt: string
  assignedTo: { name: string }
  location: { id: string; name: string; city: string | null } | null
}

interface EquipmentType { id: string; name: string }
interface EquipmentBrand { id: string; name: string }

const emptyLocationForm = {
  name: '', address: '', city: '', postalCode: '', phone: '', contactPerson: '', notes: '',
}

const emptyEquipmentForm = {
  equipmentTypeId: '', brandId: '', model: '',
}

export default function ClientDetailPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)

  // Location form state
  const [showLocationForm, setShowLocationForm] = useState(false)
  const [editingLocation, setEditingLocation] = useState<CompanyLocation | null>(null)
  const [locationForm, setLocationForm] = useState(emptyLocationForm)
  const [locationLoading, setLocationLoading] = useState(false)

  // Equipment state
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])
  const [equipmentBrands, setEquipmentBrands] = useState<EquipmentBrand[]>([])
  const [addEquipmentLocationId, setAddEquipmentLocationId] = useState<string | null>(null)
  const [editingEquipment, setEditingEquipment] = useState<LocationEquipment | null>(null)
  const [equipmentForm, setEquipmentForm] = useState(emptyEquipmentForm)
  const [equipmentLoading, setEquipmentLoading] = useState(false)

  const tAuth = useTranslations('auth')
  const tCommon = useTranslations('common')
  const tClients = useTranslations('clients')
  const tNav = useTranslations('nav')
  const tInterventions = useTranslations('interventions')

  useEffect(() => {
    if (params.id) {
      fetchClient()
      fetchEquipmentMeta()
    }
  }, [params.id])

  const fetchClient = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/clients/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setClient(data)
    } catch (error) {
      console.error('Error fetching client:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEquipmentMeta = async () => {
    try {
      const token = localStorage.getItem('token')
      const [typesRes, brandsRes] = await Promise.all([
        fetch('/api/admin/equipment-types', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/equipment-brands', { headers: { Authorization: `Bearer ${token}` } }),
      ])
      setEquipmentTypes(await typesRes.json())
      setEquipmentBrands(await brandsRes.json())
    } catch (error) {
      console.error('Error fetching equipment metadata:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-yellow-100 text-yellow-800'
      case 'IN_PROGRESS': return 'bg-orange-100 text-orange-800'
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'OPEN': return tInterventions('statusOpen')
      case 'IN_PROGRESS': return tInterventions('statusInProgress')
      case 'QUALITY_ASSESSMENT': return tInterventions('statusQualityAssessment')
      case 'COMPLETED': return tInterventions('statusCompleted')
      case 'CANCELED': return tInterventions('statusCanceled')
      default: return status
    }
  }

  // Location handlers
  const openAddLocation = () => {
    setEditingLocation(null)
    setLocationForm(emptyLocationForm)
    setShowLocationForm(true)
  }

  const openEditLocation = (loc: CompanyLocation) => {
    setEditingLocation(loc)
    setLocationForm({
      name: loc.name,
      address: loc.address || '',
      city: loc.city || '',
      postalCode: loc.postalCode || '',
      phone: loc.phone || '',
      contactPerson: loc.contactPerson || '',
      notes: loc.notes || '',
    })
    setShowLocationForm(true)
  }

  const handleLocationFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setLocationForm({ ...locationForm, [e.target.name]: e.target.value })
  }

  const saveLocation = async () => {
    if (!locationForm.name.trim()) return
    setLocationLoading(true)
    try {
      const token = localStorage.getItem('token')
      const url = editingLocation
        ? `/api/clients/${params.id}/locations/${editingLocation.id}`
        : `/api/clients/${params.id}/locations`
      const method = editingLocation ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(locationForm),
      })
      if (response.ok) {
        setShowLocationForm(false)
        fetchClient()
      }
    } catch (error) {
      console.error('Error saving location:', error)
    } finally {
      setLocationLoading(false)
    }
  }

  const deleteLocation = async (locationId: string) => {
    if (!confirm(tClients('deleteLocation') + '?')) return
    try {
      const token = localStorage.getItem('token')
      await fetch(`/api/clients/${params.id}/locations/${locationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      fetchClient()
    } catch (error) {
      console.error('Error deleting location:', error)
    }
  }

  // Equipment handlers
  const openAddEquipment = (locationId: string) => {
    setAddEquipmentLocationId(locationId)
    setEditingEquipment(null)
    setEquipmentForm(emptyEquipmentForm)
  }

  const openEditEquipment = (eq: LocationEquipment, locationId: string) => {
    setAddEquipmentLocationId(locationId)
    setEditingEquipment(eq)
    setEquipmentForm({ equipmentTypeId: eq.equipmentTypeId, brandId: eq.brandId, model: eq.model })
  }

  const closeEquipmentForm = () => {
    setAddEquipmentLocationId(null)
    setEditingEquipment(null)
    setEquipmentForm(emptyEquipmentForm)
  }

  const saveEquipment = async (locationId: string) => {
    if (!equipmentForm.equipmentTypeId || !equipmentForm.brandId || !equipmentForm.model.trim()) return
    setEquipmentLoading(true)
    try {
      const token = localStorage.getItem('token')
      const url = editingEquipment
        ? `/api/clients/${params.id}/locations/${locationId}/equipment/${editingEquipment.id}`
        : `/api/clients/${params.id}/locations/${locationId}/equipment`
      const method = editingEquipment ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(equipmentForm),
      })
      if (response.ok) {
        closeEquipmentForm()
        fetchClient()
      }
    } catch (error) {
      console.error('Error saving equipment:', error)
    } finally {
      setEquipmentLoading(false)
    }
  }

  const deleteEquipment = async (locationId: string, equipmentId: string) => {
    if (!confirm(tClients('deleteEquipment') + '?')) return
    try {
      const token = localStorage.getItem('token')
      await fetch(`/api/clients/${params.id}/locations/${locationId}/equipment/${equipmentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      fetchClient()
    } catch (error) {
      console.error('Error deleting equipment:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">{tClients('loadingClient')}</div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-600">{tClients('clientNotFound')}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => router.push(`/${locale}/dashboard/clients`)}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          {tNav('backToClients')}
        </button>
      </div>

      {/* Client header */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-4">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{client.name}</h1>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${client.clientType === 'COMPANY' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'}`}>
                {client.clientType === 'COMPANY' ? tClients('company') : tClients('private')}
              </span>
            </div>
          </div>
          <button
            onClick={() => router.push(`/${locale}/dashboard/interventions/new?clientId=${client.id}`)}
            className="btn btn-primary w-full sm:w-auto"
          >
            {tInterventions('newIntervention')}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {client.address && (
            <div>
              <span className="font-medium text-gray-700">{tClients('address')}:</span>
              <p className="text-gray-600">{client.address}</p>
            </div>
          )}
          {client.city && (
            <div>
              <span className="font-medium text-gray-700">{tClients('city')}:</span>
              <p className="text-gray-600">{client.city}</p>
            </div>
          )}
          {client.postalCode && (
            <div>
              <span className="font-medium text-gray-700">{tClients('postalCode')}:</span>
              <p className="text-gray-600">{client.postalCode}</p>
            </div>
          )}
          {client.phone && (
            <div>
              <span className="font-medium text-gray-700">{tClients('phone')}:</span>
              <p className="text-gray-600">{client.phone}</p>
            </div>
          )}
          {client.email && (
            <div>
              <span className="font-medium text-gray-700">{tAuth('email')}:</span>
              <p className="text-gray-600">{client.email}</p>
            </div>
          )}
          {client.contactPerson && (
            <div>
              <span className="font-medium text-gray-700">{tClients('contactPerson')}:</span>
              <p className="text-gray-600">{client.contactPerson}</p>
            </div>
          )}
        </div>

        {client.notes && (
          <div className="mt-4 pt-4 border-t">
            <span className="font-medium text-gray-700">{tClients('notes')}:</span>
            <p className="text-gray-600 mt-1">{client.notes}</p>
          </div>
        )}
      </div>

      {/* Locations section (company only) */}
      {client.clientType === 'COMPANY' && (
        <div className="card mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              {tClients('locations')} ({client.locations.length})
            </h2>
            <button onClick={openAddLocation} className="btn btn-primary text-sm">
              {tClients('addLocation')}
            </button>
          </div>

          {/* Location inline form */}
          {showLocationForm && (
            <div className="border rounded-lg p-4 mb-4 bg-gray-50 space-y-3">
              <h3 className="font-medium text-gray-800">
                {editingLocation ? tClients('editLocation') : tClients('addLocation')}
              </h3>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{tClients('locationName')} *</label>
                <input
                  type="text"
                  name="name"
                  className="input text-gray-800"
                  value={locationForm.name}
                  onChange={handleLocationFormChange}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{tClients('address')}</label>
                  <input type="text" name="address" className="input text-gray-800" value={locationForm.address} onChange={handleLocationFormChange} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{tClients('city')}</label>
                  <input type="text" name="city" className="input text-gray-800" value={locationForm.city} onChange={handleLocationFormChange} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{tClients('postalCode')}</label>
                  <input type="text" name="postalCode" className="input text-gray-800" value={locationForm.postalCode} onChange={handleLocationFormChange} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{tClients('phone')}</label>
                  <input type="tel" name="phone" className="input text-gray-800" value={locationForm.phone} onChange={handleLocationFormChange} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{tClients('contactPerson')}</label>
                <input type="text" name="contactPerson" className="input text-gray-800" value={locationForm.contactPerson} onChange={handleLocationFormChange} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{tClients('notes')}</label>
                <textarea name="notes" rows={2} className="input text-gray-800" value={locationForm.notes} onChange={handleLocationFormChange} />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveLocation}
                  disabled={locationLoading || !locationForm.name.trim()}
                  className="btn btn-primary text-sm"
                >
                  {locationLoading ? tCommon('saving') : tClients('saveLocation')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLocationForm(false)}
                  className="btn btn-secondary text-sm"
                >
                  {tCommon('cancel')}
                </button>
              </div>
            </div>
          )}

          {client.locations.length === 0 && !showLocationForm ? (
            <p className="text-gray-500 text-sm py-4">{tClients('noLocations')}</p>
          ) : (
            <div className="space-y-4">
              {client.locations.map((loc) => (
                <div key={loc.id} className="border rounded-lg p-4">
                  {/* Location header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{loc.name}</p>
                      <div className="text-sm text-gray-600 mt-0.5">
                        {loc.city && <span>{loc.city}{loc.address ? `, ${loc.address}` : ''}</span>}
                        {loc.phone && <p>{loc.phone}</p>}
                        {loc.contactPerson && <p>{loc.contactPerson}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => openEditLocation(loc)} className="text-blue-600 hover:text-blue-800 text-sm">
                        {tCommon('edit')}
                      </button>
                      <button onClick={() => deleteLocation(loc.id)} className="text-red-600 hover:text-red-800 text-sm">
                        {tCommon('delete')}
                      </button>
                    </div>
                  </div>

                  {/* Equipment subsection */}
                  <div className="border-t pt-3 mt-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {tClients('equipment')} ({loc.equipment.length})
                      </span>
                      <button
                        onClick={() => openAddEquipment(loc.id)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        {tClients('addEquipment')}
                      </button>
                    </div>

                    {/* Equipment add/edit form */}
                    {addEquipmentLocationId === loc.id && (
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-2 space-y-2">
                        <h4 className="text-xs font-semibold text-gray-700">
                          {editingEquipment ? tClients('editEquipment') : tClients('addEquipment')}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">{tClients('equipmentType')} *</label>
                            <select
                              className="input text-gray-800 text-sm"
                              value={equipmentForm.equipmentTypeId}
                              onChange={(e) => setEquipmentForm({ ...equipmentForm, equipmentTypeId: e.target.value })}
                            >
                              <option value="">—</option>
                              {equipmentTypes.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">{tClients('equipmentBrand')} *</label>
                            <select
                              className="input text-gray-800 text-sm"
                              value={equipmentForm.brandId}
                              onChange={(e) => setEquipmentForm({ ...equipmentForm, brandId: e.target.value })}
                            >
                              <option value="">—</option>
                              {equipmentBrands.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">{tClients('equipmentModel')} *</label>
                            <input
                              type="text"
                              className="input text-gray-800 text-sm"
                              value={equipmentForm.model}
                              onChange={(e) => setEquipmentForm({ ...equipmentForm, model: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEquipment(loc.id)}
                            disabled={equipmentLoading || !equipmentForm.equipmentTypeId || !equipmentForm.brandId || !equipmentForm.model.trim()}
                            className="btn btn-primary text-xs py-1.5 px-3"
                          >
                            {equipmentLoading ? tCommon('saving') : tClients('saveEquipment')}
                          </button>
                          <button
                            onClick={closeEquipmentForm}
                            className="btn btn-secondary text-xs py-1.5 px-3"
                          >
                            {tCommon('cancel')}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Equipment list */}
                    {loc.equipment.length === 0 && addEquipmentLocationId !== loc.id ? (
                      <p className="text-xs text-gray-400 py-1">{tClients('noEquipment')}</p>
                    ) : (
                      <div className="space-y-1">
                        {loc.equipment.map((eq) => (
                          <div key={eq.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 text-sm">
                            <span className="text-gray-800">
                              <span className="font-medium">{eq.equipmentType.name}</span>
                              <span className="text-gray-500"> — {eq.brand.name} </span>
                              <span className="text-gray-700">{eq.model}</span>
                            </span>
                            <div className="flex gap-2 ml-2 shrink-0">
                              <button
                                onClick={() => openEditEquipment(eq, loc.id)}
                                className="text-blue-600 hover:text-blue-800 text-xs"
                              >
                                {tCommon('edit')}
                              </button>
                              <button
                                onClick={() => deleteEquipment(loc.id, eq.id)}
                                className="text-red-600 hover:text-red-800 text-xs"
                              >
                                {tCommon('delete')}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Interventions */}
      <div className="card">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
          {tInterventions('title')} ({client.interventions.length})
        </h2>

        {client.interventions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">{tInterventions('noInterventionsYet')}</p>
            <button
              onClick={() => router.push(`/${locale}/dashboard/interventions/new?clientId=${client.id}`)}
              className="btn btn-primary"
            >
              {tInterventions('createFirst')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {client.interventions.map((intervention) => (
              <div
                key={intervention.id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/${locale}/dashboard/interventions/${intervention.id}`)}
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(intervention.status)}`}>
                      {getStatusLabel(intervention.status)}
                    </span>
                    <span className="text-xs sm:text-sm text-gray-600">
                      {new Date(intervention.scheduledDate).toLocaleDateString()} at {intervention.scheduledTime}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {intervention.workDone || tInterventions('scheduledIntervention')}
                  </h3>
                  {intervention.location && (
                    <p className="text-sm text-purple-700 mb-1">
                      {intervention.location.name}{intervention.location.city ? ` — ${intervention.location.city}` : ''}
                    </p>
                  )}
                  {intervention.description && (
                    <p className="text-sm text-gray-600 mb-2">{intervention.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                    <span>{tInterventions('fieldsAssignedTo')}: {intervention.assignedTo.name}</span>
                    {intervention.timeSpent && <span>{tInterventions('fieldsTimeSpent')}: {intervention.timeSpent}h</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
