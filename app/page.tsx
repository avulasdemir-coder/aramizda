'use client'

import { useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Home() {
  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user) {
        window.location.href = '/app'
      }
    }
    checkUser()
  }, [])

  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/app' },
    })
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Giriş yapılmadı</h1>
      <button onClick={login}>Google ile Giriş Yap</button>
    </div>
  )
}