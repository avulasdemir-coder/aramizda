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
  rating: number | null
  pros: string | null
  cons: string | null
  would_buy_again: boolean | null
  created_at: string
  products?: { name: string; brand: string; category: string }[] | null
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
  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string>('')

  // product search
  const [q, setQ] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  // add product
  const [pBrand, setPBrand] = useState('')
  const [pName, setPName] = useState('')
  const [pCategory, setPCategory] = useState('Cilt Bakım')
  const [addingProduct, setAddingProduct] = useState(false)

  // latest reviews
  const [latest, setLatest] = useState<ReviewRow[]>([])

  // add review form
  const [rating, setRating] = useState<number>(5)
  const [pros, setPros] = useState('')
  const [cons, setCons] = useState('')
  const [wouldBuyAgain, setWouldBuyAgain] = useState<boolean>(true)
  const [saving, setSaving] = useState(false)

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

    const { data: listener } = supabase.auth.onAuthStateChange((_evt, session) => {
      const u = session?.user
      if (!u) {
        setEmail(null)
        setUserId(null)
        window.location.href = '/'
      } else {
        setEmail(u.email ?? null)
        setUserId(u.id)
      }
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const selectedTitle = useMemo(() => {
    if (!selectedProduct) return 'Seçili ürün: yok'
    return `Seçili ürün: ${selectedProduct.brand} — ${selectedProduct.name}`
  }, [selectedProduct])

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
        .select('id,name,brand,category')
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

  const loadLatest = async (productId?: string) => {
    setMsg('')
    try {
      let query = supabase
        .from('reviews')
        .select(
          `
            id,
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

      setLatest((data as ReviewRow[]) ?? [])
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

  const saveReview = async () => {
    setMsg('')
    if (!userId) return setMsg('Kullanıcı bulunamadı.')
    if (!selectedProduct) return setMsg('Önce bir ürün seç.')

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

  const addProduct = async () => {
    setMsg('')
    if (!userId) return setMsg('Kullanıcı bulunamadı.')
    const brand = pBrand.trim()
    const name = pName.trim()
    const category = pCategory.trim()

    if (!brand || !name || !category) return setMsg('Marka, ürün adı ve kategori zorunlu.')

    setAddingProduct(true)
    try {
      const { data, error } = await supabase
        .from('products')
        .insert({
          brand,
          name,
          category,
          created_by: userId,
        })
        .select('id,name,brand,category')
        .single()

      if (error) throw error

      const created = data as Product
      setSelectedProduct(created)
      setMsg('Ürün eklendi ✅ (otomatik seçildi)')

      // arama kutusuna da doldur
      setQ(`${created.brand} ${created.name}`)
      setProducts([created])

      // form reset
      setPBrand('')
      setPName('')
      setPCategory('Cilt Bakım')
    } catch (e: any) {
      setMsg(e?.message ?? 'Ürün eklenemedi.')
    } finally {
      setAddingProduct(false)
    }
  }

  if (loading)
    return (
      <div className="page">
        <div className="container">Yükleniyor…</div>
      </div>
    )

  return (
    <div className="page">
      <div className="container">
        <div className="topbar">
          <div className="brand">
            <h1>Aramızda</h1>
          </div>

          <div className="pill">
            <span className="muted">{email}</span>
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
                        <div className="row" style={{ justifyContent: 'space-between' }}>
                          <div>
                            <div>
                              <strong>{p.brand}</strong> — {p.name}
                            </div>
                            <div className="muted">{p.category}</div>
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
                      return (
                        <div key={r.id} className="item">
                          <div className="row" style={{ justifyContent: 'space-between' }}>
                            <div>
                              <div>
                                <strong>{title}</strong>
                              </div>
                              <div className="muted">{new Date(r.created_at).toLocaleString('tr-TR')}</div>
                            </div>
                            <Stars value={score} />
                          </div>

                          {r.pros ? <div className="section-gap">✅ {r.pros}</div> : null}
                          {r.cons ? <div className="section-gap">⚠️ {r.cons}</div> : null}

                          <div className="section-gap">
                            <span className="badge">{r.would_buy_again ? 'Tekrar alırım' : 'Tekrar almam'}</span>
                          </div>
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
            <div className="card">
              <div className="card-inner">
                <h2 className="card-title">Ürün Ekle</h2>
                <div className="muted">Bulamadığın ürünü ekleyebilirsin.</div>

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
                  <button className="btn" onClick={addProduct} disabled={addingProduct}>
                    {addingProduct ? 'Ekleniyor…' : 'Ürünü Ekle'}
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-inner">
                <h2 className="card-title">Deneyim Ekle</h2>
                <div className="muted">Önce soldan bir ürün seç.</div>

                <div className="section-gap">
                  <label className="muted">Puan</label>
                  <select className="select" value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="section-gap">
                  <label className="muted">Artılar</label>
                  <textarea className="textarea" value={pros} onChange={(e) => setPros(e.target.value)} />
                </div>

                <div className="section-gap">
                  <label className="muted">Eksiler</label>
                  <textarea className="textarea" value={cons} onChange={(e) => setCons(e.target.value)} />
                </div>

                <div className="section-gap row">
                  <input
                    id="wba"
                    type="checkbox"
                    checked={wouldBuyAgain}
                    onChange={(e) => setWouldBuyAgain(e.target.checked)}
                  />
                  <label htmlFor="wba" className="muted">
                    Tekrar alırım
                  </label>
                </div>

                <div className="section-gap">
                  <button className="btn" onClick={saveReview} disabled={saving}>
                    {saving ? 'Kaydediliyor…' : 'Gönder'}
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-inner">
                <div className="muted">
                  Test için: önce ürün ekle veya ara → seç → deneyim gönder → solda “Son Deneyimler”e düşer.
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}