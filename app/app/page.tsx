'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AppPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession()
      const userEmail = data.session?.user?.email ?? null

      if (!userEmail) {
        window.location.href = '/'
        return
      }

      setEmail(userEmail)
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
      
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 40
      }}>
        <h1>Dashboard</h1>
        <div>
          <span style={{ marginRight: 20 }}>{email}</span>
          <button onClick={logout}>Çıkış yap</button>
        </div>
      </div>

      {/* Content Blocks */}
      <div style={{ display: 'grid', gap: 20 }}>

        <div style={{
          padding: 20,
          border: '1px solid #ddd',
          borderRadius: 8
        }}>
          <h2>Alan 1</h2>
          <p>Buraya içerik gelecek.</p>
        </div>

        <div style={{
          padding: 20,
          border: '1px solid #ddd',
          borderRadius: 8
        }}>
          <h2>Alan 2</h2>
          <p>Buraya içerik gelecek.</p>
        </div>

        <div style={{
          padding: 20,
          border: '1px solid #ddd',
          borderRadius: 8
        }}>
          <h2>Alan 3</h2>
          <p>Buraya içerik gelecek.</p>
        </div>

      </div>
    </div>
  )
}