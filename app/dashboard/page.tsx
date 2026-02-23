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
    <span className="stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className="star"
          viewBox="0 0 24 24"
          fill={i < v ? 'rgba(255,210,90,.95)' : 'rgba(255,255,255,.25)'}
        >
          <path d="M12 17.3l-5.5 3 1-6.3-4.6-4.5 6.4-1 2.7-5.8 2.7 5.8 6.4 1-4.6 4.5 1 6.3z" />
        </svg>
      ))}
    </span>
  )
}

export default function DashboardPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const [nickById, setNickById] = useState<Record<string, string>>({})

  const [q, setQ] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const [latest, setLatest] = useState<ReviewRow[]>([])

  const [rating, setRating] = useState(5)
  const [pros, setPros] = useState('')
  const [cons, setCons] = useState('')
  const [wouldBuyAgain, setWouldBuyAgain] = useState(true)
  const [saving, setSaving] = useState(false)

  // -------- AUTH (getUser kullanıyoruz) --------
  useEffect(() => {
    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getUser()
        if (error) throw error

        const u = data.user
        if (!u) {
          setLoading(false)
          setMsg('Giriş yapman gerekiyor.')
          return
        }

        setUserId(u.id)

        const { data: prof } = await supabase
          .from('profiles')
          .select('nickname')
          .eq('id', u.id)
          .maybeSingle()

        const nn = prof?.nickname ?? 'Kullanıcı'
        setNickname(nn)
        setNickById((prev) => ({ ...prev, [u.id]: nn }))

        setLoading(false)
      } catch (e: any) {
        setMsg(e?.message ?? 'Oturum başlatılamadı.')
        setLoading(false)
      }
    }

    init()
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  // -------- PRODUCT SEARCH --------
  const runSearch = async () => {
    const term = q.trim()
    if (!term) return setProducts([])

    const { data } = await supabase
      .from('products')
      .select('id,name,brand,category,image_url')
      .or(`name.ilike.%${term}%,brand.ilike.%${term}%`)
      .limit(30)

    setProducts((data as Product[]) ?? [])
  }

  // -------- LOAD REVIEWS --------
  const loadLatest = async () => {
    const { data } = await supabase
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

    setLatest((data as ReviewRow[]) ?? [])
  }

  useEffect(() => {
    if (!loading && userId) loadLatest()
  }, [loading, userId])

  const saveReview = async () => {
    if (!userId || !selectedProduct) return

    setSaving(true)

    await supabase.from('reviews').insert({
      user_id: userId,
      product_id: selectedProduct.id,
      rating,
      pros: pros || null,
      cons: cons || null,
      would_buy_again: wouldBuyAgain,
    })

    setPros('')
    setCons('')
    setRating(5)
    setWouldBuyAgain(true)

    await loadLatest()
    setSaving(false)
  }

  if (loading) {
    return <div style={{ padding: 40 }}>Yükleniyor…</div>
  }

  if (!userId) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Giriş yapman gerekiyor</h2>
        <button onClick={() => (window.location.href = '/')}>Girişe dön</button>
      </div>
    )
  }

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 30 }}>
        <h1>Dashboard</h1>
        <div>
          <strong>{nickname}</strong>
          <button style={{ marginLeft: 15 }} onClick={logout}>
            Çıkış
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 30 }}>
        <h2>Ürün Ara</h2>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="örn: elidor şampuan"
        />
        <button onClick={runSearch}>Ara</button>

        {products.map((p) => (
          <div key={p.id} style={{ marginTop: 10 }}>
            <strong>{p.brand}</strong> — {p.name}
            <button onClick={() => setSelectedProduct(p)} style={{ marginLeft: 10 }}>
              Seç
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 30 }}>
        <h2>Deneyim Ekle</h2>
        <div>
          {selectedProduct
            ? `${selectedProduct.brand} — ${selectedProduct.name}`
            : 'Önce ürün seç'}
        </div>

        <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        <div>
          <textarea
            placeholder="Artılar"
            value={pros}
            onChange={(e) => setPros(e.target.value)}
          />
        </div>

        <div>
          <textarea
            placeholder="Eksiler"
            value={cons}
            onChange={(e) => setCons(e.target.value)}
          />
        </div>

        <label>
          <input
            type="checkbox"
            checked={wouldBuyAgain}
            onChange={(e) => setWouldBuyAgain(e.target.checked)}
          />
          Tekrar alırım
        </label>

        <div>
          <button onClick={saveReview} disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Gönder'}
          </button>
        </div>
      </div>

      <div>
        <h2>Son Deneyimler</h2>
        {latest.map((r) => {
          const prod = r.products?.[0]
          return (
            <div key={r.id} style={{ marginBottom: 15 }}>
              <strong>
                {prod?.brand} — {prod?.name}
              </strong>
              <div>{r.pros && <>✅ {r.pros}</>}</div>
              <div>{r.cons && <>⚠️ {r.cons}</>}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}