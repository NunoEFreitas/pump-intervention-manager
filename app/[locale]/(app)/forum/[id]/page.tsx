'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface Reply {
  id: string
  content: string
  authorId: string
  authorName: string
  isSolution: boolean
  createdAt: string
}

interface Post {
  id: string
  title: string
  content: string
  authorId: string
  authorName: string
  solved: boolean
  createdAt: string
  replies: Reply[]
}

export default function ForumPostPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const postId = params.id as string

  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [userRole, setUserRole] = useState('')
  const [replyContent, setReplyContent] = useState('')
  const [replySaving, setReplySaving] = useState(false)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const u = JSON.parse(userStr)
      setUserId(u.id)
      setUserRole(u.role)
    }
    fetchPost()
  }, [postId])

  const fetchPost = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const data = await fetch(`/api/forum/${postId}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
      setPost(data)
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  const handleReply = async () => {
    if (!replyContent.trim()) return
    setReplySaving(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/forum/${postId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: replyContent }),
      })
      if (res.ok) {
        setReplyContent('')
        fetchPost()
      }
    } finally { setReplySaving(false) }
  }

  const handleMarkSolution = async (replyId: string, isSolution: boolean) => {
    const token = localStorage.getItem('token')
    await fetch(`/api/forum/${postId}/replies/${replyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isSolution }),
    })
    fetchPost()
  }

  const handleDeleteReply = async (replyId: string) => {
    if (!confirm('Eliminar esta resposta?')) return
    const token = localStorage.getItem('token')
    await fetch(`/api/forum/${postId}/replies/${replyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    fetchPost()
  }

  const handleToggleSolved = async () => {
    if (!post) return
    const token = localStorage.getItem('token')
    await fetch(`/api/forum/${postId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ solved: !post.solved }),
    })
    fetchPost()
  }

  const isAdmin = userRole === 'ADMIN'
  const isPostAuthor = post?.authorId === userId

  if (loading) return (
    <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
  )

  if (!post) return (
    <div className="card text-center py-12"><p className="text-gray-500">Publicação não encontrada.</p></div>
  )

  return (
    <div>
      <button onClick={() => router.push(`/${locale}/forum`)} className="text-blue-600 hover:text-blue-800 text-sm mb-4 block">
        ← Voltar ao Fórum
      </button>

      {/* Original post */}
      <div className={`card mb-4 ${post.solved ? 'border-green-200' : ''}`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {post.solved && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">✓ Resolvido</span>}
              <h1 className="text-xl font-bold text-gray-900">{post.title}</h1>
            </div>
            <p className="text-xs text-gray-400">{post.authorName} · {new Date(post.createdAt).toLocaleString('pt-PT')}</p>
          </div>
          {(isAdmin || isPostAuthor) && (
            <button
              onClick={handleToggleSolved}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${post.solved ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              {post.solved ? 'Marcar como não resolvido' : 'Marcar como resolvido'}
            </button>
          )}
        </div>
        <p className="text-gray-800 whitespace-pre-wrap">{post.content}</p>
      </div>

      {/* Replies */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        {post.replies.length} {post.replies.length === 1 ? 'Resposta' : 'Respostas'}
      </h2>

      <div className="space-y-3 mb-6">
        {post.replies.map(reply => (
          <div
            key={reply.id}
            className={`rounded-xl border px-5 py-4 ${reply.isSolution ? 'border-green-300 bg-green-50' : 'bg-white border-gray-200'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {reply.isSolution && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    <span className="text-xs font-semibold text-green-700">Solução aceite</span>
                  </div>
                )}
                <p className="text-gray-800 whitespace-pre-wrap">{reply.content}</p>
                <p className="text-xs text-gray-400 mt-2">{reply.authorName} · {new Date(reply.createdAt).toLocaleString('pt-PT')}</p>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                {(isAdmin || isPostAuthor) && (
                  <button
                    onClick={() => handleMarkSolution(reply.id, !reply.isSolution)}
                    title={reply.isSolution ? 'Remover solução' : 'Marcar como solução'}
                    className={`p-1.5 rounded-lg text-xs transition-colors ${reply.isSolution ? 'text-green-600 bg-green-100 hover:bg-green-200' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  </button>
                )}
                {(isAdmin || reply.authorId === userId) && (
                  <button
                    onClick={() => handleDeleteReply(reply.id)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Reply form */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-gray-800 text-sm">Adicionar Resposta</h3>
        <textarea
          rows={4}
          className="input text-gray-800 w-full"
          placeholder="Escreve a tua resposta ou solução..."
          value={replyContent}
          onChange={e => setReplyContent(e.target.value)}
        />
        <button
          onClick={handleReply}
          disabled={replySaving || !replyContent.trim()}
          className="btn btn-primary disabled:opacity-50"
        >
          {replySaving ? 'A enviar...' : 'Responder'}
        </button>
      </div>
    </div>
  )
}
