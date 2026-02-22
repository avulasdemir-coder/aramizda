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
    <div style={{ padding: 40 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* HEADER */}
        <div style={header}>
          <h1 style={logo}>Aramızda</h1>
          <div>
            <span style={{ marginRight: 15, fontSize: 14 }}>
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
            <input placeholder="Ürün adı yaz..." style={input} />
            <button style={primaryBtn}>Ara</button>
          </div>
        </div>

        {/* REVIEWS */}
        <div style={card}>
          <h2 style={title}>Son Deneyimler</h2>

          <div style={innerCard}>
            <div style={{ fontWeight: 600 }}>
              Cerave Nemlendirici
            </div>
            <div style={{ marginTop: 6, color: '#f4b400' }}>
              ⭐⭐⭐⭐☆
            </div>

            <div style={{ marginTop: 12 }}>
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

          <textarea
            placeholder="Artılar"
            style={{ ...input, height: 90 }}
          />

          <textarea
            placeholder="Eksiler"
            style={{ ...input, height: 90 }}
          />

          <button style={{ ...primaryBtn, marginTop: 18 }}>
            Kaydet
          </button>
        </div>

      </div>
    </div>
  )
}

/* ===== STYLES ===== */

const header: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 40
}

const logo: React.CSSProperties = {
  margin: 0,
  fontWeight: 800,
  fontSize: 28,
  background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent'
}

const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 22,
  padding: 28,
  marginBottom: 28,
  boxShadow: 'var(--shadow)'
}

const innerCard: React.CSSProperties = {
  background: 'var(--card-2)',
  borderRadius: 18,
  padding: 20
}

const title: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 18,
  fontWeight: 700
}

const input: React.CSSProperties = {
  width: '100%',
  padding: 14,
  borderRadius: 16,
  border: '1px solid var(--border)',
  outline: 'none',
  marginBottom: 12
}

const primaryBtn: React.CSSProperties = {
  background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
  color: 'white',
  border: 'none',
  padding: '12px 20px',
  borderRadius: 16,
  cursor: 'pointer',
  fontWeight: 600
}

const secondaryBtn: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--brand-1)',
  border: '1px solid var(--brand-1)',
  padding: '8px 16px',
  borderRadius: 16,
  cursor: 'pointer',
  fontWeight: 600
}