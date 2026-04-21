'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

export default function AdminPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const tAdmin = useTranslations('admin')
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      if (user.role !== 'ADMIN') { router.push(`/${locale}/dashboard`); return }
      setAuthorized(true)
    }
  }, [])

  if (!authorized) return null

  const NAV_ITEMS: { path: string; label: string; description: string; icon: React.ReactNode }[] = [
    {
      path: 'users', label: tAdmin('userManagement'), description: 'Gerir utilizadores e permissões',
      icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4a4 4 0 11-8 0 4 4 0 018 0zm6 4a2 2 0 11-4 0 2 2 0 014 0zM5 16a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    },
    {
      path: 'equipment-types', label: tAdmin('equipmentTypes'), description: 'Tipos de equipamento disponíveis',
      icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    },
    {
      path: 'equipment-brands', label: tAdmin('equipmentBrands'), description: 'Marcas de equipamento disponíveis',
      icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>,
    },
    {
      path: 'vehicles', label: tAdmin('vehicles'), description: 'Frota de veículos da empresa',
      icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 17a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4zM4 8h16M5 8l1.5-4h11L19 8M4 8l-1 5h18l-1-5" /></svg>,
    },
    {
      path: 'fuel-types', label: tAdmin('fuelTypes'), description: 'Tipos de combustível',
      icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h3m0 0V4a1 1 0 011-1h8a1 1 0 011 1v3m-10 0h10m0 0h2a1 1 0 011 1v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8a1 1 0 011-1h1m10 4l2 2m0 0l2-2m-2 2V10" /></svg>,
    },
    {
      path: 'ovm-regulators', label: tAdmin('ovmRegulators'), description: 'Reguladores OVM',
      icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" /></svg>,
    },
    {
      path: 'settings', label: tAdmin('settings'), description: 'Prefixos e configurações gerais',
      icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>,
    },
    {
      path: 'company', label: tAdmin('companySettings'), description: 'Nome, logotipo e contactos',
      icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
    },
    {
      path: 'item-categories', label: 'Categorias de Artigos', description: 'Categorias para artigos de armazém',
      icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>,
    },
    {
      path: 'import-parts', label: 'Importar Artigos', description: 'Importar artigos de armazém via XLS',
      icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>,
    },
    {
      path: 'import-clients', label: 'Importar Clientes', description: 'Importar clientes a partir de ficheiro XLS',
      icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4a4 4 0 11-8 0 4 4 0 018 0zm6 4a2 2 0 11-4 0 2 2 0 014 0zM5 16a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v5m0 0l-2-2m2 2l2-2" /></svg>,
    },
    {
      path: 'label-templates', label: 'Etiquetas', description: 'Configurar etiquetas para impressora Brother QL-800',
      icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 20h16" /></svg>,
    },
  ]

  return (
    <div>
      <div className="px-4 sm:px-0 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{tAdmin('title')}</h1>
        <p className="text-gray-600">{tAdmin('subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {NAV_ITEMS.map(({ path, label, description, icon }) => (
          <button
            key={path}
            onClick={() => router.push(`/${locale}/admin/${path}`)}
            className="flex flex-col items-start gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 text-left hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm transition-all group"
          >
            <span className="text-blue-500 group-hover:text-blue-600">{icon}</span>
            <span>
              <span className="block text-sm font-semibold text-gray-900 group-hover:text-blue-700 leading-tight">{label}</span>
              <span className="block text-xs text-gray-400 mt-0.5 leading-snug">{description}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
