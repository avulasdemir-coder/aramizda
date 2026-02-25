'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

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
  count: number
  avg: number | null
  repurchasePct: number | null
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
  const maxSize = 5 * 1024 * 1024
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

export default function Home() {
  // auth
  const [userId, setUserId] = useState<string | null>(null)

  // profile
  const [profile, setProfile] = useState<Profile | null>(null)
  const [usernameDraft, setUsernameDraft] = useState('')
  const [avatarDraft, setAvatarDraft] = useState<File | null>(null)
  const [profileErr, setProfileErr] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)

  // products
  const [q, setQ] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [selected, setSelected] = useState<Product | null>(null)
  const [pLoading, setPLoading] = useState(false)
  const [pErr, setPErr] = useState<string | null>(null)

  // stats for list
  const [productStats, setProductStats] = useState<Record<string, ProductStats>>({})

  // add product
  const [newBrand, setNewBrand] = useState('')
  const [newName, setNewName] = useState('')
  const [categoryChoice, setCategoryChoice] = useState<(typeof CATEGORY_OPTIONS)[number]>('Cilt Bakım')
  const [customCategory, setCustomCategory] = useState('')
  const [newPhoto, setNewPhoto] = useState<File | null>(null)
  const [addingProduct, setAddingProduct] = useState(false)
  const [addProductMsg, setAddProductMsg] = useState<string | null>(null)

  // add experience
  const [rating, setRating] = useState(8)
  const [pros, setPros] = useState('')
  const [cons, setCons] = useState('')
  const [wba, setWba] = useState(false)
  const [expPhoto, setExpPhoto] = useState<File | null>(null)
  const [addingExp, setAddingExp] = useState(false)
  const [expMsg, setExpMsg] = useState<string | null>(null)

  // recent (global)
  const [recent, setRecent] = useState<ExperienceRow[]>([])
  const [recentLoading, setRecentLoading] = useState(false)

  // selected product reviews (for modal)
  const [productReviews, setProductReviews] = useState<ExperienceRow[]>([])
  const [productReviewsLoading, setProductReviewsLoading] = useState(false)
  const [reviewsOpen, setReviewsOpen] = useState(false)
  const [reviewsProduct, setReviewsProduct] = useState<Product | null>(null)
  const [expandedReviewIds, setExpandedReviewIds] = useState<Record<string, boolean>>({})

  // lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [lightboxAlt, setLightboxAlt] = useState<string>('Fotoğraf')

  // profile modal
  const [profileOpen, setProfileOpen] = useState(false)

  // user modal (from review username)
  const [userOpen, setUserOpen] = useState(false)
  const [userModal, setUserModal] = useState<{ user_id: string; username: string; avatar_url: string | null } | null>(null)
  const [userTab, setUserTab] = useState<'products' | 'reviews'>('products')
  const [userExperiences, setUserExperiences] = useState<ExperienceRow[]>([])
  const [userLoading, setUserLoading] = useState(false)

  const needsUsername = !!userId && (!profile?.username || profile.username.trim().length < 2)

  const selectedLabel = useMemo(() => {
    if (!selected) return 'Seçili ürün yok (Önce soldan ürün seç)'
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
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const uid = session?.user?.id ?? null
      setUserId(uid)
      setSelected(null)
      setProducts([])
      setRecent([])
      setProductReviews([])
      setProductStats({})
      if (uid) {
        loadProfile(uid)
        loadRecent()
      } else {
        setProfile(null)
      }
    })

    return () => sub.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadProfile(uid: string) {
    setProfileErr(null)
    const res = await supabase.from('profiles').select('user_id,username,avatar_url,is_admin').eq('user_id', uid).maybeSingle()
    if (res.error) {
      setProfile(null)
      setProfileErr(res.error.message)
      return
    }
    setProfile((res.data as Profile) ?? null)
    setUsernameDraft(res.data?.username ?? '')
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

  async function computeStats(productIds: string[]) {
    if (productIds.length === 0) {
      setProductStats({})
      return
    }

    try {
      const { data, error } = await supabase
        .from('experiences')
        .select('product_id,rating,would_buy_again')
        .in('product_id', productIds)
        .limit(5000)

      if (error) throw error

      const map: Record<string, { count: number; sum: number; nRated: number; repYes: number }> = {}
      for (const row of (data as any[]) || []) {
        const pid = row.product_id as string
        if (!map[pid]) map[pid] = { count: 0, sum: 0, nRated: 0, repYes: 0 }
        map[pid].count += 1
        if (typeof row.rating === 'number') {
          map[pid].sum += row.rating
          map[pid].nRated += 1
        }
        if (row.would_buy_again === true) map[pid].repYes += 1
      }

      const out: Record<string, ProductStats> = {}
      for (const pid of productIds) {
        const m = map[pid]
        if (!m) {
          out[pid] = { count: 0, avg: null, repurchasePct: null }
        } else {
          const avg = m.nRated > 0 ? m.sum / m.nRated : null
          const rep = m.count > 0 ? Math.round((m.repYes / m.count) * 100) : null
          out[pid] = { count: m.count, avg, repurchasePct: rep }
        }
      }
      setProductStats(out)
    } catch {
      // sessiz
    }
  }

  async function searchProducts(termOverride?: string) {
    setPErr(null)
    setAddProductMsg(null)
    setPLoading(true)

    try {
      const term = (termOverride ?? q).trim()

      // boş arama: listeyi temizle + seçimi düşür (senin istediğin)
      if (!term) {
        setProducts([])
        setSelected(null)
        setProductStats({})
        return
      }

      const { data, error } = await supabase
        .from('products')
        .select('id,brand,name,category,image_url,created_at')
        .or(`name.ilike.%${term}%,brand.ilike.%${term}%,category.ilike.%${term}%`)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      const list = ((data as Product[]) ?? []) as Product[]
      setProducts(list)
      await computeStats(list.map((x) => x.id))
    } catch (e: any) {
      setPErr(e?.message ?? 'Ürün araması başarısız')
    } finally {
      setPLoading(false)
    }
  }

  async function addProduct() {
    setPErr(null)
    setAddProductMsg(null)
    try {
      if (!userId) throw new Error('Giriş gerekli')

      const brand = newBrand.trim()
      const name = newName.trim()

      const category = categoryChoice === 'Diğer' ? (customCategory.trim() || null) : (categoryChoice as string)

      if (!brand) throw new Error('Marka zorunlu')
      if (!name) throw new Error('Ürün adı zorunlu')
      if (!category) throw new Error('Kategori zorunlu')

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

      const ins = await supabase.from('products').insert({ brand, name, category, image_url }).select('id,brand,name,category,image_url,created_at').single()
      if (ins.error) throw ins.error

      setAddProductMsg('Ürün eklendi')
      setNewBrand('')
      setNewName('')
      setCategoryChoice('Cilt Bakım')
      setCustomCategory('')
      setNewPhoto(null)

      // yeni ürün: arama alanına yaz + arama yap + seç
      const p = ins.data as Product
      setQ(p.name)
      await searchProducts(p.name)
      setSelected(p)
    } catch (e: any) {
      const msg = (e?.message ?? 'Ürün eklenemedi') as string
      setPErr(msg.toLowerCase().includes('duplicate') ? 'Bu ürün zaten ekli' : msg)
    } finally {
      setAddingProduct(false)
    }
  }

  async function addExperience() {
    setExpMsg(null)
    setPErr(null)

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
          rating,
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
      // ürün listesi açıksa metrikleri de yenile
      if (products.length > 0) await computeStats(products.map((x) => x.id))
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

  async function loadProductReviews(productId: string) {
    setProductReviewsLoading(true)
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
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setProductReviews(((data as any[]) || []) as ExperienceRow[])
    } catch {
      setProductReviews([])
    } finally {
      setProductReviewsLoading(false)
    }
  }

  async function openReviewsModal(p: Product) {
    setReviewsProduct(p)
    setExpandedReviewIds({})
    setReviewsOpen(true)
    await loadProductReviews(p.id)
  }

  function toggleExpandReview(id: string) {
    setExpandedReviewIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  async function openUserModal(r: ExperienceRow) {
    const u = { user_id: r.user_id, username: r.author?.username || 'Kullanıcı', avatar_url: r.author?.avatar_url ?? null }
    setUserModal(u)
    setUserTab('products')
    setUserExperiences([])
    setUserOpen(true)
    setUserLoading(true)

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
        .eq('user_id', r.user_id)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      setUserExperiences(((data as any[]) || []) as ExperienceRow[])
    } catch {
      setUserExperiences([])
    } finally {
      setUserLoading(false)
    }
  }

  async function goToProductFromRecent(p: Product) {
    // arama alanına yaz + arama yap + listeden seçilmiş gibi olsun
    setQ(p.name)
    await searchProducts(p.name)
    setSelected(p)
  }

  function fmtAvg10(avg: number | null) {
    if (avg === null || Number.isNaN(avg)) return '-'
    const v = Math.round(avg * 10) / 10
    return `${v}/10`
  }
  function fmtPct(p: number | null) {
    if (p === null || Number.isNaN(p)) return '-'
    return `% ${p}`
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
              style={{ transform: 'scale(1.12)' }}
              onError={(e) => {
                ;(e.currentTarget as any).style.display = 'none'
              }}
            />
            <div className="word">ARAMIZDA</div>
          </div>

          <div className="rightCol">
            <button
              type="button"
              className="userPill"
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

            <button className="btn ghost btnSm" onClick={signOut}>
              Çıkış
            </button>
          </div>
        </header>

        {needsUsername ? (
          <div className="card">
            <div className="h2">Kullanıcı adı</div>
            <div className="muted">Bu isim yorumlarda görünecek</div>

            <div className="field">
              <div className="label strong">Kullanıcı Adı</div>
              <input className="input" value={usernameDraft} onChange={(e) => setUsernameDraft(e.target.value)} placeholder="ör: ulas, gizem" />
            </div>

            <div className="field">
              <div className="label strong">Profil Fotoğrafı (Opsiyonel)</div>
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
          <main className="grid">
            {/* Left */}
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
                    const st = productStats[p.id] ?? { count: 0, avg: null, repurchasePct: null }
                    return (
                      <button
                        key={p.id}
                        className={`item ${selected?.id === p.id ? 'active' : ''}`}
                        onClick={() => setSelected(p)}
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
                          <div className="muted small">{p.category || 'Kategori yok'}</div>

                          <div className="metaRow">
                            <span className="metaChip">Ortalama Puan: {fmtAvg10(st.avg)}</span>

                            <button
                              type="button"
                              className="metaLink"
                              onClick={(e) => {
                                e.stopPropagation()
                                openReviewsModal(p)
                              }}
                            >
                              Yorum ({st.count})
                            </button>

                            <span className="metaChip">Tekrar Alma Oranı: {fmtPct(st.repurchasePct)}</span>
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </section>

            {/* Middle */}
            <section className="card tall">
              <div className="h2">Deneyim Ekle</div>
              <div className="muted small">{selectedLabel}</div>

              <div className="field">
                <div className="label strong">Puan</div>
                <select className="input" value={rating} onChange={(e) => setRating(parseInt(e.target.value, 10))}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <div className="label strong">Artılar</div>
                <textarea className="ta" value={pros} onChange={(e) => setPros(e.target.value)} />
              </div>

              <div className="field">
                <div className="label strong">Eksiler</div>
                <textarea className="ta" value={cons} onChange={(e) => setCons(e.target.value)} />
              </div>

              <label className="check">
                <input type="checkbox" checked={wba} onChange={(e) => setWba(e.target.checked)} />
                <span>Tekrar alırım</span>
              </label>

              <div className="field">
                <div className="label strong">Deneyim Fotoğrafı (Opsiyonel)</div>
                <input
                  className="file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  onChange={(e) => setExpPhoto(e.target.files?.[0] ?? null)}
                />
                <div className="muted small">5 MB Altı</div>
              </div>

              {expMsg ? <div className={expMsg.includes('eklendi') ? 'ok' : 'err'}>{expMsg}</div> : null}

              <button className="btn btnSm" disabled={!selected || addingExp} onClick={addExperience}>
                {addingExp ? 'Gönderiliyor…' : 'Gönder'}
              </button>

              <div className="divider" />

              <div className="h2">Son Deneyimler</div>
              {recentLoading ? (
                <div className="muted">Yükleniyor…</div>
              ) : recent.length === 0 ? null : (
                <div className="recent">
                  {recent.map((r) => (
                    <div className="r" key={r.id}>
                      <div className="rHead">
                        {r.author?.avatar_url ? <img className="avSm" src={r.author.avatar_url} alt="" /> : <div className="avSm ph" />}
                        <div className="rMeta">
                          <div className="rUser">{r.author?.username || 'Kullanıcı'}</div>
                          <div className="muted small">{new Date(r.created_at).toLocaleString('tr-TR')}</div>
                        </div>
                        <div className="badge">{typeof r.rating === 'number' ? `${r.rating}/10` : '-'}</div>
                      </div>

                      {r.product ? (
                        <button
                          type="button"
                          className="prodLink"
                          onClick={async () => {
                            await goToProductFromRecent(r.product!)
                          }}
                        >
                          {r.product.brand} — {r.product.name}
                          {r.product.category ? <span className="muted small"> • {r.product.category}</span> : null}
                        </button>
                      ) : null}

                      <div className="pcWrap">
                        {r.pros ? (
                          <div className="pc">
                            <div className="pcT">
                              <b>Artılar :</b>
                            </div>
                            <div className="pcB">{r.pros}</div>
                          </div>
                        ) : null}

                        {r.cons ? (
                          <div className="pc">
                            <div className="pcT">
                              <b>Eksiler :</b>
                            </div>
                            <div className="pcB">{r.cons}</div>
                          </div>
                        ) : null}
                      </div>

                      <div className="wbaRow">
                        <span className={`wbaBadge ${r.would_buy_again ? 'yes' : 'no'}`}>{r.would_buy_again ? '✔ Tekrar Alırım' : '✖ Tekrar Almam'}</span>
                      </div>

                      {r.image_url ? (
                        <img
                          className="rImg clickable"
                          src={r.image_url}
                          alt=""
                          onClick={() => {
                            setLightboxAlt('Deneyim fotoğrafı')
                            setLightboxUrl(r.image_url!)
                          }}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Right */}
            <section id="add-product" className="card tall">
              <div className="h2">Ürün Ekle</div>

              <div className="field">
                <div className="label strong">Marka</div>
                <input className="input" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} />
              </div>

              <div className="field">
                <div className="label strong">Ürün Adı</div>
                <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>

              <div className="field">
                <div className="label strong">Kategori</div>
                <select className="input" value={categoryChoice} onChange={(e) => setCategoryChoice(e.target.value as any)}>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {categoryChoice === 'Diğer' ? (
                <div className="field">
                  <div className="label strong">Diğer Kategori</div>
                  <input className="input" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="ör: Anne&Bebek" />
                </div>
              ) : null}

              <div className="field">
                <div className="label strong">Ürün Fotoğrafı (Opsiyonel)</div>
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
            </section>
          </main>
        )}

        <div className="foot muted small">© ARAMIZDA</div>

        {/* Profile modal */}
        {profileOpen ? (
          <div className="pm" onClick={() => setProfileOpen(false)} role="dialog" aria-modal="true">
            <div className="pmInner" onClick={(e) => e.stopPropagation()}>
              <button className="pmClose" onClick={() => setProfileOpen(false)} aria-label="Kapat">
                ×
              </button>

              <div className="h2">Profil</div>

              <div className="field">
                <div className="label strong">Kullanıcı Adı</div>
                <input className="input" value={usernameDraft} onChange={(e) => setUsernameDraft(e.target.value)} />
              </div>

              <div className="field">
                <div className="label strong">Profil Fotoğrafı</div>
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
                      // hata zaten ekranda
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

        {/* Reviews modal */}
        {reviewsOpen ? (
          <div
            className="pm"
            onClick={() => {
              setReviewsOpen(false)
              setReviewsProduct(null)
            }}
            role="dialog"
            aria-modal="true"
          >
            <div className="pmInner pmWide" onClick={(e) => e.stopPropagation()}>
              <button
                className="pmClose"
                onClick={() => {
                  setReviewsOpen(false)
                  setReviewsProduct(null)
                }}
                aria-label="Kapat"
              >
                ×
              </button>

              <div className="h2">Yorumlar</div>
              <div className="muted small">{reviewsProduct ? `${reviewsProduct.brand} — ${reviewsProduct.name}` : ''}</div>

              <div className="divider" />

              {productReviewsLoading ? (
                <div className="muted">Yükleniyor…</div>
              ) : productReviews.length === 0 ? (
                <div className="muted">Bu ürüne henüz yorum yok</div>
              ) : (
                <div className="revList">
                  {productReviews.map((r) => {
                    const expanded = !!expandedReviewIds[r.id]
                    const summaryParts: string[] = []
                    if (r.pros) summaryParts.push(`Artılar: ${r.pros}`)
                    if (r.cons) summaryParts.push(`Eksiler: ${r.cons}`)
                    const summary = summaryParts.join(' • ')

                    return (
                      <div key={r.id} className={`revBar ${expanded ? 'open' : ''}`} onClick={() => toggleExpandReview(r.id)}>
                        <div className="revTop">
                          <div className="revUser">
                            {r.author?.avatar_url ? <img className="avSm" src={r.author.avatar_url} alt="" /> : <div className="avSm ph" />}
                            <button
                              type="button"
                              className="revUName"
                              onClick={(e) => {
                                e.stopPropagation()
                                openUserModal(r)
                              }}
                            >
                              {r.author?.username || 'Kullanıcı'}
                            </button>
                          </div>
                          <div className="revDate muted small">{new Date(r.created_at).toLocaleString('tr-TR')}</div>
                        </div>

                        <div className="revMid">
                          <span className="revMeta">
                            Puan: {typeof r.rating === 'number' ? `${r.rating}/10` : '-'} •{' '}
                            <span className={`wbaBadge ${r.would_buy_again ? 'yes' : 'no'}`}>{r.would_buy_again ? '✔ Tekrar Alırım' : '✖ Tekrar Almam'}</span>
                          </span>
                        </div>

                        {!expanded ? (
                          <div className="revPreview clamp2">{summary || '—'}</div>
                        ) : (
                          <div className="revBody">
                            {r.pros ? (
                              <div className="pc">
                                <div className="pcT">
                                  <b>Artılar :</b>
                                </div>
                                <div className="pcB">{r.pros}</div>
                              </div>
                            ) : null}

                            {r.cons ? (
                              <div className="pc">
                                <div className="pcT">
                                  <b>Eksiler :</b>
                                </div>
                                <div className="pcB">{r.cons}</div>
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
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* User modal */}
        {userOpen ? (
          <div className="pm" onClick={() => setUserOpen(false)} role="dialog" aria-modal="true">
            <div className="pmInner pmWide" onClick={(e) => e.stopPropagation()}>
              <button className="pmClose" onClick={() => setUserOpen(false)} aria-label="Kapat">
                ×
              </button>

              <div className="h2">Profil</div>
              <div className="muted small">
                {userModal ? (
                  <span className="inlineUser">
                    {userModal.avatar_url ? <img className="avSm" src={userModal.avatar_url} alt="" /> : <div className="avSm ph" />}
                    <b>{userModal.username}</b>
                  </span>
                ) : null}
              </div>

              <div className="divider" />

              <div className="tabs">
                <button className={`tab ${userTab === 'products' ? 'active' : ''}`} onClick={() => setUserTab('products')}>
                  Eklediği Ürünler
                </button>
                <button className={`tab ${userTab === 'reviews' ? 'active' : ''}`} onClick={() => setUserTab('reviews')}>
                  Yaptığı Yorumlar
                </button>
              </div>

              {userLoading ? (
                <div className="muted">Yükleniyor…</div>
              ) : userExperiences.length === 0 ? (
                <div className="muted">—</div>
              ) : userTab === 'products' ? (
                <div className="recent">
                  {Array.from(
                    new Map(
                      userExperiences
                        .filter((x) => x.product?.id)
                        .map((x) => [x.product!.id, x.product!])
                    ).values()
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="prodLink"
                      onClick={async () => {
                        setUserOpen(false)
                        await goToProductFromRecent(p)
                      }}
                    >
                      {p.brand} — {p.name}
                      {p.category ? <span className="muted small"> • {p.category}</span> : null}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="revList">
                  {userExperiences.map((r) => (
                    <div key={r.id} className="revBar open">
                      <div className="revTop">
                        <div className="revUser">
                          {r.author?.avatar_url ? <img className="avSm" src={r.author.avatar_url} alt="" /> : <div className="avSm ph" />}
                          <div className="revUNameStatic">{userModal?.username || 'Kullanıcı'}</div>
                        </div>
                        <div className="revDate muted small">{new Date(r.created_at).toLocaleString('tr-TR')}</div>
                      </div>

                      <div className="revMid">
                        <span className="revMeta">
                          Puan: {typeof r.rating === 'number' ? `${r.rating}/10` : '-'} •{' '}
                          <span className={`wbaBadge ${r.would_buy_again ? 'yes' : 'no'}`}>{r.would_buy_again ? '✔ Tekrar Alırım' : '✖ Tekrar Almam'}</span>
                        </span>
                      </div>

                      <div className="revBody">
                        {r.product ? (
                          <div style={{ marginBottom: 8 }}>
                            <button
                              type="button"
                              className="prodLink"
                              onClick={async () => {
                                setUserOpen(false)
                                await goToProductFromRecent(r.product!)
                              }}
                            >
                              {r.product.brand} — {r.product.name}
                              {r.product.category ? <span className="muted small"> • {r.product.category}</span> : null}
                            </button>
                          </div>
                        ) : null}

                        {r.pros ? (
                          <div className="pc">
                            <div className="pcT">
                              <b>Artılar :</b>
                            </div>
                            <div className="pcB">{r.pros}</div>
                          </div>
                        ) : null}

                        {r.cons ? (
                          <div className="pc">
                            <div className="pcT">
                              <b>Eksiler :</b>
                            </div>
                            <div className="pcB">{r.cons}</div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Lightbox */}
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
.app{ max-width: 1180px; margin:0 auto; display:flex; flex-direction:column; gap: 14px; }

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

.rightCol{ display:flex; flex-direction:column; gap: 8px; align-items:flex-end; }

.userPill{
  display:flex; align-items:center; gap:12px;
  height: 46px;
  padding: 0 16px;
  border-radius: 999px;
  border:1px solid var(--stroke);
  background: rgba(0,0,0,.18);
  color: var(--text);
  cursor: pointer;
}
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
.strong{ font-weight: 900; }

.grid{
  display:grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 14px;
  align-items: start;
}
.tall{ min-height: 520px; }

.row{ display:flex; gap:10px; align-items:center; margin-bottom: 10px; }
.label{ font-size: 12px; color: var(--muted); margin-bottom: 6px; }
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
.item{
  display:flex; gap:12px; align-items:flex-start;
  border-radius: var(--r2);
  border:1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.16);
  padding: 10px;
  cursor:pointer;
  color: var(--text);
  text-align:left;
}
.item.active{ border-color: rgba(255,255,255,.28); background: rgba(255,255,255,.08); }
.thumb{ width:44px; height:44px; border-radius: 14px; object-fit: cover; border:1px solid rgba(255,255,255,.18); }
.thumb.ph{ background: rgba(255,255,255,.10); }
.mid{ flex:1; min-width:0; }
.t{ font-weight: 900; }
.check{ display:flex; align-items:center; gap:10px; margin-top: 10px; font-weight: 900; }

.metaRow{ display:flex; flex-wrap:wrap; gap:8px; margin-top: 8px; }
.metaChip{
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.14);
}
.metaLink{
  appearance:none;
  border: 0;
  background: rgba(255,255,255,.12);
  border: 1px solid rgba(255,255,255,.18);
  color: var(--text);
  font-weight: 900;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  cursor: pointer;
}
.metaLink:hover{ transform: translateY(-1px); }

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
.r{ border:1px solid rgba(255,255,255,.14); background: rgba(0,0,0,.14); border-radius: var(--r2); padding: 10px; }
.rHead{ display:flex; align-items:center; gap:10px; margin-bottom: 8px; }
.avSm{ width:28px; height:28px; border-radius:999px; object-fit:cover; border:1px solid rgba(255,255,255,.22); }
.avSm.ph{ background: rgba(255,255,255,.12); }
.rMeta{ flex:1; min-width:0; }
.rUser{ font-weight: 900; }
.badge{ font-weight: 900; padding: 6px 10px; border-radius: 999px; background: rgba(255,255,255,.10); border:1px solid rgba(255,255,255,.18); }

.prodLink{
  width: 100%;
  text-align: left;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: var(--text);
  border-radius: 14px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 900;
}
.prodLink:hover{ transform: translateY(-1px); }

.pcWrap{ display:flex; flex-direction:column; gap:10px; margin-top: 10px; }
.pc{ border:1px solid rgba(255,255,255,.14); border-radius: 14px; background: rgba(0,0,0,.10); padding: 10px; }
.pcT{ font-size: 12px; color: rgba(255,255,255,.86); margin-bottom: 6px; }
.pcB{ font-size: 13px; color: rgba(255,255,255,.88); }

.wbaRow{ margin-top: 10px; }
.wbaBadge{
  display:inline-flex;
  align-items:center;
  gap:8px;
  padding: 6px 10px;
  border-radius: 999px;
  font-weight: 900;
  font-size: 12px;
  border: 1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.08);
}
.wbaBadge.yes{ background: rgba(70,255,160,.10); border-color: rgba(120,255,190,.24); }
.wbaBadge.no{ background: rgba(255,90,90,.10); border-color: rgba(255,120,120,.24); }

.rImg{ width: 100%; max-height: 220px; object-fit: cover; border-radius: 14px; border:1px solid rgba(255,255,255,.18); margin-top: 10px; }

.foot{ text-align:center; padding: 6px 0; }

.clickable { cursor: zoom-in; }

/* Reviews modal list */
.revList{ display:flex; flex-direction:column; gap: 10px; max-height: 70vh; overflow:auto; padding-right: 2px; }
.revBar{
  border:1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.14);
  border-radius: 16px;
  padding: 10px;
  cursor: pointer;
}
.revBar:hover{ transform: translateY(-1px); }
.revTop{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.revUser{ display:flex; align-items:center; gap:10px; }
.revUName{
  appearance:none;
  border:0;
  background: transparent;
  color: var(--text);
  font-weight: 900;
  cursor:pointer;
  padding: 0;
}
.revUName:hover{ text-decoration: underline; }
.revUNameStatic{ font-weight: 900; }
.revMid{ margin-top: 6px; }
.revMeta{ font-weight: 900; font-size: 12px; color: rgba(255,255,255,.88); }
.revPreview{ margin-top: 8px; font-size: 13px; color: rgba(255,255,255,.85); }
.revBody{ margin-top: 10px; display:flex; flex-direction:column; gap:10px; }

.clamp2{
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

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

/* Modal */
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
.pmWide{ width: min(880px, 96vw); }
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
.inlineUser{ display:inline-flex; align-items:center; gap:10px; }

.tabs{ display:flex; gap: 10px; margin-bottom: 12px; }
.tab{
  appearance:none;
  border:1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.08);
  color: var(--text);
  font-weight: 900;
  padding: 10px 12px;
  border-radius: 14px;
  cursor:pointer;
}
.tab.active{ background: rgba(255,255,255,.16); border-color: rgba(255,255,255,.26); }

@media(max-width: 1100px){
  .grid{ grid-template-columns: 1fr; }
  .tall{ min-height: auto; }
  .list,.recent{ max-height: 280px; }
  .logo{ width: 96px; height: 96px; }
  .word{ font-size: 22px; }
}
`