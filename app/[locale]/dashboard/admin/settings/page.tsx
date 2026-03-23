'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

export default function AdminSettingsPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')

  const [settings, setSettings] = useState({ clientPrefix: '', projectPrefix: '', workOrderPrefix: '', repairPrefix: '', userPrefix: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr && JSON.parse(userStr).role !== 'ADMIN') { router.push(`/${locale}/dashboard`); return }
    const token = localStorage.getItem('token')
    fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setSettings({ clientPrefix: data.clientPrefix || '', projectPrefix: data.projectPrefix || '', workOrderPrefix: data.workOrderPrefix || '', repairPrefix: data.repairPrefix || '', userPrefix: data.userPrefix || '' }))
  }, [])

  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      setSettings({ clientPrefix: data.clientPrefix || '', projectPrefix: data.projectPrefix || '', workOrderPrefix: data.workOrderPrefix || '', repairPrefix: data.repairPrefix || '', userPrefix: data.userPrefix || '' })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push(`/${locale}/dashboard/admin`)} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{t('settings')}</h1>
      </div>

      <div className="card max-w-lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('clientPrefix')}</label>
            <input type="text" className="input text-gray-800" placeholder="e.g. CLI" value={settings.clientPrefix} onChange={e => setSettings(s => ({ ...s, clientPrefix: e.target.value }))} />
            <p className="text-xs text-gray-500 mt-1">{t('clientPrefixHint')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('projectPrefix')}</label>
            <input type="text" className="input text-gray-800" placeholder="e.g. INT" value={settings.projectPrefix} onChange={e => setSettings(s => ({ ...s, projectPrefix: e.target.value }))} />
            <p className="text-xs text-gray-500 mt-1">{t('projectPrefixHint')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('workOrderPrefix')}</label>
            <input type="text" className="input text-gray-800" placeholder="e.g. WO" value={settings.workOrderPrefix} onChange={e => setSettings(s => ({ ...s, workOrderPrefix: e.target.value }))} />
            <p className="text-xs text-gray-500 mt-1">{t('workOrderPrefixHint')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prefixo de Reparação</label>
            <input type="text" className="input text-gray-800" placeholder="e.g. REP" value={settings.repairPrefix} onChange={e => setSettings(s => ({ ...s, repairPrefix: e.target.value }))} />
            <p className="text-xs text-gray-500 mt-1">Usado para gerar referências de trabalhos de reparação (ex: REP-001/2025)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prefixo de Utilizador</label>
            <input type="text" className="input text-gray-800" placeholder="e.g. USR" value={settings.userPrefix} onChange={e => setSettings(s => ({ ...s, userPrefix: e.target.value }))} />
            <p className="text-xs text-gray-500 mt-1">Usado para gerar IDs de utilizadores (ex: USR-001)</p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button onClick={save} disabled={saving} className="btn btn-primary">{saving ? tCommon('saving') : tCommon('save')}</button>
            {saved && <span className="text-sm text-green-600 font-medium">{tCommon('saved')}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
