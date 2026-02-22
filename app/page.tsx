'use client'

import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setErr('ENV eksik: NEXT_PUBLIC_SUPABASE_URL veya NEXT_PUBLIC_SUPABASE_ANON_KEY')
      return
    }

    supabase.auth.getUser().then(({ data, error }) => {
      if (error) setErr(error.message)
      setUser(data.user)
    })
  }, [])

  if (err) return <div style={{ padding: 40 }}>Hata: {err}</div>

  return (
  <div style={{ padding: 40 }}>
    {user ? (
      <>
        <h1>Giriş yapıldı: {user.email}</h1>
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
              options: {
                redirectTo: window.location.origin
              }
            })
          }
        >
          Google ile Giriş Yap
        </button>
      </>
    )}
  </div>
)