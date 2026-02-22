'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Product = {
  id: string
  name: string
  brand: string
  category: string
}

type ReviewRow = {
  id: string
  rating: number | null
  pros: string | null
  cons: string | null
  would_buy_again: boolean | null
  created_at: string
  products?: { name: string; brand: string; category: string }[] | null
}

type ReviewComment = {
  id: string
  review_id: string
  user_id: string
  parent_id: string | null
  body: string
  created_at: string
}

export default function DashboardPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string>('')

  const [q, setQ] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const [latest, setLatest] = useState<ReviewRow[]>([])
  const [commentsByReview, setCommentsByReview] = useState<Record<string, ReviewComment[]>>({})
  const [commentDraftByReview, setCommentDraftByReview] = useState<Record<string, string>>({})

  const [rating, setRating] = useState<number>(5)
  const [pros, setPros] = useState('')
  const [cons, setCons] = useState('')
  const [wouldBuyAgain, setWouldBuyAgain] = useState<boolean>(true)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      const u = data.session?.user
      if (!u) {
        window.location.href = '/'
        return
      }

      setEmail(u.email ?? null)
      setUserId(u.id)
      setLoading(false)
    }
    init()
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const selectedTitle = useMemo(() => {
    if (!selectedProduct) return ''
    return `${selectedProduct.brand} — ${selectedProduct.name}`
  }, [selectedProduct])

  const runSearch = async () => {
    const term = q.trim()
    if (!term) return

    const { data } = await supabase
      .from('products')
      .select('id,name,brand,category')
      .or(`name.ilike.%${term}%,brand.ilike.%${term}%`)
      .limit(20)

    setProducts((data as Product[]) ?? [])
  }

  const loadLatest = async () => {
    const { data } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        pros,
        cons,
        would_buy_again,
        created_at,
        products(name,brand,category)
      `)
      .order('created_at', { ascending: false })
      .limit(10)

    const rows = (data as ReviewRow[]) ?? []
    setLatest(rows)

    const ids = rows.map(r => r.id)
    if (ids.length) {
      const { data: c } = await supabase
        .from('review_comments')
        .select('*')
        .in('review_id', ids)
        .order('created_at', { ascending: true })

      const map: Record<string, ReviewComment[]> = {}
      ids.forEach(id => (map[id] = []))
      ;(c as ReviewComment[]).forEach(cm => {
        map[cm.review_id].push(cm)
      })
      setCommentsByReview(map)
    }
  }

  useEffect(() => {
    if (!loading) loadLatest()
  }, [loading])

  const saveReview = async () => {
    if (!userId || !selectedProduct) return

    await supabase.from('reviews').insert({
      user_id: userId,
      product_id: selectedProduct.id,
      rating,
      pros,
      cons,
      would_buy_again: wouldBuyAgain,
    })

    setPros('')
    setCons('')
    setRating(5)
    setWouldBuyAgain(true)
    loadLatest()
    setMsg('Kaydedildi ✅')
  }

  const sendComment = async (reviewId: string) => {
    if (!userId) return
    const body = commentDraftByReview[reviewId]
    if (!body) return

    await supabase.from('review_comments').insert({
      review_id: reviewId,
      user_id: userId,
      body,
    })

    setCommentDraftByReview(prev => ({ ...prev, [reviewId]: '' }))
    loadLatest()
  }

  if (loading) return <div style={{ padding: 40 }}>Yükleniyor...</div>

  return (
    <div style={{ background: '#f5f6f8', minHeight: '100vh', padding: 30 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 30 }}>
          <h1 style={{ margin: 0 }}>Aramızda</h1>
          <div>
            <span style={{ marginRight: 12, fontSize: 14 }}>{email}</span>
            <button onClick={logout}>Çıkış</button>
          </div>
        </div>

        {msg && (
          <div style={{
            background: '#e6f7ee',
            padding: 12,
            borderRadius: 12,
            marginBottom: 20
          }}>
            {msg}
          </div>
        )}

        {/* PRODUCT SEARCH CARD */}
        <div style={card}>
          <h2>Ürün Ara</h2>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Örn: Cerave"
              style={input}
            />
            <button onClick={runSearch}>Ara</button>
          </div>

          <div style={{ marginTop: 10 }}>
            {products.map(p => (
              <div
                key={p.id}
                onClick={() => setSelectedProduct(p)}
                style={{
                  padding: 8,
                  cursor: 'pointer',
                  borderBottom: '1px solid #eee'
                }}
              >
                {p.brand} — {p.name}
              </div>
            ))}
          </div>

          {selectedProduct && (
            <div style={{ marginTop: 10, fontSize: 14 }}>
              Seçili: {selectedTitle}
            </div>
          )}
        </div>

        {/* REVIEWS CARD */}
        <div style={card}>
          <h2>Son Deneyimler</h2>

          {latest.map(r => {
            const prod = r.products?.[0]
            return (
              <div key={r.id} style={reviewCard}>
                <div style={{ fontWeight: 600 }}>
                  {prod?.brand} — {prod?.name}
                </div>
                <div style={{ fontSize: 13, opacity: .6 }}>
                  {new Date(r.created_at).toLocaleString()}
                </div>

                <div style={{ marginTop: 8 }}>
                  ⭐ {r.rating} | Tekrar alır mı: {r.would_buy_again ? 'Evet' : 'Hayır'}
                </div>

                {r.pros && <div>Artı: {r.pros}</div>}
                {r.cons && <div>Eksi: {r.cons}</div>}

                {/* COMMENTS */}
                <div style={{ marginTop: 10 }}>
                  {(commentsByReview[r.id] || []).map(c => (
                    <div key={c.id} style={commentBox}>
                      {c.body}
                    </div>
                  ))}

                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input
                      value={commentDraftByReview[r.id] || ''}
                      onChange={(e) =>
                        setCommentDraftByReview(prev => ({
                          ...prev,
                          [r.id]: e.target.value
                        }))
                      }
                      placeholder="Yorum yaz..."
                      style={input}
                    />
                    <button onClick={() => sendComment(r.id)}>Gönder</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* ADD REVIEW CARD */}
        <div style={card}>
          <h2>Deneyim Ekle</h2>

          {!selectedProduct ? (
            <div>Önce ürün seç.</div>
          ) : (
            <>
              <div style={{ marginBottom: 10 }}>
                {selectedTitle}
              </div>

              <select value={rating} onChange={e => setRating(Number(e.target.value))} style={input}>
                {[5,4,3,2,1].map(n => <option key={n}>{n}</option>)}
              </select>

              <textarea value={pros} onChange={e => setPros(e.target.value)} placeholder="Artılar" style={input} />
              <textarea value={cons} onChange={e => setCons(e.target.value)} placeholder="Eksiler" style={input} />

              <button onClick={saveReview} style={{ marginTop: 10 }}>Kaydet</button>
            </>
          )}
        </div>

      </div>
    </div>
  )
}

const card = {
  background: '#fff',
  padding: 20,
  borderRadius: 16,
  marginBottom: 20,
  boxShadow: '0 6px 20px rgba(0,0,0,0.05)'
}

const reviewCard = {
  background: '#fafafa',
  padding: 14,
  borderRadius: 12,
  marginTop: 12
}

const commentBox = {
  background: '#fff',
  padding: 8,
  borderRadius: 8,
  marginTop: 6,
  fontSize: 14
}

const input = {
  width: '100%',
  padding: 10,
  borderRadius: 10,
  border: '1px solid #ddd'
}