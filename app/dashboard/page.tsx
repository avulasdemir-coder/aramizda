'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)

  useEffect(() => {
    loadProfile()
    loadProducts()
  }, [])

  async function loadProfile() {
    const { data } = await supabase.auth.getUser()
    if (!data.user) return

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', data.user.id)
      .single()

    setProfile(profileData)
  }

  async function loadProducts() {
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })

    setProducts(data || [])
  }

  async function addProduct() {
    if (!profile?.is_admin) return alert('Yetkin yok')

    let image_url = null

    if (photo) {
      const filePath = `products/${Date.now()}-${photo.name}`
      const { error } = await supabase.storage
        .from('uploads')
        .upload(filePath, photo)

      if (error) return alert(error.message)

      const { data } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath)

      image_url = data.publicUrl
    }

    const { error } = await supabase.from('products').insert({
      name,
      brand,
      image_url
    })

    if (error) return alert(error.message)

    setName('')
    setBrand('')
    setPhoto(null)
    loadProducts()
  }

  async function logout() {
    await supabase.auth.signOut()
    location.reload()
  }

  return (
    <div className="page">
      <div className="navbar">
        <div className="logoArea">
          <img src="/logo.png" className="logo" />
          <div className="brand">ARAMIZDA</div>
        </div>

        <div className="userArea">
          <div className="username">{profile?.username}</div>
          <button className="ghostBtn" onClick={logout}>Çıkış</button>
        </div>
      </div>

      <div className="grid">
        {profile?.is_admin && (
          <div className="card">
            <h3>Ürün Ekle</h3>
            <input
              placeholder="Ürün adı"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <input
              placeholder="Marka"
              value={brand}
              onChange={e => setBrand(e.target.value)}
            />
            <input
              type="file"
              onChange={e => setPhoto(e.target.files?.[0] || null)}
            />
            <button onClick={addProduct}>Ekle</button>
          </div>
        )}

        <div className="card">
          <h3>Ürünler</h3>
          {products.map(p => (
            <div
              key={p.id}
              className={`product ${selectedProduct?.id === p.id ? 'active' : ''}`}
              onClick={() => setSelectedProduct(p)}
            >
              {p.image_url && <img src={p.image_url} />}
              <div>
                <strong>{p.name}</strong>
                <div className="muted">{p.brand}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 20px;
          background: linear-gradient(135deg,#c471f5,#fa71cd);
          color:white;
        }

        .navbar {
          display:flex;
          justify-content:space-between;
          align-items:center;
          padding:15px 20px;
          border-radius:20px;
          backdrop-filter:blur(20px);
          background:rgba(255,255,255,0.12);
          border:1px solid rgba(255,255,255,0.2);
          margin-bottom:30px;
        }

        .logoArea {
          display:flex;
          align-items:center;
          gap:12px;
        }

        .logo {
          width:40px;
        }

        .brand {
          font-size:18px;
          letter-spacing:0.2em;
          font-weight:500;
        }

        .userArea {
          display:flex;
          gap:15px;
          align-items:center;
        }

        .username {
          font-weight:600;
        }

        .ghostBtn {
          background:transparent;
          border:1px solid rgba(255,255,255,0.3);
          padding:6px 12px;
          border-radius:20px;
          color:white;
        }

        .grid {
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:30px;
        }

        .card {
          padding:20px;
          border-radius:20px;
          backdrop-filter:blur(20px);
          background:rgba(255,255,255,0.12);
          border:1px solid rgba(255,255,255,0.2);
        }

        input {
          width:100%;
          margin-bottom:10px;
          padding:8px;
          border-radius:10px;
          border:none;
        }

        button {
          padding:8px 15px;
          border-radius:10px;
          border:none;
          cursor:pointer;
        }

        .product {
          display:flex;
          gap:12px;
          align-items:center;
          padding:10px;
          border-radius:15px;
          cursor:pointer;
        }

        .product.active {
          background:rgba(255,255,255,0.2);
        }

        .product img {
          width:50px;
          height:50px;
          object-fit:cover;
          border-radius:10px;
        }

        .muted {
          opacity:0.7;
          font-size:13px;
        }

        @media(max-width:900px){
          .grid{grid-template-columns:1fr;}
        }
      `}</style>
    </div>
  )
}