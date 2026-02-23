'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [needsNickname, setNeedsNickname] = useState(false)
  const [nickname, setNickname] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      const user = data.session?.user

      if (!user) {
        setLoading(false)
        return
      }

      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', user.id)
        .single()

      if (!profile?.nickname) {
        setNeedsNickname(true)
      } else {
        window.location.href = '/dashboard'
      }

      setLoading(false)
    }

    init()
  }, [])

  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  const saveNickname = async () => {
    if (!nickname.trim() || !userId) return

    await supabase
      .from('profiles')
      .update({ nickname: nickname.trim() })
      .eq('id', userId)

    window.location.href = '/dashboard'
  }

  if (loading) return <div style={{ padding: 40 }}>Yükleniyor...</div>

  if (needsNickname) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Takma Ad Seç</h2>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="örn: ciltsever"
        />
        <br /><br />
        <button onClick={saveNickname}>Devam</button>
      </div>
    )
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Giriş Yap</h1>
      <button onClick={login}>Google ile Giriş Yap</button>
    </div>
  )
}