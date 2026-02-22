'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function DashboardPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      const u = data.session?.user
      if (!u) {
        window.location.href = '/'
        return
      }
      setEmail(u.email ?? null)
      setLoading(false)
    }
    init()
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) return <div style={{ padding: 40 }}>Yükleniyor...</div>

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fdf4f6',
      padding: 30
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* HEADER */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 40
        }}>
          <h1 style={{
            margin: 0,
            fontWeight: 800,
            color: '#e84a78',
            letterSpacing: -0.5
          }}>
            Aramızda
          </h1>

          <div>
            <span style={{ marginRight: 15, fontSize: 14, color: '#555' }}>
              {email}
            </span>
            <button style={secondaryBtn} onClick={logout}>
              Çıkış
            </button>
          </div>
        </div>

        {/* PRODUCT SEARCH */}
        <div style={card}>
          <h2 style={title}>Ürün Ara</h2>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              placeholder="Örn: Cerave Nemlendirici"
              style={input}
            />
            <button style={primaryBtn}>Ara</button>
          </div>
        </div>

        {/* REVIEWS */}
        <div style={card}>
          <h2 style={title}>Son Deneyimler</h2>

          <div style={reviewCard}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              Cerave Nemlendirici
            </div>

            <div style={{ marginTop: 6, color: '#f4b400' }}>
              ⭐⭐⭐⭐☆
            </div>

            <div style={{ marginTop: 10, color: '#555' }}>
              Cildi yumuşatıyor ama biraz ağır.
            </div>

            <div style={{ marginTop: 15 }}>
              <input placeholder="Yorum yaz..." style={input} />
              <button style={{ ...primaryBtn, marginTop: 10 }}>
                Gönder
              </button>
            </div>
          </div>

        </div>

        {/* ADD REVIEW */}
        <div style={card}>
          <h2 style={title}>Deneyim Ekle</h2>

          <select style={input}>
            {[5,4,3,2,1].map(n => <option key={n}>{n}</option>)}
          </select>

          <textarea placeholder="Artılar" style={{ ...input, height: 90 }} />
          <textarea placeholder="Eksiler" style={{ ...input, height: 90 }} />

          <button style={{ ...primaryBtn, marginTop: 15 }}>
            Kaydet
          </button>
        </div>

      </div>
    </div>
  )
}

const card = {
  background: 'white',
  padding: 28,
  borderRadius: 24,
  marginBottom: 25,
  boxShadow: '0 20px 40px rgba(232,74,120,0.08)'
}

const reviewCard = {
  background: '#fff6f8',
  padding: 20,
  borderRadius: 20,
  marginTop: 15
}

const title = {
  marginTop: 0,
  marginBottom: 18,
  fontWeight: 700,
  color: '#333'
}

const input = {
  width: '100%',
  padding: 14,
  borderRadius: 16,
  border: '1px solid #f1d7dd',
  outline: 'none',
  fontSize: 14
}

const primaryBtn = {
  background: '#e84a78',
  color: 'white',
  border: 'none',
  padding: '14px 22px',
  borderRadius: 18,
  cursor: 'pointer',
  fontWeight: 700
}

const secondaryBtn = {
  background: 'transparent',
  color: '#e84a78',
  border: '1px solid #e84a78',
  padding: '8px 16px',
  borderRadius: 16,
  cursor: 'pointer',
  fontWeight: 600
}