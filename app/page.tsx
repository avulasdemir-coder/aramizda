'use client'

import { useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Home() {
  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession()
      const user = data.session?.user
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, age_range')
        .eq('id', user.id)
        .single()

      if (!profile) {
        await supabase.from('profiles').insert({
          id: user.id,
          email: user.email,
          age_range: null,
        })
        window.location.href = '/onboarding'
        return
      }

      if (!profile.age_range) {
        window.location.href = '/onboarding'
        return
      }

      window.location.href = '/dashboard'
    }

    run()
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