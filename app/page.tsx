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

      const user = data.session?.user
      if (!user) return

      // Profil var mı kontrol et
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      // Yoksa oluştur
      if (!profile) {
        await supabase.from('profiles').insert({
          id: user.id,
          email: user.email,
          age_range: null
        })
      }

      window.location.href = '/dashboard'
    }

    checkUser()
  }, [])

  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Giriş yapılmadı</h1>
      <button onClick={login}>Google ile Giriş Yap</button>
    </div>
  )
}