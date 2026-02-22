'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type ProductRow = {
  id: string
  name: string
  brand: string
  category: string
  subcategory: string | null
}

type ProductMini = {
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
  products: ProductMini[] // <-- Supabase join bazen array döndürüyor, buna göre yazdım
}

function firstProductName(r: ReviewRow) {
  return r.products?.[0]?.name ?? '(ürün yok)'
}

export default function DashboardPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  // search
  const [q, setQ] = useState('')
  const [products, setProducts] = useState<ProductRow[]>([])
  const [selected, setSelected] = useState<ProductRow | null>(null)

  // latest reviews
  const [latest, setLatest] = useState<ReviewRow[]>([])

  useEffect(() => {
    const init = async () => {
      setMsg(null)
      const { data } = await supabase.auth.getSession()
      const session = data.session
      if (!session?.user) {
        window.location.href = '/'
        return
      }

      setEmail(session.user.email ?? null)
      setUserId(session.user.id)
      setLoading(false)
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) {
        window.location.href = '/'
        return
      }
      setEmail(session.user.email ?? null)
      setUserId(session.user.id)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!userId) return

    const loadLatest = async () => {
      try {
        setMsg(null)
        const { data, error } = await supabase
          .from('reviews')
          .select(
            `
            id,
            rating,
            pros,
            cons,
            would_buy_again,
            created_at,
            products ( name, brand, category, subcategory )
          `
          )
          .order('created_at', { ascending: false })
          .limit(10)

        if (error) throw error

        const safe: ReviewRow[] = (data ?? []).map((r: any) => ({
          id: String(r.id),
          rating: r.rating ?? null,
          pros: r.pros ?? null,
          cons: r.cons ?? null,
          would_buy_again: r.would_buy_again ?? null,
          created_at: String(r.created_at),
          products: Array.isArray(r.products) ? r.products : r.products ? [r.products] : [],
        }))

        setLatest(safe)
      } catch (e: any) {
        setMsg(e?.message ?? 'Son deneyimler yüklenemedi.')
      }
    }

    loadLatest()
  }, [userId])

  useEffect(() => {
    // ürün araması (küçük debounce)
    const t = setTimeout(async () => {
      try {
        setMsg(null)
        const term = q.trim()
        if (!term) {
          setProducts([])
          return
        }

        const { data, error } = await supabase
          .from('products')
          .select('id,name,brand,category,subcategory')
          .or(`name.ilike.%${term}%,brand.ilike.%${term}%`)
          .order('name', { ascending: true })
          .limit(20)

        if (error) throw error
        setProducts((data as ProductRow[]) ?? [])
      } catch (e: any) {
        setMsg(e?.message ?? 'Ürün araması başarısız.')
      }
    }, 250)

    return () => clearTimeout(t)
  }, [q])

  const logout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const headerRight = useMemo(() => {
    return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 14, opacity: 0.8 }}>{email}</span>
        <button
          onClick={logout}
          style={{
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: 8,
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          Çıkış yap
        </button>
      </div>
    )
  }, [email])

  if (loading) return <div style={{ padding: 40 }}>Yükleniyor...</div>

  return (
    <div style={{ padding: 24, maxWidth: 980, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        {headerRight}
      </div>

      {msg ? (
        <div style={{ marginBottom: 16, padding: 12, border: '1px solid #f0c', borderRadius: 8 }}>
          {msg}
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 16 }}>
        {/* ÜRÜN ARA */}
        <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 10 }}>
          <h2 style={{ marginTop: 0 }}>Ürün Ara</h2>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Örn: cerave, loreal..."
            style={{
              width: '100%',
              padding: '12px 12px',
              border: '1px solid #bbb',
              borderRadius: 10,
              outline: 'none',
              fontSize: 16,
            }}
          />

          {products.length > 0 ? (
            <div style={{ marginTop: 12, borderTop: '1px solid #eee', paddingTop: 12 }}>
              <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 8 }}>Sonuçlar</div>

              <div style={{ display: 'grid', gap: 8 }}>
                {products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      border: '1px solid #ddd',
                      borderRadius: 10,
                      background: selected?.id === p.id ? '#f5f5f5' : '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>
                      {p.brand} — {p.name}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.75 }}>
                      {p.category}
                      {p.subcategory ? ` / ${p.subcategory}` : ''}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : q.trim() ? (
            <div style={{ marginTop: 12, fontSize: 14, opacity: 0.7 }}>Sonuç yok.</div>
          ) : null}

          {selected ? (
            <div style={{ marginTop: 14, fontSize: 14 }}>
              Seçili ürün: <b>{selected.brand}</b> — <b>{selected.name}</b>
            </div>
          ) : null}
        </div>

        {/* SON DENEYİMLER */}
        <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 10 }}>
          <h2 style={{ marginTop: 0 }}>Son Deneyimler</h2>

          {latest.length === 0 ? (
            <div style={{ fontSize: 14, opacity: 0.7 }}>Henüz deneyim yok.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {latest.map((r) => (
                <div key={r.id} style={{ padding: 12, border: '1px solid #eee', borderRadius: 10 }}>
                  <div style={{ fontWeight: 600 }}>{firstProductName(r)}</div>
                  <div style={{ fontSize: 13, opacity: 0.7 }}>
                    {new Date(r.created_at).toLocaleString()}
                    {r.rating != null ? ` • Puan: ${r.rating}/5` : ''}
                    {r.would_buy_again != null ? ` • Tekrar alır: ${r.would_buy_again ? 'Evet' : 'Hayır'}` : ''}
                  </div>
                  {r.pros ? <div style={{ marginTop: 8 }}>✅ {r.pros}</div> : null}
                  {r.cons ? <div style={{ marginTop: 6 }}>⚠️ {r.cons}</div> : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* DENEYİM EKLE (şimdilik placeholder) */}
        <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 10 }}>
          <h2 style={{ marginTop: 0 }}>Deneyim Ekle</h2>
          <div style={{ fontSize: 14, opacity: 0.7 }}>
            Bir sonraki adım: seçili ürüne puan + artı/eksi + tekrar alır mısın formu.
          </div>
        </div>
      </div>
    </div>
  )
}