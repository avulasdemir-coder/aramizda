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
    <div style={{ minHeight: '100vh', background: '#f4f6fb' }}>
      
      {/* HEADER */}
      <div style={{
        background: 'linear-gradient(135deg, #8f5cff, #ff7eb3)',
        padding: '30px 40px',
        color: 'white'
      }}>
        <div style={{
          maxWidth: 1000,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h1 style={{ margin: 0, fontWeight: 700 }}>Aramızda</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
            <span style={{ fontSize: 14 }}>{email}</span>
            <button
              onClick={logout}
              style={{
                background: 'white',
                color: '#8f5cff',
                border: 'none',
                padding: '8px 14px',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Çıkış
            </button>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{
        maxWidth: 1000,
        margin: '30px auto',
        padding: '0 20px'
      }}>

        {/* PRODUCT SEARCH CARD */}
        <div style={card}>
          <h2 style={title}>Ürün Ara</h2>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              placeholder="Örn: Cerave Nemlendirici"
              style={input}
            />
            <button style={primaryButton}>Ara</button>
          </div>
        </div>

        {/* REVIEWS CARD */}
        <div style={card}>
          <h2 style={title}>Son Deneyimler</h2>

          <div style={reviewCard}>
            <div style={{ fontWeight: 600 }}>Cerave — Nemlendirici</div>
            <div style={{ fontSize: 13, opacity: .6 }}>⭐ 4 / 5</div>
            <div style={{ marginTop: 8 }}>Cildi yumuşatıyor ama biraz ağır.</div>

            <div style={{ marginTop: 12 }}>
              <input placeholder="Yorum yaz..." style={input} />
              <button style={{ ...primaryButton, marginTop: 8 }}>Gönder</button>
            </div>
          </div>

        </div>

        {/* ADD REVIEW CARD */}
        <div style={card}>
          <h2 style={title}>Deneyim Ekle</h2>

          <select style={input}>
            {[5,4,3,2,1].map(n => <option key={n}>{n}</option>)}
          </select>

          <textarea placeholder="Artılar" style={{ ...input, height: 80 }} />
          <textarea placeholder="Eksiler" style={{ ...input, height: 80 }} />

          <button style={{ ...primaryButton, marginTop: 10 }}>Kaydet</button>
        </div>

      </div>
    </div>
  )
}

const card = {
  background: 'white',
  padding: 24,
  borderRadius: 20,
  marginBottom: 20,
  boxShadow: '0 15px 35px rgba(0,0,0,0.06)'
}

const reviewCard = {
  background: '#faf9ff',
  padding: 16,
  borderRadius: 16,
  marginTop: 10
}

const title = {
  marginTop: 0,
  marginBottom: 16
}

const input = {
  width: '100%',
  padding: 12,
  borderRadius: 12,
  border: '1px solid #e0e0e0',
  outline: 'none'
}

const primaryButton = {
  background: '#8f5cff',
  color: 'white',
  border: 'none',
  padding: '12px 18px',
  borderRadius: 12,
  cursor: 'pointer',
  fontWeight: 600
}