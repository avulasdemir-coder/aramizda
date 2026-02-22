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
    <div style={{ padding: 40 }}>
      <h1>Uygulama Alanı</h1>
      <p>Giriş yapan: {email}</p>
      <button onClick={logout}>Çıkış yap</button>
    </div>
  )
}