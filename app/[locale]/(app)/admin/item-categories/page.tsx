'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface ItemCategory { id: string; name: string }

export default function AdminItemCategoriesPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string

  const [items, setItems] = useState<ItemCategory[]>([])
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<ItemCategory | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const token = () => localStorage.getItem('token') || ''

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr && JSON.parse(userStr).role !== 'ADMIN') { router.push(`/${locale}/dashboard`); return }
    fetch('/api/admin/item-categories', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(d => setItems(Array.isArray(d) ? d : []))
  }, [])

  const save = async () => {
    const name = editing ? editing.name : newName
    if (!name.trim()) return
    setSaving(true); setError('')
    try {
      const url = editing ? `/api/admin/item-categories/${editing.id}` : '/api/admin/item-categories'
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        const data = await res.json()
        if (editing) setItems(prev => prev.map(i => i.id === editing.id ? data : i))
        else setItems(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
        setNewName(''); setEditing(null)
      } else { const d = await res.json(); setError(d.error || 'Erro ao guardar') }
    } finally { setSaving(false) }
  }

  const del = async (id: string) => {
    if (!confirm('Eliminar esta categoria?')) return
    setError('')
    const res = await fetch(`/api/admin/item-categories/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } })
    if (res.ok) setItems(prev => prev.filter(i => i.id !== id))
    else { const d = await res.json(); setError(d.error || 'Erro ao eliminar') }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push(`/${locale}/admin`)} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Categorias de Artigos</h1>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Categorias</h2>
            <p className="text-sm text-gray-500 mt-0.5">Agrupa os artigos de armazém em categorias (ex: Electrónica, Mecânica).</p>
          </div>
          <button onClick={() => { setNewName(' '); setEditing(null) }} className="btn btn-primary text-sm">Adicionar</button>
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        {newName !== '' && !editing && (
          <div className="flex gap-2 mb-4">
            <input
              type="text" className="input text-gray-800 flex-1" placeholder="Nome da categoria" autoFocus
              value={newName.trim() === '' ? '' : newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setNewName('') }}
            />
            <button onClick={save} disabled={saving || !newName.trim()} className="btn btn-primary text-sm disabled:opacity-50">{saving ? 'A guardar...' : 'Guardar'}</button>
            <button onClick={() => setNewName('')} className="btn btn-secondary text-sm">Cancelar</button>
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">Nenhuma categoria criada.</p>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-2 p-3 border rounded-lg">
                {editing?.id === item.id ? (
                  <>
                    <input
                      type="text" className="input text-gray-800 flex-1 py-1" autoFocus
                      value={editing.name}
                      onChange={e => setEditing({ ...editing, name: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(null) }}
                    />
                    <button onClick={save} disabled={saving} className="btn btn-primary text-sm py-1">{saving ? 'A guardar...' : 'Guardar'}</button>
                    <button onClick={() => setEditing(null)} className="btn btn-secondary text-sm py-1">Cancelar</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-gray-900">{item.name}</span>
                    <button onClick={() => { setEditing(item); setNewName('') }} className="text-blue-600 hover:text-blue-800 text-sm">Editar</button>
                    <button onClick={() => del(item.id)} className="text-red-600 hover:text-red-800 text-sm">Eliminar</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
