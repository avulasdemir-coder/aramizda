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
  // Supabase embed bazen array döndürebiliyor; bu yüzden array kabul ediyoruz.
  products?: { name: string; brand: string; category: string }[] | null
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

  // latest reviews
  const [latest, setLatest] = useState<ReviewRow[]>([])

  // add review form
  const [rating, setRating] = useState<number>(5)
  const [pros, setPros] = useState('')
  const [cons, setCons] = useState('')
  const [wouldBuyAgain, setWouldBuyAgain] = useState<boolean>(true)
  const [saving, setSaving] = useState(false)

  // --- Auth bootstrap ---
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      const session = data.session
      const u = session?.user

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
        .select('id,name,brand,category')
        .or(`name.ilike.%${term}%,brand.ilike.%${term}%`)
        .limit(20)

      if (error) throw error
      setProducts((data as Product[]) ?? [])
    } catch (e: any) {
      setMsg(e?.message ?? 'Ürün arama başarısız.')
    }
  }

  // --- Latest reviews (optionally filtered by product) ---
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

  // seçili ürün değişince son deneyimleri filtrele
  useEffect(() => {
    if (!loading) loadLatest(selectedProduct?.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct?.id, loading])

  const selectedTitle = useMemo(() => {
    if (!selectedProduct) return ''
    return `${selectedProduct.brand} — ${selectedProduct.name}`
  }, [selectedProduct])

  // --- Save review ---
  const saveReview = async () => {
    setMsg('')
    if (!userId) {
      setMsg('Kullanıcı bulunamadı.')
      return
    }
    if (!selectedProduct) {
      setMsg('Önce bir ürün seç.')
      return
    }

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

      // form reset
      setPros('')
      setCons('')
      setWouldBuyAgain(true)
      setRating(5)

      // refresh latest
      await loadLatest(selectedProduct.id)

      setMsg('Kaydedildi ✅')
    } catch (e: any) {
      setMsg(e?.message ?? 'Kaydetme başarısız.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: 40 }}>Yükleniyor...</div>

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          gap: 16,
        }}
      >
        <h1 style={{ margin: 0 }}>Dashboard</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ opacity: 0.8, fontSize: 14 }}>{email}</span>
          <button onClick={logout}>Çıkış yap</button>
        </div>
      </div>

      {msg ? (
        <div
          style={{
            padding: 12,
            border: '1px solid #ddd',
            borderRadius: 8,
            marginBottom: 16,
            background: '#fafafa',
            fontSize: 14,
          }}
        >
          {msg}
        </div>
      ) : null}

      {/* 1) Product Search */}
      <div
        style={{
          padding: 20,
          border: '1px solid #ddd',
          borderRadius: 10,
          marginBottom: 16,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Ürün Ara</h2>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="örn: cerave"
            style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ccc' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') runSearch()
            }}
          />
          <button onClick={runSearch}>Ara</button>
          <button
            onClick={() => {
              setQ('')
              setProducts([])
              setSelectedProduct(null)
            }}
          >
            Temizle
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 8 }}>Sonuçlar</div>

          {products.length === 0 ? (
            <div style={{ fontSize: 14, opacity: 0.7 }}>Henüz sonuç yok.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProduct(p)}
                  style={{
                    textAlign: 'left',
                    padding: 10,
                    borderRadius: 10,
                    border: selectedProduct?.id === p.id ? '2px solid #333' : '1px solid #ddd',
                    background: 'white',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {p.brand} — {p.name}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{p.category}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 12, fontSize: 14 }}>
          <b>Seçili ürün:</b> {selectedTitle || 'Yok'}
        </div>
      </div>

      {/* 2) Latest Reviews */}
      <div
        style={{
          padding: 20,
          border: '1px solid #ddd',
          borderRadius: 10,
          marginBottom: 16,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Son Deneyimler</h2>
        {!selectedProduct ? (
          <div style={{ fontSize: 14, opacity: 0.75 }}>
            Bir ürün seçersen sadece o ürünün deneyimleri listelenir.
          </div>
        ) : null}

        {latest.length === 0 ? (
          <div style={{ fontSize: 14, opacity: 0.75 }}>Henüz deneyim yok.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {latest.map((r) => {
              const prod = r.products?.[0]
              return (
                <div
                  key={r.id}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid #eee',
                    background: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {prod ? `${prod.brand} — ${prod.name}` : 'Ürün'}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 14 }}>
                    <b>Puan:</b> {r.rating ?? '-'} / 5 &nbsp; | &nbsp;
                    <b>Tekrar alır mı:</b> {r.would_buy_again ? 'Evet' : 'Hayır'}
                  </div>

                  {r.pros ? (
                    <div style={{ marginTop: 8, fontSize: 14 }}>
                      <b>Artılar:</b> {r.pros}
                    </div>
                  ) : null}

                  {r.cons ? (
                    <div style={{ marginTop: 6, fontSize: 14 }}>
                      <b>Eksiler:</b> {r.cons}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 3) Add Review */}
      <div
        style={{
          padding: 20,
          border: '1px solid #ddd',
          borderRadius: 10,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Deneyim Ekle</h2>

        {!selectedProduct ? (
          <div style={{ fontSize: 14, opacity: 0.75 }}>
            Bir sonraki adım: önce üstten bir ürün seç.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 14, marginBottom: 12 }}>
              <b>Seçili ürün:</b> {selectedTitle}
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <label style={{ fontSize: 14 }}>
                Puan (1–5)
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: 6,
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid #ccc',
                  }}
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ fontSize: 14 }}>
                Artılar
                <textarea
                  value={pros}
                  onChange={(e) => setPros(e.target.value)}
                  placeholder="Kısa ve net (isteğe bağlı)"
                  rows={3}
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: 6,
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid #ccc',
                  }}
                />
              </label>

              <label style={{ fontSize: 14 }}>
                Eksiler
                <textarea
                  value={cons}
                  onChange={(e) => setCons(e.target.value)}
                  placeholder="Kısa ve net (isteğe bağlı)"
                  rows={3}
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: 6,
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid #ccc',
                  }}
                />
              </label>

              <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  checked={wouldBuyAgain}
                  onChange={(e) => setWouldBuyAgain(e.target.checked)}
                />
                Tekrar alırım
              </label>

              <button onClick={saveReview} disabled={saving}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}