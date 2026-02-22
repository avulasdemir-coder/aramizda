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
      padding: 40,
      background: `
        radial-gradient(circle at 20% 30%, #f8d8ff 0%, transparent 40%),
        radial-gradient(circle at 80% 70%, #ffd6e8 0%, transparent 40%),
        linear-gradient(135deg, #efe7ff 0%, #ffeaf3 100%)
      `
    }}>

      <div style={{ maxWidth: 950, margin: '0 auto' }}>

        {/* HEADER */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 45
        }}>
          <h1 style={{
            margin: 0,
            fontWeight: 800,
            fontSize: 32,
            background: 'linear-gradient(90deg,#9b5cff,#ff5fa2)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Aramızda
          </h1>

          <div>
            <span style={{ marginRight: 18, color: '#555', fontSize: 14 }}>
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
          <div style={{ display: 'flex', gap: 12 }}>
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

            <div style={{ marginTop: 12, color: '#555' }}>
              Cildi yumuşatıyor ama biraz ağır.
            </div>

            <div style={{ marginTop: 18 }}>
              <input placeholder="Yorum yaz..." style={input} />
              <button style={{ ...primaryBtn, marginTop: 12 }}>
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

          <textarea placeholder="Artılar" style={{ ...input, height: 100 }} />
          <textarea placeholder="Eksiler" style={{ ...input, height: 100 }} />

          <button style={{ ...primaryBtn, marginTop: 18 }}>
            Kaydet
          </button>
        </div>

      </div>
    </div>
  )
}

const card = {
  background: 'rgba(255,255,255,0.9)',
  padding: 30,
  borderRadius: 28,
  marginBottom: 30,
  backdropFilter: 'blur(10px)',
  boxShadow: '0 20px 45px rgba(155,92,255,0.12)'
}

const reviewCard = {
  background: 'rgba(255,255,255,0.7)',
  padding: 22,
  borderRadius: 22,
  marginTop: 18
}

const title = {
  marginTop: 0,
  marginBottom: 20,
  fontWeight: 700,
  color: '#333'
}

const input = {
  width: '100%',
  padding: 16,
  borderRadius: 20,
  border: '1px solid #f0d6ff',
  outline: 'none',
  fontSize: 14,
  background: 'white'
}

const primaryBtn = {
  background: 'linear-gradient(135deg,#9b5cff,#ff5fa2)',
  color: 'white',
  border: 'none',
  padding: '14px 24px',
  borderRadius: 22,
  cursor: 'pointer',
  fontWeight: 700
}

const secondaryBtn = {
  background: 'transparent',
  color: '#9b5cff',
  border: '1px solid #9b5cff',
  padding: '8px 18px',
  borderRadius: 20,
  cursor: 'pointer',
  fontWeight: 600
}