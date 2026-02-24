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
  brand: string | null
  image_url: string | null
}

type Profile = {
  user_id: string
  username: string
  avatar_url: string | null
}

type Experience = {
  id: string
  product_id: string
  user_id: string
  rating: number
  pros: string | null
  cons: string | null
  would_buy_again: boolean
  image_url: string | null
  created_at: string
  profile?: { username: string; avatar_url: string | null } | null
}

function safeFileExt(name: string) {
  const parts = name.split('.')
  const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : 'jpg'
  return ext.replace(/[^a-z0-9]/g, '') || 'jpg'
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16)
}

async function uploadToBucket(file: File, folder: string) {
  const ext = safeFileExt(file.name)
  const path = `${folder}/${uid()}.${ext}`

  const { error } = await supabase.storage.from('uploads').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  })
  if (error) throw error

  const { data } = supabase.storage.from('uploads').getPublicUrl(path)
  return data.publicUrl
}

export default function DashboardPage() {
  const [authUserId, setAuthUserId] = useState<string | null>(null)

  // profile
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [usernameDraft, setUsernameDraft] = useState('')
  const [profileError, setProfileError] = useState<string | null>(null)
  const [savingUsername, setSavingUsername] = useState(false)

  // products
  const [q, setQ] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsError, setProductsError] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  // add product
  const [newName, setNewName] = useState('')
  const [newBrand, setNewBrand] = useState('')
  const [newPhoto, setNewPhoto] = useState<File | null>(null)
  const [addingProduct, setAddingProduct] = useState(false)
  const [addProductError, setAddProductError] = useState<string | null>(null)

  // experiences
  const [rating, setRating] = useState(5)
  const [pros, setPros] = useState('')
  const [cons, setCons] = useState('')
  const [wba, setWba] = useState(true)
  const [expPhoto, setExpPhoto] = useState<File | null>(null)
  const [submittingExp, setSubmittingExp] = useState(false)
  const [submitExpError, setSubmitExpError] = useState<string | null>(null)

  const [experiences, setExperiences] = useState<Experience[]>([])
  const [expLoading, setExpLoading] = useState(false)
  const [expError, setExpError] = useState<string | null>(null)

  // ---------------- auth + profile ----------------
  useEffect(() => {
    let alive = true

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setAuthUserId(data.session?.user?.id ?? null)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!alive) return
      setAuthUserId(session?.user?.id ?? null)
    })

    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!authUserId) {
      setProfile(null)
      setProfileLoading(false)
      return
    }

    ;(async () => {
      setProfileLoading(true)
      setProfileError(null)
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, username, avatar_url')
          .eq('user_id', authUserId)
          .single()

        if (error) {
          // "no rows" => profile yok
          if (error.code === 'PGRST116') {
            setProfile(null)
          } else {
            throw error
          }
        } else {
          setProfile(data as Profile)
        }
      } catch (e: any) {
        setProfileError(e?.message ?? 'Profil okunamadı.')
      } finally {
        setProfileLoading(false)
      }
    })()
  }, [authUserId])

  async function saveUsername() {
    if (!authUserId) return
    const username = usernameDraft.trim()
    if (username.length < 3) {
      setProfileError('Kullanıcı adı en az 3 karakter olmalı.')
      return
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      setProfileError('Kullanıcı adı sadece harf, rakam, . _ - içerebilir.')
      return
    }

    setSavingUsername(true)
    setProfileError(null)
    try {
      // upsert profile
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ user_id: authUserId, username }, { onConflict: 'user_id' })
        .select('user_id, username, avatar_url')
        .single()

      if (error) throw error
      setProfile(data as Profile)
      setUsernameDraft('')
    } catch (e: any) {
      setProfileError(e?.message ?? 'Kullanıcı adı kaydedilemedi.')
    } finally {
      setSavingUsername(false)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    setSelectedProduct(null)
    setProducts([])
    setExperiences([])
  }

  // ---------------- products ----------------
  async function loadProducts(searchText: string) {
    setProductsLoading(true)
    setProductsError(null)
    try {
      const s = searchText.trim()
      let query = supabase.from('products').select('id,name,brand,image_url').order('name', { ascending: true }).limit(50)
      if (s) query = query.ilike('name', `%${s}%`)
      const { data, error } = await query
      if (error) throw error
      setProducts((data as Product[]) ?? [])
    } catch (e: any) {
      setProductsError(e?.message ?? 'Ürünler yüklenemedi.')
      setProducts([])
    } finally {
      setProductsLoading(false)
    }
  }

  useEffect(() => {
    loadProducts('')
  }, [])

  useEffect(() => {
    const t = setTimeout(() => loadProducts(q), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  // remember selected product
  useEffect(() => {
    if (selectedProduct?.id) localStorage.setItem('selectedProductId', selectedProduct.id)
  }, [selectedProduct])

  useEffect(() => {
    if (!products.length) return
    if (selectedProduct) return
    const saved = localStorage.getItem('selectedProductId')
    if (!saved) return
    const found = products.find(p => p.id === saved)
    if (found) setSelectedProduct(found)
  }, [products, selectedProduct])

  // ---------------- experiences ----------------
  async function loadExperiences(productId: string) {
    setExpLoading(true)
    setExpError(null)
    try {
      // join profile for username
      const { data, error } = await supabase
        .from('experiences')
        .select('id,product_id,user_id,rating,pros,cons,would_buy_again,image_url,created_at, profile:profiles(username,avatar_url)')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) throw error
      setExperiences((data as any as Experience[]) ?? [])
    } catch (e: any) {
      setExpError(e?.message ?? 'Deneyimler yüklenemedi.')
      setExperiences([])
    } finally {
      setExpLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedProduct?.id) {
      setExperiences([])
      return
    }
    loadExperiences(selectedProduct.id)
  }, [selectedProduct?.id])

  async function addProduct() {
    if (!profile) return
    const name = newName.trim()
    const brand = newBrand.trim() || null
    if (!name) {
      setAddProductError('Ürün adı boş olamaz.')
      return
    }

    setAddingProduct(true)
    setAddProductError(null)
    try {
      let image_url: string | null = null
      if (newPhoto) {
        image_url = await uploadToBucket(newPhoto, 'products')
      }

      const { data, error } = await supabase
        .from('products')
        .insert({ name, brand, image_url })
        .select('id,name,brand,image_url')
        .single()

      if (error) throw error

      // refresh list + select new product
      setNewName('')
      setNewBrand('')
      setNewPhoto(null)
      await loadProducts(q)
      setSelectedProduct(data as Product)
    } catch (e: any) {
      setAddProductError(e?.message ?? 'Ürün eklenemedi.')
    } finally {
      setAddingProduct(false)
    }
  }

  async function submitExperience() {
    if (!profile) return
    if (!selectedProduct?.id) return

    setSubmittingExp(true)
    setSubmitExpError(null)
    try {
      let image_url: string | null = null
      if (expPhoto) {
        image_url = await uploadToBucket(expPhoto, 'experiences')
      }

      const payload = {
        product_id: selectedProduct.id,
        user_id: profile.user_id,
        rating: Math.max(1, Math.min(10, Number(rating) || 5)),
        pros: pros.trim() ? pros.trim() : null,
        cons: cons.trim() ? cons.trim() : null,
        would_buy_again: !!wba,
        image_url,
      }

      const { error } = await supabase.from('experiences').insert(payload)
      if (error) throw error

      setPros('')
      setCons('')
      setWba(true)
      setExpPhoto(null)
      await loadExperiences(selectedProduct.id)
    } catch (e: any) {
      setSubmitExpError(e?.message ?? 'Deneyim gönderilemedi.')
    } finally {
      setSubmittingExp(false)
    }
  }

  const selectedLabel = useMemo(() => {
    if (!selectedProduct) return ''
    return `${selectedProduct.brand ? `${selectedProduct.brand} — ` : ''}${selectedProduct.name}`
  }, [selectedProduct])

  const needsUsername = !profileLoading && authUserId && !profile

  return (
    <div className="page">
      <div className="topbar">
        <div className="brand">
          <div className="title">Aramızda</div>
          <div className="sub">
            {selectedProduct ? `Seçili ürün: ${selectedLabel}` : 'Ürün seç veya ekle.'}
          </div>
        </div>

        <div className="userbox">
          <div className="userpill">
            <div className="avatar">{profile?.username?.slice(0, 1)?.toUpperCase() || '•'}</div>
            <div className="uname">{profile?.username || '—'}</div>
          </div>
          <button className="btn ghost" onClick={logout} type="button">
            Çıkış
          </button>
        </div>
      </div>

      {profileError && (
        <div className="notice error">
          {profileError}
        </div>
      )}

      <div className="grid">
        {/* LEFT */}
        <div className="col">
          <div className="card">
            <div className="cardTitle">Ürün Ara</div>
            <div className="row">
              <input
                className="input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ürün adı…"
              />
              <button className="btn" type="button" onClick={() => loadProducts(q)} disabled={productsLoading}>
                Ara
              </button>
            </div>

            {productsError && <div className="notice error">{productsError}</div>}

            <div className="list">
              {productsLoading ? (
                <div className="muted">Yükleniyor…</div>
              ) : products.length === 0 ? (
                <div className="muted">Sonuç yok.</div>
              ) : (
                products.map((p) => {
                  const active = selectedProduct?.id === p.id
                  return (
                    <button
                      key={p.id}
                      className={`item ${active ? 'active' : ''}`}
                      type="button"
                      onClick={() => setSelectedProduct(p)}
                    >
                      <div className="itemTop">
                        <div className="itemName">{p.name}</div>
                        {p.image_url ? <img className="thumb" src={p.image_url} alt="" /> : null}
                      </div>
                      <div className="muted">{p.brand ?? ''}</div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <div className="card">
            <div className="cardTitle">Ürün Ekle</div>
            <div className="muted small">Yeni ürün ve fotoğraf ekleyebilirsin.</div>

            {addProductError && <div className="notice error">{addProductError}</div>}

            <input
              className="input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ürün adı"
              disabled={!profile || addingProduct}
            />

            <input
              className="input"
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              placeholder="Marka (opsiyonel)"
              disabled={!profile || addingProduct}
            />

            <label className="fileRow">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setNewPhoto(e.target.files?.[0] ?? null)}
                disabled={!profile || addingProduct}
              />
              <span className="muted">{newPhoto ? newPhoto.name : 'Ürün fotoğrafı seç (opsiyonel)'}</span>
            </label>

            <button className="btn" type="button" onClick={addProduct} disabled={!profile || addingProduct}>
              {addingProduct ? 'Ekleniyor…' : 'Ürün Ekle'}
            </button>
          </div>
        </div>

        {/* RIGHT */}
        <div className="col">
          <div className="card">
            <div className="cardTitle">Deneyim Ekle</div>

            {!selectedProduct ? (
              <div className="notice">Önce soldan bir ürün seç.</div>
            ) : (
              <>
                <div className="muted small" style={{ marginBottom: 10 }}>{selectedLabel}</div>

                <label className="muted small">Puan</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={10}
                  value={rating}
                  onChange={(e) => setRating(Math.max(1, Math.min(10, Number(e.target.value) || 5)))}
                  disabled={!profile || submittingExp}
                />

                <label className="muted small">Artılar</label>
                <textarea
                  className="textarea"
                  value={pros}
                  onChange={(e) => setPros(e.target.value)}
                  placeholder="Kısa ve net…"
                  disabled={!profile || submittingExp}
                />

                <label className="muted small">Eksiler</label>
                <textarea
                  className="textarea"
                  value={cons}
                  onChange={(e) => setCons(e.target.value)}
                  placeholder="Kısa ve net…"
                  disabled={!profile || submittingExp}
                />

                <label className="checkRow">
                  <input
                    type="checkbox"
                    checked={wba}
                    onChange={(e) => setWba(e.target.checked)}
                    disabled={!profile || submittingExp}
                  />
                  <span>Tekrar alırım</span>
                </label>

                <label className="fileRow">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setExpPhoto(e.target.files?.[0] ?? null)}
                    disabled={!profile || submittingExp}
                  />
                  <span className="muted">{expPhoto ? expPhoto.name : 'Deneyim fotoğrafı seç (opsiyonel)'}</span>
                </label>

                {submitExpError && <div className="notice error">{submitExpError}</div>}

                <button className="btn" type="button" onClick={submitExperience} disabled={!profile || submittingExp}>
                  {submittingExp ? 'Gönderiliyor…' : 'Gönder'}
                </button>
              </>
            )}
          </div>

          <div className="card">
            <div className="cardTitle">Son Deneyimler</div>

            {!selectedProduct ? (
              <div className="muted">Deneyimleri görmek için ürün seç.</div>
            ) : expLoading ? (
              <div className="muted">Yükleniyor…</div>
            ) : expError ? (
              <div className="notice error">{expError}</div>
            ) : experiences.length === 0 ? (
              <div className="muted">Henüz deneyim yok.</div>
            ) : (
              <div className="expList">
                {experiences.map((x) => (
                  <div key={x.id} className="exp">
                    <div className="expTop">
                      <div className="expUser">
                        <div className="expAvatar">
                          {(x.profile?.username || '?').slice(0, 1).toUpperCase()}
                        </div>
                        <div className="expUname">{x.profile?.username ?? '—'}</div>
                      </div>
                      <div className="expMeta">
                        <div className="badge">⭐ {x.rating}</div>
                        <div className="muted small">{new Date(x.created_at).toLocaleString('tr-TR')}</div>
                      </div>
                    </div>

                    {x.image_url ? <img className="expImg" src={x.image_url} alt="" /> : null}

                    {x.pros ? (
                      <div className="block">
                        <div className="muted small"><b>Artılar</b></div>
                        <div className="text">{x.pros}</div>
                      </div>
                    ) : null}

                    {x.cons ? (
                      <div className="block">
                        <div className="muted small"><b>Eksiler</b></div>
                        <div className="text">{x.cons}</div>
                      </div>
                    ) : null}

                    <div className="muted small">
                      Tekrar alırım: <b>{x.would_buy_again ? 'Evet' : 'Hayır'}</b>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* USERNAME GATE */}
      {needsUsername ? (
        <div className="modalBack">
          <div className="modal">
            <div className="modalTitle">Kullanıcı adı belirle</div>
            <div className="muted small" style={{ marginBottom: 10 }}>
              Yorumlar anonim olmayacak. Bu isim yorumlarda görünecek.
            </div>

            <input
              className="input"
              value={usernameDraft}
              onChange={(e) => setUsernameDraft(e.target.value)}
              placeholder="örn: ulas, ulas.demir"
              autoFocus
              disabled={savingUsername}
            />

            <button className="btn" type="button" onClick={saveUsername} disabled={savingUsername}>
              {savingUsername ? 'Kaydediliyor…' : 'Kaydet'}
            </button>

            {profileError ? <div className="notice error" style={{ marginTop: 10 }}>{profileError}</div> : null}
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 18px;
          background: radial-gradient(1200px 700px at 20% 10%, rgba(255,255,255,0.16), transparent 60%),
                      radial-gradient(1200px 700px at 80% 10%, rgba(255,255,255,0.12), transparent 60%),
                      linear-gradient(135deg, #c471f5 0%, #fa71cd 100%);
          color: rgba(255,255,255,0.92);
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.18);
          background: rgba(255,255,255,0.14);
          backdrop-filter: blur(18px);
          margin-bottom: 14px;
        }

        .brand .title {
          font-weight: 800;
          font-size: 18px;
          letter-spacing: 0.2px;
        }
        .brand .sub {
          opacity: 0.8;
          font-size: 12px;
          margin-top: 2px;
        }

        .userbox {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .userpill {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.18);
          background: rgba(255,255,255,0.10);
        }
        .avatar {
          width: 28px;
          height: 28px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          font-weight: 800;
          background: rgba(255,255,255,0.18);
          border: 1px solid rgba(255,255,255,0.18);
        }
        .uname {
          font-weight: 700;
          font-size: 13px;
          opacity: 0.95;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          align-items: start;
        }
        .col {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .card {
          padding: 14px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.18);
          background: rgba(255,255,255,0.14);
          backdrop-filter: blur(18px);
        }

        .cardTitle {
          font-weight: 800;
          font-size: 14px;
          margin-bottom: 10px;
        }

        .row {
          display: flex;
          gap: 10px;
          margin-bottom: 10px;
        }

        .input, .textarea {
          width: 100%;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.16);
          background: rgba(0,0,0,0.12);
          color: rgba(255,255,255,0.92);
          outline: none;
          padding: 10px 12px;
        }
        .textarea {
          min-height: 84px;
          resize: vertical;
        }

        .btn {
          border: 0;
          border-radius: 14px;
          padding: 10px 14px;
          font-weight: 800;
          cursor: pointer;
          background: rgba(255,255,255,0.88);
          color: rgba(30, 10, 40, 0.95);
        }
        .btn.ghost {
          background: rgba(255,255,255,0.10);
          color: rgba(255,255,255,0.92);
          border: 1px solid rgba(255,255,255,0.18);
        }

        .list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 420px;
          overflow: auto;
          padding-right: 2px;
        }

        .item {
          text-align: left;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(0,0,0,0.10);
          padding: 12px;
          cursor: pointer;
        }
        .item.active {
          border-color: rgba(255,255,255,0.35);
          background: rgba(255,255,255,0.12);
        }

        .itemTop {
          display: flex;
          justify-content: space-between;
          align-items: start;
          gap: 10px;
        }
        .itemName {
          font-weight: 800;
          font-size: 14px;
        }
        .thumb {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          object-fit: cover;
          border: 1px solid rgba(255,255,255,0.18);
        }

        .muted {
          opacity: 0.8;
        }
        .small {
          font-size: 12px;
        }

        .notice {
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.18);
          background: rgba(0,0,0,0.12);
          margin-bottom: 10px;
        }
        .notice.error {
          background: rgba(255, 0, 90, 0.12);
          border-color: rgba(255, 0, 90, 0.24);
        }

        .checkRow {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 10px 0;
          font-weight: 700;
        }

        .fileRow {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.16);
          background: rgba(0,0,0,0.12);
          margin-bottom: 10px;
        }
        .fileRow input[type="file"] {
          width: 140px;
        }

        .expList {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .exp {
          padding: 12px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(0,0,0,0.10);
        }
        .expTop {
          display: flex;
          justify-content: space-between;
          align-items: start;
          gap: 10px;
          margin-bottom: 10px;
        }
        .expUser {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .expAvatar {
          width: 30px;
          height: 30px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          font-weight: 900;
          background: rgba(255,255,255,0.18);
          border: 1px solid rgba(255,255,255,0.18);
        }
        .expUname {
          font-weight: 900;
        }
        .expMeta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
        }
        .badge {
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.18);
          background: rgba(255,255,255,0.10);
          font-weight: 900;
        }
        .expImg {
          width: 100%;
          max-height: 320px;
          object-fit: cover;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.18);
          margin: 8px 0 10px;
        }
        .block {
          margin-top: 10px;
        }
        .text {
          white-space: pre-wrap;
        }

        .modalBack {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          display: grid;
          place-items: center;
          padding: 16px;
        }
        .modal {
          width: 100%;
          max-width: 420px;
          padding: 16px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.18);
          background: rgba(255,255,255,0.16);
          backdrop-filter: blur(18px);
          color: rgba(255,255,255,0.92);
        }
        .modalTitle {
          font-weight: 950;
          font-size: 16px;
          margin-bottom: 10px;
        }

        @media (max-width: 980px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}