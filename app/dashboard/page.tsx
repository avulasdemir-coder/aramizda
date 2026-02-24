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
  category: string | null
  image_url: string | null
  created_at?: string
}

type Experience = {
  id: string
  user_id: string
  product_id: string
  rating: number | null
  pros: string | null
  cons: string | null
  would_buy_again: boolean | null
  created_at: string
  product?: Product | null
  author?: { username: string; avatar_url: string | null } | null
}

type Profile = {
  user_id: string
  username: string
  avatar_url: string | null
}

function slugFileName(original: string) {
  const clean = original
    .toLowerCase()
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const ts = Date.now()
  return `${ts}-${clean || 'file'}`
}

async function uploadToBucket(file: File, bucket = 'product-images') {
  const userRes = await supabase.auth.getUser()
  const uid = userRes.data.user?.id ?? 'anon'
  const path = `${uid}/${slugFileName(file.name)}`
  const up = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  })
  if (up.error) throw up.error
  const pub = supabase.storage.from(bucket).getPublicUrl(path)
  return pub.data.publicUrl
}

export default function Page() {
  const [ready, setReady] = useState(false)

  // auth
  const [userId, setUserId] = useState<string | null>(null)

  // profile
  const [profile, setProfile] = useState<Profile | null>(null)
  const [usernameDraft, setUsernameDraft] = useState('')
  const [avatarDraft, setAvatarDraft] = useState<File | null>(null)
  const [profileErr, setProfileErr] = useState<string | null>(null)
  const [profileSaving, setProfileSaving] = useState(false)

  // products
  const [q, setQ] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [selected, setSelected] = useState<Product | null>(null)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [productErr, setProductErr] = useState<string | null>(null)

  // add product
  const [pBrand, setPBrand] = useState('')
  const [pName, setPName] = useState('')
  const [pCategory, setPCategory] = useState('')
  const [pImage, setPImage] = useState<File | null>(null)
  const [addingProduct, setAddingProduct] = useState(false)
  const [addProductMsg, setAddProductMsg] = useState<string | null>(null)

  // add experience
  const [rating, setRating] = useState<number>(5)
  const [pros, setPros] = useState('')
  const [cons, setCons] = useState('')
  const [wba, setWba] = useState(true)
  const [addingExp, setAddingExp] = useState(false)
  const [expMsg, setExpMsg] = useState<string | null>(null)

  // recent
  const [recent, setRecent] = useState<Experience[]>([])
  const [loadingRecent, setLoadingRecent] = useState(false)

  const selectedTitle = useMemo(() => {
    if (!selected) return 'Seçili ürün: yok'
    const cat = selected.category ? ` • ${selected.category}` : ''
    return `${selected.brand} — ${selected.name}${cat}`
  }, [selected])

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      const u = data.user
      setUserId(u?.id ?? null)
      setReady(true)
      if (u?.id) {
        await loadProfile(u.id)
        await loadRecent()
      }
    })()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, session) => {
      const uid = session?.user?.id ?? null
      setUserId(uid)
      setSelected(null)
      setProducts([])
      setRecent([])
      if (uid) {
        await loadProfile(uid)
        await loadRecent()
      } else {
        setProfile(null)
      }
    })

    return () => sub.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadProfile(uid: string) {
    setProfileErr(null)
    const res = await supabase.from('profiles').select('user_id,username,avatar_url').eq('user_id', uid).maybeSingle()
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
    setProfileSaving(true)
    setProfileErr(null)
    try {
      const uname = usernameDraft.trim()
      if (uname.length < 2) throw new Error('Kullanıcı adı en az 2 karakter olmalı.')

      let avatarUrl: string | null = profile?.avatar_url ?? null
      if (avatarDraft) {
        // aynı bucket'ı kullanıyoruz (kolay)
        avatarUrl = await uploadToBucket(avatarDraft, 'product-images')
      }

      const up = await supabase
        .from('profiles')
        .upsert({ user_id: userId, username: uname, avatar_url: avatarUrl }, { onConflict: 'user_id' })
        .select('user_id,username,avatar_url')
        .single()

      if (up.error) throw up.error
      setProfile(up.data)
      setAvatarDraft(null)
    } catch (e: any) {
      setProfileErr(e?.message ?? 'Profil kaydedilemedi.')
    } finally {
      setProfileSaving(false)
    }
  }

  async function searchProducts() {
    setProductErr(null)
    setLoadingProducts(true)
    try {
      const term = q.trim()
      if (!term) {
        setProducts([])
        return
      }
      const { data, error } = await supabase
        .from('products')
        .select('id,name,brand,category,image_url,created_at')
        .or(`name.ilike.%${term}%,brand.ilike.%${term}%,category.ilike.%${term}%`)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setProducts((data as Product[]) ?? [])
    } catch (e: any) {
      setProductErr(e?.message ?? 'Ürün araması başarısız.')
    } finally {
      setLoadingProducts(false)
    }
  }

  async function addProduct() {
    if (!userId) return
    setAddProductMsg(null)
    setProductErr(null)
    setAddingProduct(true)
    try {
      const brand = pBrand.trim()
      const name = pName.trim()
      const category = pCategory.trim()

      if (!brand || !name) throw new Error('Marka ve ürün adı zorunlu.')
      if (!profile?.username) throw new Error('Önce kullanıcı adını kaydet.')

      let image_url: string | null = null
      if (pImage) {
        if (pImage.size > 5 * 1024 * 1024) throw new Error('Fotoğraf çok büyük. 5MB altında olmalı.')
        image_url = await uploadToBucket(pImage, 'product-images')
      }

      const ins = await supabase
        .from('products')
        .insert({
          brand,
          name,
          category: category || null,
          image_url,
          created_by: userId, // kolon yoksa Supabase "column does not exist" der; o zaman sil
        } as any)
        .select('id,name,brand,category,image_url,created_at')
        .single()

      if (ins.error) throw ins.error

      setAddProductMsg('Ürün eklendi.')
      setPBrand('')
      setPName('')
      setPCategory('')
      setPImage(null)

      // yeni ürünü seç + listeyi güncelle
      const newP = ins.data as Product
      setSelected(newP)
      if (q.trim()) await searchProducts()
    } catch (e: any) {
      setAddProductMsg(null)
      setProductErr(e?.message ?? 'Ürün eklenemedi.')
    } finally {
      setAddingProduct(false)
    }
  }

  async function addExperience() {
    if (!userId) return
    setExpMsg(null)
    try {
      if (!selected) throw new Error('Önce bir ürün seç.')
      if (!profile?.username) throw new Error('Önce kullanıcı adını kaydet.')

      setAddingExp(true)
      const ins = await supabase
        .from('experiences')
        .insert({
          user_id: userId,
          product_id: selected.id,
          rating,
          pros: pros.trim() || null,
          cons: cons.trim() || null,
          would_buy_again: wba,
        })
        .select('id,user_id,product_id,rating,pros,cons,would_buy_again,created_at')
        .single()

      if (ins.error) throw ins.error
      setExpMsg('Deneyim eklendi.')
      setPros('')
      setCons('')
      setRating(5)
      setWba(true)
      await loadRecent()
    } catch (e: any) {
      setExpMsg(e?.message ?? 'Deneyim eklenemedi.')
    } finally {
      setAddingExp(false)
    }
  }

  async function loadRecent() {
    setLoadingRecent(true)
    try {
      const { data, error } = await supabase
        .from('experiences')
        .select(
          `
          id,user_id,product_id,rating,pros,cons,would_buy_again,created_at,
          product:products(id,name,brand,category,image_url,created_at),
          author:profiles(username,avatar_url)
        `
        )
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error

      const list = ((data as any[]) || []).map((x) => {
        const e: Experience = {
          id: x.id,
          user_id: x.user_id,
          product_id: x.product_id,
          rating: x.rating,
          pros: x.pros,
          cons: x.cons,
          would_buy_again: x.would_buy_again,
          created_at: x.created_at,
          product: x.product ?? null,
          author: x.author ?? null,
        }
        return e
      })
      setRecent(list)
    } catch (_e) {
      // sessiz
    } finally {
      setLoadingRecent(false)
    }
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const showProfileGate = ready && !!userId && (!profile?.username || profile.username.trim().length < 2)

  return (
    <div className="wrap">
      <style>{css}</style>

      {!ready ? (
        <div className="center">
          <div className="card">
            <div className="title">Yükleniyor…</div>
            <div className="muted">Bir saniye.</div>
          </div>
        </div>
      ) : !userId ? (
        <div className="center">
          <div className="card">
            <div className="title">Giriş yapılmadı</div>
            <div className="muted">Devam etmek için giriş yap.</div>
            <button className="btn" onClick={signInWithGoogle}>
              Google ile Giriş Yap
            </button>
          </div>
        </div>
      ) : (
        <div className="app">
          {/* Top bar */}
          <div className="topbar">
            <div className="brand">
              <div className="logoDot" />
              <div className="brandText">Aramızda</div>
            </div>

            <div className="topRight">
              {profile?.avatar_url ? (
                <img className="avatar" src={profile.avatar_url} alt="avatar" />
              ) : (
                <div className="avatar ph" />
              )}
              <div className="who">
                <div className="whoName">{profile?.username || 'Profil'}</div>
                <div className="whoSub muted">Giriş açık</div>
              </div>
              <button className="btn ghost" onClick={signOut}>
                Çıkış
              </button>
            </div>
          </div>

          {/* Gate: must have username */}
          {showProfileGate ? (
            <div className="gridOne">
              <div className="card">
                <div className="cardTitle">Profil</div>
                <div className="muted">Kullanıcı adı zorunlu (yorumlar anonim olmasın diye).</div>

                <div className="formRow">
                  <label className="label">Kullanıcı adı</label>
                  <input
                    className="input"
                    value={usernameDraft}
                    onChange={(e) => setUsernameDraft(e.target.value)}
                    placeholder="ör: gizem, ulas, aramizda_admin"
                  />
                </div>

                <div className="formRow">
                  <label className="label">Profil fotoğrafı (opsiyonel)</label>
                  <input
                    className="file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setAvatarDraft(e.target.files?.[0] ?? null)}
                  />
                  <div className="muted small">Öneri: kare fotoğraf, 5MB altı.</div>
                </div>

                {profileErr ? <div className="err">{profileErr}</div> : null}

                <button className="btn" onClick={saveProfile} disabled={profileSaving}>
                  {profileSaving ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
              </div>
            </div>
          ) : (
            // MAIN: single-screen layout (no scrolling by design)
            <div className="grid">
              {/* Left column */}
              <div className="col">
                <div className="card">
                  <div className="cardTitle">Ürün Ara</div>
                  <div className="row">
                    <input
                      className="input"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="ör: elidor şampuan"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') searchProducts()
                      }}
                    />
                    <button className="btn" onClick={searchProducts} disabled={loadingProducts}>
                      {loadingProducts ? '…' : 'Ara'}
                    </button>
                  </div>

                  {productErr ? <div className="err">{productErr}</div> : null}

                  <div className="list">
                    {products.length === 0 ? (
                      <div className="muted small">Arama yapınca sonuçlar burada listelenir.</div>
                    ) : (
                      products.map((p) => (
                        <button
                          key={p.id}
                          className={`item ${selected?.id === p.id ? 'active' : ''}`}
                          onClick={() => setSelected(p)}
                        >
                          <div className="itemLeft">
                            {p.image_url ? <img className="thumb" src={p.image_url} alt="" /> : <div className="thumb ph" />}
                          </div>
                          <div className="itemMid">
                            <div className="itemTitle">
                              {p.brand} — {p.name}
                            </div>
                            <div className="muted small">{p.category || 'Kategori yok'}</div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="card grow">
                  <div className="cardTitle">Son Deneyimler</div>
                  {loadingRecent ? (
                    <div className="muted">Yükleniyor…</div>
                  ) : recent.length === 0 ? (
                    <div className="muted">Henüz deneyim yok.</div>
                  ) : (
                    <div className="recent">
                      {recent.map((r) => (
                        <div className="recentItem" key={r.id}>
                          <div className="recentHead">
                            {r.author?.avatar_url ? (
                              <img className="avatarSm" src={r.author.avatar_url} alt="" />
                            ) : (
                              <div className="avatarSm ph" />
                            )}
                            <div className="recentMeta">
                              <div className="recentUser">{r.author?.username || 'Kullanıcı'}</div>
                              <div className="muted small">
                                {new Date(r.created_at).toLocaleString('tr-TR')}
                              </div>
                            </div>
                            <div className="badge">{typeof r.rating === 'number' ? `${r.rating}/5` : '-'}</div>
                          </div>

                          <div className="recentBody">
                            <div className="muted small">
                              {r.product ? `${r.product.brand} — ${r.product.name}` : 'Ürün'}
                            </div>
                            {r.pros ? <div className="pill ok">+ {r.pros}</div> : null}
                            {r.cons ? <div className="pill bad">- {r.cons}</div> : null}
                            <div className="muted small">{r.would_buy_again ? '✅ Tekrar alırım' : '❌ Tekrar almam'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right column */}
              <div className="col">
                <div className="card">
                  <div className="cardTitle">Deneyim Ekle</div>
                  <div className="muted small">{selectedTitle}</div>

                  <div className="formRow">
                    <label className="label">Puan</label>
                    <select className="select" value={rating} onChange={(e) => setRating(parseInt(e.target.value, 10))}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="formRow">
                    <label className="label">Artılar</label>
                    <textarea className="ta" value={pros} onChange={(e) => setPros(e.target.value)} placeholder="kısa yaz" />
                  </div>

                  <div className="formRow">
                    <label className="label">Eksiler</label>
                    <textarea className="ta" value={cons} onChange={(e) => setCons(e.target.value)} placeholder="kısa yaz" />
                  </div>

                  <label className="check">
                    <input type="checkbox" checked={wba} onChange={(e) => setWba(e.target.checked)} />
                    <span className="muted">Tekrar alırım</span>
                  </label>

                  {expMsg ? <div className={expMsg.includes('eklendi') ? 'okMsg' : 'err'}>{expMsg}</div> : null}

                  <button className="btn" onClick={addExperience} disabled={addingExp || !selected}>
                    {addingExp ? 'Gönderiliyor…' : 'Gönder'}
                  </button>
                  {!selected ? <div className="muted small">Önce soldan bir ürün seç.</div> : null}
                </div>

                <div className="card">
                  <div className="cardTitle">Ürün Ekle</div>
                  <div className="muted small">İlk hafta sadece admin/partner eklesin (istersen sonra kapatırız).</div>

                  <div className="form2">
                    <div className="formRow">
                      <label className="label">Marka</label>
                      <input className="input" value={pBrand} onChange={(e) => setPBrand(e.target.value)} placeholder="ör: Bee Beauty" />
                    </div>

                    <div className="formRow">
                      <label className="label">Ürün Adı</label>
                      <input className="input" value={pName} onChange={(e) => setPName(e.target.value)} placeholder="ör: Topuk çatlak kremi" />
                    </div>

                    <div className="formRow">
                      <label className="label">Kategori</label>
                      <input className="input" value={pCategory} onChange={(e) => setPCategory(e.target.value)} placeholder="ör: bakım" />
                    </div>

                    <div className="formRow">
                      <label className="label">Ürün fotoğrafı (opsiyonel)</label>
                      <input className="file" type="file" accept="image/*" onChange={(e) => setPImage(e.target.files?.[0] ?? null)} />
                      <div className="muted small">5MB altı önerilir.</div>
                    </div>

                    {addProductMsg ? <div className={addProductMsg.includes('eklendi') ? 'okMsg' : 'err'}>{addProductMsg}</div> : null}

                    <button className="btn" onClick={addProduct} disabled={addingProduct}>
                      {addingProduct ? 'Ekleniyor…' : 'Ekle'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="footer muted small">© Aramızda</div>
        </div>
      )}
    </div>
  )
}

const css = `
:root{
  --bg0:#1a0b23;
  --bg1:#3b1360;
  --bg2:#b02b86;
  --glass: rgba(255,255,255,.10);
  --glass2: rgba(255,255,255,.14);
  --stroke: rgba(255,255,255,.18);
  --text: rgba(255,255,255,.92);
  --muted: rgba(255,255,255,.72);
  --shadow: 0 18px 60px rgba(0,0,0,.35);
  --r: 22px;
  --r2: 16px;
}

*{ box-sizing:border-box; }
html,body{ height:100%; }
body{ margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:var(--text); }
.wrap{
  min-height:100vh;
  background:
    radial-gradient(1200px 700px at 18% 8%, rgba(255,255,255,.10), transparent 55%),
    radial-gradient(900px 600px at 78% 20%, rgba(255,255,255,.10), transparent 55%),
    linear-gradient(135deg, var(--bg1), var(--bg2));
  padding: 18px;
}

.center{
  min-height: calc(100vh - 36px);
  display:flex;
  align-items:center;
  justify-content:center;
}

.app{
  max-width: 1180px;
  margin: 0 auto;
  display:flex;
  flex-direction:column;
  gap: 14px;
}

.topbar{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding: 12px 14px;
  border:1px solid var(--stroke);
  background: linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.08));
  border-radius: var(--r);
  box-shadow: var(--shadow);
}

.brand{ display:flex; align-items:center; gap:10px; }
.logoDot{
  width: 12px; height: 12px; border-radius: 999px;
  background: rgba(255,255,255,.85);
  box-shadow: 0 0 0 6px rgba(255,255,255,.10);
}
.brandText{ font-weight:800; letter-spacing:.4px; }

.topRight{ display:flex; align-items:center; gap:12px; }
.who{ display:flex; flex-direction:column; line-height:1.1; }
.whoName{ font-weight:700; }
.whoSub{ font-size:12px; }

.avatar{ width:34px; height:34px; border-radius:999px; object-fit:cover; border:1px solid rgba(255,255,255,.25); }
.avatar.ph{ background: rgba(255,255,255,.14); }

.btn{
  appearance:none; border:0; cursor:pointer;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(0,0,0,.35);
  color: var(--text);
  border: 1px solid rgba(255,255,255,.18);
}
.btn:hover{ filter: brightness(1.07); }
.btn:disabled{ opacity:.55; cursor:not-allowed; }
.btn.ghost{ background: rgba(255,255,255,.08); }

.card{
  border: 1px solid var(--stroke);
  background: linear-gradient(180deg, var(--glass2), var(--glass));
  border-radius: var(--r);
  padding: 14px;
  box-shadow: var(--shadow);
}
.title{ font-size: 20px; font-weight: 800; margin-bottom: 8px; }
.cardTitle{ font-size: 16px; font-weight: 800; margin-bottom: 10px; }

.muted{ color: var(--muted); }
.small{ font-size: 12px; }

.grid{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  /* TEK EKRAN: yükseklik sabit, içerik kendi içinde kayar */
  height: calc(100vh - 18px - 18px - 64px - 14px - 18px); /* wrap padding - topbar - gap - footer */
  min-height: 560px;
}
.gridOne{
  display:grid;
  grid-template-columns: 1fr;
  gap: 14px;
}

.col{
  display:flex;
  flex-direction:column;
  gap: 14px;
  min-height: 0; /* allow children to scroll */
}

.grow{ flex: 1; min-height: 0; }

.row{ display:flex; gap:10px; align-items:center; }
.input, .select, .ta, .file{
  width:100%;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.16);
  background: rgba(0,0,0,.22);
  color: var(--text);
  outline: none;
}
.select{ height: 40px; }
.ta{ min-height: 74px; resize: none; }
.file{ padding: 10px; background: rgba(255,255,255,.06); }

.label{
  display:block;
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 6px;
}
.formRow{ margin-top: 10px; }
.form2 .formRow:first-child{ margin-top: 0; }

.list{
  margin-top: 10px;
  display:flex;
  flex-direction:column;
  gap:10px;
  max-height: 260px;
  overflow:auto;
  padding-right: 2px;
}
.item{
  display:flex;
  align-items:center;
  gap: 12px;
  text-align:left;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.18);
  color: var(--text);
  border-radius: var(--r2);
  padding: 10px;
  cursor:pointer;
}
.item:hover{ filter: brightness(1.06); }
.item.active{
  border-color: rgba(255,255,255,.28);
  background: rgba(255,255,255,.08);
}
.thumb{
  width: 44px; height: 44px;
  border-radius: 14px;
  object-fit:cover;
  border:1px solid rgba(255,255,255,.18);
}
.thumb.ph{ background: rgba(255,255,255,.10); }
.itemTitle{ font-weight: 700; }
.itemMid{ flex:1; min-width:0; }

.check{
  display:flex;
  align-items:center;
  gap:10px;
  margin-top: 10px;
}

.err{
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255,70,70,.18);
  border: 1px solid rgba(255,120,120,.28);
}
.okMsg{
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(70,255,160,.14);
  border: 1px solid rgba(120,255,190,.24);
}

.recent{
  margin-top: 10px;
  display:flex;
  flex-direction:column;
  gap: 10px;
  max-height: 100%;
  overflow:auto;
  padding-right: 2px;
}
.recentItem{
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.16);
  border-radius: var(--r2);
  padding: 10px;
}
.recentHead{
  display:flex;
  align-items:center;
  gap: 10px;
}
.avatarSm{
  width: 28px; height: 28px; border-radius: 999px;
  object-fit:cover; border: 1px solid rgba(255,255,255,.22);
}
.avatarSm.ph{ background: rgba(255,255,255,.12); }
.recentMeta{ flex:1; min-width:0; }
.recentUser{ font-weight: 800; }
.badge{
  font-weight: 800;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255,255,255,.10);
  border: 1px solid rgba(255,255,255,.18);
}
.recentBody{ margin-top: 10px; display:flex; flex-direction:column; gap: 8px; }

.pill{
  padding: 8px 10px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.14);
}
.pill.ok{ background: rgba(70,255,160,.12); }
.pill.bad{ background: rgba(255,90,90,.12); }

.footer{ text-align:center; padding: 4px 0; }

@media (max-width: 980px){
  .grid{
    grid-template-columns: 1fr;
    height: auto;
  }
  .list{ max-height: 240px; }
}
`