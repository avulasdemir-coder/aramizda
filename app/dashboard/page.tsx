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
  subcategory: string | null
}

type ReviewRow = {
  id: string
  rating: number | null
  pros: string | null
  cons: string | null
  would_buy_again: boolean | null
  created_at: string
  products?: {
    name: string
    brand: string
    category: string
    subcategory: string | null
  }[] | null
}

export default function DashboardPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [msg, setMsg] = useState<string | null>(null)

  // products
  const [q, setQ] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>('')

  // review form
  const [rating, setRating] = useState<number>(5)
  const [pros, setPros] = useState('')
  const [cons, setCons] = useState('')
  const [wouldBuyAgain, setWouldBuyAgain] = useState(true)

  // latest
  const [latest, setLatest] = useState<ReviewRow[]>([])

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? null,
    [products, selectedProductId]
  )

  useEffect(() => {
    const init = async () => {
      try {
        setMsg(null)

        const { data } = await supabase.auth.getSession()
        const user = data.session?.user
        if (!user) {
          window.location.href = '/'
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('age_range')
          .eq('id', user.id)
          .single()

        if (!profile?.age_range) {
          window.location.href = '/onboarding'
          return
        }

        setEmail(user.email ?? null)
        setUserId(user.id)

        // products
        const { data: prodData, error: prodErr } = await supabase
          .from('products')
          .select('id,name,brand,category,subcategory')
          .order('name', { ascending: true })

        if (prodErr) throw prodErr
        setProducts((prodData as Product[]) ?? [])

        // latest reviews + join products
        const { data: revData, error: revErr } = await supabase
          .from('reviews')
          .select(
            `
            id, rating, pros, cons, would_buy_again, created_at,
            products ( name, brand, category, subcategory )
          `
          )
          .order('created_at', { ascending: false })
          .limit(20)

        if (revErr) throw revErr
        setLatest((revData as ReviewRow[]) ?? [])
      } catch (e: any) {
        setMsg(e?.message ?? 'Dashboard yüklenemedi.')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const filteredProducts = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return products.slice(0, 30)
    return products
      .filter((p) => {
        const hay = `${p.brand} ${p.name} ${p.category} ${p.subcategory ?? ''}`.toLowerCase()
        return hay.includes(t)
      })
      .slice(0, 30)
  }, [q, products])

  const refreshLatest = async () => {
    const { data: revData, error: revErr } = await supabase
      .from('reviews')
      .select(
        `
        id, rating, pros, cons, would_buy_again, created_at,
        products ( name, brand, category, subcategory )
      `
      )
      .order('created_at', { ascending: false })
      .limit(20)

    if (revErr) throw revErr
    setLatest((revData as ReviewRow[]) ?? [])
  }

  const submitReview = async () => {
    setMsg(null)

    if (!userId) {
      setMsg('Kullanıcı bulunamadı. Çıkış yapıp tekrar giriş yap.')
      return
    }
    if (!selectedProductId) {
      setMsg('Önce bir ürün seç.')
      return
    }

    try {
      const { error } = await supabase.from('reviews').insert({
        user_id: userId,
        product_id: selectedProductId,
        rating,
        pros: pros.trim() || null,
        cons: cons.trim() || null,
        would_buy_again: wouldBuyAgain,
      })
      if (error) throw error

      setPros('')
      setCons('')
      setWouldBuyAgain(true)
      setRating(5)

      await refreshLatest()
      setMsg('Kaydedildi.')
    } catch (e: any) {
      setMsg(e?.message ?? 'Kaydedilemedi.')
    }
  }

  if (loading) return <div style={{ padding: 40 }}>Yükleniyor...</div>

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ opacity: 0.8 }}>{email}</span>
          <button onClick={logout}>Çıkış yap</button>
        </div>
      </div>

      {msg ? (
        <div style={{ marginTop: 16, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          {msg}
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
        {/* Ürün Ara */}
        <div style={{ padding: 20, border: '1px solid #ddd', borderRadius: 12 }}>
          <h2 style={{ marginTop: 0 }}>Ürün Ara</h2>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Marka / ürün adı / kategori yaz…"
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 10,
              border: '1px solid #ccc',
              marginBottom: 12,
            }}
          />

          <div style={{ display: 'grid', gap: 8 }}>
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProductId(p.id)}
                style={{
                  textAlign: 'left',
                  padding: 12,
                  borderRadius: 10,
                  border: p.id === selectedProductId ? '2px solid #111' : '1px solid #ddd',
                  background: 'white',
                  cursor: 'pointer',
                }}
                type="button"
              >
                <div style={{ fontWeight: 700 }}>
                  {p.brand} — {p.name}
                </div>
                <div style={{ opacity: 0.75, fontSize: 14 }}>
                  {p.category}
                  {p.subcategory ? ` / ${p.subcategory}` : ''}
                </div>
              </button>
            ))}
            {filteredProducts.length === 0 ? <div style={{ opacity: 0.7 }}>Sonuç yok.</div> : null}
          </div>
        </div>

        {/* Deneyim Ekle */}
        <div style={{ padding: 20, border: '1px solid #ddd', borderRadius: 12 }}>
          <h2 style={{ marginTop: 0 }}>Deneyim Ekle</h2>

          <div style={{ marginBottom: 10, opacity: 0.85 }}>
            Seçili ürün:{' '}
            <b>{selectedProduct ? `${selectedProduct.brand} — ${selectedProduct.name}` : 'Yok (yukarıdan seç)'}</b>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <label>
              Puan (1-5)
              <input
                type="number"
                min={1}
                max={5}
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #ccc', marginTop: 6 }}
              />
            </label>

            <label>
              Artılar
              <textarea
                value={pros}
                onChange={(e) => setPros(e.target.value)}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #ccc', marginTop: 6, minHeight: 80 }}
              />
            </label>

            <label>
              Eksiler
              <textarea
                value={cons}
                onChange={(e) => setCons(e.target.value)}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #ccc', marginTop: 6, minHeight: 80 }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={wouldBuyAgain} onChange={(e) => setWouldBuyAgain(e.target.checked)} />
              Tekrar alır mısın?
            </label>

            <button onClick={submitReview} style={{ padding: 12, borderRadius: 10 }}>
              Kaydet
            </button>
          </div>
        </div>

        {/* Son Deneyimler */}
        <div style={{ padding: 20, border: '1px solid #ddd', borderRadius: 12 }}>
          <h2 style={{ marginTop: 0 }}>Son Deneyimler</h2>

          <div style={{ display: 'grid', gap: 12 }}>
            {latest.map((r) => {
              const p = r.products?.[0]
              return (
                <div key={r.id} style={{ padding: 14, borderRadius: 12, border: '1px solid #eee' }}>
                  <div style={{ fontWeight: 800 }}>{p ? `${p.brand} — ${p.name}` : 'Ürün'}</div>
                  <div style={{ opacity: 0.75, fontSize: 14, marginBottom: 6 }}>
                    {p ? `${p.category}${p.subcategory ? ` / ${p.subcategory}` : ''}` : ''}
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    Puan: <b>{r.rating ?? '-'}</b> • Tekrar alır: <b>{r.would_buy_again ? 'Evet' : 'Hayır'}</b>
                  </div>
                  {r.pros ? (
                    <div style={{ marginBottom: 6 }}>
                      <b>Artılar:</b> {r.pros}
                    </div>
                  ) : null}
                  {r.cons ? (
                    <div>
                      <b>Eksiler:</b> {r.cons}
                    </div>
                  ) : null}
                </div>
              )
            })}

            {latest.length === 0 ? <div style={{ opacity: 0.7 }}>Henüz deneyim yok.</div> : null}
          </div>
        </div>
      </div>
    </div>
  )
}