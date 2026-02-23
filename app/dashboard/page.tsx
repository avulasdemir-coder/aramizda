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
  image_url?: string | null
}

type ReviewRow = {
  id: string
  user_id: string
  rating: number | null
  pros: string | null
  cons: string | null
  would_buy_again: boolean | null
  created_at: string
  products?: { name: string; brand: string; category: string; image_url?: string | null }[] | null
}

type CommentRow = {
  id: string
  review_id: string
  user_id: string
  content: string
  created_at: string
}

type ProfileRow = {
  id: string
  nickname: string
}

function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function Stars({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, Math.round(value)))
  return (
    <span className="stars" aria-label={`${v} / 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className="star"
          viewBox="0 0 24 24"
          fill={i < v ? 'rgba(255, 210, 90, .95)' : 'rgba(255,255,255,.25)'}
        >
          <path d="M12 17.3l-5.5 3 1-6.3-4.6-4.5 6.4-1 2.7-5.8 2.7 5.8 6.4 1-4.6 4.5 1 6.3z" />
        </svg>
      ))}
    </span>
  )
}

export default function DashboardPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [nickname, setNickname] = useState<string>('') // header
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  // userId -> nickname map (for reviews/comments)
  const [nickById, setNickById] = useState<Record<string, string>>({})

  // product search
  const [q, setQ] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  // add product
  const [pBrand, setPBrand] = useState('')
  const [pName, setPName] = useState('')
  const [pCategory, setPCategory] = useState('Cilt Bakım')
  const [pImageFile, setPImageFile] = useState<File | null>(null)
  const [addingProduct, setAddingProduct] = useState(false)

  // latest reviews
  const [latest, setLatest] = useState<ReviewRow[]>([])

  // add review form
  const [rating, setRating] = useState<number>(5)
  const [pros, setPros] = useState('')
  const [cons, setCons] = useState('')
  const [wouldBuyAgain, setWouldBuyAgain] = useState(true)
  const [saving, setSaving] = useState(false)

  // comments UI state
  const [openReviewId, setOpenReviewId] = useState<string | null>(null)
  const [commentsByReview, setCommentsByReview] = useState<Record<string, CommentRow[]>>({})
  const [commentDraftByReview, setCommentDraftByReview] = useState<Record<string, string>>({})
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({})
  const [sendingComment, setSendingComment] = useState<Record<string, boolean>>({})

  // ---------- helpers ----------
  const fetchNicknames = async (ids: string[]) => {
    const uniq = Array.from(new Set(ids.filter(Boolean)))
    if (!uniq.length) return

    // already have?
    const missing = uniq.filter((id) => !nickById[id])
    if (!missing.length) return

    const { data, error } = await supabase.from('profiles').select('id,nickname').in('id', missing)
    if (error) throw error

    const rows = (data as ProfileRow[]) ?? []
    setNickById((prev) => {
      const next = { ...prev }
      for (const r of rows) next[r.id] = r.nickname
      return next
    })
  }

  // --- Auth bootstrap (no email shown) ---
  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const u = data.session?.user

        if (!u) {
          window.location.href = '/'
          return
        }

        setUserId(u.id)

        // own nickname for header
        const { data: prof, error: pe } = await supabase
          .from('profiles')
          .select('id,nickname')
          .eq('id', u.id)
          .single()

        if (pe) throw pe

        setNickname(prof?.nickname ?? 'Kullanıcı')
        setNickById((prev) => ({ ...prev, [u.id]: prof?.nickname ?? 'Kullanıcı' }))

        setLoading(false)
      } catch (e: any) {
        setMsg(e?.message ?? 'Oturum başlatılamadı.')
        setLoading(false)
      }
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange(async (_evt, session) => {
      const u = session?.user
      if (!u) {
        setUserId(null)
        window.location.href = '/'
        return
      }

      setUserId(u.id)

      // refresh header nickname if needed
      const { data: prof } = await supabase.from('profiles').select('nickname').eq('id', u.id).single()
      if (prof?.nickname) {
        setNickname(prof.nickname)
        setNickById((prev) => ({ ...prev, [u.id]: prof.nickname }))
      }
    })

    return () => {
      listener.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const selectedTitle = useMemo(() => {
    if (!selectedProduct) return 'Seçili ürün: yok'
    return `Seçili ürün: ${selectedProduct.brand} — ${selectedProduct.name}`
  }, [selectedProduct])

  // --- Product search ---
  const runSearch = async () => {
    setMsg('')
    const term = q.trim()
    if (!term) {
      setProducts([])
      return
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select('id,name,brand,category,image_url')
        .or(`name.ilike.%${term}%,brand.ilike.%${term}%`)
        .order('brand', { ascending: true })
        .order('name', { ascending: true })
        .limit(30)

      if (error) throw error
      setProducts((data as Product[]) ?? [])
    } catch (e: any) {
      setMsg(e?.message ?? 'Ürün arama başarısız.')
    }
  }

  // --- Latest reviews ---
  const loadLatest = async (productId?: string) => {
    setMsg('')
    try {
      let query = supabase
        .from('reviews')
        .select(
          `
          id,
          user_id,
          rating,
          pros,
          cons,
          would_buy_again,
          created_at,
          products(name,brand,category,image_url)
        `
        )
        .order('created_at', { ascending: false })
        .limit(10)

      if (productId) query = query.eq('product_id', productId)

      const { data, error } = await query
      if (error) throw error

      const rows = ((data as ReviewRow[]) ?? []).map((r) => ({ ...r }))
      setLatest(rows)

      // fetch nicknames for review authors
      await fetchNicknames(rows.map((r) => r.user_id))
    } catch (e: any) {
      setMsg(e?.message ?? 'Son deneyimler yüklenemedi.')
    }
  }

  useEffect(() => {
    if (!loading) loadLatest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  useEffect(() => {
    if (!loading) loadLatest(selectedProduct?.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct?.id, loading])

  // --- Save review ---
  const saveReview = async () => {
    setMsg('')
    if (!userId) return setMsg('Kullanıcı bulunamadı.')
    if (!selectedProduct) return setMsg('Önce soldan bir ürün seç.')

    setSaving(true)
    try {
      const payload = {
        user_id: userId,
        product_id: selectedProduct.id,
        rating,
        pros: pros.trim() ? pros.trim() : null,
        cons: cons.trim() ? cons.trim() : null,
        would_buy_again: wouldBuyAgain,
      }

      const { error } = await supabase.from('reviews').insert(payload)
      if (error) throw error

      setPros('')
      setCons('')
      setWouldBuyAgain(true)
      setRating(5)

      await loadLatest(selectedProduct.id)
      setMsg('Kaydedildi ✅')
    } catch (e: any) {
      setMsg(e?.message ?? 'Kaydetme başarısız.')
    } finally {
      setSaving(false)
    }
  }

  // --- Add product ---
  const findDuplicateProduct = async (brand: string, name: string) => {
    const { data, error } = await supabase
      .from('products')
      .select('id,name,brand,category,image_url')
      .ilike('brand', brand)
      .ilike('name', name)
      .limit(10)

    if (error) throw error

    const rows = (data as Product[]) ?? []
    const exact = rows.find(
      (p) =>
        p.brand.trim().toLowerCase() === brand.trim().toLowerCase() &&
        p.name.trim().toLowerCase() === name.trim().toLowerCase()
    )
    return exact ?? null
  }

  const uploadProductImage = async (file: File, brand: string, name: string, uid: string) => {
    if (!file.type.startsWith('image/')) throw new Error('Sadece fotoğraf yükleyebilirsin.')
    if (file.size > 6 * 1024 * 1024) throw new Error('Fotoğraf çok büyük. 6MB altı yükle.')

    const ext = file.name.split('.').pop() || 'jpg'
    const safe = slugify(`${brand}-${name}`)
    const path = `${uid}/${Date.now()}-${safe}.${ext}`

    const { error: upErr } = await supabase.storage.from('product-images').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    })
    if (upErr) throw upErr

    const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path)
    const publicUrl = pub?.publicUrl
    if (!publicUrl) throw new Error('Fotoğraf URL alınamadı.')

    return { path, publicUrl }
  }

  const addProduct = async () => {
    setMsg('')
    if (!userId) return setMsg('Kullanıcı bulunamadı.')

    const brand = pBrand.trim()
    const name = pName.trim()
    const category = pCategory.trim()
    if (!brand || !name || !category) return setMsg('Marka, ürün adı ve kategori zorunlu.')

    setAddingProduct(true)
    try {
      const existing = await findDuplicateProduct(brand, name)
      if (existing) {
        setSelectedProduct(existing)
        setMsg('Bu ürün zaten var ✅ (seçildi)')
        setQ(`${existing.brand} ${existing.name}`)
        setProducts([existing])
        return
      }

      let image_path: string | null = null
      let image_url: string | null = null
      if (pImageFile) {
        const uploaded = await uploadProductImage(pImageFile, brand, name, userId)
        image_path = uploaded.path
        image_url = uploaded.publicUrl
      }

      const { data, error } = await supabase
        .from('products')
        .insert({
          brand,
          name,
          category,
          created_by: userId,
          image_path,
          image_url,
        })
        .select('id,name,brand,category,image_url')
        .single()

      if (error) throw error

      const created = data as Product
      setSelectedProduct(created)
      setMsg('Ürün eklendi ✅ (otomatik seçildi)')
      setQ(`${created.brand} ${created.name}`)
      setProducts([created])

      setPBrand('')
      setPName('')
      setPCategory('Cilt Bakım')
      setPImageFile(null)
    } catch (e: any) {
      const m = e?.message ?? 'Ürün eklenemedi.'
      setMsg(m.includes('duplicate') ? 'Bu ürün zaten var (duplicate).' : m)
    } finally {
      setAddingProduct(false)
    }
  }

  // --- Comments ---
  const loadComments = async (reviewId: string) => {
    setMsg('')
    setLoadingComments((s) => ({ ...s, [reviewId]: true }))
    try {
      const { data, error } = await supabase
        .from('review_comments')
        .select('id,review_id,user_id,content,created_at')
        .eq('review_id', reviewId)
        .order('created_at', { ascending: true })
        .limit(50)

      if (error) throw error

      const rows = (data as CommentRow[]) ?? []
      setCommentsByReview((s) => ({ ...s, [reviewId]: rows }))

      // fetch nicknames for comment authors
      await fetchNicknames(rows.map((c) => c.user_id))
    } catch (e: any) {
      setMsg(e?.message ?? 'Yorumlar yüklenemedi.')
    } finally {
      setLoadingComments((s) => ({ ...s, [reviewId]: false }))
    }
  }

  const toggleComments = async (reviewId: string) => {
    if (openReviewId === reviewId) {
      setOpenReviewId(null)
      return
    }
    setOpenReviewId(reviewId)
    if (!commentsByReview[reviewId]) await loadComments(reviewId)
  }

  const sendComment = async (reviewId: string) => {
    setMsg('')
    if (!userId) return setMsg('Kullanıcı bulunamadı.')
    const text = (commentDraftByReview[reviewId] ?? '').trim()
    if (!text) return setMsg('Yorum boş olamaz.')

    setSendingComment((s) => ({ ...s, [reviewId]: true }))
    try {
      const { error } = await supabase.from('review_comments').insert({
        review_id: reviewId,
        user_id: userId,
        content: text,
      })
      if (error) throw error

      setCommentDraftByReview((s) => ({ ...s, [reviewId]: '' }))
      await loadComments(reviewId)
      setMsg('Yorum eklendi ✅')
    } catch (e: any) {
      setMsg(e?.message ?? 'Yorum eklenemedi.')
    } finally {
      setSendingComment((s) => ({ ...s, [reviewId]: false }))
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="container">Yükleniyor…</div>
      </div>
    )
  }

  const reviewDisabled = !selectedProduct

  return (
    <div className="page">
      <div className="container">
        <div className="topbar">
          <div className="brand">
            <h1>Aramızda</h1>
          </div>

          <div className="pill" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="badge">{nickname || 'Kullanıcı'}</span>
            <button className="btn btn-ghost" onClick={logout}>
              Çıkış
            </button>
          </div>
        </div>

        {msg ? (
          <div className="card section-gap">
            <div className="card-inner">
              <div className="badge">{msg}</div>
            </div>
          </div>
        ) : null}

        <div className="grid section-gap">
          {/* LEFT */}
          <div className="col">
            <div className="card">
              <div className="card-inner">
                <h2 className="card-title">Ürün Ara</h2>

                <div className="row">
                  <input
                    className="input"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="örn: elidor şampuan"
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                  />
                  <button className="btn" onClick={runSearch}>
                    Ara
                  </button>
                </div>

                <div className="divider" />
                <div className="muted">{selectedTitle}</div>

                {products.length ? (
                  <div className="list">
                    {products.map((p) => (
                      <div key={p.id} className="item">
                        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            {p.image_url ? (
                              <img
                                src={p.image_url}
                                alt=""
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 12,
                                  objectFit: 'cover',
                                  border: '1px solid rgba(255,255,255,.25)',
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 12,
                                  background: 'rgba(255,255,255,.12)',
                                  border: '1px solid rgba(255,255,255,.18)',
                                }}
                              />
                            )}

                            <div>
                              <div>
                                <strong>{p.brand}</strong> — {p.name}
                              </div>
                              <div className="muted">{p.category}</div>
                            </div>
                          </div>

                          <button className="btn btn-ghost" onClick={() => setSelectedProduct(p)}>
                            Seç
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="muted">Arama yapınca sonuçlar burada listelenir.</div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-inner">
                <h2 className="card-title">Son Deneyimler</h2>

                {latest.length ? (
                  <div className="list">
                    {latest.map((r) => {
                      const prod = r.products?.[0]
                      const title = prod ? `${prod.brand} — ${prod.name}` : 'Ürün'
                      const score = r.rating ?? 0
                      const isOpen = openReviewId === r.id
                      const comments = commentsByReview[r.id] ?? []
                      const isLoading = loadingComments[r.id] ?? false
                      const isSending = sendingComment[r.id] ?? false
                      const draft = commentDraftByReview[r.id] ?? ''
                      const authorNick = nickById[r.user_id] ?? 'Kullanıcı'

                      return (
                        <div key={r.id} className="item">
                          <div className="row" style={{ justifyContent: 'space-between' }}>
                            <div>
                              <div>
                                <strong>{title}</strong>
                              </div>
                              <div className="muted">
                                {authorNick} • {new Date(r.created_at).toLocaleString('tr-TR')}
                              </div>
                            </div>
                            <Stars value={score} />
                          </div>

                          {r.pros ? <div className="section-gap">✅ {r.pros}</div> : null}
                          {r.cons ? <div className="section-gap">⚠️ {r.cons}</div> : null}

                          <div className="section-gap row" style={{ justifyContent: 'space-between' }}>
                            <span className="badge">{r.would_buy_again ? 'Tekrar alırım' : 'Tekrar almam'}</span>

                            <button className="btn btn-ghost" onClick={() => toggleComments(r.id)}>
                              {isOpen ? 'Yorumları gizle' : `Yorumlar (${comments.length})`}
                            </button>
                          </div>

                          {isOpen ? (
                            <div className="section-gap">
                              <div className="divider" />

                              {isLoading ? (
                                <div className="muted">Yorumlar yükleniyor…</div>
                              ) : comments.length ? (
                                <div className="list" style={{ marginTop: 10 }}>
                                  {comments.map((c) => {
                                    const cnick = nickById[c.user_id] ?? 'Kullanıcı'
                                    return (
                                      <div key={c.id} className="item" style={{ padding: 12 }}>
                                        <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>
                                          <strong>{cnick}</strong>
                                        </div>
                                        <div style={{ fontSize: 14 }}>{c.content}</div>
                                        <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                                          {new Date(c.created_at).toLocaleString('tr-TR')}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : (
                                <div className="muted" style={{ marginTop: 10 }}>
                                  Henüz yorum yok. İlk yorumu yaz.
                                </div>
                              )}

                              <div className="section-gap">
                                <label className="muted">Yorum yaz</label>
                                <textarea
                                  className="textarea"
                                  value={draft}
                                  onChange={(e) =>
                                    setCommentDraftByReview((s) => ({ ...s, [r.id]: e.target.value }))
                                  }
                                  placeholder="Kısa ve net yaz…"
                                />
                              </div>

                              <div className="section-gap">
                                <button className="btn" onClick={() => sendComment(r.id)} disabled={isSending}>
                                  {isSending ? 'Gönderiliyor…' : 'Yorumu Gönder'}
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="muted">Henüz deneyim yok.</div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="col">
            {/* 1) Deneyim Ekle (üstte) */}
            <div className="card">
              <div className="card-inner">
                <h2 className="card-title">Deneyim Ekle</h2>

                <div className="muted">
                  {selectedProduct
                    ? `Seçili ürün: ${selectedProduct.brand} — ${selectedProduct.name}`
                    : 'Önce soldan bir ürün seç.'}
                </div>

                <div className="section-gap">
                  <label className="muted">Puan</label>
                  <select
                    className="select"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    disabled={reviewDisabled}
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="section-gap">
                  <label className="muted">Artılar</label>
                  <textarea
                    className="textarea"
                    value={pros}
                    onChange={(e) => setPros(e.target.value)}
                    disabled={reviewDisabled}
                  />
                </div>

                <div className="section-gap">
                  <label className="muted">Eksiler</label>
                  <textarea
                    className="textarea"
                    value={cons}
                    onChange={(e) => setCons(e.target.value)}
                    disabled={reviewDisabled}
                  />
                </div>

                <div className="section-gap row">
                  <input
                    id="wba"
                    type="checkbox"
                    checked={wouldBuyAgain}
                    onChange={(e) => setWouldBuyAgain(e.target.checked)}
                    disabled={reviewDisabled}
                  />
                  <label htmlFor="wba" className="muted">
                    Tekrar alırım
                  </label>
                </div>

                <div className="section-gap">
                  <button className="btn" onClick={saveReview} disabled={saving || reviewDisabled}>
                    {saving ? 'Kaydediliyor…' : 'Gönder'}
                  </button>
                </div>
              </div>
            </div>

            {/* 2) Ürün Ekle (altta) */}
            <div className="card">
              <div className="card-inner">
                <h2 className="card-title">Ürün Ekle</h2>
                <div className="muted">Bulamadığın ürünü ekleyebilirsin (foto opsiyonel).</div>

                <div className="section-gap">
                  <label className="muted">Marka</label>
                  <input className="input" value={pBrand} onChange={(e) => setPBrand(e.target.value)} />
                </div>

                <div className="section-gap">
                  <label className="muted">Ürün Adı</label>
                  <input className="input" value={pName} onChange={(e) => setPName(e.target.value)} />
                </div>

                <div className="section-gap">
                  <label className="muted">Kategori</label>
                  <select className="select" value={pCategory} onChange={(e) => setPCategory(e.target.value)}>
                    {['Cilt Bakım', 'Saç Bakım', 'Makyaj', 'Güneş Koruma', 'Hijyen', 'Temizlik'].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="section-gap">
                  <label className="muted">Ürün Fotoğrafı (opsiyonel)</label>
                  <input
                    className="input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPImageFile(e.target.files?.[0] ?? null)}
                  />
                  <div className="muted" style={{ marginTop: 6 }}>
                    6MB altı önerilir.
                  </div>
                </div>

                <div className="section-gap">
                  <button className="btn" onClick={addProduct} disabled={addingProduct}>
                    {addingProduct ? 'Ekleniyor…' : 'Ürünü Ekle'}
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-inner">
                <div className="muted">Not: Yorumlar “Son Deneyimler” kartından açılır.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}