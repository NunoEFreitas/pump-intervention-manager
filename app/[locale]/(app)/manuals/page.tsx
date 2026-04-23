'use client'

import { useEffect, useState, useMemo } from 'react'

interface Manual {
  id: string
  title: string
  filename: string
  uploadedById: string
  createdAt: string
}

export default function ManualsPage() {
  const [manuals, setManuals] = useState<Manual[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState<{ id: string; title: string; data: string } | null>(null)
  const [viewLoading, setViewLoading] = useState(false)

  const [showUpload, setShowUpload] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) setUserRole(JSON.parse(userStr).role)
    fetchManuals()
  }, [])

  const fetchManuals = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const data = await fetch('/api/manuals', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
      setManuals(Array.isArray(data) ? data : [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return manuals
    return manuals.filter(m =>
      m.title.toLowerCase().includes(q) || m.filename.toLowerCase().includes(q)
    )
  }, [manuals, search])

  const openManual = async (manual: Manual) => {
    setViewLoading(true)
    setViewing({ id: manual.id, title: manual.title, data: '' })
    try {
      const token = localStorage.getItem('token')
      const data = await fetch(`/api/manuals/${manual.id}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
      setViewing({ id: manual.id, title: manual.title, data: data.data })
    } catch { setViewing(null) } finally { setViewLoading(false) }
  }

  const handleUpload = async () => {
    if (!uploadTitle.trim() || !uploadFile) return
    if (uploadFile.size > 20 * 1024 * 1024) { setUploadError('Máximo 20MB por ficheiro.'); return }
    setUploading(true)
    setUploadError('')
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(uploadFile)
      })
      const token = localStorage.getItem('token')
      const res = await fetch('/api/manuals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: uploadTitle.trim(), filename: uploadFile.name, data: base64 }),
      })
      if (res.ok) {
        setShowUpload(false)
        setUploadTitle('')
        setUploadFile(null)
        fetchManuals()
      } else {
        const d = await res.json()
        setUploadError(d.error || 'Erro ao carregar.')
      }
    } catch { setUploadError('Erro ao carregar.') } finally { setUploading(false) }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Eliminar "${title}"?`)) return
    const token = localStorage.getItem('token')
    await fetch(`/api/manuals/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    setManuals(prev => prev.filter(m => m.id !== id))
  }

  const isAdmin = userRole === 'ADMIN'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Manuais</h1>
          <p className="text-gray-500 text-sm mt-1">Documentação e manuais técnicos</p>
        </div>
        {isAdmin && !showUpload && (
          <button onClick={() => setShowUpload(true)} className="btn btn-primary">
            + Carregar Manual
          </button>
        )}
      </div>

      {/* Upload form */}
      {isAdmin && showUpload && (
        <div className="card mb-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Novo Manual</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
            <input
              type="text"
              className="input text-gray-800"
              placeholder="Ex: Manual de Instalação Bomba X200"
              value={uploadTitle}
              onChange={e => setUploadTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ficheiro PDF * <span className="text-gray-400 font-normal">(máx. 20MB)</span>
            </label>
            <input
              type="file"
              accept="application/pdf"
              onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {uploadFile && (
              <p className="text-xs text-gray-500 mt-1">{uploadFile.name} — {(uploadFile.size / 1024 / 1024).toFixed(1)}MB</p>
            )}
          </div>
          {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
          <div className="flex gap-2">
            <button onClick={handleUpload} disabled={uploading || !uploadTitle.trim() || !uploadFile} className="btn btn-primary disabled:opacity-50">
              {uploading ? 'A carregar...' : 'Guardar'}
            </button>
            <button onClick={() => { setShowUpload(false); setUploadTitle(''); setUploadFile(null); setUploadError('') }} className="btn btn-secondary">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      {!loading && manuals.length > 0 && (
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Pesquisar manuais..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input text-gray-800 pl-9 w-full sm:w-80"
          />
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : manuals.length === 0 ? (
        <div className="card text-center py-16">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-400">Nenhum manual disponível.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">Nenhum resultado para &ldquo;{search}&rdquo;.</p>
      ) : (
        <div className="card divide-y divide-gray-100 p-0 overflow-hidden">
          {filtered.map(m => (
            <div key={m.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
              <div className="shrink-0 w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 4h5v7h7v9H6V4z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{m.title}</p>
                <p className="text-xs text-gray-400 truncate">{m.filename} · {new Date(m.createdAt).toLocaleDateString('pt-PT')}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => openManual(m)} className="btn btn-primary text-sm py-1.5 px-3">
                  Consultar
                </button>
                {isAdmin && (
                  <button onClick={() => handleDelete(m.id, m.title)} className="text-gray-300 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PDF Viewer */}
      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex flex-col" onClick={() => setViewing(null)}>
          <div className="flex items-center justify-between px-4 py-3 bg-gray-900 shrink-0" onClick={e => e.stopPropagation()}>
            <span className="text-white font-medium text-sm truncate">{viewing.title}</span>
            <button onClick={() => setViewing(null)} className="text-gray-400 hover:text-white ml-4 shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex-1 overflow-hidden" onClick={e => e.stopPropagation()}>
            {viewLoading || !viewing.data ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
              </div>
            ) : (
              <iframe
                src={`${viewing.data}#toolbar=0&navpanes=0`}
                className="w-full h-full"
                title={viewing.title}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
