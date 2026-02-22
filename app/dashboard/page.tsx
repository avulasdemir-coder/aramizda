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
    const run = async () => {
      const { data } = await supabase.auth.getSession()
      const user = data.session?.user
      if (!user) {
        window.location.href = '/'
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('age_range')
        .eq('id', user.id)
        .single()

      if (!profile?.age_range) {
        window.location.href = '/onboarding'
        return
      }

      setEmail(user.email ?? null)
      setLoading(false)
    }

    run()
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) return <div style={{ padding: 40 }}>Yükleniyor...</div>

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 40,
        }}
      >
        <h1>Dashboard</h1>
        <div>
          <span style={{ marginRight: 20 }}>{email}</span>
          <button onClick={logout}>Çıkış yap</button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 20 }}>
        <div style={{ padding: 20, border: '1px solid #ddd', borderRadius: 8 }}>
          <h2>Ürün Ara</h2>
          <p>Buraya arama kutusu gelecek.</p>
        </div>

        <div style={{ padding: 20, border: '1px solid #ddd', borderRadius: 8 }}>
          <h2>Son Deneyimler</h2>
          <p>Buraya son paylaşımlar gelecek.</p>
        </div>

        <div style={{ padding: 20, border: '1px solid #ddd', borderRadius: 8 }}>
          <h2>Deneyim Ekle</h2>
          <p>Buraya deneyim ekleme formu gelecek.</p>
        </div>
      </div>
    </div>
  )
}