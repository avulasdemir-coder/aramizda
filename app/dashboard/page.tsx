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
      background: 'linear-gradient(180deg, #7f5af0 0%, #2cb67d 100%)',
      padding: 30
    }}>

      <div style={{
        maxWidth: 1000,
        margin: '0 auto'
      }}>

        {/* HEADER */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 30,
          color: 'white'
        }}>
          <h1 style={{ margin: 0, fontWeight: 800 }}>Aramızda</h1>
          <div>
            <span style={{ marginRight: 15 }}>{email}</span>
            <button style={logoutBtn} onClick={logout}>Çıkış</button>
          </div>
        </div>

        {/* CARD */}
        <div style={glassCard}>
          <h2 style={cardTitle}>Ürün Ara</h2>
          <div style={{ display: 'flex', gap: 10 }}>
            <input placeholder="Ürün adı yaz..." style={input} />
            <button style={gradientBtn}>Ara</button>
          </div>
        </div>

        <div style={glassCard}>
          <h2 style={cardTitle}>Son Deneyimler</h2>

          <div style={reviewCard}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              Cerave Nemlendirici
            </div>
            <div style={{ marginTop: 6 }}>
              ⭐⭐⭐⭐☆
            </div>
            <div style={{ marginTop: 10 }}>
              Cildi yumuşatıyor ama biraz ağır.
            </div>

            <div style={{ marginTop: 15 }}>
              <input placeholder="Yorum yaz..." style={input} />
              <button style={{ ...gradientBtn, marginTop: 8 }}>
                Gönder
              </button>
            </div>
          </div>
        </div>

        <div style={glassCard}>
          <h2 style={cardTitle}>Deneyim Ekle</h2>

          <select style={input}>
            {[5,4,3,2,1].map(n => <option key={n}>{n}</option>)}
          </select>

          <textarea placeholder="Artılar" style={{ ...input, height: 80 }} />
          <textarea placeholder="Eksiler" style={{ ...input, height: 80 }} />

          <button style={{ ...gradientBtn, marginTop: 10 }}>
            Kaydet
          </button>
        </div>

      </div>
    </div>
  )
}

const glassCard = {
  background: 'rgba(255,255,255,0.15)',
  backdropFilter: 'blur(15px)',
  padding: 25,
  borderRadius: 25,
  marginBottom: 20,
  color: 'white',
  boxShadow: '0 15px 35px rgba(0,0,0,0.2)'
}

const reviewCard = {
  background: 'rgba(255,255,255,0.2)',
  padding: 20,
  borderRadius: 20,
  marginTop: 10
}

const cardTitle = {
  marginTop: 0,
  marginBottom: 15,
  fontWeight: 700
}

const input = {
  width: '100%',
  padding: 12,
  borderRadius: 15,
  border: 'none',
  outline: 'none'
}

const gradientBtn = {
  background: 'linear-gradient(135deg, #ff7eb3, #ff758c)',
  color: 'white',
  border: 'none',
  padding: '12px 20px',
  borderRadius: 15,
  cursor: 'pointer',
  fontWeight: 700
}

const logoutBtn = {
  background: 'white',
  color: '#7f5af0',
  border: 'none',
  padding: '8px 14px',
  borderRadius: 12,
  cursor: 'pointer',
  fontWeight: 600
}