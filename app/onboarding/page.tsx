'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const OPTIONS = ['18-24', '25-34', '35-44', '45-54', '55+'] as const

export default function OnboardingPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<string>('')

  useEffect(() => {
    const run = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user
      if (!user) {
        window.location.href = '/'
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('age_range')
        .eq('id', user.id)
        .single()

      // Doluysa onboarding'e gerek yok
      if (profile?.age_range) {
        window.location.href = '/dashboard'
        return
      }

      setLoading(false)
    }

    run()
  }, [])

  const save = async () => {
    if (!selected) return
    setSaving(true)

    const { data: sessionData } = await supabase.auth.getSession()
    const user = sessionData.session?.user
    if (!user) {
      window.location.href = '/'
      return
    }

    await supabase
      .from('profiles')
      .update({ age_range: selected })
      .eq('id', user.id)

    window.location.href = '/dashboard'
  }

  if (loading) return <div style={{ padding: 40 }}>Yükleniyor...</div>

  return (
    <div style={{ padding: 40, maxWidth: 600, margin: '0 auto' }}>
      <h1>Yaş aralığını seç</h1>
      <p>Bu bilgi, deneyimleri sana göre filtrelemek için lazım.</p>

      <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
        {OPTIONS.map((opt) => (
          <label
            key={opt}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              padding: 12,
              border: '1px solid #ddd',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="age"
              value={opt}
              checked={selected === opt}
              onChange={() => setSelected(opt)}
            />
            <span>{opt}</span>
          </label>
        ))}
      </div>

      <button
        onClick={save}
        disabled={!selected || saving}
        style={{ marginTop: 20 }}
      >
        {saving ? 'Kaydediliyor...' : 'Devam'}
      </button>
    </div>
  )
}