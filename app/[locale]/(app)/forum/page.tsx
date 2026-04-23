'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface Post {
  id: string
  title: string
  content: string
  authorId: string
  authorName: string
  solved: boolean
  createdAt: string
  _count: { replies: number }
}

export default function ForumPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string

  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [userRole, setUserRole] = useState('')
  const [search, setSearch] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', content: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const u = JSON.parse(userStr)
      setUserId(u.id)
      setUserRole(u.role)
    }
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const data = await fetch('/api/forum', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
      setPosts(Array.isArray(data) ? data : [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  const handleCreate = async () => {
    if (!form.title.trim() || !form.content.trim()) return
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/forum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setShowForm(false)
        setForm({ title: '', content: '' })
        fetchPosts()
      }
    } finally { setSaving(false) }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return posts
    return posts.filter(p =>
      p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q) || p.authorName.toLowerCase().includes(q)
    )
  }, [posts, search])

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar esta publicação?')) return
    const token = localStorage.getItem('token')
    await fetch(`/api/forum/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    setPosts(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Base de Conhecimento</h1>
          <p className="text-gray-500 text-sm mt-1">Partilha problemas e soluções com a equipa</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
            + Nova Publicação
          </button>
        )}
      </div>

      {showForm && (
        <div className="card mb-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Nova Publicação</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
            <input
              type="text"
              className="input text-gray-800"
              placeholder="Descreve o problema em poucas palavras..."
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
            <textarea
              rows={5}
              className="input text-gray-800"
              placeholder="Descreve o problema com detalhe: sintomas, contexto, o que já tentaste..."
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving || !form.title.trim() || !form.content.trim()} className="btn btn-primary disabled:opacity-50">
              {saving ? 'A publicar...' : 'Publicar'}
            </button>
            <button onClick={() => { setShowForm(false); setForm({ title: '', content: '' }) }} className="btn btn-secondary">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      {!loading && posts.length > 0 && (
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Pesquisar publicações..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input text-gray-800 pl-9 w-full sm:w-80"
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : posts.length === 0 ? (
        <div className="card text-center py-16">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-gray-400">Ainda não há publicações. Sê o primeiro!</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">Nenhum resultado para &ldquo;{search}&rdquo;.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(post => (
            <div
              key={post.id}
              className={`card cursor-pointer hover:border-blue-300 hover:shadow-md transition-all border ${post.solved ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}
              onClick={() => router.push(`/${locale}/forum/${post.id}`)}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {post.solved && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">✓ Resolvido</span>
                    )}
                    <h2 className="font-semibold text-gray-900 text-sm">{post.title}</h2>
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2">{post.content}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>{post.authorName}</span>
                    <span>·</span>
                    <span>{new Date(post.createdAt).toLocaleDateString('pt-PT')}</span>
                    <span>·</span>
                    <span>{post._count.replies} {post._count.replies === 1 ? 'resposta' : 'respostas'}</span>
                  </div>
                </div>
                {(userRole === 'ADMIN' || post.authorId === userId) && (
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(post.id) }}
                    className="shrink-0 text-gray-300 hover:text-red-500 transition-colors p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
