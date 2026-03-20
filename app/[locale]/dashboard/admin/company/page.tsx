'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

export default function AdminCompanyPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')

  const [company, setCompany] = useState({ name: '', email: '', address: '', phones: [] as string[], faxes: [] as string[], logo: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr && JSON.parse(userStr).role !== 'ADMIN') { router.push(`/${locale}/dashboard`); return }
    const token = localStorage.getItem('token')
    fetch('/api/admin/company', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setCompany({ name: data.name || '', email: data.email || '', address: data.address || '', phones: Array.isArray(data.phones) ? data.phones : [], faxes: Array.isArray(data.faxes) ? data.faxes : [], logo: data.logo || '' }))
  }, [])

  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      const token = localStorage.getItem('token')
      await fetch('/api/admin/company', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(company) })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push(`/${locale}/dashboard/admin`)} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{t('companySettings')}</h1>
      </div>

      <div className="card max-w-2xl">
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('companyLogo')}</label>
            {company.logo && <div className="mb-2"><img src={company.logo} alt="Company logo" className="h-16 object-contain border rounded p-1" /></div>}
            <input type="file" accept="image/*" className="text-sm text-gray-600"
              onChange={e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setCompany(c => ({ ...c, logo: reader.result as string })); reader.readAsDataURL(file) }} />
            {company.logo && <button onClick={() => setCompany(c => ({ ...c, logo: '' }))} className="ml-3 text-xs text-red-600 hover:text-red-800">{t('removeLogo')}</button>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('companyName')}</label>
            <input type="text" className="input text-gray-800" value={company.name} onChange={e => setCompany(c => ({ ...c, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('companyEmail')}</label>
            <input type="email" className="input text-gray-800" value={company.email} onChange={e => setCompany(c => ({ ...c, email: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('companyAddress')}</label>
            <textarea className="input text-gray-800 resize-none" rows={2} value={company.address} onChange={e => setCompany(c => ({ ...c, address: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('companyPhones')}</label>
            <div className="space-y-2">
              {company.phones.map((phone, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" className="input text-gray-800 flex-1" value={phone}
                    onChange={e => { const phones = [...company.phones]; phones[i] = e.target.value; setCompany(c => ({ ...c, phones })) }} />
                  <button onClick={() => setCompany(c => ({ ...c, phones: c.phones.filter((_, j) => j !== i) }))} className="text-red-600 hover:text-red-800 text-sm px-2">&times;</button>
                </div>
              ))}
              <button onClick={() => setCompany(c => ({ ...c, phones: [...c.phones, ''] }))} className="text-blue-600 hover:text-blue-800 text-sm">{t('addPhone')}</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('companyFaxes')}</label>
            <div className="space-y-2">
              {company.faxes.map((fax, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" className="input text-gray-800 flex-1" value={fax}
                    onChange={e => { const faxes = [...company.faxes]; faxes[i] = e.target.value; setCompany(c => ({ ...c, faxes })) }} />
                  <button onClick={() => setCompany(c => ({ ...c, faxes: c.faxes.filter((_, j) => j !== i) }))} className="text-red-600 hover:text-red-800 text-sm px-2">&times;</button>
                </div>
              ))}
              <button onClick={() => setCompany(c => ({ ...c, faxes: [...c.faxes, ''] }))} className="text-blue-600 hover:text-blue-800 text-sm">{t('addFax')}</button>
            </div>
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
