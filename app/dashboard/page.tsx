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
  } | null
}

export default function DashboardPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // products
  const [q, setQ] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  // reviews
  const [latest, setLatest] = useState<ReviewRow[]>([])
  const [latestLoading, setLatestLoading] = useState(false)

  // review form
  const [rating, setRating] = useState<number>(5)
  const [usageDuration, setUsageDuration] = useState('')
  const [pros, setPros] = useState('')
  const [cons, setCons] = useState('')
  const [wouldBuyAgain, setWouldBuyAgain] = useState<boolean>(true)
  const [savingReview, setSavingReview] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      setMsg(null)
      const { data } = await supabase.auth.getSession()
      const user = data.session?.user
      if (!user) {
        window.location.href = '/'
        return
      }

      // onboarding kontrolü
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
      setLoading(false)

      // ilk yükte ürünler + son deneyimler
      fetchProducts('')
      fetchLatest()
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const fetchProducts = async (query: string) => {
    setProductsLoading(true)
    try {
      let req = supabase
        .from('products')
        .select('id,name,brand,category,subcategory')
        .order('created_at', { ascending: false })
        .limit(50)

      const t = query.trim()
      if (t) {
        // name veya brand içinde geçsin
        req = req.or(`name.ilike.%${t}%,brand.ilike.%${t}%`)
      }

      const { data, error } = await req
      if (error) throw error
      setProducts((data as Product[]) ?? [])
    } catch (e: any) {
      setMsg(e?.message ?? 'Ürünler yüklenemedi.')
    } finally {
      setProductsLoading(false)
    }
  }

  const fetchLatest = async () => {
    setLatestLoading(true)
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(
          'id,rating,pros,cons,would_buy_again,created_at,products(name,brand,category,subcategory)'
        )
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setLatest((data as ReviewRow[]) ?? [])
    } catch (e: any) {
      setMsg(e?.message ?? 'Son deneyimler yüklenemedi.')
    } finally {
      setLatestLoading(false)
    }
  }

  const canSubmit = useMemo(() => {
    return !!userId && !!selectedProduct && rating >= 1 && rating <= 5
  }, [userId, selectedProduct, rating])

  const submitReview = async () => {
    if (!canSubmit || !userId || !selectedProduct) return
    setSavingReview(true)
    setMsg(null)
    try {
      const { error } = await supabase.from('reviews').insert({
        user_id: userId,
        product_id: selectedProduct.id,
        rating,
        usage_duration: usageDuration || null,
        pros: pros || null,
        cons: cons || null,
        would_buy_again: wouldBuyAgain,
      })
      if (error) throw error

      // form reset (kısmi)
      setUsageDuration('')
      setPros('')
      setCons('')
      setWouldBuyAgain(true)

      await fetchLatest()
      setMsg('Deneyim kaydedildi.')
    } catch (e: any) {
      setMsg(e?.message ?? 'Deneyim kaydedilemedi.')
    } finally {
      setSavingReview(false)
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
        }}
      >
        <h1>Dashboard</h1>
        <div>
          <span style={{ marginRight: 16 }}>{email}</span>
          <button onClick={logout}>Çıkış yap</button>
        </div>
      </div>

      {msg && (
        <div style={{ marginBottom: 16, padding: 10, border: '1px solid #ddd', borderRadius: 8 }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'grid', gap: 20 }}>
        {/* Ürün Ara */}
        <div style={{ padding: 20, border: '1px solid #ddd', borderRadius: 8 }}>
          <h2>Ürün Ara</h2>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ürün adı veya marka (örn: La Roche, ped, şampuan...)"
              style={{ flex: 1, padding: 10 }}
            />
            <button
              onClick={() => fetchProducts(q)}
              disabled={productsLoading}
              style={{ whiteSpace: 'nowrap' }}
            >
              {productsLoading ? 'Aranıyor...' : 'Ara'}
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 8, fontSize: 12, opacity: 0.8 }}>
              Sonuç: {products.length}
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              {products.map((p) => {
                const active = selectedProduct?.id === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProduct(p)}
                    style={{
                      textAlign: 'left',
                      padding: 12,
                      borderRadius: 8,
                      border: active ? '2px solid #333' : '1px solid #ddd',
                      background: 'white',
                      cursor: 'pointer',
                    }}
                    type="button"
                  >
                    <div style={{ fontWeight: 600 }}>
                      {p.brand} — {p.name}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      {p.category}
                      {p.subcategory ? ` / ${p.subcategory}` : ''}
                    </div>
                  </button>
                )
              })}
              {products.length === 0 && !productsLoading && (
                <div style={{ padding: 10, opacity: 0.8 }}>
                  Ürün yok. (Sonra “ürün ekleme” ekranı da ekleyeceğiz.)
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Son Deneyimler */}
        <div style={{ padding: 20, border: '1px solid #ddd', borderRadius: 8 }}>
          <h2>Son Deneyimler</h2>
          {latestLoading ? (
            <div style={{ marginTop: 10 }}>Yükleniyor...</div>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
              {latest.map((r) => (
                <div
                  key={r.id}
                  style={{ padding: 12, border: '1px solid #eee', borderRadius: 8 }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {r.products ? `${r.products.brand} — ${r.products.name}` : 'Ürün'}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                    Puan: {r.rating ?? '-'} •{' '}
                    {new Date(r.created_at).toLocaleString('tr-TR')}
                  </div>
                  {r.pros && <div style={{ marginTop: 8 }}><b>Artı:</b> {r.pros}</div>}
                  {r.cons && <div style={{ marginTop: 4 }}><b>Eksi:</b> {r.cons}</div>}
                </div>
              ))}
              {latest.length === 0 && <div style={{ opacity: 0.8 }}>Henüz deneyim yok.</div>}
            </div>
          )}
        </div>

        {/* Deneyim Ekle */}
        <div style={{ padding: 20, border: '1px solid #ddd', borderRadius: 8 }}>
          <h2>Deneyim Ekle</h2>

          <div style={{ marginTop: 10, marginBottom: 10, fontSize: 14 }}>
            Seçili ürün:{' '}
            <b>
              {selectedProduct ? `${selectedProduct.brand} — ${selectedProduct.name}` : 'Yok'}
            </b>
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
                style={{ display: 'block', width: '100%', padding: 10, marginTop: 6 }}
              />
            </label>

            <label>
              Kullanım süresi (opsiyonel)
              <input
                value={usageDuration}
                onChange={(e) => setUsageDuration(e.target.value)}
                placeholder="örn: 2 hafta, 3 ay..."
                style={{ display: 'block', width: '100%', padding: 10, marginTop: 6 }}
              />
            </label>

            <label>
              Artılar
              <textarea
                value={pros}
                onChange={(e) => setPros(e.target.value)}
                placeholder="Sende ne işe yaradı?"
                style={{ display: 'block', width: '100%', padding: 10, marginTop: 6, minHeight: 80 }}
              />
            </label>

            <label>
              Eksiler
              <textarea
                value={cons}
                onChange={(e) => setCons(e.target.value)}
                placeholder="Sende ne kötüydü?"
                style={{ display: 'block', width: '100%', padding: 10, marginTop: 6, minHeight: 80 }}
              />
            </label>

            <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={wouldBuyAgain}
                onChange={(e) => setWouldBuyAgain(e.target.checked)}
              />
              Tekrar alırım
            </label>

            <button
              onClick={submitReview}
              disabled={!canSubmit || savingReview}
              type="button"
              style={{ marginTop: 6 }}
            >
              {savingReview ? 'Kaydediliyor...' : 'Deneyimi Kaydet'}
            </button>

            {!selectedProduct && (
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                Deneyim eklemek için önce yukarıdan bir ürün seç.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}