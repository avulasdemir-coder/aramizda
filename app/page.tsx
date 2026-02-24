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

function safeExt(fileName: string) {
  const p = fileName.split('.')
  const ext = p.length > 1 ? p[p.length - 1].toLowerCase() : 'jpg'
  return ext.replace(/[^a-z0-9]/g, '') || 'jpg'
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16)
}
function validateImage(file: File) {
  const allowed = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ]
  const maxSize = 5 * 1024 * 1024 // 5MB

  if (!allowed.includes(file.type)) {
    throw new Error('Sadece JPG, PNG, WEBP veya HEIC/HEIF formatı yükleyebilirsin.')
  }
  if (file.size > maxSize) {
    throw new Error('Fotoğraf en fazla 5MB olabilir.')
  }
}
function validateImage(file: File) {
  const allowed = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
  const maxSize = 5 * 1024 * 1024 // 5MB

  if (!allowed.includes(file.type)) {
    throw new Error('Sadece JPG, PNG, WEBP veya HEIC/HEIF formatı yükleyebilirsin.')
  }

  if (file.size > maxSize) {
    throw new Error('Fotoğraf en fazla 5MB olabilir.')
  }
}
  validateImage(file)
async function uploadImage(file: File, folder: string) {
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

export default function Home() {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
const [lightboxAlt, setLightboxAlt] = useState<string>('Fotoğraf')
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

  // add product (admin)
  const [newBrand, setNewBrand] = useState('')
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newPhoto, setNewPhoto] = useState<File | null>(null)
  const [addingProduct, setAddingProduct] = useState(false)
  const [addProductMsg, setAddProductMsg] = useState<string | null>(null)

  // add experience
  const [rating, setRating] = useState(5)
  const [pros, setPros] = useState('')
  const [cons, setCons] = useState('')
  const [wba, setWba] = useState(true)
  const [expPhoto, setExpPhoto] = useState<File | null>(null)
  const [addingExp, setAddingExp] = useState(false)
  const [expMsg, setExpMsg] = useState<string | null>(null)

  // recent
  const [recent, setRecent] = useState<ExperienceRow[]>([])
  const [recentLoading, setRecentLoading] = useState(false)

  const needsUsername = !!userId && (!profile?.username || profile.username.trim().length < 2)

  const selectedLabel = useMemo(() => {
    if (!selected) return 'Seçili ürün yok'
    const cat = selected.category ? ` • ${selected.category}` : ''
    return `${selected.brand} — ${selected.name}${cat}`
  }, [selected])

  useEffect(() => {
    // Boot auth without any "ready" gate (no infinite loader possible)
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

    setProfile(res.data ?? null)
    setUsernameDraft(res.data?.username ?? '')
  }

  async function saveProfile() {
    if (!userId) return
    setSavingProfile(true)
    setProfileErr(null)

    try {
      const uname = usernameDraft.trim()
      if (uname.length < 2) throw new Error('Kullanıcı adı en az 2 karakter olmalı.')

      let avatar_url = profile?.avatar_url ?? null
      if (avatarDraft) {
        if (avatarDraft.size > 5 * 1024 * 1024) throw new Error('Profil fotoğrafı 5MB altında olmalı.')
        avatar_url = await uploadImage(avatarDraft, 'avatars')
      }

      const up = await supabase
        .from('profiles')
        .upsert({ user_id: userId, username: uname, avatar_url }, { onConflict: 'user_id' })
        .select('user_id,username,avatar_url,is_admin')
        .single()

      if (up.error) throw up.error
      setProfile(up.data as Profile)
      setAvatarDraft(null)
    } catch (e: any) {
      setProfileErr(e?.message ?? 'Profil kaydedilemedi.')
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

    try {
      const term = q.trim()
      if (!term) {
        setProducts([])
        return
      }

      const { data, error } = await supabase
        .from('products')
        .select('id,brand,name,category,image_url,created_at')
        .or(`name.ilike.%${term}%,brand.ilike.%${term}%,category.ilike.%${term}%`)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setProducts((data as Product[]) ?? [])
    } catch (e: any) {
      setPErr(e?.message ?? 'Ürün araması başarısız.')
    } finally {
      setPLoading(false)
    }
  }

  async function addProduct() {
    setPErr(null)
    setAddProductMsg(null)

    try {
      if (!userId) throw new Error('Giriş gerekli.')
      if (!profile?.is_admin) throw new Error('Ürün ekleme yetkin yok.')
      const brand = newBrand.trim()
      const name = newName.trim()
      const category = newCategory.trim() || null
      if (!brand || !name) throw new Error('Marka ve ürün adı zorunlu.')

      setAddingProduct(true)

      let image_url: string | null = null
      if (newPhoto) {
        if (newPhoto.size > 5 * 1024 * 1024) throw new Error('Ürün fotoğrafı 5MB altında olmalı.')
        image_url = await uploadImage(newPhoto, 'products')
      }

      const ins = await supabase
        .from('products')
        .insert({ brand, name, category, image_url })
        .select('id,brand,name,category,image_url,created_at')
        .single()

      if (ins.error) throw ins.error

      setAddProductMsg('Ürün eklendi.')
      setNewBrand('')
      setNewName('')
      setNewCategory('')
      setNewPhoto(null)

      // seç ve arama sonucunu tazele
      setSelected(ins.data as Product)
      if (q.trim()) await searchProducts()
    } catch (e: any) {
      setPErr(e?.message ?? 'Ürün eklenemedi.')
    } finally {
      setAddingProduct(false)
    }
  }

  async function addExperience() {
    setExpMsg(null)
    try {
      if (!userId) throw new Error('Giriş gerekli.')
      if (!profile?.username) throw new Error('Önce kullanıcı adı belirle.')
      if (!selected) throw new Error('Önce ürün seç.')

      setAddingExp(true)

      let image_url: string | null = null
      if (expPhoto) {
        if (expPhoto.size > 5 * 1024 * 1024) throw new Error('Deneyim fotoğrafı 5MB altında olmalı.')
        image_url = await uploadImage(expPhoto, 'experiences')
      }

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
      setRating(5)
      setWba(true)
      setExpPhoto(null)
      setExpMsg('Deneyim eklendi.')
      await loadRecent()
    } catch (e: any) {
      setExpMsg(e?.message ?? 'Deneyim eklenemedi.')
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
        .limit(12)

      if (error) throw error
      setRecent(((data as any[]) || []) as ExperienceRow[])
    } catch {
      // sessiz
    } finally {
      setRecentLoading(false)
    }
  }

  // UI
  if (!userId) {
    return (
      <div className="wrap">
        <style>{css}</style>
        <div className="center">
          <div className="card">
            <div className="h1">Giriş yap</div>
            <div className="muted">Devam etmek için Google ile giriş yap.</div>
            <button className="btn" onClick={signInWithGoogle}>Google ile giriş</button>
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
            <img className="logo" src="/logo.png" alt="ARAMIZDA" onError={(e) => { (e.currentTarget as any).style.display = 'none' }} />
            <div className="word">ARAMIZDA</div>
          </div>

          <div className="right">
            <div className="userPill">
              {profile?.avatar_url ? <img className="av" src={profile.avatar_url} alt="" /> : <div className="av ph" />}
              <div className="uname">{profile?.username || 'Profil'}</div>
            </div>
            <button className="btn ghost" onClick={signOut}>Çıkış</button>
          </div>
        </header>

        {needsUsername ? (
          <div className="card">
            <div className="h2">Kullanıcı adı</div>
            <div className="muted">Yorumlar anonim olmayacak. Bu isim görünecek.</div>

            <div className="field">
              <div className="label">Kullanıcı adı</div>
              <input className="input" value={usernameDraft} onChange={(e) => setUsernameDraft(e.target.value)} placeholder="ör: ulas, gizem" />
            </div>

            <div className="field">
              <div className="label">Profil fotoğrafı (opsiyonel)</div>
              <input className="file" type="file" accept="image/*" onChange={(e) => setAvatarDraft(e.target.files?.[0] ?? null)} />
              <div className="muted small">5MB altı.</div>
            </div>

            {profileErr ? <div className="err">{profileErr}</div> : null}

            <button className="btn" onClick={saveProfile} disabled={savingProfile}>
              {savingProfile ? 'Kaydediliyor…' : 'Devam'}
            </button>
          </div>
        ) : (
          <main className="grid">
            {/* Left */}
            <section className="card tall">
              <div className="h2">Ürün Ara</div>
              <div className="row">
                <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ör: bee beauty" />
                <button className="btn" onClick={searchProducts} disabled={pLoading}>{pLoading ? '…' : 'Ara'}</button>
              </div>

              {pErr ? <div className="err">{pErr}</div> : null}
              {addProductMsg ? <div className="ok">{addProductMsg}</div> : null}

              <div className="list">
                {products.length === 0 ? (
                  <div className="muted small">Arama yapınca sonuçlar burada listelenir.</div>
                ) : (
                  products.map((p) => (
                    <button key={p.id} className={`item ${selected?.id === p.id ? 'active' : ''}`} onClick={() => setSelected(p)}>
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
                        <div className="t">{p.brand} — {p.name}</div>
                        <div className="muted small">{p.category || 'Kategori yok'}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>

            {/* Middle */}
            <section className="card tall">
              <div className="h2">Deneyim Ekle</div>
              <div className="muted small">{selectedLabel}</div>

              <div className="field">
                <div className="label">Puan</div>
                <select className="input" value={rating} onChange={(e) => setRating(parseInt(e.target.value, 10))}>
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div className="field">
                <div className="label">Artılar</div>
                <textarea className="ta" value={pros} onChange={(e) => setPros(e.target.value)} />
              </div>

              <div className="field">
                <div className="label">Eksiler</div>
                <textarea className="ta" value={cons} onChange={(e) => setCons(e.target.value)} />
              </div>

              <label className="check">
                <input type="checkbox" checked={wba} onChange={(e) => setWba(e.target.checked)} />
                <span>Tekrar alırım</span>
              </label>

              <div className="field">
                <div className="label">Deneyim fotoğrafı (opsiyonel)</div>
                <input className="file" type="file" accept="image/*" onChange={(e) => setExpPhoto(e.target.files?.[0] ?? null)} />
                <div className="muted small">5MB altı.</div>
              </div>

              {expMsg ? <div className={expMsg.includes('eklendi') ? 'ok' : 'err'}>{expMsg}</div> : null}

              <button className="btn" disabled={!selected || addingExp} onClick={addExperience}>
                {addingExp ? 'Gönderiliyor…' : 'Gönder'}
              </button>
              {!selected ? <div className="muted small" style={{ marginTop: 10 }}>Önce soldan ürün seç.</div> : null}
            </section>

            {/* Right */}
            <section className="card tall">
              <div className="h2">Ürün Ekle</div>
              <div className="muted small">İlk hafta sadece admin/partner.</div>

              {!profile?.is_admin ? (
                <div className="muted" style={{ marginTop: 10 }}>Ürün ekleme yetkin yok.</div>
              ) : (
                <>
                  <div className="field">
                    <div className="label">Marka</div>
                    <input className="input" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="label">Ürün adı</div>
                    <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="label">Kategori</div>
                    <input className="input" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="label">Ürün fotoğrafı (opsiyonel)</div>
                    <input className="file" type="file" accept="image/*" onChange={(e) => setNewPhoto(e.target.files?.[0] ?? null)} />
                    <div className="muted small">5MB altı.</div>
                  </div>

                  <button className="btn" onClick={addProduct} disabled={addingProduct}>
                    {addingProduct ? 'Ekleniyor…' : 'Ekle'}
                  </button>
                </>
              )}

              <div className="divider" />

              <div className="h2">Son Deneyimler</div>
              {recentLoading ? (
                <div className="muted">Yükleniyor…</div>
              ) : recent.length === 0 ? (
                <div className="muted">Henüz yok.</div>
              ) : (
                <div className="recent">
                  {recent.map((r) => (
                    <div className="r" key={r.id}>
                      <div className="rHead">
                        {r.author?.avatar_url ? <img className="avSm" src={r.author.avatar_url} alt="" /> : <div className="avSm ph" />}
                        <div className="rMeta">
                          <div className="rUser">{r.author?.username || 'Kullanıcı'}</div>
                          <div className="muted small">{new Date(r.created_at).toLocaleString('tr-TR')}</div>
                        </div>
                        <div className="badge">{typeof r.rating === 'number' ? `${r.rating}/5` : '-'}</div>
                      </div>
                      <div className="muted small">{r.product ? `${r.product.brand} — ${r.product.name}` : 'Ürün'}</div>
                      {r.pros ? <div className="pill okP">+ {r.pros}</div> : null}
                      {r.cons ? <div className="pill badP">- {r.cons}</div> : null}
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
          </main>
        )}

        <div className="foot muted small">© ARAMIZDA</div>
        {lightboxUrl ? (
  <div
    className="lb"
    onClick={() => setLightboxUrl(null)}
    role="dialog"
    aria-modal="true"
  >
    <div className="lbInner" onClick={(e) => e.stopPropagation()}>
      <button
        className="lbClose"
        onClick={() => setLightboxUrl(null)}
        aria-label="Kapat"
      >
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
  display:flex; align-items:center; justify-content:space-between;
  padding: 14px 16px; border-radius: var(--r);
  border:1px solid var(--stroke);
  background: linear-gradient(180deg, var(--glass2), var(--glass));
  backdrop-filter: blur(18px);
  box-shadow: var(--shadow);
  position: sticky; top: 12px; z-index: 20;
}
.brand{ display:flex; align-items:center; gap: 12px; }
.logo{ width: 34px; height: 34px; object-fit: contain; filter: drop-shadow(0 10px 20px rgba(0,0,0,.25)); }
.word{ font-weight: 500; letter-spacing: .18em; text-transform: uppercase; }
.right{ display:flex; align-items:center; gap: 10px; }
.userPill{
  display:flex; align-items:center; gap:10px;
  padding: 8px 12px; border-radius: 999px;
  border:1px solid var(--stroke);
  background: rgba(0,0,0,.18);
}
.av{ width: 28px; height: 28px; border-radius: 999px; object-fit: cover; border:1px solid rgba(255,255,255,.22); }
.av.ph{ background: rgba(255,255,255,.14); }
.uname{ font-weight: 800; font-size: 13px; }
.btn{
  appearance:none;
  border:1px solid rgba(255,255,255,.35);
  cursor:pointer;
  padding: 10px 14px;
  border-radius: 14px;
  background: rgba(0,0,0,.35);
  color: #ffffff;
  font-weight: 900;
  letter-spacing: .4px;
  text-shadow: 0 1px 2px rgba(0,0,0,.6);
}
.btn.ghost{
  background: rgba(255,255,255,.08);
  color: var(--text);
  border: 1px solid var(--stroke);
}
.btn:disabled{ opacity:.6; cursor:not-allowed; }
.card{
  padding: 14px; border-radius: var(--r);
  border:1px solid var(--stroke);
  background: linear-gradient(180deg, var(--glass2), var(--glass));
  backdrop-filter: blur(18px);
  box-shadow: var(--shadow);
}
.h1{ font-size: 20px; font-weight: 900; margin-bottom: 8px; }
.h2{ font-size: 16px; font-weight: 900; margin-bottom: 10px; }
.muted{ color: var(--muted); }
.small{ font-size: 12px; }
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
.input,.ta,.file{
  width:100%;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.16);
  background: rgba(0,0,0,.22);
  color: var(--text);
  padding: 10px 12px;
  outline:none;
}
.ta{ min-height: 74px; resize: vertical; }
.file{ padding: 10px; background: rgba(255,255,255,.06); }
.list{
  margin-top: 10px;
  display:flex; flex-direction:column; gap:10px;
  max-height: 380px; overflow:auto; padding-right: 2px;
}
.item{
  display:flex; gap:12px; align-items:center;
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
.check{ display:flex; align-items:center; gap:10px; margin-top: 10px; font-weight: 800; }
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
.pill{ margin-top: 8px; padding: 8px 10px; border-radius: 14px; border:1px solid rgba(255,255,255,.14); }
.okP{ background: rgba(70,255,160,.10); }
.badP{ background: rgba(255,90,90,.10); }
.rImg{ width: 100%; max-height: 220px; object-fit: cover; border-radius: 14px; border:1px solid rgba(255,255,255,.18); margin-top: 10px; }
.foot{ text-align:center; padding: 6px 0; }

@media(max-width: 1100px){
  .grid{ grid-template-columns: 1fr; }
  .tall{ min-height: auto; }
  .list,.recent{ max-height: 280px; }
}
  .clickable { cursor: zoom-in; }

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
`