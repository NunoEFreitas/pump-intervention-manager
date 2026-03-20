'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import LocationSelector from '@/components/LocationSelector'
import { validateVAT } from '@/lib/vat-validation'

interface LocationEquipment {
  id: string
  equipmentTypeId: string
  brandId: string
  model: string
  serialNumber: string | null
  observations: string | null
  equipmentType: { name: string }
  brand: { name: string }
}

interface OvmRegulator { id: string; name: string }

interface CompanyLocation {
  id: string
  name: string
  country: string | null
  district: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  phone: string | null
  contactPerson: string | null
  notes: string | null
  ovmRegulatorId: string | null
  equipment: LocationEquipment[]
}

interface Client {
  id: string
  reference: string | null
  name: string
  vatNumber: string | null
  country: string | null
  district: string | null
  address: string
  city: string
  postalCode: string
  phone: string
  email: string
  contactPerson: string
  notes: string
  contract: boolean
  contractDate: string | null
  locations: CompanyLocation[]
  interventions: Intervention[]
}

interface Intervention {
  id: string
  status: string
  scheduledDate: string
  scheduledTime: string
  createdAt: string
  assignedTo: { name: string } | null
  location: { id: string; name: string; city: string | null } | null
}

interface EquipmentType { id: string; name: string }
interface EquipmentBrand { id: string; name: string }

const emptyLocationForm = {
  name: '', country: '', district: '', address: '', city: '', postalCode: '', phone: '', contactPerson: '', notes: '', ovmRegulatorId: '',
}

const emptyEquipmentForm = {
  equipmentTypeId: '', brandId: '', model: '', serialNumber: '', observations: '',
}

export default function ClientDetailPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditingClient, setIsEditingClient] = useState(false)
  const [clientEditData, setClientEditData] = useState({
    name: '', vatNumber: '', country: '', district: '', address: '', city: '', postalCode: '', phone: '', email: '', contactPerson: '', notes: '', contract: false, contractDate: '',
  })
  const [clientEditLoading, setClientEditLoading] = useState(false)

  // Create user modal state
  const [showCreateUserModal, setShowCreateUserModal] = useState(false)
  const [createUserData, setCreateUserData] = useState({ email: '', password: '', name: '' })
  const [createUserLoading, setCreateUserLoading] = useState(false)
  const [createUserError, setCreateUserError] = useState('')
  const [createUserSuccess, setCreateUserSuccess] = useState(false)
  const [showCreateUserPassword, setShowCreateUserPassword] = useState(false)

  // Location form state
  const [showLocationForm, setShowLocationForm] = useState(false)
  const [editingLocation, setEditingLocation] = useState<CompanyLocation | null>(null)
  const [locationForm, setLocationForm] = useState(emptyLocationForm)
  const [locationLoading, setLocationLoading] = useState(false)

  const [ovmRegulators, setOvmRegulators] = useState<OvmRegulator[]>([])

  // Equipment state
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])
  const [equipmentBrands, setEquipmentBrands] = useState<EquipmentBrand[]>([])
  const [addEquipmentLocationId, setAddEquipmentLocationId] = useState<string | null>(null)
  const [editingEquipment, setEditingEquipment] = useState<LocationEquipment | null>(null)
  const [expandedEquipmentLocations, setExpandedEquipmentLocations] = useState<Set<string>>(new Set())
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
      const token = localStorage.getItem('token')
      fetch('/api/admin/ovm-regulators', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(setOvmRegulators).catch(() => {})
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

  const openEditClient = () => {
    if (!client) return
    setClientEditData({
      name: client.name,
      vatNumber: client.vatNumber || '',
      country: client.country || '',
      district: client.district || '',
      address: client.address || '',
      city: client.city || '',
      postalCode: client.postalCode || '',
      phone: client.phone || '',
      email: client.email || '',
      contactPerson: client.contactPerson || '',
      notes: client.notes || '',
      contract: client.contract ?? false,
      contractDate: client.contractDate ? client.contractDate.slice(0, 10) : '',
    })
    setIsEditingClient(true)
  }

  const saveClient = async () => {
    setClientEditLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/clients/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(clientEditData),
      })
      if (response.ok) {
        setIsEditingClient(false)
        fetchClient()
      }
    } catch (error) {
      console.error('Error updating client:', error)
    } finally {
      setClientEditLoading(false)
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
      country: loc.country || '',
      district: loc.district || '',
      address: loc.address || '',
      city: loc.city || '',
      postalCode: loc.postalCode || '',
      phone: loc.phone || '',
      contactPerson: loc.contactPerson || '',
      notes: loc.notes || '',
      ovmRegulatorId: loc.ovmRegulatorId || '',
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
    setEquipmentForm({ equipmentTypeId: eq.equipmentTypeId, brandId: eq.brandId, model: eq.model, serialNumber: eq.serialNumber || '', observations: eq.observations || '' })
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

  const editVatError = validateVAT(clientEditData.vatNumber, clientEditData.country)

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
        <div className="flex justify-between items-start gap-3 mb-4">
          <div className="min-w-0">
            {client.reference && (
              <p className="text-sm font-mono text-gray-500 mb-0.5">{client.reference}</p>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">{client.name}</h1>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={openEditClient}
              className="btn btn-secondary"
            >
              {tCommon('edit')}
            </button>
            <button
              onClick={() => {
                setCreateUserData({ name: client.name, email: client.email || '', password: '' })
                setCreateUserError('')
                setCreateUserSuccess(false)
                setShowCreateUserModal(true)
              }}
              className="btn btn-secondary"
            >
              Criar Acesso
            </button>
            <button
              onClick={() => router.push(`/${locale}/dashboard/interventions/new?clientId=${client.id}`)}
              className="btn btn-primary"
            >
              {tInterventions('newIntervention')}
            </button>
          </div>
        </div>

        {isEditingClient ? (
          <div className="space-y-4 border-t pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{tClients('clientName')} *</label>
                <input type="text" className="input text-gray-800" value={clientEditData.name} onChange={(e) => setClientEditData({ ...clientEditData, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{tClients('vatNumber')}</label>
                <input
                  type="text"
                  className={`input text-gray-800 ${editVatError && clientEditData.vatNumber ? 'border-red-400 focus:ring-red-400' : ''}`}
                  value={clientEditData.vatNumber}
                  onChange={(e) => setClientEditData({ ...clientEditData, vatNumber: e.target.value })}
                />
                {editVatError && clientEditData.vatNumber && (
                  <p className="text-xs text-red-600 mt-1">{editVatError}</p>
                )}
              </div>
            </div>
            <LocationSelector
              country={clientEditData.country}
              district={clientEditData.district}
              city={clientEditData.city}
              labelSize="xs"
              onCountryChange={(v) => setClientEditData({ ...clientEditData, country: v, district: '', city: '' })}
              onDistrictChange={(v) => setClientEditData({ ...clientEditData, district: v, city: '' })}
              onCityChange={(v) => setClientEditData({ ...clientEditData, city: v })}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{tClients('address')}</label>
                <input type="text" className="input text-gray-800" value={clientEditData.address} onChange={(e) => setClientEditData({ ...clientEditData, address: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{tClients('postalCode')}</label>
                <input type="text" className="input text-gray-800" value={clientEditData.postalCode} onChange={(e) => setClientEditData({ ...clientEditData, postalCode: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{tClients('phone')}</label>
                <input type="tel" className="input text-gray-800" value={clientEditData.phone} onChange={(e) => setClientEditData({ ...clientEditData, phone: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{tAuth('email')}</label>
                <input type="email" className="input text-gray-800" value={clientEditData.email} onChange={(e) => setClientEditData({ ...clientEditData, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{tClients('contactPerson')}</label>
                <input type="text" className="input text-gray-800" value={clientEditData.contactPerson} onChange={(e) => setClientEditData({ ...clientEditData, contactPerson: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{tClients('notes')}</label>
              <textarea rows={3} className="input text-gray-800" value={clientEditData.notes} onChange={(e) => setClientEditData({ ...clientEditData, notes: e.target.value })} />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="clientContract"
                checked={clientEditData.contract}
                onChange={(e) => setClientEditData({ ...clientEditData, contract: e.target.checked, contractDate: e.target.checked ? clientEditData.contractDate : '' })}
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              <label htmlFor="clientContract" className="text-xs font-medium text-gray-700 cursor-pointer">{tClients('contract')}</label>
              {clientEditData.contract && (
                <input
                  type="date"
                  className="input text-gray-800 w-40 text-xs"
                  value={clientEditData.contractDate}
                  onChange={(e) => setClientEditData({ ...clientEditData, contractDate: e.target.value })}
                />
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={saveClient} disabled={clientEditLoading || !clientEditData.name.trim() || !!editVatError} className="btn btn-primary text-sm">
                {clientEditLoading ? tCommon('saving') : tCommon('save')}
              </button>
              <button onClick={() => setIsEditingClient(false)} className="btn btn-secondary text-sm">
                {tCommon('cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {client.vatNumber && (
              <div>
                <span className="font-medium text-gray-700">{tClients('vatNumber')}:</span>
                <p className="text-gray-600">{client.vatNumber}</p>
              </div>
            )}
            {client.country && (
              <div>
                <span className="font-medium text-gray-700">{tClients('country')}:</span>
                <p className="text-gray-600">{[client.country, client.district, client.city].filter(Boolean).join(' › ')}</p>
              </div>
            )}
            {client.address && (
              <div>
                <span className="font-medium text-gray-700">{tClients('address')}:</span>
                <p className="text-gray-600">{client.address}</p>
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
            {client.notes && (
              <div className="md:col-span-2 pt-2 border-t">
                <span className="font-medium text-gray-700">{tClients('notes')}:</span>
                <p className="text-gray-600 mt-1">{client.notes}</p>
              </div>
            )}
            <div className="md:col-span-2 pt-2 border-t flex gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${client.contract ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>
                {client.contract ? '✓' : '✗'} {tClients('contract')}
              </span>
              {client.contract && client.contractDate && (
                <span className="text-xs text-gray-600 self-center">
                  {new Date(client.contractDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Locations section */}
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
              <LocationSelector
                country={locationForm.country}
                district={locationForm.district}
                city={locationForm.city}
                labelSize="xs"
                onCountryChange={(v) => setLocationForm({ ...locationForm, country: v, district: '', city: '' })}
                onDistrictChange={(v) => setLocationForm({ ...locationForm, district: v, city: '' })}
                onCityChange={(v) => setLocationForm({ ...locationForm, city: v })}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{tClients('address')}</label>
                  <input type="text" name="address" className="input text-gray-800" value={locationForm.address} onChange={handleLocationFormChange} />
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
              {ovmRegulators.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">OVM Regulator</label>
                  <select
                    className="input text-gray-800"
                    value={locationForm.ovmRegulatorId}
                    onChange={e => setLocationForm({ ...locationForm, ovmRegulatorId: e.target.value })}
                  >
                    <option value="">— none —</option>
                    {ovmRegulators.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}
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
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">{tClients('equipmentSerialNumber')}</label>
                            <input
                              type="text"
                              className="input text-gray-800 text-sm"
                              value={equipmentForm.serialNumber}
                              onChange={(e) => setEquipmentForm({ ...equipmentForm, serialNumber: e.target.value })}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs text-gray-600 mb-1">{tClients('equipmentObservations')}</label>
                            <textarea
                              rows={3}
                              className="input text-gray-800 text-sm"
                              value={equipmentForm.observations}
                              onChange={(e) => setEquipmentForm({ ...equipmentForm, observations: e.target.value })}
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
                    ) : (() => {
                      const isExpanded = expandedEquipmentLocations.has(loc.id)
                      const visible = isExpanded ? loc.equipment : loc.equipment.slice(0, 3)
                      const hidden = loc.equipment.length - 3
                      return (
                        <div className="space-y-2">
                          {visible.map((eq) => (
                            <div key={eq.id} className="bg-gray-50 rounded px-3 py-2 text-sm">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <span className="font-medium text-gray-800">{eq.equipmentType?.name}</span>
                                  <span className="text-gray-500"> — {eq.brand?.name} </span>
                                  <span className="text-gray-700">{eq.model}</span>
                                  {eq.serialNumber && (
                                    <span className="text-gray-500 ml-2">· SN: {eq.serialNumber}</span>
                                  )}
                                  {eq.observations && (
                                    <p className="text-gray-500 mt-1 text-xs whitespace-pre-wrap">{eq.observations}</p>
                                  )}
                                </div>
                                <div className="flex gap-2 shrink-0">
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
                            </div>
                          ))}
                          {loc.equipment.length > 3 && (
                            <button
                              onClick={() => setExpandedEquipmentLocations(prev => {
                                const next = new Set(prev)
                                isExpanded ? next.delete(loc.id) : next.add(loc.id)
                                return next
                              })}
                              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 pt-1"
                            >
                              {isExpanded ? (
                                <>{tClients('showLess')} ▲</>
                              ) : (
                                <>+{hidden} {tClients('moreEquipment')} ▼</>
                              )}
                            </button>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

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
                    {tInterventions('scheduledIntervention')}
                  </h3>
                  {intervention.location && (
                    <p className="text-sm text-purple-700 mb-1">
                      {intervention.location.name}{intervention.location.city ? ` — ${intervention.location.city}` : ''}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                    <span>{tInterventions('fieldsAssignedTo')}: {intervention.assignedTo?.name ?? '—'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Criar Acesso de Cliente</h2>
            <p className="text-sm text-gray-500 mb-4">Criar uma conta de acesso para {client.name}</p>

            {createUserSuccess ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
                  Acesso criado com sucesso.
                </div>
                <button
                  onClick={() => { setShowCreateUserModal(false); setCreateUserSuccess(false) }}
                  className="btn btn-secondary w-full"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nome</label>
                  <input
                    type="text"
                    className="input text-gray-800"
                    value={createUserData.name}
                    onChange={(e) => setCreateUserData({ ...createUserData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    className="input text-gray-800"
                    value={createUserData.email}
                    onChange={(e) => setCreateUserData({ ...createUserData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Palavra-passe</label>
                  <div className="relative">
                    <input
                      type={showCreateUserPassword ? 'text' : 'password'}
                      className="input text-gray-800 pr-16"
                      value={createUserData.password}
                      onChange={(e) => setCreateUserData({ ...createUserData, password: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreateUserPassword(!showCreateUserPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
                    >
                      {showCreateUserPassword ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                </div>
                {createUserError && (
                  <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-red-700 text-sm">
                    {createUserError}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={async () => {
                      if (!createUserData.email || !createUserData.password || !createUserData.name) return
                      setCreateUserLoading(true)
                      setCreateUserError('')
                      try {
                        const token = localStorage.getItem('token')
                        const res = await fetch(`/api/clients/${params.id}/create-user`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify(createUserData),
                        })
                        const data = await res.json()
                        if (!res.ok) {
                          setCreateUserError(data.error || 'Erro ao criar acesso')
                        } else {
                          setCreateUserSuccess(true)
                        }
                      } catch {
                        setCreateUserError('Erro de rede')
                      } finally {
                        setCreateUserLoading(false)
                      }
                    }}
                    disabled={createUserLoading || !createUserData.email || !createUserData.password || !createUserData.name}
                    className="btn btn-primary flex-1"
                  >
                    {createUserLoading ? 'A criar...' : 'Criar'}
                  </button>
                  <button
                    onClick={() => { setShowCreateUserModal(false); setCreateUserError('') }}
                    className="btn btn-secondary"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
