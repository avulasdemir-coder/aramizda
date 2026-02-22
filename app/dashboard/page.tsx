'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Product = { id: string; name: string; brand: string; category: string }

type ReviewRow = {
  id: string
  product_id: string
  user_id: string
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

  // search
  const [q, setQ] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  // reviews
  const [latest, setLatest] = useState<ReviewRow[]>([])
  const [latestLoading, setLatestLoading] = useState(false)

  // comments
  const [commentsByReview, setCommentsByReview] = useState<Record<string, ReviewComment[]>>({})
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({})
  const [sendingComment, setSendingComment] = useState<Record<string, boolean>>({})

  // add review
  const [rating, setRating] = useState<number>(5)
  const [pros, setPros] = useState('')
  const [cons, setCons] = useState('')
  const [wouldBuyAgain, setWouldBuyAgain] = useState(true)
  const [savingReview, setSavingReview] = useState(false)

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
    if (!selectedProduct) return 'Yok'
    return `${selectedProduct.brand} — ${selectedProduct.name}`
  }, [selectedProduct])

  const runSearch = async () => {
    setMsg('')
    const term = q.trim()
    if (!term) {
      setProducts([])
      return
    }
    setSearching(true)
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id,name,brand,category')
        .or(`name.ilike.%${term}%,brand.ilike.%${term}%`)
        .order('name', { ascending: true })
        .limit(20)

      if (error) throw error
      setProducts((data as Product[]) ?? [])
    } catch (e: any) {
      setMsg(e?.message ?? 'Ürün araması başarısız.')
    } finally {
      setSearching(false)
    }
  }

  const loadLatest = async (productId?: string) => {
    setMsg('')
    setLatestLoading(true)
    try {
      let query = supabase
        .from('reviews')
        .select(
          `
          id,
          product_id,
          user_id,
          rating,
          pros,
          cons,
          would_buy_again,
          created_at,
          products(name,brand,category)
        `
        )
        .order('created_at', { ascending: false })
        .limit(10)

      if (productId) query = query.eq('product_id', productId)

      const { data, error } = await query
      if (error) throw error

      const rows = (data as ReviewRow[]) ?? []
      setLatest(rows)

      const ids = rows.map((r) => r.id)
      await loadComments(ids)
    } catch (e: any) {
      setMsg(e?.message ?? 'Son deneyimler yüklenemedi.')
    } finally {
      setLatestLoading(false)
    }
  }

  const loadComments = async (reviewIds: string[]) => {
    if (reviewIds.length === 0) {
      setCommentsByReview({})
      return
    }
    const { data, error } = await supabase
      .from('review_comments')
      .select('id,review_id,user_id,parent_id,body,created_at')
      .in('review_id', reviewIds)
      .order('created_at', { ascending: true })
      .limit(300)

    if (error) {
      setMsg(error.message)
      return
    }

    const map: Record<string, ReviewComment[]> = {}
    for (const rid of reviewIds) map[rid] = []
    for (const c of (data as ReviewComment[]) ?? []) {
      if (!map[c.review_id]) map[c.review_id] = []
      // şimdilik sadece top-level gösteriyoruz
      if (!c.parent_id) map[c.review_id].push(c)
    }
    setCommentsByReview(map)
  }

  useEffect(() => {
    if (!loading) loadLatest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  useEffect(() => {
    if (!loading) loadLatest(selectedProduct?.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct?.id, loading])

  const saveReview = async () => {
    setMsg('')
    if (!userId) return setMsg('Kullanıcı yok.')
    if (!selectedProduct) return setMsg('Önce ürün seç.')

    setSavingReview(true)
    try {
      const { error } = await supabase.from('reviews').insert({
        user_id: userId,
        product_id: selectedProduct.id,
        rating,
        pros: pros.trim() ? pros.trim() : null,
        cons: cons.trim() ? cons.trim() : null,
        would_buy_again: wouldBuyAgain,
      })
      if (error) throw error

      setPros('')
      setCons('')
      setRating(5)
      setWouldBuyAgain(true)

      await loadLatest(selectedProduct.id)
      setMsg('Kaydedildi ✅')
    } catch (e: any) {
      setMsg(e?.message ?? 'Kaydetme başarısız.')
    } finally {
      setSavingReview(false)
    }
  }

  const sendCommentFor = async (reviewId: string) => {
    setMsg('')
    if (!userId) return setMsg('Kullanıcı yok.')
    const body = (commentDraft[reviewId] ?? '').trim()
    if (!body) return setMsg('Yorum boş olamaz.')

    setSendingComment((p) => ({ ...p, [reviewId]: true }))
    try {
      const { error } = await supabase.from('review_comments').insert({
        review_id: reviewId,
        user_id: userId,
        parent_id: null,
        body,
      })
      if (error) throw error

      setCommentDraft((p) => ({ ...p, [reviewId]: '' }))
      await loadComments([reviewId])
      setMsg('Yorum eklendi ✅')
    } catch (e: any) {
      setMsg(e?.message ?? 'Yorum eklenemedi.')
    } finally {
      setSendingComment((p) => ({ ...p, [reviewId]: false }))
    }
  }

  if (loading) return <div style={{ padding: 40 }}>Yükleniyor...</div>

  return (
    <div style={{ padding: 40 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={header}>
          <h1 style={logo}>Aramızda</h1>
          <div>
            <span style={{ marginRight: 15, fontSize: 14, opacity: 0.85 }}>{email}</span>
            <button style={secondaryBtn} onClick={logout}>
              Çıkış
            </button>
          </div>
        </div>

        {msg ? (
          <div style={{ ...card, padding: 14, marginBottom: 18 }}>
            <div style={{ fontSize: 14 }}>{msg}</div>
          </div>
        ) : null}

        <div style={grid}>
          {/* LEFT */}
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ ...card, padding: 22 }}>
              <h2 style={title}>Ürün Ara</h2>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Ürün adı / marka..."
                  style={input}
                  onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                />
                <button style={primaryBtn} onClick={runSearch} disabled={searching}>
                  {searching ? '...' : 'Ara'}
                </button>
              </div>

              <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                {products.map((p) => {
                  const active = selectedProduct?.id === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedProduct(p)}
                      style={{
                        ...listItem,
                        border: active ? '1px solid var(--brand-1)' : '1px solid var(--border)',
                        background: active ? 'var(--card-2)' : 'rgba(255,255,255,.55)',
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{p.brand} — {p.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>{p.category}</div>
                    </button>
                  )
                })}
                {q.trim() && !searching && products.length === 0 ? (
                  <div style={{ fontSize: 13, opacity: 0.7 }}>Sonuç yok.</div>
                ) : null}
              </div>

              <div style={{ marginTop: 12, fontSize: 13 }}>
                <b>Seçili ürün:</b> {selectedTitle}
              </div>
            </div>

            <div style={{ ...card, padding: 22 }}>
              <h2 style={title}>Deneyim Ekle</h2>

              {!selectedProduct ? (
                <div style={{ fontSize: 14, opacity: 0.75 }}>Önce üstten ürün seç.</div>
              ) : (
                <>
                  <div style={{ fontSize: 13, marginBottom: 10, opacity: 0.85 }}>
                    <b>{selectedTitle}</b>
                  </div>

                  <label style={label}>Puan</label>
                  <select value={rating} onChange={(e) => setRating(Number(e.target.value))} style={input}>
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>

                  <label style={label}>Artılar</label>
                  <textarea value={pros} onChange={(e) => setPros(e.target.value)} style={{ ...input, height: 90 }} />

                  <label style={label}>Eksiler</label>
                  <textarea value={cons} onChange={(e) => setCons(e.target.value)} style={{ ...input, height: 90 }} />

                  <label style={{ ...label, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={wouldBuyAgain}
                      onChange={(e) => setWouldBuyAgain(e.target.checked)}
                    />
                    Tekrar alırım
                  </label>

                  <button style={{ ...primaryBtn, width: '100%' }} onClick={saveReview} disabled={savingReview}>
                    {savingReview ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* RIGHT */}
          <div style={{ ...card, padding: 22 }}>
            <h2 style={title}>Son Deneyimler</h2>

            {latestLoading ? (
              <div style={{ fontSize: 14, opacity: 0.7 }}>Yükleniyor...</div>
            ) : latest.length === 0 ? (
              <div style={{ fontSize: 14, opacity: 0.7 }}>Henüz deneyim yok.</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {latest.map((r) => {
                  const prod = r.products?.[0]
                  const comments = commentsByReview[r.id] ?? []
                  const draft = commentDraft[r.id] ?? ''
                  const sending = !!sendingComment[r.id]

                  return (
                    <div key={r.id} style={{ ...innerCard, padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ fontWeight: 800 }}>
                          {prod ? `${prod.brand} — ${prod.name}` : 'Ürün'}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>
                          {new Date(r.created_at).toLocaleString('tr-TR')}
                        </div>
                      </div>

                      <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
                        ⭐ {r.rating ?? '-'} / 5 &nbsp; • &nbsp;
                        {r.would_buy_again ? 'Tekrar alır' : 'Tekrar almaz'}
                      </div>

                      {r.pros ? <div style={{ marginTop: 10, fontSize: 14 }}><b>Artılar:</b> {r.pros}</div> : null}
                      {r.cons ? <div style={{ marginTop: 6, fontSize: 14 }}><b>Eksiler:</b> {r.cons}</div> : null}

                      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
                          Yorumlar ({comments.length})
                        </div>

                        {comments.length ? (
                          <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
                            {comments.map((c) => (
                              <div key={c.id} style={{ ...commentBubble }}>
                                <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 4 }}>
                                  {new Date(c.created_at).toLocaleString('tr-TR')}
                                </div>
                                <div style={{ fontSize: 14 }}>{c.body}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 10 }}>Henüz yorum yok.</div>
                        )}

                        <div style={{ display: 'flex', gap: 10 }}>
                          <input
                            value={draft}
                            onChange={(e) => setCommentDraft((p) => ({ ...p, [r.id]: e.target.value }))}
                            placeholder="Yorum yaz..."
                            style={{ ...input, marginBottom: 0 }}
                          />
                          <button
                            style={primaryBtn}
                            onClick={() => sendCommentFor(r.id)}
                            disabled={sending}
                          >
                            {sending ? '...' : 'Gönder'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ================= STYLES ================= */

const header: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 26,
}

const logo: React.CSSProperties = {
  margin: 0,
  fontWeight: 900,
  fontSize: 28,
  background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '380px 1fr',
  gap: 18,
}

const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 22,
  boxShadow: 'var(--shadow)',
  backdropFilter: 'blur(10px)',
}

const innerCard: React.CSSProperties = {
  background: 'var(--card-2)',
  borderRadius: 18,
  border: '1px solid var(--border)',
}

const title: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 14,
  fontWeight: 900,
}

const label: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  marginTop: 10,
  fontSize: 13,
  fontWeight: 800,
  opacity: 0.9,
}

const input: React.CSSProperties = {
  width: '100%',
  padding: 12,
  borderRadius: 16,
  border: '1px solid var(--border)',
  outline: 'none',
  background: 'rgba(255,255,255,.92)',
  marginBottom: 10,
}

const primaryBtn: React.CSSProperties = {
  background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
  color: 'white',
  border: 'none',
  padding: '12px 16px',
  borderRadius: 16,
  cursor: 'pointer',
  fontWeight: 800,
}

const secondaryBtn: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--brand-1)',
  border: '1px solid var(--brand-1)',
  padding: '8px 14px',
  borderRadius: 16,
  cursor: 'pointer',
  fontWeight: 700,
}

const listItem: React.CSSProperties = {
  textAlign: 'left',
  padding: 12,
  borderRadius: 16,
  cursor: 'pointer',
}

const commentBubble: React.CSSProperties = {
  background: 'rgba(255,255,255,.92)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 12,
}