'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Profile = {
  user_id: string
  username: string
  avatar_url: string | null
  is_admin: boolean
}

type Product = {
  id: string
  brand: string
  name: string
  category: string | null
  image_url: string | null
  created_at: string
}

type ExperienceRow = {
  id: string
  user_id: string
  product_id: string
  rating: number | null
  pros: string | null
  cons: string | null
  would_buy_again: boolean | null
  image_url: string | null
  created_at: string
  product?: Product | null
  author?: { username: string; avatar_url: string | null } | null
}

type ProductStats = {
  avg: number | null
  count: number
  wbaRate: number | null // 0-100
}

function safeExt(fileName: string) {
  const p = fileName.split('.')
  const ext = p.length > 1 ? p[p.length - 1].toLowerCase() : 'jpg'
  return ext.replace(/[^a-z0-9]/g, '') || 'jpg'
}
function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16)
}

function validateImage(file: File) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (!allowed.includes(file.type)) throw new Error('Sadece JPG, PNG, WEBP veya HEIC/HEIF yükleyebilirsin')
  if (file.size > maxSize) throw new Error('Fotoğraf en fazla 5MB olabilir')
}

async function uploadImage(file: File, folder: string) {
  validateImage(file)
  const ext = safeExt(file.name)
  const path = `${folder}/${uid()}.${ext}`

  const up = await supabase.storage.from('uploads').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  })
  if (up.error) throw up.error

  const { data } = supabase.storage.from('uploads').getPublicUrl(path)
  return data.publicUrl
}

const CATEGORY_OPTIONS = ['Cilt Bakım', 'Makyaj', 'Saç', 'Vücut', 'Parfüm', 'Güneş', 'Ağız Bakım', 'Diğer'] as const

function clamp10(n: number | null) {
  if (typeof n !== 'number' || Number.isNaN(n)) return null
  // Eski veriler 1-5 geldiyse, 10’luk sisteme çevirmek için *2 yap.
  // (Yeni sistemde zaten 1-10 girilecek.)
  const v = n <= 5 ? n * 2 : n
  return Math.max(1, Math.min(10, v))
}

function formatAvg(avg: number | null) {
  if (avg == null) return '—'
  const s = avg.toFixed(1).replace('.', ',')
  return `${s}/10`
}

function titleCaseTR(s: string) {
  // Basit: kelime başlarını büyüt
  return s
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1))
    .join(' ')
}

export default function Home() {
  // auth
  const [userId, setUserId] = useState<string | null>(null)

  // profile
  const [profile, setProfile] = useState<Profile | null>(null)
  const [usernameDraft, setUsernameDraft] = useState('')
  const [avatarDraft, setAvatarDraft] = useState<File | null>(null)
  const [profileErr, setProfileErr] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)

  // products search
  const [q, setQ] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [selected, setSelected] = useState<Product | null>(null)
  const [pLoading, setPLoading] = useState(false)
  const [pErr, setPErr] = useState<string | null>(null)

  // product stats (avg / count / wba%)
  const [stats, setStats] = useState<Record<string, ProductStats>>({})

  // brands (for dropdown)
  const [brands, setBrands] = useState<string[]>([])
  const [brandChoice, setBrandChoice] = useState<string>('Hepsi')
  const [brandFallback, setBrandFallback] = useState('') // sadece ürün yoksa ilk marka için

  // add product
  const [newName, setNewName] = useState('')
  const [categoryChoice, setCategoryChoice] = useState<(typeof CATEGORY_OPTIONS)[number] | ''>('')
  const [customCategory, setCustomCategory] = useState('')
  const [newPhoto, setNewPhoto] = useState<File | null>(null)
  const [addingProduct, setAddingProduct] = useState(false)
  const [addProductMsg, setAddProductMsg] = useState<string | null>(null)

  // add experience
  const [rating, setRating] = useState(8) // 10 üzerinden
  const [pros, setPros] = useState('')
  const [cons, setCons] = useState('')
  const [wba, setWba] = useState(false) // default boş
  const [expPhoto, setExpPhoto] = useState<File | null>(null)
  const [addingExp, setAddingExp] = useState(false)
  const [expMsg, setExpMsg] = useState<string | null>(null)

  // recent (global)
  const [recent, setRecent] = useState<ExperienceRow[]>([])
  const [recentLoading, setRecentLoading] = useState(false)

  // lightbox (images)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [lightboxAlt, setLightboxAlt] = useState<string>('Fotoğraf')

  // profile modal
  const [profileOpen, setProfileOpen] = useState(false)

  // reviews modal (product)
  const [reviewsOpen, setReviewsOpen] = useState(false)
  const [reviewsProduct, setReviewsProduct] = useState<Product | null>(null)
  const [productReviews, setProductReviews] = useState<ExperienceRow[]>([])
  const [productReviewsLoading, setProductReviewsLoading] = useState(false)
  const [expandedReviewIds, setExpandedReviewIds] = useState<Record<string, boolean>>({})

  // user page modal
  const [userOpen, setUserOpen] = useState(false)
  const [userView, setUserView] = useState<{ user_id: string; username: string; avatar_url: string | null } | null>(null)
  const [userLoading, setUserLoading] = useState(false)
  const [userProducts, setUserProducts] = useState<{ product: Product; experiences: ExperienceRow[] }[]>([])
  const [userComments, setUserComments] = useState<ExperienceRow[]>([])
  const [userTab, setUserTab] = useState<'products' | 'comments'>('products')

  const needsUsername = !!userId && (!profile?.username || profile.username.trim().length < 2)

  const selectedLabel = useMemo(() => {
    if (!selected) return 'Seçili Ürün Yok (Önce Soldan Ürün Seç)'
    const cat = selected.category ? ` • ${selected.category}` : ''
    return `${selected.brand} — ${selected.name}${cat}`
  }, [selected])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null
      setUserId(uid)
      if (uid) {
        loadProfile(uid)
        loadRecent()
        loadBrands()
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const uid = session?.user?.id ?? null
      setUserId(uid)
      setSelected(null)
      setProducts([])
      setRecent([])
      setStats({})
      if (uid) {
        loadProfile(uid)
        loadRecent()
        loadBrands()
      } else {
        setProfile(null)
      }
    })

    return () => sub.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Arama kutusu temizlenirse: liste + selected temizlensin
  useEffect(() => {
    if (q.trim() === '') {
      setProducts([])
      setSelected(null)
      setStats({})
      setPErr(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  async function loadProfile(uid: string) {
    setProfileErr(null)
    const res = await supabase
      .from('profiles')
      .select('user_id,username,avatar_url,is_admin')
      .eq('user_id', uid)
      .maybeSingle()

    if (res.error) {
      setProfile(null)
      setProfileErr(res.error.message)
      return
    }
    setProfile((res.data as Profile) ?? null)
    setUsernameDraft(res.data?.username ?? '')
  }

  async function loadBrands() {
    // products’tan brand’leri çekip alfabetik sırala
    const res = await supabase.from('products').select('brand').limit(2000)
    if (res.error) return
    const uniq = Array.from(
      new Set(((res.data as any[]) || []).map((r) => String(r.brand || '').trim()).filter(Boolean))
    )
    uniq.sort((a, b) => a.localeCompare(b, 'tr', { sensitivity: 'base' }))
    setBrands(uniq)
  }

  async function saveProfile() {
    if (!userId) return
    setSavingProfile(true)
    setProfileErr(null)
    try {
      const uname = usernameDraft.trim()
      if (uname.length < 2) throw new Error('Kullanıcı adı en az 2 karakter olmalı')

      let avatar_url = profile?.avatar_url ?? null
      if (avatarDraft) avatar_url = await uploadImage(avatarDraft, 'avatars')

      const up = await supabase
        .from('profiles')
        .upsert({ user_id: userId, username: uname, avatar_url }, { onConflict: 'user_id' })
        .select('user_id,username,avatar_url,is_admin')
        .single()

      if (up.error) throw up.error
      setProfile(up.data as Profile)
      setAvatarDraft(null)
    } catch (e: any) {
      setProfileErr(e?.message ?? 'Profil kaydedilemedi')
      throw e
    } finally {
      setSavingProfile(false)
    }
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function searchProducts() {
    setPErr(null)
    setAddProductMsg(null)
    setPLoading(true)
    setStats({})
    try {
      const term = q.trim()
      if (!term) {
        setProducts([])
        return
      }

      const or = `name.ilike.%${term}%,brand.ilike.%${term}%,category.ilike.%${term}%`

      const { data, error } = await supabase
        .from('products')
        .select('id,brand,name,category,image_url,created_at')
        .or(or)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      const list = ((data as Product[]) ?? []) as Product[]
      setProducts(list)

      // stats hesapla (avg / count / wba)
      const ids = list.map((p) => p.id)
      if (ids.length > 0) {
        const ex = await supabase
          .from('experiences')
          .select('product_id,rating,would_buy_again')
          .in('product_id', ids)
          .limit(5000)

        if (!ex.error) {
          const m: Record<string, { sum: number; cnt: number; wbaYes: number; wbaCnt: number }> = {}
          for (const row of (ex.data as any[]) || []) {
            const pid = String(row.product_id)
            if (!m[pid]) m[pid] = { sum: 0, cnt: 0, wbaYes: 0, wbaCnt: 0 }
            const r10 = clamp10(typeof row.rating === 'number' ? row.rating : null)
            if (r10 != null) {
              m[pid].sum += r10
              m[pid].cnt += 1
            }
            if (typeof row.would_buy_again === 'boolean') {
              m[pid].wbaCnt += 1
              if (row.would_buy_again) m[pid].wbaYes += 1
            }
          }
          const out: Record<string, ProductStats> = {}
          for (const pid of ids) {
            const it = m[pid]
            if (!it) {
              out[pid] = { avg: null, count: 0, wbaRate: null }
              continue
            }
            const avg = it.cnt > 0 ? it.sum / it.cnt : null
            const wbaRate = it.wbaCnt > 0 ? Math.round((it.wbaYes / it.wbaCnt) * 100) : null
            out[pid] = { avg, count: it.cnt, wbaRate }
          }
          setStats(out)
        }
      }
    } catch (e: any) {
      setPErr(e?.message ?? 'Ürün araması başarısız')
    } finally {
      setPLoading(false)
    }
  }

  function validateAddProductInputs() {
    const errs: string[] = []
    const chosenBrand = brandChoice === 'Hepsi' ? '' : brandChoice
    const brand = (chosenBrand || '').trim()
    const name = newName.trim()
    const category = categoryChoice

    if (!brand) errs.push('Marka seç')
    if (!category) errs.push('Kategori seç')
    if (category === 'Diğer' && !customCategory.trim()) errs.push('Diğer kategori yaz')
    if (!name) errs.push('Ürün adı yaz')

    return errs
  }

  async function addProduct() {
    setPErr(null)
    setAddProductMsg(null)
    try {
      if (!userId) throw new Error('Giriş gerekli')

      const vErrs = validateAddProductInputs()
      if (vErrs.length) throw new Error(vErrs.join(' • '))

      const brand =
        (brandChoice !== 'Hepsi' ? brandChoice : '').trim() || brandFallback.trim() // fallback sadece ürün yokken
      const name = newName.trim()

      const category =
        categoryChoice === 'Diğer' ? (customCategory.trim() || null) : (categoryChoice as string)

      setAddingProduct(true)

      // Aynı isimli ürünü tekrar eklemeyi engelle (case-insensitive)
      const dupName = await supabase.from('products').select('id').ilike('name', name).limit(1)
      if (dupName.error) throw dupName.error
      if (dupName.data && dupName.data.length > 0) throw new Error('Bu ürün zaten ekli')

      // Aynı brand + name kombinasyonu da engellensin
      const dupCombo = await supabase.from('products').select('id').ilike('brand', brand).ilike('name', name).limit(1)
      if (dupCombo.error) throw dupCombo.error
      if (dupCombo.data && dupCombo.data.length > 0) throw new Error('Bu ürün zaten ekli')

      let image_url: string | null = null
      if (newPhoto) image_url = await uploadImage(newPhoto, 'products')

      const ins = await supabase
        .from('products')
        .insert({ brand, name, category, image_url })
        .select('id,brand,name,category,image_url,created_at')
        .single()

      if (ins.error) throw ins.error

      setAddProductMsg('Ürün eklendi')
      setNewName('')
      setCategoryChoice('')
      setCustomCategory('')
      setNewPhoto(null)

      // markalar güncellensin
      await loadBrands()

      // Eklenen ürün seçilsin ve arama varsa yenilensin
      setSelected(ins.data as Product)
      if (q.trim()) await searchProducts()
    } catch (e: any) {
      const msg = (e?.message ?? 'Ürün eklenemedi') as string
      setPErr(msg.toLowerCase().includes('duplicate') ? 'Bu ürün zaten ekli' : msg)
    } finally {
      setAddingProduct(false)
    }
  }

  async function addExperience() {
    setExpMsg(null)
    try {
      if (!userId) throw new Error('Giriş gerekli')
      if (!profile?.username) throw new Error('Önce kullanıcı adı belirle')
      if (!selected) throw new Error('Önce ürün seç')

      setAddingExp(true)

      let image_url: string | null = null
      if (expPhoto) image_url = await uploadImage(expPhoto, 'experiences')

      const ins = await supabase
        .from('experiences')
        .insert({
          user_id: userId,
          product_id: selected.id,
          rating, // 1-10
          pros: pros.trim() || null,
          cons: cons.trim() || null,
          would_buy_again: wba,
          image_url,
        })
        .select('id')
        .single()

      if (ins.error) throw ins.error

      setPros('')
      setCons('')
      setRating(8)
      setWba(false)
      setExpPhoto(null)
      setExpMsg('Deneyim eklendi')

      await loadRecent()
      // stats tazelensin (listede görünür)
      if (q.trim()) await searchProducts()
    } catch (e: any) {
      setExpMsg(e?.message ?? 'Deneyim eklenemedi')
    } finally {
      setAddingExp(false)
    }
  }

  async function loadRecent() {
    setRecentLoading(true)
    try {
      const { data, error } = await supabase
        .from('experiences')
        .select(
          `
          id,user_id,product_id,rating,pros,cons,would_buy_again,image_url,created_at,
          product:products(id,brand,name,category,image_url,created_at),
          author:profiles(username,avatar_url)
        `
        )
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setRecent(((data as any[]) || []) as ExperienceRow[])
    } catch {
      setRecent([])
    } finally {
      setRecentLoading(false)
    }
  }

  async function loadProductReviews(product: Product) {
    setProductReviewsLoading(true)
    setExpandedReviewIds({})
    try {
      const { data, error } = await supabase
        .from('experiences')
        .select(
          `
          id,user_id,product_id,rating,pros,cons,would_buy_again,image_url,created_at,
          author:profiles(username,avatar_url)
        `
        )
        .eq('product_id', product.id)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      setProductReviews(((data as any[]) || []) as ExperienceRow[])
      setReviewsProduct(product)
      setReviewsOpen(true)
    } catch {
      setProductReviews([])
      setReviewsProduct(product)
      setReviewsOpen(true)
    } finally {
      setProductReviewsLoading(false)
    }
  }

  async function openUser(user_id: string, username: string, avatar_url: string | null) {
    setUserOpen(true)
    setUserView({ user_id, username, avatar_url })
    setUserTab('products')
    setUserLoading(true)
    setUserProducts([])
    setUserComments([])

    try {
      // Yaptığı yorumlar
      const commentsRes = await supabase
        .from('experiences')
        .select(
          `
          id,user_id,product_id,rating,pros,cons,would_buy_again,image_url,created_at,
          product:products(id,brand,name,category,image_url,created_at),
          author:profiles(username,avatar_url)
        `
        )
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(300)

      if (!commentsRes.error) {
        const comments = (((commentsRes.data as any[]) || []) as ExperienceRow[]).map((r) => ({
          ...r,
          rating: clamp10(r.rating),
        }))
        setUserComments(comments)

        // “Eklediği Ürünler” için (şemada ürünün sahibi yoksa) en güvenli yaklaşım:
        // Kullanıcının yorum yaptığı ürünleri "Eklediği Ürünler" adı altında göstereceğiz.
        // (DB’de products.user_id varsa ileride gerçek ekleyen bilgisini bağlarız.)
        const byProduct: Record<string, { product: Product; experiences: ExperienceRow[] }> = {}
        for (const r of comments) {
          const p = r.product
          if (!p) continue
          if (!byProduct[p.id]) byProduct[p.id] = { product: p, experiences: [] }
          byProduct[p.id].experiences.push(r)
        }
        const groups = Object.values(byProduct).sort((a, b) => {
          const ad = a.product.created_at || ''
          const bd = b.product.created_at || ''
          return bd.localeCompare(ad)
        })
        setUserProducts(groups)
      }
    } finally {
      setUserLoading(false)
    }
  }

  function reviewText(r: ExperienceRow) {
    const a = r.pros?.trim()
    const e = r.cons?.trim()
    const parts: string[] = []
    if (a) parts.push(`Artılar: ${a}`)
    if (e) parts.push(`Eksiler: ${e}`)
    if (!parts.length) return '—'
    return parts.join('  ')
  }

  function snippet(s: string, max = 120) {
    const t = s.replace(/\s+/g, ' ').trim()
    if (t.length <= max) return { text: t, cut: false }
    return { text: t.slice(0, max).trimEnd() + '…', cut: true }
  }

  // UI
  if (!userId) {
    return (
      <div className="wrap">
        <style>{css}</style>
        <div className="center">
          <div className="card authCard">
            <div className="h1">Giriş</div>
            <div className="muted">Devam etmek için Google ile giriş yap</div>
            <button className="btn btnSm" onClick={signInWithGoogle}>
              Google ile giriş
            </button>
          </div>
        </div>
      </div>
    )
  }

  const effectiveBrands = ['Hepsi', ...brands]

  return (
    <div className="wrap">
      <style>{css}</style>

      <div className="app">
        <header className="topbar">
          <div className="brand">
            <img
              className="logo"
              src="/logo.png"
              alt="ARAMIZDA"
              onError={(e) => {
                ;(e.currentTarget as any).style.display = 'none'
              }}
            />
            <div className="word">ARAMIZDA</div>
          </div>

          <div className="rightCol">
            <button
              type="button"
              className="userPill userPillPremium"
              onClick={() => {
                setUsernameDraft(profile?.username ?? '')
                setAvatarDraft(null)
                setProfileErr(null)
                setProfileOpen(true)
              }}
            >
              {profile?.avatar_url ? <img className="av" src={profile.avatar_url} alt="" /> : <div className="av ph" />}
              <div className="uname">{profile?.username || 'Profil'}</div>
            </button>

            <button className="btn ghost btnSm btnTiny" onClick={signOut}>
              Çıkış
            </button>
          </div>
        </header>

        {needsUsername ? (
          <div className="card">
            <div className="h2">Kullanıcı adı</div>
            <div className="muted">Bu isim yorumlarda görünecek</div>

            <div className="field">
              <div className="label">{titleCaseTR('kullanıcı adı')}</div>
              <input className="input" value={usernameDraft} onChange={(e) => setUsernameDraft(e.target.value)} placeholder="ör: ulas, gizem" />
            </div>

            <div className="field">
              <div className="label">{titleCaseTR('profil fotoğrafı (opsiyonel)')}</div>
              <input
                className="file"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                onChange={(e) => setAvatarDraft(e.target.files?.[0] ?? null)}
              />
              <div className="muted small">5 MB Altı</div>
            </div>

            {profileErr ? <div className="err">{profileErr}</div> : null}

            <button className="btn btnSm" onClick={saveProfile} disabled={savingProfile}>
              {savingProfile ? 'Kaydediliyor…' : 'Devam'}
            </button>
          </div>
        ) : (
          <main className="grid4">
            {/* 1) Ürün Ara */}
            <section className="card tall">
              <div className="h2">Ürün Ara</div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  searchProducts()
                }}
              >
                <div className="row">
                  <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ör: bee beauty" />
                  <button className="btn btnSm" type="submit" disabled={pLoading}>
                    {pLoading ? '…' : 'Ara'}
                  </button>
                </div>
              </form>

              {pErr ? <div className="err">{pErr}</div> : null}
              {addProductMsg ? <div className="ok">{addProductMsg}</div> : null}

              <div className="list">
                {products.length === 0 ? (
                  <div className="muted small">
                    {q.trim() ? 'Ürün henüz eklenmemiş, eklemek ister misiniz' : 'Ürün arayın, sonuçlar burada görünecek'}
                    {q.trim() ? (
                      <div style={{ marginTop: 10 }}>
                        <button
                          className="btn btnSm"
                          type="button"
                          onClick={() => {
                            const el = document.getElementById('add-product')
                            el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          }}
                        >
                          Ürün ekle
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  products.map((p) => {
                    const st = stats[p.id] || { avg: null, count: 0, wbaRate: null }
                    const wbaText =
                      st.wbaRate == null
                        ? 'Tekrar Alma Oranı: —'
                        : `Tekrar Alma Oranı: % ${st.wbaRate}`

                    return (
                      <div key={p.id} className={`itemWrap ${selected?.id === p.id ? 'active' : ''}`}>
                        <button
                          className="item"
                          onClick={() => {
                            setSelected(p)
                          }}
                        >
                          {p.image_url ? (
                            <img
                              className="thumb clickable"
                              src={p.image_url}
                              alt=""
                              onClick={(e) => {
                                e.stopPropagation()
                                setLightboxAlt(`${p.brand} — ${p.name}`)
                                setLightboxUrl(p.image_url!)
                              }}
                            />
                          ) : (
                            <div className="thumb ph" />
                          )}

                          <div className="mid">
                            <div className="t">
                              {p.brand} — {p.name}
                            </div>

                            <div className="muted small line2">
                              <span>{p.category || 'Kategori yok'}</span>
                              <span className="dot">•</span>
                              <span>Ortalama Puan: {formatAvg(st.avg)}</span>
                              <span className="dot">•</span>
                              <button
                                type="button"
                                className="linkBtn"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  loadProductReviews(p)
                                }}
                              >
                                {st.count} Yorum
                              </button>
                            </div>

                            <div className="muted small line3">{wbaText}</div>
                          </div>
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </section>

            {/* 2) Deneyim Ekle */}
            <section className="card tall">
              <div className="h2">Deneyim Ekle</div>
              <div className="muted small">{selectedLabel}</div>

              <div className="field">
                <div className="label">{titleCaseTR('puan')}</div>
                <select className="input" value={rating} onChange={(e) => setRating(parseInt(e.target.value, 10))}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <div className="label">{titleCaseTR('artılar')}</div>
                <textarea className="ta" value={pros} onChange={(e) => setPros(e.target.value)} />
              </div>

              <div className="field">
                <div className="label">{titleCaseTR('eksiler')}</div>
                <textarea className="ta" value={cons} onChange={(e) => setCons(e.target.value)} />
              </div>

              <label className="check">
                <input type="checkbox" checked={wba} onChange={(e) => setWba(e.target.checked)} />
                <span>Tekrar alırım</span>
              </label>

              <div className="field">
                <div className="label">{titleCaseTR('deneyim fotoğrafı (opsiyonel)')}</div>
                <input
                  className="file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  onChange={(e) => setExpPhoto(e.target.files?.[0] ?? null)}
                />
                <div className="muted small">5 MB Altı</div>
              </div>

              {expMsg ? <div className={expMsg.includes('eklendi') ? 'ok' : 'err'}>{expMsg}</div> : null}

              <button className="btn btnSm boldBtn" disabled={!selected || addingExp} onClick={addExperience}>
                {addingExp ? 'Gönderiliyor…' : 'Gönder'}
              </button>
            </section>

            {/* 3) Son Deneyimler */}
            <section className="card tall">
              <div className="h2">Son Deneyimler</div>

              {recentLoading ? (
                <div className="muted">Yükleniyor…</div>
              ) : recent.length === 0 ? (
                <div className="muted small"> </div>
              ) : (
                <div className="recent">
                  {recent.map((r) => {
                    const r10 = clamp10(r.rating)
                    const badge =
                      r.would_buy_again === true ? <span className="badge2 okB">✔ Tekrar Alırım</span> : <span className="badge2 badB">✖ Tekrar Almam</span>

                    return (
                      <div
                        className="r"
                        key={r.id}
                        onClick={() => {
                          // deneyimde ürün adını tıklayınca ürün seçilsin ve arama gibi listede görünsün
                          if (r.product) {
                            setQ(`${r.product.brand} ${r.product.name}`)
                            // searchProducts form submit gibi davran
                            setTimeout(() => {
                              searchProducts().then(() => setSelected(r.product as Product))
                            }, 0)
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="rHead">
                          <button
                            type="button"
                            className="userInline"
                            onClick={(e) => {
                              e.stopPropagation()
                              openUser(r.user_id, r.author?.username || 'Kullanıcı', r.author?.avatar_url || null)
                            }}
                          >
                            {r.author?.avatar_url ? <img className="avSm" src={r.author.avatar_url} alt="" /> : <div className="avSm ph" />}
                            <div className="rUser">{r.author?.username || 'Kullanıcı'}</div>
                          </button>

                          <div className="rMeta">
                            <div className="muted small">{new Date(r.created_at).toLocaleString('tr-TR')}</div>
                          </div>

                          <div className="badge">
                            {typeof r10 === 'number' ? `${r10}/10` : '—'} {badge}
                          </div>
                        </div>

                        {r.product ? <div className="muted small pLine">{r.product.brand} — {r.product.name}</div> : null}

                        {r.pros ? (
                          <div className="pill okP">
                            <b>Artılar:</b> {r.pros}
                          </div>
                        ) : null}
                        {r.cons ? (
                          <div className="pill badP">
                            <b>Eksiler:</b> {r.cons}
                          </div>
                        ) : null}

                        {r.image_url ? (
                          <img
                            className="rImg clickable"
                            src={r.image_url}
                            alt=""
                            onClick={(e) => {
                              e.stopPropagation()
                              setLightboxAlt('Deneyim fotoğrafı')
                              setLightboxUrl(r.image_url!)
                            }}
                          />
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* 4) Ürün Ekle */}
            <section id="add-product" className="card tall">
              <div className="h2">Ürün Ekle</div>

              <div className="field">
                <div className="label">{titleCaseTR('marka')}</div>
                {brands.length > 0 ? (
                  <select className="input" value={brandChoice} onChange={(e) => setBrandChoice(e.target.value)}>
                    {effectiveBrands.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <div className="muted small">Henüz marka yok. İlk ürünü eklemek için bir marka yaz.</div>
                    <input className="input" value={brandFallback} onChange={(e) => setBrandFallback(e.target.value)} placeholder="ör: essence" />
                  </>
                )}
              </div>

              <div className="field">
                <div className="label">{titleCaseTR('ürün adı')}</div>
                <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>

              <div className="field">
                <div className="label">{titleCaseTR('kategori')}</div>
                <select className="input" value={categoryChoice} onChange={(e) => setCategoryChoice(e.target.value as any)}>
                  <option value="">Kategori Seç</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {categoryChoice === 'Diğer' ? (
                <div className="field">
                  <div className="label">{titleCaseTR('diğer kategori')}</div>
                  <input className="input" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="ör: Anne&Bebek" />
                </div>
              ) : null}

              <div className="field">
                <div className="label">{titleCaseTR('ürün fotoğrafı (opsiyonel)')}</div>
                <input
                  className="file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  onChange={(e) => setNewPhoto(e.target.files?.[0] ?? null)}
                />
                <div className="muted small">5 MB Altı</div>
              </div>

              <button className="btn btnSm" onClick={addProduct} disabled={addingProduct}>
                {addingProduct ? 'Ekleniyor…' : 'Ekle'}
              </button>

              <div className="divider" />

              <div className="muted small">
                Marka ve kategori seçmeden ürün eklenmez. Kategori zorunlu.
              </div>
            </section>
          </main>
        )}

        <div className="foot muted small">© ARAMIZDA</div>

        {/* Profile modal (kendi profilin) */}
        {profileOpen ? (
          <div className="pm" onClick={() => setProfileOpen(false)} role="dialog" aria-modal="true">
            <div className="pmInner" onClick={(e) => e.stopPropagation()}>
              <button className="pmClose" onClick={() => setProfileOpen(false)} aria-label="Kapat">
                ×
              </button>

              <div className="h2">Profil</div>

              <div className="field">
                <div className="label">{titleCaseTR('kullanıcı adı')}</div>
                <input className="input" value={usernameDraft} onChange={(e) => setUsernameDraft(e.target.value)} />
              </div>

              <div className="field">
                <div className="label">{titleCaseTR('profil fotoğrafı')}</div>
                <input
                  className="file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  onChange={(e) => setAvatarDraft(e.target.files?.[0] ?? null)}
                />
                <div className="muted small">5 MB Altı</div>
              </div>

              {profileErr ? <div className="err">{profileErr}</div> : null}

              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
                <button
                  className="btn btnSm"
                  onClick={async () => {
                    try {
                      await saveProfile()
                      setProfileOpen(false)
                    } catch {
                      // mesaj zaten ekranda
                    }
                  }}
                  disabled={savingProfile}
                >
                  {savingProfile ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Reviews Modal */}
        {reviewsOpen ? (
          <div className="rm" onClick={() => setReviewsOpen(false)} role="dialog" aria-modal="true">
            <div className="rmInner" onClick={(e) => e.stopPropagation()}>
              <button className="rmClose" onClick={() => setReviewsOpen(false)} aria-label="Kapat">
                ×
              </button>

              <div className="rmTop">
                <div className="h2 rmTitle">
                  {reviewsProduct ? `${reviewsProduct.brand} — ${reviewsProduct.name}` : 'Yorumlar'}
                </div>
                <div className="muted small">
                  Yorumlar en son tarihliden başlar
                </div>
              </div>

              {productReviewsLoading ? (
                <div className="muted">Yükleniyor…</div>
              ) : productReviews.length === 0 ? (
                <div className="muted small"> </div>
              ) : (
                <div className="rmList">
                  {productReviews.map((r) => {
                    const rid = r.id
                    const expanded = !!expandedReviewIds[rid]
                    const r10 = clamp10(r.rating)
                    const full = reviewText(r)
                    const sn = snippet(full, 120)

                    const badge =
                      r.would_buy_again === true ? <span className="badge2 okB">✔ Tekrar Alırım</span> : <span className="badge2 badB">✖ Tekrar Almam</span>

                    return (
                      <button
                        key={r.id}
                        type="button"
                        className="rmRow"
                        onClick={() => setExpandedReviewIds((x) => ({ ...x, [rid]: !x[rid] }))}
                      >
                        <div className="rmLine1">
                          <button
                            type="button"
                            className="userInline"
                            onClick={(e) => {
                              e.stopPropagation()
                              openUser(r.user_id, r.author?.username || 'Kullanıcı', r.author?.avatar_url || null)
                            }}
                          >
                            {r.author?.avatar_url ? <img className="avSm" src={r.author.avatar_url} alt="" /> : <div className="avSm ph" />}
                            <b className="rmUser">{r.author?.username || 'Kullanıcı'}</b>
                          </button>

                          <div className="rmMetaRight">
                            <span className="rmRate">{typeof r10 === 'number' ? `Puan: ${r10}/10` : 'Puan: —'}</span>
                            {badge}
                          </div>
                        </div>

                        <div className="rmLine2">
                          {expanded ? full : sn.text}
                        </div>

                        <div className="rmLine3 muted small">
                          {new Date(r.created_at).toLocaleString('tr-TR')}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* User Modal */}
        {userOpen && userView ? (
          <div className="um" onClick={() => setUserOpen(false)} role="dialog" aria-modal="true">
            <div className="umInner" onClick={(e) => e.stopPropagation()}>
              <button className="umClose" onClick={() => setUserOpen(false)} aria-label="Kapat">
                ×
              </button>

              <div className="umHead">
                <div className="umUserBox">
                  {userView.avatar_url ? <img className="umAv" src={userView.avatar_url} alt="" /> : <div className="umAv ph" />}
                  <div className="umName"><b>{userView.username}</b></div>
                </div>

                <div className="umTabs">
                  <button type="button" className={`tab ${userTab === 'products' ? 'active' : ''}`} onClick={() => setUserTab('products')}>
                    Eklediği Ürünler
                  </button>
                  <button type="button" className={`tab ${userTab === 'comments' ? 'active' : ''}`} onClick={() => setUserTab('comments')}>
                    Yaptığı Yorumlar
                  </button>
                </div>
              </div>

              {userLoading ? (
                <div className="muted">Yükleniyor…</div>
              ) : userTab === 'products' ? (
                userProducts.length === 0 ? (
                  <div className="muted small"> </div>
                ) : (
                  <div className="umList">
                    {userProducts.map((g) => (
                      <div key={g.product.id} className="umCard">
                        <div className="umProd">
                          <div className="t">{g.product.brand} — {g.product.name}</div>
                          <div className="muted small">{g.product.category || ''}</div>
                        </div>
                        <div className="umExpList">
                          {g.experiences.map((r) => {
                            const r10 = clamp10(r.rating)
                            return (
                              <div key={r.id} className="umExp">
                                <div className="muted small">
                                  {typeof r10 === 'number' ? `Puan: ${r10}/10` : 'Puan: —'}{' '}
                                  {r.would_buy_again === true ? '• ✔ Tekrar Alırım' : '• ✖ Tekrar Almam'}
                                </div>
                                {r.pros ? <div className="pill okP"><b>Artılar:</b> {r.pros}</div> : null}
                                {r.cons ? <div className="pill badP"><b>Eksiler:</b> {r.cons}</div> : null}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                userComments.length === 0 ? (
                  <div className="muted small"> </div>
                ) : (
                  <div className="umList">
                    {userComments.map((r) => {
                      const r10 = clamp10(r.rating)
                      return (
                        <div key={r.id} className="umCard">
                          <div className="muted small">
                            {r.product ? `${r.product.brand} — ${r.product.name}` : 'Ürün'} •{' '}
                            {typeof r10 === 'number' ? `Puan: ${r10}/10` : 'Puan: —'} •{' '}
                            {r.would_buy_again === true ? '✔ Tekrar Alırım' : '✖ Tekrar Almam'}
                          </div>
                          {r.pros ? <div className="pill okP"><b>Artılar:</b> {r.pros}</div> : null}
                          {r.cons ? <div className="pill badP"><b>Eksiler:</b> {r.cons}</div> : null}
                        </div>
                      )
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        ) : null}

        {/* Lightbox (images) */}
        {lightboxUrl ? (
          <div className="lb" onClick={() => setLightboxUrl(null)} role="dialog" aria-modal="true">
            <div className="lbInner" onClick={(e) => e.stopPropagation()}>
              <button className="lbClose" onClick={() => setLightboxUrl(null)} aria-label="Kapat">
                ×
              </button>
              <img className="lbImg" src={lightboxUrl} alt={lightboxAlt} />
              <div className="lbCap">{lightboxAlt}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

const css = `
:root{
  --stroke: rgba(255,255,255,.18);
  --glass: rgba(255,255,255,.10);
  --glass2: rgba(255,255,255,.14);
  --text: rgba(255,255,255,.92);
  --muted: rgba(255,255,255,.72);
  --shadow: 0 18px 60px rgba(0,0,0,.35);
  --r: 22px;
  --r2: 16px;
}
*{ box-sizing:border-box; }
body{ margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color: var(--text); }

.wrap{
  min-height:100vh;
  padding: 18px;
  background:
    radial-gradient(1200px 700px at 18% 8%, rgba(255,255,255,.10), transparent 55%),
    radial-gradient(900px 600px at 78% 20%, rgba(255,255,255,.10), transparent 55%),
    linear-gradient(135deg, #4a1677, #c03a9f);
}
.center{ min-height: calc(100vh - 36px); display:grid; place-items:center; }
.app{ max-width: 1500px; margin:0 auto; display:flex; flex-direction:column; gap: 14px; }

.topbar{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding: 12px 20px;
  border-radius: var(--r);
  border:1px solid var(--stroke);
  background: linear-gradient(180deg, var(--glass2), var(--glass));
  backdrop-filter: blur(18px);
  box-shadow: var(--shadow);
  position: sticky; top: 12px; z-index: 20;
}
.brand{ display:flex; align-items:center; gap: 18px; }

.logo{
  width: 124px;
  height: 124px;
  padding: 0;
  object-fit: contain;
  border-radius: 30px;
  background: #0e0e14;
  border: 1px solid rgba(255,255,255,.18);
  box-shadow:
    0 35px 80px rgba(0,0,0,.55),
    inset 0 0 0 1px rgba(255,255,255,.06);
}
.word{ font-weight: 900; font-size: 26px; letter-spacing: .22em; text-transform: uppercase; }

.rightCol{
  display:flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.userPill{
  display:flex; align-items:center; gap:12px;
  height: 44px;
  padding: 0 16px;
  border-radius: 16px;
  border:1px solid rgba(255,255,255,.28);
  cursor:pointer;
  background: linear-gradient(145deg, rgba(0,0,0,.55), rgba(0,0,0,.35));
  color: #ffffff;
  box-shadow: 0 12px 30px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.06);
}
.userPillPremium{ font-weight: 900; }
.av{ width: 30px; height: 30px; border-radius: 999px; object-fit: cover; border:1px solid rgba(255,255,255,.22); }
.av.ph{ background: rgba(255,255,255,.14); }
.uname{ font-weight: 900; font-size: 13px; }

.btn{
  appearance:none;
  border:1px solid rgba(255,255,255,.28);
  cursor:pointer;
  padding: 12px 18px;
  border-radius: 16px;
  background: linear-gradient(145deg, rgba(0,0,0,.55), rgba(0,0,0,.35));
  color: #ffffff;
  font-weight: 900;
  letter-spacing: .6px;
  box-shadow: 0 12px 30px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.06);
  transition: all .2s ease;
}
.btn:hover{
  transform: translateY(-2px);
  box-shadow: 0 18px 40px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.08);
}
.btn.ghost{
  background: rgba(255,255,255,.10);
  border:1px solid rgba(255,255,255,.20);
}
.btn:disabled{ opacity:.6; cursor:not-allowed; transform:none; }
.btnSm{ height: 46px; display:inline-flex; align-items:center; justify-content:center; padding: 0 18px; }
.btnTiny{ height: 38px; padding: 0 14px; border-radius: 14px; font-size: 12px; }
.boldBtn{ font-weight: 900; }

.card{
  padding: 14px; border-radius: var(--r);
  border:1px solid var(--stroke);
  background: linear-gradient(180deg, var(--glass2), var(--glass));
  backdrop-filter: blur(18px);
  box-shadow: var(--shadow);
}
.authCard{ max-width: 420px; }

.h1{ font-size: 20px; font-weight: 900; margin-bottom: 8px; }
.h2{ font-size: 16px; font-weight: 900; margin-bottom: 10px; }
.muted{ color: var(--muted); }
.small{ font-size: 12px; }

.grid4{
  display:grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 14px;
  align-items: start;
}
.tall{ min-height: 520px; }

.row{ display:flex; gap:10px; align-items:center; margin-bottom: 10px; }

.label{
  font-size: 12px;
  color: var(--text);
  margin-bottom: 6px;
  font-weight: 900;
}

.field{ margin-top: 10px; }

.input,.ta,.file, select.input{
  width:100%;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.16);
  background: rgba(0,0,0,.22) !important;
  color: var(--text) !important;
  padding: 10px 12px;
  outline:none;
}
.ta{ min-height: 74px; resize: vertical; }
.file{ padding: 10px; }

.file::file-selector-button{
  appearance:none;
  border:1px solid rgba(255,255,255,.28);
  cursor:pointer;
  padding: 10px 14px;
  border-radius: 16px;
  background: linear-gradient(145deg, rgba(0,0,0,.55), rgba(0,0,0,.35));
  color: #ffffff;
  font-weight: 900;
  letter-spacing: .6px;
  box-shadow: 0 12px 30px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.06);
  margin-right: 12px;
}

.list{
  margin-top: 10px;
  display:flex; flex-direction:column; gap:10px;
  max-height: 380px; overflow:auto; padding-right: 2px;
}

.itemWrap{ border-radius: var(--r2); }
.itemWrap.active .item{ border-color: rgba(255,255,255,.28); background: rgba(255,255,255,.08); }

.item{
  width:100%;
  display:flex; gap:12px; align-items:center;
  border-radius: var(--r2);
  border:1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.16);
  padding: 10px;
  cursor:pointer;
  color: var(--text);
  text-align:left;
}

.thumb{ width:44px; height:44px; border-radius: 14px; object-fit: cover; border:1px solid rgba(255,255,255,.18); }
.thumb.ph{ background: rgba(255,255,255,.10); }
.mid{ flex:1; min-width:0; }
.t{ font-weight: 900; }
.line2,.line3{ display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.dot{ opacity:.7; }

.linkBtn{
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  color: rgba(255,255,255,.92);
  font-weight: 900;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-thickness: 2px;
}

.check{ display:flex; align-items:center; gap:10px; margin-top: 10px; font-weight: 900; }

.err{
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255,70,70,.18);
  border: 1px solid rgba(255,120,120,.28);
}
.ok{
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(70,255,160,.14);
  border: 1px solid rgba(120,255,190,.24);
}

.divider{ height: 1px; background: rgba(255,255,255,.16); margin: 14px 0; }

.recent{ display:flex; flex-direction:column; gap: 10px; max-height: 360px; overflow:auto; padding-right: 2px; }

.r{
  border:1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.14);
  border-radius: var(--r2);
  padding: 10px;
  cursor: pointer;
}
.rHead{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom: 8px; }

.userInline{
  display:flex;
  align-items:center;
  gap:10px;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: var(--text);
  text-align:left;
}
.avSm{ width:28px; height:28px; border-radius:999px; object-fit:cover; border:1px solid rgba(255,255,255,.22); }
.avSm.ph{ background: rgba(255,255,255,.12); }
.rUser{ font-weight: 900; }

.rMeta{ flex:1; min-width:0; }

.badge{
  display:flex;
  align-items:center;
  gap:10px;
  font-weight: 900;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255,255,255,.10);
  border:1px solid rgba(255,255,255,.18);
}
.badge2{
  font-weight: 900;
  padding: 6px 10px;
  border-radius: 999px;
  border:1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.10);
}
.okB{ background: rgba(70,255,160,.12); }
.badB{ background: rgba(255,90,90,.12); }

.pLine{ margin-top: 2px; }

.pill{ margin-top: 8px; padding: 8px 10px; border-radius: 14px; border:1px solid rgba(255,255,255,.14); }
.okP{ background: rgba(70,255,160,.10); }
.badP{ background: rgba(255,90,90,.10); }

.rImg{ width: 100%; max-height: 220px; object-fit: cover; border-radius: 14px; border:1px solid rgba(255,255,255,.18); margin-top: 10px; }

.foot{ text-align:center; padding: 6px 0; }

.clickable { cursor: zoom-in; }

/* Lightbox */
.lb{
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0,0,0,.65);
  backdrop-filter: blur(10px);
  display: grid;
  place-items: center;
  padding: 18px;
}
.lbInner{
  width: min(920px, 96vw);
  max-height: 90vh;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.18);
  background: rgba(15, 5, 20, .55);
  box-shadow: 0 30px 90px rgba(0,0,0,.55);
  padding: 14px;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lbClose{
  position: absolute;
  top: 10px;
  right: 12px;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.22);
  background: rgba(0,0,0,.35);
  color: #fff;
  font-size: 22px;
  cursor: pointer;
}
.lbImg{
  width: 100%;
  height: auto;
  max-height: 72vh;
  object-fit: contain;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.14);
}
.lbCap{
  font-size: 12px;
  color: rgba(255,255,255,.75);
  text-align: center;
}

/* Profile Modal (kendi profilin) */
.pm{
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0,0,0,.55);
  backdrop-filter: blur(10px);
  display: grid;
  place-items: center;
  padding: 18px;
}
.pmInner{
  width: min(560px, 96vw);
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.18);
  background: rgba(15, 5, 20, .60);
  box-shadow: 0 30px 90px rgba(0,0,0,.55);
  padding: 16px;
  position: relative;
}
.pmClose{
  position: absolute;
  top: 10px;
  right: 12px;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.22);
  background: rgba(0,0,0,.35);
  color: #fff;
  font-size: 22px;
  cursor: pointer;
}

/* Reviews Modal (pembe üzerine beyaz) */
.rm{
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(255,255,255,.35);
  backdrop-filter: blur(10px);
  display: grid;
  place-items: center;
  padding: 18px;
}
.rmInner{
  width: min(860px, 96vw);
  max-height: 90vh;
  overflow: auto;
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,.55);
  background:
    radial-gradient(900px 500px at 20% 0%, rgba(255,255,255,.65), rgba(255,255,255,.35)),
    linear-gradient(135deg, rgba(255,255,255,.78), rgba(255,255,255,.55));
  box-shadow: 0 30px 90px rgba(0,0,0,.35);
  padding: 16px;
  position: relative;
  color: #1a1020;
}
.rmInner .muted{ color: rgba(0,0,0,.55); }
.rmClose{
  position: absolute;
  top: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(0,0,0,.12);
  background: rgba(255,255,255,.75);
  color: #111;
  font-size: 22px;
  cursor: pointer;
}
.rmTop{ margin-bottom: 10px; }
.rmTitle{ color: #1a1020; }
.rmList{ display:flex; flex-direction:column; gap:10px; padding-top: 8px; }
.rmRow{
  width:100%;
  text-align:left;
  border-radius: 18px;
  border: 1px solid rgba(0,0,0,.10);
  background: rgba(255,255,255,.70);
  padding: 12px;
  cursor: pointer;
}
.rmLine1{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  margin-bottom: 8px;
}
.rmUser{ font-weight: 900; }
.rmMetaRight{ display:flex; align-items:center; gap:10px; }
.rmRate{ font-weight: 900; }
.rmLine2{ color: rgba(0,0,0,.78); line-height: 1.35; }
.rmLine3{ margin-top: 8px; }

/* User Modal */
.um{
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0,0,0,.45);
  backdrop-filter: blur(10px);
  display: grid;
  place-items: center;
  padding: 18px;
}
.umInner{
  width: min(980px, 96vw);
  max-height: 90vh;
  overflow: auto;
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,.18);
  background: rgba(15, 5, 20, .70);
  box-shadow: 0 30px 90px rgba(0,0,0,.55);
  padding: 16px;
  position: relative;
}
.umClose{
  position: absolute;
  top: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.22);
  background: rgba(0,0,0,.35);
  color: #fff;
  font-size: 22px;
  cursor: pointer;
}
.umHead{ display:flex; flex-direction:column; gap:12px; margin-bottom: 12px; }
.umUserBox{ display:flex; align-items:center; gap:12px; }
.umAv{ width: 44px; height: 44px; border-radius: 999px; object-fit: cover; border:1px solid rgba(255,255,255,.22); }
.umAv.ph{ background: rgba(255,255,255,.14); }
.umName{ font-size: 16px; }
.umTabs{ display:flex; gap:10px; }
.tab{
  border:1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.10);
  color: rgba(255,255,255,.92);
  padding: 10px 12px;
  border-radius: 14px;
  cursor: pointer;
  font-weight: 900;
}
.tab.active{
  background: rgba(255,255,255,.18);
  border-color: rgba(255,255,255,.28);
}
.umList{ display:flex; flex-direction:column; gap:10px; }
.umCard{
  border-radius: 18px;
  border:1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.14);
  padding: 12px;
}
.umProd{ margin-bottom: 10px; }
.umExpList{ display:flex; flex-direction:column; gap:10px; }
.umExp{ }

@media(max-width: 1300px){
  .grid4{ grid-template-columns: 1fr 1fr; }
}
@media(max-width: 900px){
  .grid4{ grid-template-columns: 1fr; }
  .tall{ min-height: auto; }
  .list,.recent{ max-height: 280px; }
  .logo{ width: 96px; height: 96px; }
  .word{ font-size: 22px; }
}
`