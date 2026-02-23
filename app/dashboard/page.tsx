'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Product = {
  id: number
  title: string
  category: string
}

type Experience = {
  id: number
  rating: number
  pros: string
  cons: string
  would_buy_again: boolean
  created_at: string
  product: { title: string }
}

export default function Dashboard() {
  const [products, setProducts] = useState<Product[]>([])
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [rating, setRating] = useState(5)
  const [pros, setPros] = useState('')
  const [cons, setCons] = useState('')
  const [wba, setWba] = useState(false)

  useEffect(() => {
    loadExperiences()
  }, [])

  async function loadExperiences() {
    const { data } = await supabase
      .from('experiences')
      .select('*, product:products(title)')
      .order('created_at', { ascending: false })

    if (data) setExperiences(data as any)
  }

  async function searchProducts() {
    const { data } = await supabase
      .from('products')
      .select('*')
      .ilike('title', `%${search}%`)

    if (data) setProducts(data)
  }

  async function addExperience() {
    if (!selectedProduct) return

    await supabase.from('experiences').insert({
      product_id: selectedProduct,
      rating,
      pros,
      cons,
      would_buy_again: wba
    })

    setPros('')
    setCons('')
    setRating(5)
    setWba(false)
    loadExperiences()
  }

  return (
    <div className="page">
      <div className="card header">
        <h2>Profil</h2>
      </div>

      <div className="grid">
        <div className="card">
          <h3>Ürün Ara</h3>
          <input
            placeholder="örn: elidor şampuan"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button onClick={searchProducts}>Ara</button>

          {products.map(p => (
            <div
              key={p.id}
              className={`product ${selectedProduct === p.id ? 'selected' : ''}`}
              onClick={() => setSelectedProduct(p.id)}
            >
              {p.title}
              <div className="muted">{p.category}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>Deneyim Ekle</h3>
          {!selectedProduct && (
            <div className="muted">Önce soldan bir ürün seç.</div>
          )}

          <label>Puan</label>
          <select value={rating} onChange={e => setRating(Number(e.target.value))}>
            {[1,2,3,4,5].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>

          <label>Artılar</label>
          <textarea value={pros} onChange={e => setPros(e.target.value)} />

          <label>Eksiler</label>
          <textarea value={cons} onChange={e => setCons(e.target.value)} />

          <label>
            <input
              type="checkbox"
              checked={wba}
              onChange={e => setWba(e.target.checked)}
            />
            Tekrar alırım
          </label>

          <button onClick={addExperience}>Gönder</button>
        </div>
      </div>

      <div className="card">
        <h3>Son Deneyimler</h3>
        {experiences.length === 0 && (
          <div className="muted">Henüz deneyim yok.</div>
        )}

        {experiences.map(exp => (
          <div key={exp.id} className="review">
            <strong>{exp.product?.title}</strong>
            <div>⭐ {exp.rating}</div>
            <div><b>Artılar:</b> {exp.pros}</div>
            <div><b>Eksiler:</b> {exp.cons}</div>
            {exp.would_buy_again && <div className="muted">Tekrar alırım</div>}
          </div>
        ))}
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: linear-gradient(135deg,#c471f5,#fa71cd);
          padding: 40px;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }
        .card {
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(20px);
          padding: 20px;
          border-radius: 20px;
          color: white;
        }
        input, textarea, select {
          width: 100%;
          margin-bottom: 12px;
          padding: 8px;
          border-radius: 8px;
          border: none;
        }
        button {
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
        }
        .product {
          padding: 8px;
          margin-bottom: 8px;
          cursor: pointer;
          border-radius: 8px;
        }
        .product.selected {
          background: rgba(255,255,255,0.25);
        }
        .muted {
          opacity: 0.7;
          font-size: 14px;
        }
        .review {
          margin-bottom: 16px;
        }
      `}</style>
    </div>
  )
}