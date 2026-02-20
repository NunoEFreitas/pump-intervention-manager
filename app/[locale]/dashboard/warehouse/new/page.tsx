// FILE: app/[locale]/dashboard/warehouse/new/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

export default function NewWarehouseItemPage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('warehouse')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    itemName: '',
    partNumber: '',
    value: '',
    mainWarehouse: '0',
    tracksSerialNumbers: false,
    autoSn: false,
    snExample: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/warehouse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || tErrors('failedToCreate'))
      }

      router.push(`/${locale}/dashboard/warehouse`)
    } catch (err: any) {
      setError(err.message || tErrors('failedToCreate'))
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← {tCommon('back')}
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('newItem')}</h1>
        <p className="text-gray-600">{t('newItemSubtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('itemName')} *
          </label>
          <input
            type="text"
            name="itemName"
            className="input text-gray-800"
            value={formData.itemName}
            onChange={handleChange}
            placeholder="e.g., Pump Seal"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('partNumber')} *
          </label>
          <input
            type="text"
            name="partNumber"
            className="input text-gray-800"
            value={formData.partNumber}
            onChange={handleChange}
            placeholder="e.g., PS-2024-001"
            required
          />
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="tracksSerialNumbers"
              checked={formData.tracksSerialNumbers}
              onChange={(e) => setFormData({...formData, tracksSerialNumbers: e.target.checked, autoSn: false, snExample: ''})}
              className="mt-1"
            />
            <div className="flex-1">
              <label htmlFor="tracksSerialNumbers" className="text-sm font-medium text-gray-700 cursor-pointer">
                {t('tracksSerialNumbers')}
              </label>
              <p className="text-xs text-gray-500 mt-1">
                {t('tracksSnHelp')}
              </p>
            </div>
          </div>

          {formData.tracksSerialNumbers && (
            <div className="ml-6 flex items-start gap-3">
              <input
                type="checkbox"
                id="autoSn"
                checked={formData.autoSn}
                onChange={(e) => setFormData({...formData, autoSn: e.target.checked, snExample: ''})}
                className="mt-1"
              />
              <div className="flex-1">
                <label htmlFor="autoSn" className="text-sm font-medium text-gray-700 cursor-pointer">
                  {t('autoSnGeneration')}
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  {t('autoSnGenerationHelp')}
                </p>
                {formData.autoSn && (
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {t('snExample')} *
                    </label>
                    <input
                      type="text"
                      className="input text-gray-800"
                      value={formData.snExample}
                      onChange={(e) => setFormData({...formData, snExample: e.target.value})}
                      placeholder="e.g. PTT"
                      required={formData.autoSn}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t('snExampleHelp', { example: formData.snExample || 'PTT' })}
                    </p>
                  </div>
                )}
                {!formData.autoSn && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-xs text-blue-800">
                      {t('manualSnNote')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('value')} (€) *
          </label>
          <input
            type="number"
            step="0.01"
            name="value"
            className="input text-gray-800"
            value={formData.value}
            onChange={handleChange}
            placeholder="0.00"
            required
          />
        </div>

        {!formData.tracksSerialNumbers && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('mainWarehouse')}
            </label>
            <input
              type="number"
              name="mainWarehouse"
              className="input text-gray-800"
              value={formData.mainWarehouse}
              onChange={handleChange}
              placeholder="0"
              min="0"
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('initialStockHelp')}
            </p>
          </div>
        )}

        {formData.tracksSerialNumbers && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              {t('snInitialStockNote')}
            </p>
          </div>
        )}

        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            className="btn btn-primary flex-1"
            disabled={loading}
          >
            {loading ? tCommon('loading') : t('createButton')}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn btn-secondary"
            disabled={loading}
          >
            {tCommon('cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}
