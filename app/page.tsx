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
  avg10: number | null
  count: number
  wbaPct: number | null
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

  // product stats
  const [stats, setStats] = useState<Record<string, ProductStats>>({})

  // add product
  const [brandChoice, setBrandChoice] = useState<string>('') // dropdown
  const [brandCustom, setBrandCustom] = useState<string>('') // if NEW
  const [newName, setNewName] = useState('')
  const [categoryChoice, setCategoryChoice] = useState<(typeof CATEGORY_OPTIONS)[number] | ''>('')
  const [customCategory, setCustomCategory] = useState('')
  const [newPhoto, setNewPhoto] = useState<File | null>(null)
  const [addingProduct, setAddingProduct] = useState(false)
  const [addProductMsg, setAddProductMsg] = useState<string | null>(null)

  // add/edit experience
  const [editingExpId, setEditingExpId] = useState<string | null>(null)
  const [ratingStr, setRatingStr] = useState<string>('') // empty by default
  const [pros, setPros] = useState('')
  const [cons, setCons] = useState('')
  const [wba, setWba] = useState<boolean>(false) // boş bırakılırsa ✖ Tekrar Almam
  const [expPhoto, setExpPhoto] = useState<File | null>(null)
  const [addingExp, setAddingExp] = useState(false)
  const [expMsg, setExpMsg] = useState<string | null>(null)

  // recent
  const [recent, setRecent] = useState<ExperienceRow[]>([])
  const [recentLoading, setRecentLoading] = useState(false)

  // lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [lightboxAlt, setLightboxAlt] = useState<string>('Fotoğraf')

  // reviews modal
  const [reviewsOpen, setReviewsOpen] = useState(false)
  const [reviewsProduct, setReviewsProduct] = useState<Product | null>(null)
  const [reviews, setReviews] = useState<ExperienceRow[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [expandedReviewIds, setExpandedReviewIds] = useState<Record<string, boolean>>({})

  // user modal
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [userModalTitle, setUserModalTitle] = useState<string>('Kullanıcı')
  const [userModalAvatar, setUserModalAvatar] = useState<string | null>(null)
  const [userExperiences, setUserExperiences] = useState<ExperienceRow[]>([])
  const [userExperiencesLoading, setUserExperiencesLoading] = useState(false)

  // profile modal
  const [profileOpen, setProfileOpen] = useState(false)

  const needsUsername = !!userId && (!profile?.username || profile.username.trim().length < 2)

  const brandOptions = useMemo(() => {
    const set = new Set<string>()
    for (const p of products) set.add(p.brand)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'))
  }, [products])

  const selectedLabel = useMemo(() => {
    if (!selected) return 'Seçili Ürün Yok (Önce Soldan Ürün Seç)'
    const cat = selected.category ? ` • ${selected.category}` : ''
    return `${selected.brand} — ${selected.name}${cat}`
  }, [selected])

  // --- auth bootstrap
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
      setStats({})
      setRecent([])
      setReviews([])
      setReviewsOpen(false)
      setEditingExpId(null)
      setExpMsg(null)

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

  // --- search helpers
  function resetSearchState() {
    setProducts([])
    setStats({})
    setSelected(null)
    setPErr(null)
    setAddProductMsg(null)
  }

  async function searchProducts(termOverride?: string) {
    setPErr(null)
    setAddProductMsg(null)
    setPLoading(true)
    try {
      const term = (typeof termOverride === 'string' ? termOverride : q).trim()
      if (!term) {
        resetSearchState()
        return
      }

      const { data, error } = await supabase
        .from('products')
        .select('id,brand,name,category,image_url,created_at')
        .or(`name.ilike.%${term}%,brand.ilike.%${term}%,category.ilike.%${term}%`)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      const list = (data as Product[]) ?? []
      setProducts(list)

      await loadStatsForProducts(list.map((p) => p.id))
    } catch (e: any) {
      setPErr(e?.message ?? 'Ürün araması başarısız')
    } finally {
      setPLoading(false)
    }
  }

  async function loadStatsForProducts(productIds: string[]) {
    if (productIds.length === 0) {
      setStats({})
      return
    }

    const { data, error } = await supabase
      .from('experiences')
      .select('product_id,rating,would_buy_again')
      .in('product_id', productIds)
      .limit(5000)

    if (error) {
      setStats({})
      return
    }

    const map: Record<string, { sum: number; n: number; wbaTrue: number; wbaKnown: number }> = {}
    for (const pid of productIds) map[pid] = { sum: 0, n: 0, wbaTrue: 0, wbaKnown: 0 }

    for (const row of (data as any[]) || []) {
      const pid = row.product_id as string
      if (!map[pid]) map[pid] = { sum: 0, n: 0, wbaTrue: 0, wbaKnown: 0 }

      const r = typeof row.rating === 'number' ? (row.rating as number) : null
      if (typeof r === 'number') {
        map[pid].sum += r
        map[pid].n += 1
      }

      if (row.would_buy_again === true || row.would_buy_again === false) {
        map[pid].wbaKnown += 1
        if (row.would_buy_again === true) map[pid].wbaTrue += 1
      }
    }

    const out: Record<string, ProductStats> = {}
    for (const pid of Object.keys(map)) {
      const m = map[pid]
      const avg10 = m.n > 0 ? Math.round((m.sum / m.n) * 10) / 10 : null
      const wbaPct = m.wbaKnown > 0 ? Math.round((m.wbaTrue / m.wbaKnown) * 100) : null
      out[pid] = { avg10, count: m.n, wbaPct }
    }
    setStats(out)
  }

  // --- add product
  async function addProduct() {
    setPErr(null)
    setAddProductMsg(null)

    try {
      if (!userId) throw new Error('Giriş gerekli')

      const brand = brandChoice === '__NEW__' ? brandCustom.trim() : brandChoice.trim()
      const category =
        categoryChoice === 'Diğer' ? (customCategory.trim() || null) : categoryChoice ? String(categoryChoice) : null
      const name = newName.trim()

      const missing: string[] = []
      if (!brand) missing.push('Marka')
      if (!name) missing.push('Ürün Adı')
      if (!category) missing.push('Kategori')
      if (missing.length) throw new Error(`${missing.join(', ')} zorunlu`)

      setAddingProduct(true)

      const dup = await supabase.from('products').select('id').ilike('name', name).limit(1)
      if (dup.error) throw dup.error
      if (dup.data && dup.data.length > 0) throw new Error('Bu ürün zaten ekli')

      let image_url: string | null = null
      if (newPhoto) image_url = await uploadImage(newPhoto, 'products')

      const ins = await supabase
        .from('products')
        .insert({ brand, name, category, image_url })
        .select('id,brand,name,category,image_url,created_at')
        .single()

      if (ins.error) throw ins.error

      setAddProductMsg('Ürün eklendi')
      setBrandChoice('')
      setBrandCustom('')
      setNewName('')
      setCategoryChoice('')
      setCustomCategory('')
      setNewPhoto(null)

      setSelected(ins.data as Product)
      if (q.trim()) await searchProducts(q.trim())
    } catch (e: any) {
      const msg = (e?.message ?? 'Ürün eklenemedi') as string
      setPErr(msg.toLowerCase().includes('duplicate') ? 'Bu ürün zaten ekli' : msg)
    } finally {
      setAddingProduct(false)
    }
  }

  // --- add/edit experience
  function startEditExperience(r: ExperienceRow) {
    if (!selected || selected.id !== r.product_id) {
      if (r.product) setSelected(r.product)
    }
    setEditingExpId(r.id)
    setRatingStr(typeof r.rating === 'number' ? String(r.rating) : '')
    setPros(r.pros ?? '')
    setCons(r.cons ?? '')
    setWba(r.would_buy_again === true)
    setExpPhoto(null)
    setExpMsg('Düzenleme modundasın. Kaydedince güncellenecek.')
  }

  function cancelEditExperience() {
    setEditingExpId(null)
    setRatingStr('')
    setPros('')
    setCons('')
    setWba(false)
    setExpPhoto(null)
    setExpMsg(null)
  }

  async function deleteExperience(expId: string) {
    if (!userId) return
    const ok = confirm('Bu yorumu silmek istiyor musun?')
    if (!ok) return

    const del = await supabase.from('experiences').delete().eq('id', expId).eq('user_id', userId)
    if (del.error) {
      alert(del.error.message)
      return
    }

    // refresh
    await loadRecent()
    if (q.trim()) await searchProducts(q.trim())
    if (reviewsOpen && reviewsProduct?.id) await loadReviews(reviewsProduct.id)
  }

  async function addExperience() {
    setExpMsg(null)
    try {
      if (!userId) throw new Error('Giriş gerekli')
      if (!profile?.username) throw new Error('Önce kullanıcı adı belirle')
      if (!selected) throw new Error('Önce ürün seç')

      const r10 = ratingStr ? parseInt(ratingStr, 10) : NaN
      if (!Number.isFinite(r10) || r10 < 1 || r10 > 10) throw new Error('Puan seç')

      setAddingExp(true)

      let image_url: string | null = null
      if (expPhoto) image_url = await uploadImage(expPhoto, 'experiences')

      if (editingExpId) {
        const up = await supabase
          .from('experiences')
          .update({
            rating: r10,
            pros: pros.trim() || null,
            cons: cons.trim() || null,
            would_buy_again: wba === true,
            image_url: image_url ?? undefined, // yeni foto seçmediyse dokunma
          })
          .eq('id', editingExpId)
          .eq('user_id', userId)
          .select('id')
          .single()

        if (up.error) throw up.error
        setExpMsg('Deneyim güncellendi')
      } else {
        const ins = await supabase
          .from('experiences')
          .insert({
            user_id: userId,
            product_id: selected.id,
            rating: r10,
            pros: pros.trim() || null,
            cons: cons.trim() || null,
            would_buy_again: wba === true,
            image_url,
          })
          .select('id')
          .single()

        if (ins.error) throw ins.error
        setExpMsg('Deneyim eklendi')
      }

      // reset form
      setPros('')
      setCons('')
      setRatingStr('')
      setWba(false)
      setExpPhoto(null)
      setEditingExpId(null)

      await loadRecent()
      if (q.trim()) await searchProducts(q.trim())
      if (reviewsOpen && reviewsProduct?.id) await loadReviews(reviewsProduct.id)
    } catch (e: any) {
      setExpMsg(e?.message ?? 'Deneyim eklenemedi')
    } finally {
      setAddingExp(false)
    }
  }

  // --- recent
  async function loadRecent() {
    setRecentLoading(true)
    try {
      const { data, error } = await supabase
        .from('experiences')
        .select(`
          id,user_id,product_id,rating,pros,cons,would_buy_again,image_url,created_at,
          product:products(id,brand,name,category,image_url,created_at),
          author:profiles(username,avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) throw error
      setRecent(((data as any[]) || []) as ExperienceRow[])
    } catch {
      setRecent([])
    } finally {
      setRecentLoading(false)
    }
  }

  // --- reviews modal
  async function loadReviews(productId: string) {
    setReviewsLoading(true)
    setExpandedReviewIds({})
    try {
      const { data, error } = await supabase
        .from('experiences')
        .select(`
          id,user_id,product_id,rating,pros,cons,would_buy_again,image_url,created_at,
          author:profiles(username,avatar_url),
          product:products(id,brand,name,category,image_url,created_at)
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      setReviews(((data as any[]) || []) as ExperienceRow[])
    } catch {
      setReviews([])
    } finally {
      setReviewsLoading(false)
    }
  }

  function openReviews(p: Product) {
    setReviewsProduct(p)
    setReviewsOpen(true)
    loadReviews(p.id)
  }

  // --- user modal
  async function openUserModal(uid: string, username: string, avatarUrl: string | null) {
    setUserModalTitle(username || 'Kullanıcı')
    setUserModalAvatar(avatarUrl)
    setUserModalOpen(true)

    setUserExperiencesLoading(true)
    try {
      const { data, error } = await supabase
        .from('experiences')
        .select(`
          id,user_id,product_id,rating,pros,cons,would_buy_again,image_url,created_at,
          product:products(id,brand,name,category,image_url,created_at),
          author:profiles(username,avatar_url)
        `)
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      setUserExperiences(((data as any[]) || []) as ExperienceRow[])
    } catch {
      setUserExperiences([])
    } finally {
      setUserExperiencesLoading(false)
    }
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

            <button className="btn ghost btnXs" onClick={signOut}>
              Çıkış
            </button>
          </div>
        </header>

        {needsUsername ? (
          <div className="card">
            <div className="h2">Kullanıcı Adı</div>
            <div className="muted">Bu isim yorumlarda görünecek</div>

            <div className="field">
              <div className="label b">Kullanıcı Adı</div>
              <input className="input" value={usernameDraft} onChange={(e) => setUsernameDraft(e.target.value)} placeholder="ör: ulas, gizem" />
            </div>

            <div className="field">
              <div className="label b">Profil Fotoğrafı (Opsiyonel)</div>
              <input className="file" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(e) => setAvatarDraft(e.target.files?.[0] ?? null)} />
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
                  <input
                    className="input"
                    value={q}
                    onChange={(e) => {
                      const v = e.target.value
                      setQ(v)
                      if (!v.trim()) resetSearchState()
                    }}
                    placeholder="ör: bee beauty"
                  />
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
                    const st = stats[p.id]
                    const avg = st?.avg10
                    const cnt = st?.count ?? 0
                    const wbaPct = st?.wbaPct

                    return (
                      <div
                        key={p.id}
                        className={`item ${selected?.id === p.id ? 'active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelected(p)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') setSelected(p)
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

                          <div className="muted small meta2">
                            <span>Ortalama Puan: {typeof avg === 'number' ? avg.toFixed(1) : '—'}</span>
                            <button
                              type="button"
                              className="linkBtn"
                              onClick={(e) => {
                                e.stopPropagation()
                                openReviews(p)
                              }}
                            >
                              Yorum ({cnt})
                            </button>
                          </div>

                          <div className="muted small meta2">
                            <span>Tekrar Alma Oranı: {typeof wbaPct === 'number' ? `% ${wbaPct}` : '—'}</span>
                            <span>{p.category || 'Kategori yok'}</span>
                          </div>
                        </div>
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
                <div className="label b">Puan</div>
                <select className="input" value={ratingStr} onChange={(e) => setRatingStr(e.target.value)}>
                  <option value="">Seç</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={String(n)}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <div className="label b">Artılar</div>
                <textarea className="ta" value={pros} onChange={(e) => setPros(e.target.value)} />
              </div>

              <div className="field">
                <div className="label b">Eksiler</div>
                <textarea className="ta" value={cons} onChange={(e) => setCons(e.target.value)} />
              </div>

              <div className="field">
                <div className="label b">Tekrar Alırım</div>
                <div className="row" style={{ marginBottom: 0 }}>
                  <label className="radio">
                    <input type="radio" name="wba" checked={wba === true} onChange={() => setWba(true)} />
                    <span>✔ Tekrar Alırım</span>
                  </label>
                  <label className="radio">
                    <input type="radio" name="wba" checked={wba === false} onChange={() => setWba(false)} />
                    <span>✖ Tekrar Almam</span>
                  </label>
                </div>
              </div>

              <div className="field">
                <div className="label b">Deneyim Fotoğrafı (Opsiyonel)</div>
                <input className="file" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(e) => setExpPhoto(e.target.files?.[0] ?? null)} />
                <div className="muted small">5 MB Altı</div>
              </div>

              {expMsg ? <div className={expMsg.includes('eklendi') || expMsg.includes('güncellendi') ? 'ok' : 'err'}>{expMsg}</div> : null}

              <div className="row" style={{ marginTop: 10, marginBottom: 0 }}>
                <button className="btn btnSm boldBtn" disabled={!selected || addingExp} onClick={addExperience}>
                  {addingExp ? (editingExpId ? 'Güncelleniyor…' : 'Gönderiliyor…') : editingExpId ? 'Güncelle' : 'Gönder'}
                </button>

                {editingExpId ? (
                  <button className="btn ghost btnSm" type="button" onClick={cancelEditExperience} disabled={addingExp}>
                    Vazgeç
                  </button>
                ) : null}
              </div>
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
                    const r10 = typeof r.rating === 'number' ? r.rating : null
                    const badgeText = r.would_buy_again === true ? '✔ Tekrar Alırım' : '✖ Tekrar Almam'

                    return (
                      <div
                        key={r.id}
                        className="r clickableCard"
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (!r.product) return
                          const term = `${r.product.brand} ${r.product.name}`
                          setQ(term)
                          setSelected(r.product)
                          // sonuçlar da gelsin
                          setTimeout(() => {
                            searchProducts(term)
                          }, 0)
                        }}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && r.product) {
                            const term = `${r.product.brand} ${r.product.name}`
                            setQ(term)
                            setSelected(r.product)
                            setTimeout(() => {
                              searchProducts(term)
                            }, 0)
                          }
                        }}
                      >
                        <div className="rHead">
                          <button
                            type="button"
                            className="userLink"
                            onClick={(e) => {
                              e.stopPropagation()
                              const u = r.author?.username || 'Kullanıcı'
                              const av = r.author?.avatar_url || null
                              openUserModal(r.user_id, u, av)
                            }}
                          >
                            {r.author?.avatar_url ? <img className="avSm" src={r.author.avatar_url} alt="" /> : <div className="avSm ph" />}
                            <span className="rUser">{r.author?.username || 'Kullanıcı'}</span>
                          </button>

                          <div className="rRight">
                            <div className="badge">{r10 !== null ? `${r10}/10` : '—'}</div>
                            <div className={`wbaBadge ${r.would_buy_again === true ? '' : 'no'}`}>{badgeText}</div>
                          </div>
                        </div>

                        {r.product ? (
                          <div className="muted small pLine">
                            {r.product.brand} — {r.product.name}
                            {r.product.category ? ` • ${r.product.category}` : ''}
                          </div>
                        ) : null}

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
                <div className="label b">Marka</div>
                <select className="input" value={brandChoice} onChange={(e) => setBrandChoice(e.target.value)}>
                  <option value="">Seç</option>
                  {brandOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                  <option value="__NEW__">Yeni marka</option>
                </select>
              </div>

              {brandChoice === '__NEW__' ? (
                <div className="field">
                  <div className="label b">Yeni Marka</div>
                  <input className="input" value={brandCustom} onChange={(e) => setBrandCustom(e.target.value)} placeholder="ör: Essence" />
                </div>
              ) : null}

              <div className="field">
                <div className="label b">Ürün Adı</div>
                <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>

              <div className="field">
                <div className="label b">Kategori</div>
                <select className="input" value={categoryChoice} onChange={(e) => setCategoryChoice(e.target.value as any)}>
                  <option value="">Seç</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {categoryChoice === 'Diğer' ? (
                <div className="field">
                  <div className="label b">Diğer Kategori</div>
                  <input className="input" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="ör: Anne & Bebek" />
                </div>
              ) : null}

              <div className="field">
                <div className="label b">Ürün Fotoğrafı (Opsiyonel)</div>
                <input className="file" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(e) => setNewPhoto(e.target.files?.[0] ?? null)} />
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
                <div className="label b">Kullanıcı Adı</div>
                <input className="input" value={usernameDraft} onChange={(e) => setUsernameDraft(e.target.value)} />
              </div>

              <div className="field">
                <div className="label b">Profil Fotoğrafı</div>
                <input className="file" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(e) => setAvatarDraft(e.target.files?.[0] ?? null)} />
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
                    } catch {}
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
            className="rm"
            onClick={() => {
              setReviewsOpen(false)
              setExpandedReviewIds({})
            }}
            role="dialog"
            aria-modal="true"
          >
            <div className="rmInner" onClick={(e) => e.stopPropagation()}>
              <button
                className="rmClose"
                onClick={() => {
                  setReviewsOpen(false)
                  setExpandedReviewIds({})
                }}
                aria-label="Kapat"
              >
                ×
              </button>

              <div className="rmTitle">
                <div className="h2" style={{ marginBottom: 6 }}>
                  Yorumlar
                </div>
                <div className="rmSubtitle">
                  {reviewsProduct
                    ? `${reviewsProduct.brand} — ${reviewsProduct.name}${reviewsProduct.category ? ` • ${reviewsProduct.category}` : ''}`
                    : ''}
                </div>
              </div>

              {reviewsLoading ? (
                <div className="muted">Yükleniyor…</div>
              ) : reviews.length === 0 ? (
                <div className="muted small"> </div>
              ) : (
                <div className="rmList">
                  {reviews.map((r) => {
                    const expanded = !!expandedReviewIds[r.id]
                    const txt = [r.pros ? `Artılar: ${r.pros}` : '', r.cons ? `Eksiler: ${r.cons}` : '']
                      .filter(Boolean)
                      .join(' • ')
                      .trim()

                    const r10 = typeof r.rating === 'number' ? r.rating : null
                    const badge = r.would_buy_again === true ? '✔ Tekrar Alırım' : '✖ Tekrar Almam'
                    const isMine = !!userId && r.user_id === userId

                    return (
                      <div
                        key={r.id}
                        className={`rmCard ${expanded ? 'open' : ''}`}
                        onClick={() => setExpandedReviewIds((s) => ({ ...s, [r.id]: !expanded }))}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="rmRow1">
                          <button
                            type="button"
                            className="userLink rmUserLink"
                            onClick={(e) => {
                              e.stopPropagation()
                              const u = r.author?.username || 'Kullanıcı'
                              const av = r.author?.avatar_url || null
                              openUserModal(r.user_id, u, av)
                            }}
                          >
                            {r.author?.avatar_url ? <img className="avSm" src={r.author.avatar_url} alt="" /> : <div className="avSm ph" />}
                            <span className="rmUser">{r.author?.username || 'Kullanıcı'}</span>
                          </button>

                          <div className="rmRight">
                            <span className="badge">{r10 !== null ? `${r10}/10` : '—'}</span>
                            <span className={`wbaBadge ${r.would_buy_again === true ? '' : 'no'}`}>{badge}</span>

                            {isMine ? (
                              <span className="rmActions" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="miniBtn"
                                  onClick={() => {
                                    if (reviewsProduct) setSelected(reviewsProduct)
                                    startEditExperience(r)
                                    setReviewsOpen(false)
                                  }}
                                >
                                  Düzenle
                                </button>
                                <button type="button" className="miniBtn danger" onClick={() => deleteExperience(r.id)}>
                                  Sil
                                </button>
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className={`rmText ${expanded ? 'open' : ''}`}>{txt || ' '}</div>
                        <div className="rmDate">{new Date(r.created_at).toLocaleString('tr-TR')}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* User modal */}
        {userModalOpen ? (
          <div className="um" onClick={() => setUserModalOpen(false)} role="dialog" aria-modal="true">
            <div className="umInner" onClick={(e) => e.stopPropagation()}>
              <button className="umClose" onClick={() => setUserModalOpen(false)} aria-label="Kapat">
                ×
              </button>

              <div className="umHead">
                {userModalAvatar ? <img className="umAv" src={userModalAvatar} alt="" /> : <div className="umAv ph" />}
                <div>
                  <div className="h2" style={{ marginBottom: 4 }}>
                    {userModalTitle}
                  </div>
                  <div className="umSub">Yaptığı Yorumlar</div>
                </div>
              </div>

              {userExperiencesLoading ? (
                <div className="muted">Yükleniyor…</div>
              ) : (
                <div className="umList">
                  {userExperiences.map((r) => {
                    const r10 = typeof r.rating === 'number' ? r.rating : null
                    return (
                      <div key={r.id} className="umCard">
                        <div className="umTop">
                          <div className="badge">{r10 !== null ? `${r10}/10` : '—'}</div>
                          <div className={`wbaBadge ${r.would_buy_again === true ? '' : 'no'}`}>{r.would_buy_again === true ? '✔ Tekrar Alırım' : '✖ Tekrar Almam'}</div>
                        </div>

                        {r.product ? (
                          <div className="t" style={{ marginBottom: 8 }}>
                            {r.product.brand} — {r.product.name}
                            {r.product.category ? ` • ${r.product.category}` : ''}
                          </div>
                        ) : null}

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

                        <div className="umDate">{new Date(r.created_at).toLocaleString('tr-TR')}</div>
                      </div>
                    )
                  })}
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
.app{ max-width: 1380px; margin:0 auto; display:flex; flex-direction:column; gap: 14px; }

.topbar{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding: 10px 18px;
  border-radius: var(--r);
  border:1px solid var(--stroke);
  background: linear-gradient(180deg, var(--glass2), var(--glass));
  backdrop-filter: blur(18px);
  box-shadow: var(--shadow);
  position: sticky; top: 12px; z-index: 20;
}
.brand{ display:flex; align-items:center; gap: 14px; }
.logo{
  width: 124px;
  height: 124px;
  padding: 0;
  object-fit: contain;
  border-radius: 30px;
  background: #0e0e14;
  border: 1px solid rgba(255,255,255,.18);
  box-shadow: 0 35px 80px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.06);
}
.word{ font-weight: 900; font-size: 26px; letter-spacing: .22em; text-transform: uppercase; }

.rightCol{ display:flex; flex-direction:column; align-items:flex-end; gap: 10px; }
.userPill{
  display:flex; align-items:center; gap:12px;
  height: 44px;
  padding: 0 16px;
  border-radius: 999px;
  border:1px solid rgba(255,255,255,.28);
  background: linear-gradient(145deg, rgba(0,0,0,.55), rgba(0,0,0,.35));
  color: var(--text);
  cursor: pointer;
  box-shadow: 0 12px 30px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.06);
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
.btn:hover{ transform: translateY(-2px); box-shadow: 0 18px 40px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.08); }
.btn.ghost{ background: rgba(255,255,255,.10); border:1px solid rgba(255,255,255,.20); }
.btn:disabled{ opacity:.6; cursor:not-allowed; transform:none; }
.btnSm{ height: 46px; display:inline-flex; align-items:center; justify-content:center; padding: 0 18px; }
.btnXs{ height: 38px; padding: 0 14px; border-radius: 14px; font-weight: 900; }
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
.b{ font-weight: 900; }

.grid4{
  display:grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
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
  max-height: 420px; overflow:auto; padding-right: 2px;
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
.thumb{ width:44px; height:44px; border-radius: 14px; object-fit: cover; border:1px solid rgba(255,255,255,.18); flex:0 0 auto; }
.thumb.ph{ background: rgba(255,255,255,.10); }
.mid{ flex:1; min-width:0; }
.t{ font-weight: 900; }
.meta2{ display:flex; gap: 10px; align-items:center; flex-wrap:wrap; }
.linkBtn{
  appearance:none; border:none; background: transparent;
  color: rgba(255,255,255,.92);
  font-weight: 900;
  text-decoration: underline;
  cursor:pointer;
  padding: 0;
}

.radio{
  display:flex; align-items:center; gap:8px;
  padding: 8px 10px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.16);
  font-weight: 900;
}

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

.recent{ display:flex; flex-direction:column; gap: 10px; max-height: 420px; overflow:auto; padding-right: 2px; }
.r{ border:1px solid rgba(255,255,255,.14); background: rgba(0,0,0,.14); border-radius: var(--r2); padding: 10px; }
.clickableCard{ cursor:pointer; }
.rHead{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom: 8px; }
.userLink{
  appearance:none; border:none; background: transparent; color: var(--text);
  display:flex; align-items:center; gap:10px; cursor:pointer; padding: 0;
}
.avSm{ width:28px; height:28px; border-radius:999px; object-fit:cover; border:1px solid rgba(255,255,255,.22); }
.avSm.ph{ background: rgba(255,255,255,.12); }
.rUser{ font-weight: 900; }
.rRight{ display:flex; align-items:center; gap:10px; }
.badge{ font-weight: 900; padding: 6px 10px; border-radius: 999px; background: rgba(255,255,255,.10); border:1px solid rgba(255,255,255,.18); }
.wbaBadge{ font-weight: 900; padding: 6px 10px; border-radius: 999px; background: rgba(70,255,160,.12); border:1px solid rgba(120,255,190,.24); }
.wbaBadge.no{ background: rgba(255,90,90,.12); border:1px solid rgba(255,120,120,.24); }

.pLine{ margin-bottom: 8px; }
.pill{ margin-top: 8px; padding: 8px 10px; border-radius: 14px; border:1px solid rgba(255,255,255,.14); }
.okP{ background: rgba(70,255,160,.10); }
.badP{ background: rgba(255,90,90,.10); }
.rImg{ width: 100%; max-height: 220px; object-fit: cover; border-radius: 14px; border:1px solid rgba(255,255,255,.18); margin-top: 10px; }

.foot{ text-align:center; padding: 6px 0; }
.clickable { cursor: zoom-in; }

/* Lightbox */
.lb{
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,.65);
  backdrop-filter: blur(10px);
  display: grid; place-items: center; padding: 18px;
}
.lbInner{
  width: min(920px, 96vw); max-height: 90vh;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.18);
  background: rgba(15, 5, 20, .55);
  box-shadow: 0 30px 90px rgba(0,0,0,.55);
  padding: 14px;
  position: relative;
  display: flex; flex-direction: column; gap: 10px;
}
.lbClose{
  position: absolute; top: 10px; right: 12px;
  width: 36px; height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.22);
  background: rgba(0,0,0,.35);
  color: #fff;
  font-size: 22px;
  cursor: pointer;
}
.lbImg{ width: 100%; height: auto; max-height: 72vh; object-fit: contain; border-radius: 14px; border: 1px solid rgba(255,255,255,.14); }
.lbCap{ font-size: 12px; color: rgba(255,255,255,.75); text-align: center; }

/* Profile Modal */
.pm{
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,.55);
  backdrop-filter: blur(10px);
  display: grid; place-items: center; padding: 18px;
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
  position: absolute; top: 10px; right: 12px;
  width: 36px; height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.22);
  background: rgba(0,0,0,.35);
  color: #fff;
  font-size: 22px;
  cursor: pointer;
}

/* Reviews Modal (pembe üstü beyaz) */
.rm{
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(192, 58, 159, .22);
  backdrop-filter: blur(10px);
  display: grid; place-items: center; padding: 18px;
}
.rmInner{
  width: min(980px, 96vw);
  max-height: 90vh;
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,.25);
  background: rgba(255,255,255,.94);
  box-shadow: 0 30px 90px rgba(0,0,0,.35);
  padding: 16px;
  position: relative;
  color: #12121a;
  overflow: hidden;
}
.rmClose{
  position: absolute; top: 10px; right: 12px;
  width: 36px; height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(0,0,0,.12);
  background: rgba(255,255,255,.9);
  color: #111;
  font-size: 22px;
  cursor: pointer;
}
.rmTitle{ margin-bottom: 12px; }
.rmSubtitle{ font-size: 12px; font-weight: 900; color: #111; }
.rmList{ max-height: calc(90vh - 120px); overflow:auto; display:flex; flex-direction:column; gap: 10px; padding-right: 4px; }
.rmCard{
  border-radius: 18px;
  border: 1px solid rgba(0,0,0,.08);
  background: rgba(255,255,255,.98);
  padding: 12px;
  cursor:pointer;
}
.rmRow1{ display:flex; align-items:center; justify-content:space-between; gap: 10px; margin-bottom: 8px; }
.rmUser{ font-weight: 900; color:#111; }
.rmRight{ display:flex; align-items:center; gap: 10px; flex-wrap:wrap; justify-content:flex-end; }
.rmText{
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.35;
  margin-bottom: 6px;
  color:#111;
}
.rmText.open{ -webkit-line-clamp: unset; }
.rmDate{ font-size: 12px; color: rgba(0,0,0,.60); }
.rmUserLink{ color:#111 !important; }
.rmInner .badge{ color:#111; border-color: rgba(0,0,0,.14); background: rgba(0,0,0,.06); }
.rmInner .wbaBadge{ color:#111; border-color: rgba(0,0,0,.12); background: rgba(0,0,0,.06); }
.rmInner .wbaBadge.no{ background: rgba(255,90,90,.10); border-color: rgba(255,120,120,.24); }

.rmActions{ display:inline-flex; gap:8px; }
.miniBtn{
  appearance:none;
  border:1px solid rgba(0,0,0,.14);
  background: rgba(0,0,0,.04);
  border-radius: 12px;
  padding: 8px 10px;
  font-weight: 900;
  cursor:pointer;
  color:#111;
}
.miniBtn.danger{
  background: rgba(255,90,90,.10);
  border-color: rgba(255,120,120,.26);
}

/* User Modal */
.um{
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(192, 58, 159, .18);
  backdrop-filter: blur(10px);
  display: grid; place-items: center; padding: 18px;
}
.umInner{
  width: min(980px, 96vw);
  max-height: 90vh;
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,.25);
  background: rgba(255,255,255,.94);
  box-shadow: 0 30px 90px rgba(0,0,0,.35);
  padding: 16px;
  position: relative;
  color: #12121a;
  overflow: hidden;
}
.umClose{
  position: absolute; top: 10px; right: 12px;
  width: 36px; height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(0,0,0,.12);
  background: rgba(255,255,255,.9);
  color: #111;
  font-size: 22px;
  cursor: pointer;
}
.umHead{ display:flex; align-items:center; gap: 12px; margin-bottom: 12px; }
.umAv{ width: 44px; height: 44px; border-radius: 999px; object-fit: cover; border: 1px solid rgba(0,0,0,.12); background: rgba(0,0,0,.06); }
.umAv.ph{ background: rgba(0,0,0,.06); }
.umSub{ font-size:12px; font-weight:900; color: rgba(0,0,0,.60); }
.umList{ max-height: calc(90vh - 120px); overflow:auto; display:flex; flex-direction:column; gap: 10px; padding-right: 4px; }
.umCard{
  border-radius: 18px;
  border: 1px solid rgba(0,0,0,.08);
  background: rgba(255,255,255,.98);
  padding: 12px;
}
.umTop{ display:flex; align-items:center; gap:10px; margin-bottom: 8px; }
.umInner .badge{ color:#111; border-color: rgba(0,0,0,.14); background: rgba(0,0,0,.06); }
.umInner .wbaBadge{ color:#111; border-color: rgba(0,0,0,.12); background: rgba(0,0,0,.06); }
.umInner .wbaBadge.no{ background: rgba(255,90,90,.10); border-color: rgba(255,120,120,.26); }
.umInner .pill{ border-color: rgba(0,0,0,.10); }
.umInner .okP{ background: rgba(70,255,160,.10); }
.umInner .badP{ background: rgba(255,90,90,.10); }
.umDate{ font-size:12px; color: rgba(0,0,0,.60); margin-top: 8px; }

/* mobile */
@media(max-width: 1400px){
  .grid4{ grid-template-columns: 1fr 1fr; }
}
@media(max-width: 1100px){
  .grid4{ grid-template-columns: 1fr; }
  .tall{ min-height: auto; }
  .list,.recent{ max-height: 320px; }
  .logo{ width: 96px; height: 96px; }
  .word{ font-size: 22px; }
}
`