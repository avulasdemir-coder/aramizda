'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Home() {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
    })
  }, [])

  return (
    <div style={{ padding: 40 }}>
      {email ? (
        <>
          <h1>Giriş yapıldı: {email}</h1>
          <button onClick={() => supabase.auth.signOut()}>
            Çıkış yap
          </button>
        </>
      ) : (
        <>
          <h1>Giriş yapılmadı</h1>
          <button
            onClick={() =>
              supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin },
              })
            }
          >
            Google ile Giriş Yap
          </button>
        </>
      )}
    </div>
  )
}