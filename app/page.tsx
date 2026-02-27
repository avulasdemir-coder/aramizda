'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!supabaseUrl || !supabaseAnon) throw new Error('Supabase env eksik: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')

const supabase = createClient(supabaseUrl, supabaseAnon)

type Product = {
 id: string
  name: string
  brand: string
  category: string | null
  image_url: string | null
  created_by: string | null
}

type Profile = {
  user_id: string
  username: string | null
  avatar_url: string | null
}

type ExperienceRow = {
  id: string
  product_id: string
  user_id: string
  rating: number | null
  pros: string | null
  cons: string | null
  would_buy_again: boolean | null
  image_url: string | null
  created_at: string
}

type ExperienceView = ExperienceRow & {
  product?: Product | null
  author?: { username: string; avatar_url: string | null } | null
  comment_count?: number
}

type CommentRow = {
  id: string
  experience_id: string | null
  user_id: string
  parent_id: string | null
  body: string
  created_at: string
}

type CommentView = CommentRow & {
  author?: { username: string; avatar_url: string | null } | null
}

const CATEGORY_OPTIONS = ['Cilt Bakımı', 'Makyaj', 'Saç Bakımı', 'Parfüm', 'Güneş', 'Anne & Bebek', 'Takviye', 'Diğer'] as const

function firstSentence(s: string | null) {
  const t = (s ?? '').trim()
  if (!t) return ''

  const words = t.replace(/\s+/g, ' ').split(' ')
  const head = words.slice(0, 2).join(' ')
  return words.length > 2 ? head + '…' : head
}

function initials(name: string | null | undefined) {
  const n = (name || '').trim()
  if (!n) return '?'

  const parts = n.split(' ').filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function avatarColor(name: string | null | undefined) {
  const n = name || 'x'
  let hash = 0
  for (let i = 0; i < n.length; i++) {
    hash = n.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = ((hash % 360) + 360) % 360
  return `hsl(${hue}, 70%, 55%)`
}

export default function Page() {
  // auth
  const [userId, setUserId] = useState<string | null>(null)

  // profile
  const [profile, setProfile] = useState<Profile | null>(null)
  const [needsUsername, setNeedsUsername] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [usernameDraft, setUsernameDraft] = useState('')
  const [avatarDraft, setAvatarDraft] = useState<File | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileErr, setProfileErr] = useState<string | null>(null)

  // product search + list
  const [q, setQ] = useState('')
  const [pLoading, setPLoading] = useState(false)
  const [pErr, setPErr] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [selected, setSelected] = useState<Product | null>(null)
  const [productPhotoDraft, setProductPhotoDraft] = useState<File | null>(null)
  const [productPhotoSaving, setProductPhotoSaving] = useState(false)
  const [productPhotoMsg, setProductPhotoMsg] = useState<string | null>(null)

  // stats
  const [stats, setStats] = useState<Record<string, { avg: number | null; count: number; wbaPct: number | null }>>({})

  // add product
  const [brandChoice, setBrandChoice] = useState<string>('')
  const [brandCustom, setBrandCustom] = useState<string>('')
  const [newName, setNewName] = useState('')
  const [categoryChoice, setCategoryChoice] = useState<string>('')
  const [customCategory, setCustomCategory] = useState('')
  const [newPhoto, setNewPhoto] = useState<File | null>(null)
  const [addingProduct, setAddingProduct] = useState(false)
  const [addProductMsg, setAddProductMsg] = useState<string | null>(null)

  // add/edit experience
  const [ratingStr, setRatingStr] = useState<string>('') // ✅ 1-10
  const [pros, setPros] = useState('')
  const [cons, setCons] = useState('')
  const [wba, setWba] = useState<boolean | null>(null)
  const [expPhoto, setExpPhoto] = useState<File | null>(null)
  const [addingExp, setAddingExp] = useState(false)
  const [expMsg, setExpMsg] = useState<string | null>(null)
  const [editingExpId, setEditingExpId] = useState<string | null>(null)

  // recent experiences
  const [recent, setRecent] = useState<ExperienceView[]>([])
  const [recentLoading, setRecentLoading] = useState(false)

  // reviews modal (product experiences)
  const [reviewsOpen, setReviewsOpen] = useState(false)
  const [reviewsProduct, setReviewsProduct] = useState<Product | null>(null)
  const [reviews, setReviews] = useState<ExperienceView[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [expandedReviewIds, setExpandedReviewIds] = useState<Record<string, boolean>>({})

  // experience detail modal (single experience + comments)
  const [expDetailOpen, setExpDetailOpen] = useState(false)
  const [activeExp, setActiveExp] = useState<ExperienceView | null>(null)
  const [expComments, setExpComments] = useState<CommentView[]>([])
  const [expCommentsLoading, setExpCommentsLoading] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [commentSending, setCommentSending] = useState(false)
  const [commentErr, setCommentErr] = useState<string | null>(null)

  // user modal (user’s experiences)
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [userModalTitle, setUserModalTitle] = useState<string>('Kullanıcı')
  const [userModalAvatar, setUserModalAvatar] = useState<string | null>(null)
  const [userExperiences, setUserExperiences] = useState<ExperienceView[]>([])
  const [userExperiencesLoading, setUserExperiencesLoading] = useState(false)

  // lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [lightboxAlt, setLightboxAlt] = useState<string>('')

  const qTrim = q.trim()

  const brandOptions = useMemo(() => {
    const s = new Set<string>()
    for (const p of products) if (p.brand) s.add(p.brand)
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [products])

  const selectedLabel = useMemo(() => {
    if (!selected) return 'Ürün seç'
    return selected.brand + ' — ' + selected.name + (selected.category ? ' • ' + selected.category : '')
  }, [selected])

  // ---------- AUTH ----------
  useEffect(() => {
    let alive = true

    async function boot() {
      const { data } = await supabase.auth.getSession()
      if (!alive) return

      const uid = data.session?.user?.id ?? null
      if (!uid) {
        setUserId(null)
        return
      }

      const ok = await ensureAllowedOrSignOut(uid)
      if (!alive) return

      setUserId(ok ? uid : null)
    }

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, session) => {
      const uid = session?.user?.id ?? null
      if (!uid) {
        setUserId(null)
        return
      }
      const ok = await ensureAllowedOrSignOut(uid)
      setUserId(ok ? uid : null)
    })

    boot()

    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function signInWithGoogle() {
    const r = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    })
    if (r.error) alert(r.error.message)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
    setNeedsUsername(false)
    setSelected(null)
    setProducts([])
    setRecent([])
  }

  async function ensureAllowedOrSignOut(uid: string) {
    const u = await supabase.auth.getUser()
    const email = u.data.user?.email?.trim().toLowerCase()

    if (!email) {
      await supabase.auth.signOut()
      alert('E-posta alınamadı. Tekrar giriş yap.')
      return false
    }

    const { data, error } = await supabase.from('allowed_users').select('email').eq('email', email).maybeSingle()

    if (error || !data) {
      await supabase.auth.signOut()
      alert('Bu hesaba erişim verilmedi.')
      return false
    }

    return true
  }

  // ---------- PROFILE ----------
  async function loadProfile(uid: string) {
    const { data, error } = await supabase.from('profiles').select('user_id,username,avatar_url').eq('user_id', uid).maybeSingle()
    if (error) {
      setProfile(null)
      setNeedsUsername(true)
      return
    }
    const p = (data as Profile | null) ?? null
    setProfile(p)
    const need = !p?.username || !String(p.username).trim()
    setNeedsUsername(need)
    setUsernameDraft(p?.username ?? '')
  }

  async function saveProfile() {
    if (!userId) return
    const uname = usernameDraft.trim()
    if (!uname) {
      setProfileErr('Kullanıcı adı boş olamaz')
      return
    }

    setSavingProfile(true)
    setProfileErr(null)

    try {
      let avatar_url: string | null = profile?.avatar_url ?? null
      if (avatarDraft) {
        avatar_url = await uploadToBucket(BUCKET_AVATARS, avatarDraft, safePathPrefix('u', userId), 'avatar')
      }

      const up = await supabase.from('profiles').upsert({ user_id: userId, username: uname, avatar_url }, { onConflict: 'user_id' })
      if (up.error) throw up.error

      await loadProfile(userId)
      setProfileOpen(false)
    } catch (e: any) {
      setProfileErr(e?.message ?? 'Profil kaydedilemedi')
    } finally {
      setSavingProfile(false)
      setAvatarDraft(null)
    }
  }

  // ---------- PRODUCTS + STATS ----------
  async function resetSearchState() {
  setProducts([])
  setSelected(null)
  setStats({})
  setPErr(null)
}

  async function searchProducts() {
  setPLoading(true)
  setPErr(null)
  try {
    const term = qTrim
      .normalize('NFKC')
      .replace(/\s+/g, ' ')
      .trim()

    if (!term) {
      await resetSearchState()
      return
    }

    const { data, error } = await supabase
      .from('products')
      .select('id,name,brand,category,image_url,created_by')
      .or(`name.ilike.%${term}%,brand.ilike.%${term}%`)
      .order('brand', { ascending: true })
      .order('name', { ascending: true })
      .limit(200)

      if (error) throw error

      const list = (((data as any[]) || []) as Product[]) || []
      setProducts(list)
      if (list.length === 1) setSelected(list[0])

      await loadStatsForProducts(list.map((x) => x.id))
    } catch (e: any) {
      setPErr(e?.message ?? 'Ürünler yüklenemedi')
      setProducts([])
      setStats({})
    } finally {
      setPLoading(false)
    }
  }

  async function loadStatsForProducts(productIds: string[]) {
    if (productIds.length === 0) {
      setStats({})
      return
    }

    const { data, error } = await supabase.from('reviews').select('product_id,rating,would_buy_again').in('product_id', productIds).limit(5000)
    if (error) return

    const rows = ((data as any[]) || []) as Array<{ product_id: string; rating: number | null; would_buy_again: boolean | null }>
    const map: Record<string, { sum: number; cnt: number; wbaYes: number; wbaCnt: number }> = {}

    for (const r of rows) {
      if (!map[r.product_id]) map[r.product_id] = { sum: 0, cnt: 0, wbaYes: 0, wbaCnt: 0 }
      if (typeof r.rating === 'number') {
        map[r.product_id].sum += r.rating
        map[r.product_id].cnt += 1
      }
      if (typeof r.would_buy_again === 'boolean') {
        map[r.product_id].wbaCnt += 1
        if (r.would_buy_again) map[r.product_id].wbaYes += 1
      }
    }

    const out: Record<string, { avg: number | null; count: number; wbaPct: number | null }> = {}
    for (const pid of productIds) {
      const m = map[pid]
      if (!m) out[pid] = { avg: null, count: 0, wbaPct: null }
      else {
        out[pid] = {
          avg: m.cnt ? Number((m.sum / m.cnt).toFixed(1)) : null,
          count: m.cnt,
          wbaPct: m.wbaCnt ? Math.round((m.wbaYes / m.wbaCnt) * 100) : null,
        }
      }
    }
    setStats(out)
  }

  // ---------- ADD PRODUCT (NO UPSERT / NO ON CONFLICT) ----------
  async function getProductByBrandName(brand: string, name: string) {
    const { data, error } = await supabase.rpc('find_product_ci', {
      p_brand: brand,
      p_name: name,
    })

    if (error || !data?.length) return null
    return data[0] as Product
  }

  async function addProduct() {
    setAddProductMsg(null)
    if (addingProduct) return

    const brand = (brandChoice === '__NEW__' ? brandCustom : brandChoice).trim()
    const name = newName.trim()
    const category = (categoryChoice === 'Diğer' ? customCategory : categoryChoice).trim()

    if (!brand || !name) {
      setAddProductMsg('Marka ve ürün adı zorunlu')
      return
    }

    setAddingProduct(true)

    try {
      let image_url: string | null = null
      if (newPhoto) {
        try {
          image_url = await uploadToBucket(BUCKET_PHOTOS, newPhoto, safePathPrefix('products', brand))
        } catch {
          image_url = null
        }
      }

      // 1) Try insert
      const ins = await supabase
      .from('products')
       .insert({
       brand,
       name,
       category: category || null,
      image_url,
      created_by: userId,
  })
      .select('id,name,brand,category,image_url,created_by')
      .single()

      if (ins.error) {
        if (isDuplicateError(ins.error)) {
          const existing = await getProductByBrandName(brand, name)
          if (!existing) throw ins.error

          setAddProductMsg('Ürün zaten vardı (mevcut ürün seçildi)')
          setSelected(existing)
          setQ(`${existing.brand} ${existing.name}`)

          setProducts((prev) => {
            const next = prev.some((x) => x.id === existing.id) ? prev : [existing, ...prev]
            loadStatsForProducts(next.map((x) => x.id))
            return next
          })

          // reset form ✅ (duplicate sonrası da temizle)
          setBrandChoice('')
          setBrandCustom('')
          setNewName('')
          setCategoryChoice('')
          setCustomCategory('')
          setNewPhoto(null)
        } else {
          throw ins.error
        }
      } else {
        const p = ins.data as Product
        setAddProductMsg('Ürün eklendi')
        setSelected(p)
        setQ(`${p.brand} ${p.name}`)

        setProducts((prev) => {
          const next = prev.some((x) => x.id === p.id) ? prev : [p, ...prev]
          loadStatsForProducts(next.map((x) => x.id))
          return next
        })

        // reset form ✅ (success sonrası temizle)
        setBrandChoice('')
        setBrandCustom('')
        setNewName('')
        setCategoryChoice('')
        setCustomCategory('')
        setNewPhoto(null)
      }
    } catch (e: any) {
      setAddProductMsg(e?.message ?? 'Ürün eklenemedi')
    } finally {
      setAddingProduct(false)
    }
  }

  async function deleteSelectedProduct() {
    if (!selected) return
    if (!userId) return

    // sadece ürünü ekleyen silebilsin
    if (selected.created_by !== userId) {
      alert('Bu ürünü sadece ekleyen kişi silebilir.')
      return
    }

    const ok = confirm('Bu ürünü silmek istiyor musun? Eğer başkası deneyim girdiyse silinmez.')
    if (!ok) return

    try {
      const r = await supabase.rpc('delete_product_safe', { p_product_id: selected.id })
      if (r.error) throw r.error

      // UI temizle
      setProducts((prev) => prev.filter((p) => p.id !== selected.id))
      setSelected(null)
      setProductPhotoDraft(null)
      setProductPhotoMsg(null)
      setStats({})
      setAddProductMsg('Ürün silindi')
    } catch (e: any) {
      alert(e?.message ?? 'Ürün silinemedi')
    }
  }

  async function saveSelectedProductPhoto() {
    if (!selected) return
    if (!productPhotoDraft) {
      setProductPhotoMsg('Foto seç')
      return
    }
    if (productPhotoSaving) return

    setProductPhotoSaving(true)
    setProductPhotoMsg(null)

    try {
      const image_url = await uploadToBucket(
        BUCKET_PHOTOS, // aynı bucket kalsın
        productPhotoDraft,
        safePathPrefix('products', selected.brand, selected.id),
        'main'
      )

      const up = await supabase
        .from('products')
        .update({ image_url })
        .eq('id', selected.id)
        .select('id,name,brand,category,image_url,created_by')
        .single()

      if (up.error) throw up.error

      const updated = up.data as Product
      setSelected(updated)
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      setProductPhotoDraft(null)
      setProductPhotoMsg('Ürün fotoğrafı güncellendi')
    } catch (e: any) {
      setProductPhotoMsg(e?.message ?? 'Ürün fotoğrafı güncellenemedi')
    } finally {
      setProductPhotoSaving(false)
    }
  }

  // ---------- EXPERIENCES ----------
  async function loadRecent(prioritizeExperienceId?: string) {
    setRecentLoading(true)
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('id,product_id,user_id,rating,pros,cons,would_buy_again,image_url,created_at')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      const exps = (((data as any[]) || []) as ExperienceRow[]).map((x) => ({ ...x })) as ExperienceView[]

      const pids = Array.from(new Set(exps.map((x) => x.product_id).filter(Boolean)))
      const uids = Array.from(new Set(exps.map((x) => x.user_id).filter(Boolean)))
      const prodMap: Record<string, Product> = {}
      const profMap: Record<string, { username: string; avatar_url: string | null }> = {}

      if (pids.length) {
        const pr = await supabase.from('products').select('id,name,brand,category,image_url,created_by').in('id', pids)
        if (!pr.error && pr.data) for (const p of pr.data as any[]) prodMap[p.id] = p as Product
      }

      if (uids.length) {
        const pf = await supabase.from('profiles').select('user_id,username,avatar_url').in('user_id', uids)
        if (!pf.error && pf.data)
          for (const p of pf.data as any[])
            profMap[p.user_id] = { username: p.username ?? 'Kullanıcı', avatar_url: p.avatar_url ?? null }
      }

      const expIds = exps.map((x) => x.id)
      const ccMap: Record<string, number> = {}
      if (expIds.length) {
        const cc = await supabase.from('review_comments').select('experience_id').in('experience_id', expIds)
        if (!cc.error && cc.data) {
          for (const r of cc.data as any[]) {
            const eid = r.experience_id
            if (!eid) continue
            ccMap[eid] = (ccMap[eid] ?? 0) + 1
          }
        }
      }

      const out = exps.map((e) => ({
        ...e,
        product: prodMap[e.product_id] ?? null,
        author: profMap[e.user_id] ?? null,
        comment_count: ccMap[e.id] ?? 0,
      }))

      if (prioritizeExperienceId) {
        const idx = out.findIndex((x) => x.id === prioritizeExperienceId)
        if (idx > 0) {
          const picked = out[idx]
          out.splice(idx, 1)
          out.unshift(picked)
        }
      }

      setRecent(out)
    } catch (e:any) {
  console.error('loadRecent failed:', e)
  setRecent([])
} finally {
      setRecentLoading(false)
    }
  }

  async function addExperience() {
    if (!userId || !selected) return
    if (addingExp) return

    setExpMsg(null)
    setAddingExp(true)

    try {
      console.log('EXP: start')
      console.log('EXP: editingExpId', editingExpId)
      const rating = ratingStr ? parseInt(ratingStr, 10) : null

      if (ratingStr && (!Number.isFinite(rating) || rating! < 1 || rating! > 10)) {
        throw new Error('Puan 1-10 olmalı')
      }
      if (wba === null) throw new Error('Tekrar seçimi zorunlu')

      let image_url: string | null = null
      if (expPhoto) {
        image_url = await uploadToBucket(BUCKET_PHOTOS, expPhoto, safePathPrefix('experiences', selected.id))
        console.log('EXP: after upload')
      }

      if (editingExpId) {
        const patch: any = {
          rating,
          pros: pros.trim() || null,
          cons: cons.trim() || null,
          would_buy_again: wba,
        }
        // yeni foto seçildiyse overwrite et
        if (expPhoto) patch.image_url = image_url

        const up = await supabase
          .from('reviews')
          .update(patch)
          .eq('id', editingExpId)
          .eq('user_id', userId)
          .select('id')
          .single()

        console.log('EXP: after update')
        if (up.error) throw up.error
        setExpMsg('Deneyim güncellendi')
      } else {
        const ins = await supabase
          .from('reviews')
          .upsert(
            {
              product_id: selected.id,
              user_id: userId,
              rating,
              pros: pros.trim() || null,
              cons: cons.trim() || null,
              would_buy_again: wba,
              image_url,
            },
            { onConflict: 'user_id,product_id' } // unique_user_product_review buradan geliyor
          )
          .select('id')
          .single()

        if (ins.error) throw ins.error
        setExpMsg(editingExpId ? 'Deneyim güncellendi' : 'Deneyim kaydedildi')
      }

      setRatingStr('')
      setPros('')
      setCons('')
      setWba(null)
      setExpPhoto(null)
      setEditingExpId(null)
      setSelected(null)
      setQ('')
      setProducts([])
      setStats({})

      await loadRecent()
      console.log('EXP: after loadRecent')

      loadStatsForProducts(products.map((x) => x.id)) // await YOK
      console.log('EXP: after loadStats (fired)')
    } catch (e: any) {
      setExpMsg(e?.message ?? 'Gönderilemedi')
    } finally {
      setAddingExp(false)
    }
  }

  function startEditExperience(r: ExperienceView) {
    setEditingExpId(r.id)
    setRatingStr(typeof r.rating === 'number' ? String(r.rating) : '')
    setPros(r.pros ?? '')
    setCons(r.cons ?? '')
    setWba(typeof r.would_buy_again === 'boolean' ? r.would_buy_again : null)
    setExpPhoto(null)

    const el = document.getElementById('exp-form')
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function cancelEditExperience() {
    setEditingExpId(null)
    setRatingStr('')
    setPros('')
    setCons('')
    setWba(null)
    setExpPhoto(null)
    setExpMsg(null)
  }

  async function deleteExperience(expId: string) {
    if (!userId) return
    if (!confirm('Bu deneyim silinsin mi?')) return

    const del = await supabase.from('reviews').delete().eq('id', expId).eq('user_id', userId)
    if (del.error) {
      alert(del.error.message)
      return
    }

    await supabase.from('review_comments').delete().eq('experience_id', expId)
    await loadRecent()
  }

  // ---------- PRODUCT EXPERIENCES MODAL ----------
  async function openReviews(p: Product) {
    setReviewsProduct(p)
    setReviewsOpen(true)
    setReviews([])
    setExpandedReviewIds({})
    setReviewsLoading(true)

    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('id,product_id,user_id,rating,pros,cons,would_buy_again,image_url,created_at')
        .eq('product_id', p.id)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      const list = (((data as any[]) || []) as ExperienceRow[]).map((x) => ({ ...x })) as ExperienceView[]

      const uids = Array.from(new Set(list.map((x) => x.user_id).filter(Boolean)))
      const profMap: Record<string, { username: string; avatar_url: string | null }> = {}
      if (uids.length) {
        const pf = await supabase.from('profiles').select('user_id,username,avatar_url').in('user_id', uids)
        if (!pf.error && pf.data)
          for (const pp of pf.data as any[]) profMap[pp.user_id] = { username: pp.username ?? 'Kullanıcı', avatar_url: pp.avatar_url ?? null }
      }

      const expIds = list.map((x) => x.id)
      const ccMap: Record<string, number> = {}
      if (expIds.length) {
        const cc = await supabase.from('review_comments').select('experience_id').in('experience_id', expIds)
        if (!cc.error && cc.data) {
          for (const r of cc.data as any[]) {
            const eid = r.experience_id
            if (!eid) continue
            ccMap[eid] = (ccMap[eid] ?? 0) + 1
          }
        }
      }

      setReviews(
        list.map((e) => ({
          ...e,
          product: p,
          author: profMap[e.user_id] ?? null,
          comment_count: ccMap[e.id] ?? 0,
        }))
      )
    } catch {
      setReviews([])
    } finally {
      setReviewsLoading(false)
    }
  }

  // ---------- USER MODAL ----------
  async function openUserModal(uid: string, title: string, avatar: string | null) {
    setUserModalOpen(true)
    setUserModalTitle(title || 'Kullanıcı')
    setUserModalAvatar(avatar ?? null)
    setUserExperiences([])
    setUserExperiencesLoading(true)

    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('id,product_id,user_id,rating,pros,cons,would_buy_again,image_url,created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      const list = (((data as any[]) || []) as ExperienceRow[]).map((x) => ({ ...x })) as ExperienceView[]

      const pids = Array.from(new Set(list.map((x) => x.product_id).filter(Boolean)))
      const prodMap: Record<string, Product> = {}
      if (pids.length) {
        const pr = await supabase.from('products').select('id,name,brand,category,image_url,created_by').in('id', pids)
        if (!pr.error && pr.data) for (const p of pr.data as any[]) prodMap[p.id] = p as Product
      }

      setUserExperiences(list.map((e) => ({ ...e, product: prodMap[e.product_id] ?? null })))
    } catch {
      setUserExperiences([])
    } finally {
      setUserExperiencesLoading(false)
    }
  }

  // ---------- EXPERIENCE DETAIL + COMMENTS ----------
  async function openExperienceDetail(r: ExperienceView) {
    setActiveExp(r)
    setExpDetailOpen(true)
    setCommentDraft('')
    setCommentErr(null)
    setExpComments([])
    await loadExperienceComments(r.id)
  }

  async function loadExperienceComments(expId: string) {
    setCommentErr(null)
    setExpCommentsLoading(true)

    try {
      const { data: rows, error } = await supabase
        .from('review_comments')
        .select('id,experience_id,user_id,parent_id,body,created_at')
        .eq('experience_id', expId)
        .order('created_at', { ascending: true })
        .limit(500)

      if (error) throw error

      const list = (((rows as any[]) || []) as CommentRow[]).filter(Boolean)
      const uids = Array.from(new Set(list.map((x) => x.user_id).filter(Boolean)))

      const profMap: Record<string, { username: string; avatar_url: string | null }> = {}
      if (uids.length) {
        const { data: profs, error: pErr } = await supabase.from('profiles').select('user_id,username,avatar_url').in('user_id', uids)
        if (!pErr && profs) for (const p of profs as any[]) profMap[p.user_id] = { username: p.username ?? 'Kullanıcı', avatar_url: p.avatar_url ?? null }
      }

      setExpComments(list.map((c) => ({ ...c, author: profMap[c.user_id] ?? null })))
    } catch (e: any) {
      setCommentErr(e?.message ?? 'Yorumlar yüklenemedi')
      setExpComments([])
    } finally {
      setExpCommentsLoading(false)
    }
  }

  async function sendExperienceComment() {
    if (!userId || !activeExp) return
    const body = commentDraft.trim()
    if (!body) return
    if (commentSending) return

    setCommentSending(true)
    setCommentErr(null)

    try {
      const ins = await supabase.from('review_comments').insert({
        experience_id: activeExp.id,
        user_id: userId,
        parent_id: null,
        body,
      })
      if (ins.error) throw ins.error

      setCommentDraft('')
      await loadExperienceComments(activeExp.id)
      await loadRecent(activeExp.id)

      if (reviewsOpen && reviewsProduct) await openReviews(reviewsProduct)
    } catch (e: any) {
      setCommentErr(e?.message ?? 'Gönderilemedi')
    } finally {
      setCommentSending(false)
    }
  }

  // initial loads
  const firstLoaded = useRef(false)
  useEffect(() => {
    if (!userId) return
    if (firstLoaded.current) return
    firstLoaded.current = true

    loadProfile(userId)
    loadRecent()
  }, [userId])

  // ---------- UI: LOGIN ----------
  if (!userId) {
    return (
      <div className="wrap">
        <style>{css}</style>
        <div className="center">
          <div className="card authCard">
            <div className="h1">Giriş</div>
            <div className="muted">Devam etmek için Google ile giriş yap</div>
            <button className="btn btnSm" onClick={signInWithGoogle}>
              Google ile giriş
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="wrap">
      <style>{css}</style>

      <div className="app">
        <header className="topbar">
          <div className="brand">
            <div className="logoWrap">
              <img
                className="logo"
                src="/logo.png"
                alt="ARAMIZDA"
                onError={(e) => {
                  ;(e.currentTarget as any).style.display = 'none'
                }}
              />
            </div>
            <div className="word">ARAMIZDA</div>
          </div>

          <div className="rightCol">
            <button
              type="button"
              className="userPill"
              onClick={() => {
                setUsernameDraft(profile?.username ?? '')
                setAvatarDraft(null)
                setProfileErr(null)
                setProfileOpen(true)
              }}
            >
              {profile?.avatar_url ? (
  <img className="av" src={profile.avatar_url} alt="" />
) : (
  <div className="av ph txt" style={{ background: avatarColor(profile?.username) }}>
    {initials(profile?.username)}
  </div>
)}
              <div className="uname">{profile?.username || 'Profil'}</div>
            </button>

            <button className="btn ghost btnXs logoutBtn" onClick={signOut}>
              Çıkış
            </button>
          </div>
        </header>

        {needsUsername ? (
          <div className="card">
            <div className="h2">Kullanıcı Adı</div>
            <div className="muted">Bu isim deneyimlerde görünecek</div>

            <div className="field">
              <div className="label b">Kullanıcı Adı</div>
              <input className="input" value={usernameDraft} onChange={(e) => setUsernameDraft(e.target.value)} placeholder="ör: ulas, gizem" />
            </div>

            <div className="field">
              <div className="label b">Profil Fotoğrafı (Opsiyonel)</div>
              <input
                className="file"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                onChange={(e) => setAvatarDraft(e.target.files?.[0] ?? null)}
              />
              <div className="muted small">5 MB Altı</div>
            </div>

            {profileErr ? <div className="err">{profileErr}</div> : null}

            <button className="btn btnSm" onClick={saveProfile} disabled={savingProfile}>
              {savingProfile ? 'Kaydediliyor…' : 'Devam'}
            </button>
          </div>
        ) : (
          <main className="grid4">
            {/* 1) Ürün Ara */}
            <section className="card tall">
              <div className="h2">Ürün Ara</div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  searchProducts()
                }}
              >
                <div className="row">
                  <input
                    className="input"
                    value={q}
                    onChange={(e) => {
                      const v = e.target.value
                      setQ(v)
                      if (!v.trim()) resetSearchState()
                    }}
                    placeholder="ör: bee beauty serum"
                  />
                  <button className="btn btnSm" type="submit" disabled={pLoading}>
                    {pLoading ? '…' : 'Ara'}
                  </button>
                </div>
              </form>

              {/* Seçili ürüne foto ekle / değiştir */}
              {selected ? (
                <div className="field" style={{ marginTop: 12 }}>
                  <div className="label b">Seçili Ürüne Foto Ekle / Değiştir</div>
                  <input
                    className="file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    onChange={(e) => {
                      setProductPhotoMsg(null)
                      setProductPhotoDraft(e.target.files?.[0] ?? null)
                    }}
                  />

                  {productPhotoMsg ? (
                    <div className={productPhotoMsg.includes('güncellendi') ? 'ok' : 'err'}>{productPhotoMsg}</div>
                  ) : null}

                  <button className="btn btnSm" type="button" disabled={productPhotoSaving || !productPhotoDraft} onClick={saveSelectedProductPhoto}>
                    {productPhotoSaving ? 'Kaydediliyor…' : 'Fotoğrafı Kaydet'}
                  </button>
                  
                  {selected.created_by === userId ? (
  <button
    className="btn btnSm"
    type="button"
    style={{ marginTop: 10 }}
    onClick={deleteSelectedProduct}>
    Ürünü Sil
  </button>
) : null}
                </div>
              ) : null}

              {pErr ? <div className="err">{pErr}</div> : null}
              {addProductMsg ? (
                <div className={addProductMsg.includes('eklendi') || addProductMsg.includes('zaten') ? 'ok' : 'err'}>{addProductMsg}</div>
              ) : null}

              <div className="list">
                {products.length === 0 ? (
                  <div className="muted small">{qTrim ? 'Ürün bulunamadı. İstersen sağdan ekle.' : 'Ürün arayın, sonuçlar burada görünecek'}</div>
                ) : (
                  products.map((p) => {
                    const st = stats[p.id]
                    const avg = st?.avg
                    const cnt = st?.count ?? 0
                    const wbaPct = st?.wbaPct

                    return (
                      <div
                        key={p.id}
                        className={`item ${selected?.id === p.id ? 'active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelected(p)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') setSelected(p)
                        }}
                      >
                        {p.image_url ? (
                          <img
                            className="thumb clickable"
                            src={p.image_url}
                            alt=""
                            onClick={(e) => {
                              e.stopPropagation()
                              setLightboxAlt(`${p.brand} — ${p.name}`)
                              setLightboxUrl(p.image_url!)
                            }}
                          />
                        ) : (
                          <div className="thumb ph" />
                        )}

                        <div className="mid">
                          <div className="t">
                            {p.brand} — {p.name}
                          </div>

                          <div className="muted small meta2">
                            <span>Ortalama: {typeof avg === 'number' ? avg.toFixed(1) : '—'}/10</span>
                            <button
                              type="button"
                              className="linkBtn"
                              onClick={(e) => {
                                e.stopPropagation()
                                openReviews(p)
                              }}
                            >
                              Deneyim ({cnt})
                            </button>
                          </div>

                          <div className="muted small meta2">
                            <span>Tekrar: {typeof wbaPct === 'number' ? `% ${wbaPct}` : '—'}</span>
                            <span>{p.category || 'Kategori yok'}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </section>

            {/* 2) Deneyim Ekle */}
            <section id="exp-form" className="card tall">
              <div className="h2">{editingExpId ? 'Deneyimi Düzenle' : 'Deneyim Ekle'}</div>
              <div className="muted small">{selectedLabel}</div>

              <div className="field">
                <div className="label b">Puan (1-10)</div>
                <select className="input" value={ratingStr} onChange={(e) => setRatingStr(e.target.value)}>
                  <option value="">Seç</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={String(n)}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <div className="label b">Artılar</div>
                <textarea className="ta" value={pros} onChange={(e) => setPros(e.target.value)} />
              </div>

              <div className="field">
                <div className="label b">Eksiler</div>
                <textarea className="ta" value={cons} onChange={(e) => setCons(e.target.value)} />
              </div>

              <div className="field">
                <div className="label b">Tekrar</div>
                <div className="row" style={{ marginBottom: 0 }}>
                  <label className={`radio ${wba === true ? 'radioActive' : ''}`}>
                    <input type="radio" name="wba" checked={wba === true} onChange={() => setWba(true)} />
                    <span>✔ Tekrar Alırım</span>
                  </label>
                  <label className={`radio ${wba === false ? 'radioActive' : ''}`}>
                    <input type="radio" name="wba" checked={wba === false} onChange={() => setWba(false)} />
                    <span>✖ Tekrar Almam</span>
                  </label>
                </div>
              </div>

              <div className="field">
                <div className="label b">Deneyim Fotoğrafı (Opsiyonel)</div>
                <input
                  className="file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  onChange={(e) => setExpPhoto(e.target.files?.[0] ?? null)}
                />
                <div className="muted small">5 MB Altı</div>
              </div>

              {expMsg ? <div className={expMsg.includes('eklendi') || expMsg.includes('güncellendi') ? 'ok' : 'err'}>{expMsg}</div> : null}

              <div className="row" style={{ marginTop: 10, marginBottom: 0 }}>
                <button className="btn btnSm boldBtn" disabled={!selected || addingExp} onClick={addExperience}>
                  {addingExp ? (editingExpId ? 'Güncelleniyor…' : 'Gönderiliyor…') : editingExpId ? 'Güncelle' : 'Gönder'}
                </button>

                {editingExpId ? (
                  <button className="btn ghost btnSm" type="button" onClick={cancelEditExperience} disabled={addingExp}>
                    Vazgeç
                  </button>
                ) : null}
              </div>
            </section>

            {/* 3) Son Deneyimler */}
            <section className="card tall">
              <div className="h2">Son Deneyimler</div>

              {recentLoading ? (
                <div className="muted">Yükleniyor…</div>
              ) : recent.length === 0 ? (
                <div className="muted small"> </div>
              ) : (
                <div className="recent">
                  {recent.map((r) => {
                    const r10 = typeof r.rating === 'number' ? r.rating : null
                    const badgeText = r.would_buy_again === true ? '✔ Tekrar Alırım' : '✖ Tekrar Almam'
                    const isMine = !!userId && r.user_id === userId
                    const productThumb = r.product?.image_url || null
                    const cc = r.comment_count ?? 0

                    return (
                      <div key={r.id} className="r">
                        <div className="rHead">
                          <button
                            type="button"
                            className="userLink"
                            onClick={(e) => {
                              e.stopPropagation()
                              const u = r.author?.username || 'Kullanıcı'
                              const av = r.author?.avatar_url || null
                              openUserModal(r.user_id, u, av)
                            }}
                          >
                            {r.author?.avatar_url ? (
                              <img className="avSm" src={r.author.avatar_url} alt="" />
                            ) : (
                              <div className="avSm ph txt" style={{ background: avatarColor(r.author?.username) }}>
                                {initials(r.author?.username)}
                              </div>
                            )}
                            <span className="rUser">{r.author?.username || 'Kullanıcı'}</span>
                          </button>

                          <div className="rRight">
                            <div className="badge">{r10 !== null ? `${r10}/10` : '—'}</div>
                            <div className={`wbaBadge smallWba ${r.would_buy_again === true ? '' : 'no'}`}>{badgeText}</div>
                          </div>
                        </div>

                       {r.product ? (
  <>
    <div className="muted small pLine">
      <span>
        {r.product.brand} — {r.product.name}
        {r.product.category ? ' • ' + r.product.category : ''}
      </span>

      <span className="ccBadge" title="Yorum sayısı">
        💬 {cc}
      </span>
    </div>

    {productThumb ? (
      <img
        className="rImgSm clickable"
        src={productThumb}
        alt=""
        onClick={(e) => {
          e.stopPropagation()
          setLightboxAlt(`${r.product!.brand} — ${r.product!.name}`)
          setLightboxUrl(productThumb)
        }}
      />
    ) : null}
  </>
) : null}
                  
                      <div className="expBody clickableCard" role="button" tabIndex={0} onClick={() => openExperienceDetail(r)}>
                          {r.pros ? (
                            <div className="pill okP">
                              <b>Artılar:</b> <span className="pillTxt">{firstSentence(r.pros)}</span>
                            </div>
                          ) : null}

                          {r.cons ? (
                            <div className="pill badP">
                              <b>Eksiler:</b> <span className="pillTxt">{firstSentence(r.cons)}</span>
                            </div>
                          ) : null}

                          {r.image_url ? (
                            <img
                              className="rImg rImgSm clickable"
                              src={r.image_url}
                              alt=""
                              onClick={(e) => {
                                e.stopPropagation()
                                setLightboxAlt('Deneyim fotoğrafı')
                                setLightboxUrl(r.image_url!)
                              }}
                            />
                          ) : null}
                        </div>

                        {isMine ? (
                          <div className="inlineActions">
                            <button
                              type="button"
                              className="miniBtnDark"
                              onClick={() => {
                                if (r.product) setSelected(r.product)
                                startEditExperience(r)
                              }}
                            >
                              Düzenle
                            </button>
                            <button type="button" className="miniBtnDark danger" onClick={() => deleteExperience(r.id)}>
                              Sil
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* 4) Ürün Ekle */}
            <section id="add-product" className="card tall">
              <div className="h2">Ürün Ekle</div>

              <div className="field">
                <div className="label b">Marka</div>
                <select className="input" value={brandChoice} onChange={(e) => setBrandChoice(e.target.value)}>
                  <option value="">Seç</option>
                  {brandOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                  <option value="__NEW__">Yeni marka</option>
                </select>
              </div>

              {brandChoice === '__NEW__' ? (
                <div className="field">
                  <div className="label b">Yeni Marka</div>
                  <input className="input" value={brandCustom} onChange={(e) => setBrandCustom(e.target.value)} placeholder="ör: Essence" />
                </div>
              ) : null}

              <div className="field">
                <div className="label b">Ürün Adı</div>
                <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>

              <div className="field">
                <div className="label b">Kategori</div>
                <select className="input" value={categoryChoice} onChange={(e) => setCategoryChoice(e.target.value)}>
                  <option value="">Seç</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {categoryChoice === 'Diğer' ? (
                <div className="field">
                  <div className="label b">Diğer Kategori</div>
                  <input className="input" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="ör: Anne & Bebek" />
                </div>
              ) : null}

              <div className="field">
                <div className="label b">Ürün Fotoğrafı (Opsiyonel)</div>
                <input
                  className="file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  onChange={(e) => setNewPhoto(e.target.files?.[0] ?? null)}
                />
                <div className="muted small">5 MB Altı</div>
              </div>

              <button className="btn btnSm" onClick={addProduct} disabled={addingProduct}>
                {addingProduct ? 'Ekleniyor…' : 'Ekle'}
              </button>
            </section>
          </main>
        )}

        <div className="foot muted small">© ARAMIZDA</div>

        {/* Profile modal */}
        {profileOpen ? (
          <div className="pm" onClick={() => setProfileOpen(false)} role="dialog" aria-modal="true">
            <div className="pmInner" onClick={(e) => e.stopPropagation()}>
              <button className="pmClose" onClick={() => setProfileOpen(false)} aria-label="Kapat">
                ×
              </button>

              <div className="h2">Profil</div>

              <div className="field">
                <div className="label b">Kullanıcı Adı</div>
                <input className="input" value={usernameDraft} onChange={(e) => setUsernameDraft(e.target.value)} />
              </div>

              <div className="field">
                <div className="label b">Profil Fotoğrafı</div>
                <input
                  className="file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  onChange={(e) => setAvatarDraft(e.target.files?.[0] ?? null)}
                />
                <div className="muted small">5 MB Altı</div>
              </div>

              {profileErr ? <div className="err">{profileErr}</div> : null}

              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
                <button className="btn btnSm" onClick={saveProfile} disabled={savingProfile}>
                  {savingProfile ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Reviews modal */}
        {reviewsOpen ? (
          <div
            className="rm"
            onClick={() => {
              setReviewsOpen(false)
              setExpandedReviewIds({})
            }}
            role="dialog"
            aria-modal="true"
          >
            <div className="rmInner" onClick={(e) => e.stopPropagation()}>
              <button
                className="rmClose"
                onClick={() => {
                  setReviewsOpen(false)
                  setExpandedReviewIds({})
                }}
                aria-label="Kapat"
              >
                ×
              </button>

              <div className="rmTitle">
                <div className="h2" style={{ marginBottom: 6 }}>
                  Deneyimler
                </div>
                <div className="rmSubtitle">
                  {reviewsProduct?.image_url ? (
  <img
    className="pIcon clickable"
    src={reviewsProduct.image_url}
    alt=""
    style={{ marginTop: 8 }}
    onClick={(e) => {
      e.stopPropagation()
      setLightboxAlt(`${reviewsProduct.brand} — ${reviewsProduct.name}`)
      setLightboxUrl(reviewsProduct.image_url!)
    }}
  />
) : null}
                  {reviewsProduct
                    ? reviewsProduct.brand + ' — ' + reviewsProduct.name + (reviewsProduct.category ? ' • ' + reviewsProduct.category : '')
                    : ''}
                </div>
              </div>

              {reviewsLoading ? (
                <div className="muted">Yükleniyor…</div>
              ) : reviews.length === 0 ? (
                <div className="muted small"> </div>
              ) : (
                <div className="rmList">
                  {reviews.map((r) => {
                    const expanded = !!expandedReviewIds[r.id]
                    const txt = [r.pros ? `Artılar: ${r.pros}` : '', r.cons ? `Eksiler: ${r.cons}` : ''].filter(Boolean).join(' • ')
                    const r10 = typeof r.rating === 'number' ? r.rating : null
                    const badge = r.would_buy_again === true ? '✔ Tekrar Alırım' : '✖ Tekrar Almam'
                    const isMine = !!userId && r.user_id === userId
                    const cc = r.comment_count ?? 0

                    return (
                      <div
                        key={r.id}
                        className={`rmCard ${expanded ? 'open' : ''}`}
                        onClick={() => setExpandedReviewIds((s) => ({ ...s, [r.id]: !expanded }))}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="rmRow1">
                          <button
                            type="button"
                            className="userLink rmUserLink"
                            onClick={(e) => {
                              e.stopPropagation()
                              const u = r.author?.username || 'Kullanıcı'
                              const av = r.author?.avatar_url || null
                              openUserModal(r.user_id, u, av)
                            }}
                          >
                            {r.author?.avatar_url ? (
                              <img className="avSm" src={r.author.avatar_url} alt="" />
                            ) : (
                              <div className="avSm ph txt" style={{ background: avatarColor(r.author?.username) }}>
                                {initials(r.author?.username)}
                              </div>
                            )}
                            <span className="rmUser">{r.author?.username || 'Kullanıcı'}</span>
                          </button>

                          <div className="rmRight">
                            <span className="badge">{r10 !== null ? `${r10}/10` : '—'}</span>
                            <span className={`wbaBadge smallWba ${r.would_buy_again === true ? '' : 'no'}`}>{badge}</span>
                            <span className="ccBadge" title="Yorum sayısı">
                              💬 {cc}
                            </span>

                            <span className="rmActions" onClick={(e) => e.stopPropagation()}>
                              <button type="button" className="miniBtn" onClick={() => openExperienceDetail(r)}>
                                Aç
                              </button>

                              {isMine ? (
                                <>
                                  <button
                                    type="button"
                                    className="miniBtn"
                                    onClick={() => {
                                      if (reviewsProduct) setSelected(reviewsProduct)
                                      startEditExperience(r)
                                      setReviewsOpen(false)
                                    }}
                                  >
                                    Düzenle
                                  </button>
                                  <button type="button" className="miniBtn danger" onClick={() => deleteExperience(r.id)}>
                                    Sil
                                  </button>
                                </>
                              ) : null}
                            </span>
                          </div>
                        </div>

                        <div className={`rmText ${expanded ? 'open' : ''}`}>{txt || ' '}</div>
                        <div className="rmDate">{safeTRDate(r.created_at)}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Experience detail modal */}
        {expDetailOpen && activeExp ? (
          <div
            className="ed"
            onClick={() => {
              setExpDetailOpen(false)
              setActiveExp(null)
              setExpComments([])
              setCommentDraft('')
              setCommentErr(null)
            }}
            role="dialog"
            aria-modal="true"
          >
            <div className="edInner" onClick={(e) => e.stopPropagation()}>
              <button
                className="edClose"
                onClick={() => {
                  setExpDetailOpen(false)
                  setActiveExp(null)
                  setExpComments([])
                  setCommentDraft('')
                  setCommentErr(null)
                }}
                aria-label="Kapat"
              >
                ×
              </button>

              <div className="edTop">
                <div>
                  <div className="edTitle">Deneyim</div>

                  <button
                    type="button"
                    className="edUser"
                    onClick={() => {
                      const u = activeExp.author?.username || 'Kullanıcı'
                      const av = activeExp.author?.avatar_url || null
                      openUserModal(activeExp.user_id, u, av)
                    }}
                  >
                    {activeExp.author?.avatar_url ? (
                      <img className="edAv" src={activeExp.author.avatar_url} alt="" />
                    ) : (
                      <div className="edAv ph txt" style={{ background: avatarColor(activeExp.author?.username) }}>
                        {initials(activeExp.author?.username)}
                      </div>
                    )}
                    <span>{activeExp.author?.username || 'Kullanıcı'}</span>
                  </button>

                  <div className="edSub">
                    {activeExp.product
                      ? activeExp.product.brand +
                        ' — ' +
                        activeExp.product.name +
                        (activeExp.product.category ? ' • ' + activeExp.product.category : '')
                      : ''}
                  </div>
                </div>

                <div className="edRight">
                  <span className="badgeDark">{typeof activeExp.rating === 'number' ? `${activeExp.rating}/10` : '—'}</span>
                  <span className={`badgeWbaDark ${activeExp.would_buy_again === true ? '' : 'no'}`}>
                    {activeExp.would_buy_again === true ? '✔ Tekrar Alırım' : '✖ Tekrar Almam'}
                  </span>
                </div>
              </div>

              {activeExp.pros ? (
                <div className="pillLight okL">
                  <b>Artılar:</b> {activeExp.pros}
                </div>
              ) : null}
              {activeExp.cons ? (
                <div className="pillLight badL">
                  <b>Eksiler:</b> {activeExp.cons}
                </div>
              ) : null}

              {activeExp.image_url ? (
                <img
                  className="edImg clickable"
                  src={activeExp.image_url}
                  alt=""
                  onClick={(e) => {
                    e.stopPropagation()
                    setLightboxAlt('Deneyim fotoğrafı')
                    setLightboxUrl(activeExp.image_url!)
                  }}
                />
              ) : null}

              <div className="edSectionTitle">Yorumlar</div>

              {expCommentsLoading ? (
                <div className="edMuted">Yükleniyor…</div>
              ) : expComments.length === 0 ? (
                <div className="edMuted">Henüz yorum yok</div>
              ) : (
                <div className="edComments">
                  {expComments.map((c) => (
                    <div key={c.id} className="edC">
                      <div className="edCHead">
                        <div className="edCUser">
                          {c.author?.avatar_url ? (
                            <img className="edCav" src={c.author.avatar_url} alt="" />
                          ) : (
                            <div className="edCav ph txt" style={{ background: avatarColor(c.author?.username) }}>
                              {initials(c.author?.username)}
                            </div>
                          )}
                          <span className="edCname">{c.author?.username || 'Kullanıcı'}</span>
                        </div>
                        <div className="edCdate">{safeTRDate(c.created_at)}</div>
                      </div>
                      <div className="edCbody">{c.body}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="edSectionTitle">Bu deneyime yorum ekle</div>

              {commentErr ? <div className="edErr">{commentErr}</div> : null}

              <textarea className="edTa" value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} placeholder="Yaz..." />

              <button className="edBtn" onClick={sendExperienceComment} disabled={commentSending || !commentDraft.trim()}>
                {commentSending ? 'Gönderiliyor…' : 'Gönder'}
              </button>
            </div>
          </div>
        ) : null}

        {/* User modal */}
        {userModalOpen ? (
          <div className="um" onClick={() => setUserModalOpen(false)} role="dialog" aria-modal="true">
            <div className="umInner" onClick={(e) => e.stopPropagation()}>
              <button className="umClose" onClick={() => setUserModalOpen(false)} aria-label="Kapat">
                ×
              </button>

              <div className="umHead">
                {userModalAvatar ? (
                  <img className="umAv" src={userModalAvatar} alt="" />
                ) : (
                  <div className="umAv ph txt" style={{ background: avatarColor(userModalTitle) }}>
                    {initials(userModalTitle)}
                  </div>
                )}
                <div>
                  <div className="h2" style={{ marginBottom: 4 }}>
                    {userModalTitle}
                  </div>
                  <div className="umSub">Yaptığı Deneyimler</div>
                </div>
              </div>

              {userExperiencesLoading ? (
                <div className="muted">Yükleniyor…</div>
              ) : (
                <div className="umList">
                  {userExperiences.map((r) => {
                    const r10 = typeof r.rating === 'number' ? r.rating : null
                    return (
                      <div key={r.id} className="umCard">
                        <div className="umTop">
                          <div className="badge">{r10 !== null ? `${r10}/10` : '—'}</div>
                          <div className={`wbaBadge smallWba ${r.would_buy_again === true ? '' : 'no'}`}>
                            {r.would_buy_again === true ? '✔ Tekrar Alırım' : '✖ Tekrar Almam'}
                          </div>
                          <button
                            type="button"
                            className="miniBtn"
                            onClick={() => openExperienceDetail({ ...r, author: { username: userModalTitle, avatar_url: userModalAvatar } })}
                          >
                            Aç
                          </button>
                        </div>

                        {r.product ? (
                          <div className="t" style={{ marginBottom: 8 }}>
                            {r.product.brand} — {r.product.name}
                            {r.product.category ? ' • ' + r.product.category : ''}
                          </div>
                        ) : null}

                        {r.pros ? (
                          <div className="pill okP">
                            <b>Artılar:</b> <span className="pillTxt">{firstSentence(r.pros)}</span>
                          </div>
                        ) : null}

                        {r.cons ? (
                          <div className="pill badP">
                            <b>Eksiler:</b> <span className="pillTxt">{firstSentence(r.cons)}</span>
                          </div>
                        ) : null}

                        <div className="umDate">{safeTRDate(r.created_at)}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Lightbox */}
        {lightboxUrl ? (
          <div className="lb" onClick={() => setLightboxUrl(null)} role="dialog" aria-modal="true">
            <div className="lbInner" onClick={(e) => e.stopPropagation()}>
              <button className="lbClose" onClick={() => setLightboxUrl(null)} aria-label="Kapat">
                ×
              </button>
              <img className="lbImg" src={lightboxUrl} alt={lightboxAlt} />
              <div className="lbCap">{lightboxAlt}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

const BUCKET_AVATARS = 'avatars'
const BUCKET_PHOTOS = 'photos'

function safeTRDate(iso: string) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return ''
  }
}

function extOf(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  return ext && ext.length <= 8 ? ext : 'bin'
}

function safePathSegment(input: string) {
  return (input || 'x')
    .trim()
    .toLowerCase()
    // türkçe karakterleri sadeleştir
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    // her şeyi temizle
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}

function safePathPrefix(...parts: string[]) {
  return parts
    .map((p) => safePathSegment(p))
    .filter(Boolean)
    .join('/')
}

function safeId() {
  return (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function isDuplicateError(err: any) {
  const code = String(err?.code || err?.details || err?.hint || '')
  if (code.includes('23505')) return true

  const msg = String(err?.message || '').toLowerCase()
  return msg.includes('duplicate') || msg.includes('unique') || msg.includes('already exists') || msg.includes('violates unique constraint')
}

async function uploadToBucket(bucket: string, file: File, pathPrefix: string, fixedName?: string) {
  const u = await supabase.auth.getUser()
  console.log('UPLOAD USER:', u.data.user?.email)

  const ext = extOf(file)
  const filePath = fixedName ? `${pathPrefix}/${fixedName}.${ext}` : `${pathPrefix}/${safeId()}.${ext}`

  const up = await supabase.storage.from(bucket).upload(filePath, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type || undefined,
  })
  if (up.error) {
    console.error('UPLOAD FAIL:', {
      bucket,
      filePath,
      error: up.error,
    })
    throw up.error
  }

  const pub = supabase.storage.from(bucket).getPublicUrl(filePath)
  return pub.data.publicUrl
}

const css = `
:root{
  --bg:#140a2a;
  --card: rgba(255,255,255,.08);
  --card2: rgba(255,255,255,.06);
  --line:rgba(255,255,255,.14);
  --text:#f3f4f6;
  --muted:rgba(243,244,246,.72);
  --shadow: 0 16px 55px rgba(0,0,0,.35);
}

*{ box-sizing:border-box; }
html,body{ height:100%; }
body{
 margin:0;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  background:
    radial-gradient(1400px 700px at 18% 10%, rgba(236,72,153,.42), transparent 58%),
    radial-gradient(1200px 700px at 85% 10%, rgba(168,85,247,.40), transparent 58%),
    radial-gradient(1100px 700px at 55% 85%, rgba(147,51,234,.34), transparent 62%),
    linear-gradient(180deg, rgba(28,10,60,.88), rgba(14,6,32,1));
  color:var(--text);
}

.wrap{ min-height:100vh; padding:18px; }
.app{ max-width: 1400px; margin:0 auto; }

.topbar{
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:16px 18px;
  border:1px solid rgba(255,255,255,.22);
  border-radius:24px;
  background: linear-gradient(90deg, rgba(192,132,252,.55), rgba(244,114,182,.40));
  backdrop-filter: blur(14px);
  box-shadow: 0 20px 60px rgba(236,72,153,.25);
}

.brand{ display:flex; align-items:center; gap:14px; }
.logoWrap{
  width:110px; height:110px;
  border-radius:26px;
 background: #000;
  border: 1px solid rgba(255,255,255,.18);
  display:flex;
align-items:flex-end;
justify-content:flex-start;
padding:8px;
  box-shadow: 0 18px 44px rgba(0,0,0,.22);
}
.logo{
width:96px;
  height:96px;
  object-fit:contain;
  filter: drop-shadow(0 10px 22px rgba(0,0,0,.28));
}
.word{ font-weight:900; letter-spacing:2px; font-size:24px; text-shadow: 0 8px 26px rgba(0,0,0,.35); }

.rightCol{
  display:flex;
  flex-direction:column;
  align-items:flex-end;
  gap:10px;
}
.userPill{
  width: 220px;
  display:flex; align-items:center; gap:10px;
  border:1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.10);
  color:var(--text);
  padding:10px 12px;
  border-radius:999px;
  cursor:pointer;
  justify-content:flex-start;
}
.logoutBtn{
  width: 220px;
  justify-content:center;
}
.av{ width:34px; height:34px; border-radius:999px; object-fit:cover; background: rgba(255,255,255,.10); }
.uname{ font-weight:800; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.grid4{
  display:grid;
  grid-template-columns: 1.2fr 1fr 1.2fr 1fr;
  gap:14px;
  margin-top:14px;
}

.card{
 border:1px solid rgba(255,255,255,.26);
background: linear-gradient(
  180deg,
  rgba(255,255,255,.35) 0%,
  rgba(236,72,153,.18) 40%,
  rgba(168,85,247,.22) 100%
);
backdrop-filter: blur(18px);
border-radius:18px;
padding:14px;
box-shadow:
  0 20px 60px rgba(0,0,0,.20),
  inset 0 1px 0 rgba(255,255,255,.45);
}
.tall{ min-height: 640px; }

.h1{ font-weight:900; font-size:26px; margin-bottom:6px; }
.h2{ font-weight:900; font-size:18px; margin-bottom:8px; }
.muted{ color:var(--muted); }
.small{ font-size:12px; }

.row{ display:flex; gap:10px; align-items:center; margin-bottom:10px; }
.field{ margin-top:10px; }
.label{ margin-bottom:6px; color:var(--muted); }
.b{ font-weight:900; color:var(--text); }

.input, .ta, .file, select{
  width:100%;
  border:1px solid rgba(255,255,255,.22);
  background: linear-gradient(
    180deg,
    rgba(255,255,255,.14) 0%,
    rgba(255,255,255,.08) 55%,
    rgba(0,0,0,.10) 100%
  );
  color: rgba(243,244,246,.96);
  padding:10px 12px;
  border-radius:12px;
  outline:none;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.12);
}
.ta{ min-height:84px; resize:vertical; }
/* ===== BUTTONS (STEP 3) ===== */
.btn,
.miniBtn,
.miniBtnDark,
.edBtn{
  border:1px solid rgba(255,255,255,.28);
  background: linear-gradient(180deg, rgba(255,255,255,.92), rgba(255,255,255,.75));
  color:#1e1b4b;
  border-radius:12px;
  padding:10px 12px;
  cursor:pointer;
  font-weight:900;
  box-shadow:
    0 10px 26px rgba(0,0,0,.18),
    inset 0 1px 0 rgba(255,255,255,.65);
}

.btn:hover,
.miniBtn:hover,
.miniBtnDark:hover,
.edBtn:hover{
  background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(243,232,255,.82));
}

.btn:disabled,
.miniBtn:disabled,
.miniBtnDark:disabled,
.edBtn:disabled{
  opacity:.55;
  cursor:not-allowed;
}

.btnSm{ padding:9px 12px; }
.btnXs{ padding:10px 12px; border-radius:999px; }

/* ghost: üst bardaki "Çıkış" */
.ghost{
  background: rgba(0,0,0,.22);
  border:1px solid rgba(255,255,255,.22);
  color: rgba(255,255,255,.92);
}
.ghost:hover{ background: rgba(0,0,0,.30); }
/* ===== /BUTTONS ===== */

/* koyu mini butonları da beyaza çek */
.miniBtnDark, .miniBtn, .edBtn{
  background: linear-gradient(180deg, rgba(255,255,255,.92), rgba(255,255,255,.75));
  color:#1e1b4b;
  border:1px solid rgba(255,255,255,.28);
}
/* ===== /BUTTONS ===== */

.boldBtn{ width:100%; }

.ok{ margin-top:10px; color: #d4ffd9; font-weight:900; }
.err{ margin-top:10px; color: #ffd0d0; font-weight:900; }

.list{ margin-top:10px; max-height: 520px; overflow:auto; padding-right:4px; }
.item{
  display:flex; gap:10px; align-items:center;
  padding:10px;
  border:1px solid rgba(255,255,255,.14);
  border-radius:14px;
  background: rgba(0,0,0,.18);
  cursor:pointer;
  margin-bottom:10px;
}
.item.active{ outline: 2px solid rgba(236,72,153,.35); }
.thumb{
  width:54px; height:54px; border-radius:12px;
  object-fit:cover;
  background: rgba(255,255,255,.10);
}
.mid{ flex:1; }
.t{ font-weight:900; }
.meta2{ display:flex; justify-content:space-between; gap:8px; margin-top:6px; }

.linkBtn{
  border:none;
  background: transparent;
  color: rgba(253,164,233,1);
  font-weight:900;
  cursor:pointer;
  padding:0;
}

.radio{
  display:flex; align-items:center; gap:8px;
  border:1px solid rgba(255,255,255,.16);
  padding:10px 12px;
  border-radius:12px;
  background: rgba(0,0,0,.18);
  cursor:pointer;
  flex:1;
}
.radioActive{ outline:2px solid rgba(236,72,153,.30); }

.recent{ margin-top:10px; max-height: 560px; overflow:auto; padding-right:4px; }
.r{
  border:1px solid rgba(255,255,255,.14);
  border-radius:16px;
  background: rgba(0,0,0,.18);
  padding:10px;
  margin-bottom:12px;
}
.rHead{ display:flex; justify-content:space-between; align-items:center; gap:10px; }
.userLink{
  display:flex; align-items:center; gap:8px;
  border:none;
  background: transparent;
  color: var(--text);
  cursor:pointer;
  padding:0;
  max-width: 60%;
}
.avSm{ width:28px; height:28px; border-radius:999px; object-fit:cover; background: rgba(255,255,255,.10); }
.rUser{ font-weight:900; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.rRight{ display:flex; align-items:center; gap:8px; }

.badge{
  font-weight:900;
  padding:6px 10px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.16);
  background: rgba(255,255,255,.10);
  color: var(--text);
}
.wbaBadge{
  font-weight:900;
  padding:6px 10px;
  border-radius:999px;
  background: rgba(34,197,94,.14);
  border:1px solid rgba(34,197,94,.22);
  color: #d7ffe3;
}
.wbaBadge.no{
  background: rgba(239,68,68,.14);
  border:1px solid rgba(239,68,68,.22);
  color: #ffd0d0;
}
.smallWba{ font-size:12px; padding:6px 9px; }

.pLine{ display:flex; align-items:center; gap:8px; margin-top:8px; }
.pIcon{
  width:22px; height:22px; border-radius:8px;
  object-fit:cover;
  display:inline-block;
  background: rgba(255,255,255,.10);
  border:1px solid rgba(255,255,255,.14);
}
.ccBadge{
  margin-left:auto;
  font-weight:900;
  font-size:12px;
  padding:6px 10px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.16);
  background: rgba(255,255,255,.10);
  color: var(--text);
}

.pill{
  padding:10px 12px;
  border-radius:12px;
  border:1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.16);
  margin-top:8px;
  color: var(--text);
}
.okP{ border-color: rgba(34,197,94,.24); background: rgba(34,197,94,.10); }
.badP{ border-color: rgba(239,68,68,.24); background: rgba(239,68,68,.10); }

.expBody{ margin-top:8px; }
.clickableCard{ cursor:pointer; }
.clickable{ cursor:pointer; }

.pillTxt{
  display: -webkit-box;
  -webkit-line-clamp: 1;      /* sadece 1 satır */
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: normal;
}

.rImg{
  width:100%;
  margin-top:10px;
  border-radius:14px;
  border:1px solid rgba(255,255,255,.14);
  object-fit:cover;
  max-height: 240px;
}

.rImgSm{
  width: 100%;
  max-height: 120px;   /* istersen 100 yap */
  object-fit: cover;
}

.inlineActions{
  display:flex;
  gap:8px;
  justify-content:flex-end;
  margin-top:10px;
}
.miniBtnDark{
  border:1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.10);
  color: var(--text);
  font-weight:900;
  padding:8px 10px;
  border-radius:12px;
  cursor:pointer;
}
.miniBtnDark.danger{
  border-color: rgba(239,68,68,.26);
  background: rgba(239,68,68,.14);
}

.foot{ margin-top:12px; text-align:center; opacity:.80; }

.center{ min-height: 80vh; display:flex; align-items:center; justify-content:center; }
.authCard{ max-width: 420px; width: 100%; }

.ph{ opacity:.55; }

.pm,.rm,.ed,.um,.lb{
  position:fixed;
  inset:0;
  background: rgba(0,0,0,.60);
  display:flex;
  align-items:center;
  justify-content:center;
  padding:16px;
  z-index:50;
}
.pmInner,.rmInner,.edInner,.umInner,.lbInner{
  width:min(920px, 100%);
  max-height: 92vh;
  overflow:auto;
  border-radius:18px;
  background: rgba(255,255,255,.96);
  color:#0b1222;
  border:1px solid rgba(0,0,0,.10);
  box-shadow: 0 18px 60px rgba(0,0,0,.35);
  padding:14px;
  position:relative;
}
.pmClose,.rmClose,.edClose,.umClose,.lbClose{
  position:absolute;
  top:10px; right:10px;
  width:38px; height:38px;
  border-radius:12px;
  border:1px solid rgba(0,0,0,.12);
  background: rgba(255,255,255,.95);
  cursor:pointer;
  font-size:22px;
  line-height: 1;
}

.rmTitle{ padding-right:46px; }
.rmSubtitle{ color: rgba(15,23,42,.75); font-weight:900; }
.rmList{ margin-top:10px; display:flex; flex-direction:column; gap:10px; }
.rmCard{
  border:1px solid rgba(0,0,0,.10);
  border-radius:16px;
  background: rgba(255,255,255,.92);
  padding:10px;
}
.rmRow1{ display:flex; justify-content:space-between; align-items:center; gap:10px; }
.rmUserLink{ max-width: 55%; }
.rmUser{ font-weight:900; color:#0b1222; }
.rmRight{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
.rmActions{ display:flex; gap:8px; }
.miniBtn{
  border:1px solid rgba(0,0,0,.12);
  background: rgba(15,23,42,.06);
  color:#0b1222;
  font-weight:900;
  padding:8px 10px;
  border-radius:12px;
  cursor:pointer;
}
.miniBtn.danger{
  border-color: rgba(239,68,68,.22);
  background: rgba(239,68,68,.10);
  color:#7f1d1d;
}

.rmText{ color: rgba(15,23,42,.90); margin-top:8px; display:none; }
.rmText.open{ display:block; }
.rmDate{ margin-top:8px; font-size:12px; color: rgba(15,23,42,.65); }

.edTop{ display:flex; justify-content:space-between; align-items:flex-start; gap:10px; padding-right:46px; }
.edTitle{ font-weight:900; font-size:18px; }
.edUser{
  margin-top:6px;
  display:flex; align-items:center; gap:10px;
  border:1px solid rgba(0,0,0,.10);
  background: rgba(15,23,42,.04);
  color:#0b1222;
  border-radius:999px;
  padding:8px 10px;
  cursor:pointer;
}
.edAv{ width:34px; height:34px; border-radius:999px; object-fit:cover; background: rgba(0,0,0,.06); }
.edSub{ margin-top:10px; color: rgba(15,23,42,.75); font-weight:900; }

.edRight{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end; }
.badgeDark{
  font-weight:900;
  padding:7px 11px;
  border-radius:999px;
  border:1px solid rgba(0,0,0,.12);
  background: rgba(15,23,42,.06);
  color:#0b1222;
}
.badgeWbaDark{
  font-weight:900;
  padding:7px 11px;
  border-radius:999px;
  border:1px solid rgba(34,197,94,.25);
  background: rgba(34,197,94,.12);
  color:#14532d;
}
.badgeWbaDark.no{
  border-color: rgba(239,68,68,.22);
  background: rgba(239,68,68,.12);
  color:#7f1d1d;
}

.pillLight{
  margin-top:10px;
  border-radius:14px;
  padding:10px 12px;
  border:1px solid rgba(0,0,0,.10);
  background: rgba(15,23,42,.04);
  color:#0b1222;
}
.okL{ border-color: rgba(34,197,94,.20); background: rgba(34,197,94,.10); }
.badL{ border-color: rgba(239,68,68,.18); background: rgba(239,68,68,.08); }

.edImg{
  width:100%;
  margin-top:10px;
  border-radius:14px;
  border:1px solid rgba(0,0,0,.10);
  object-fit:cover;
  max-height: 320px;
}

.edSectionTitle{
  margin-top:14px;
  font-weight:900;
  color:#0b1222;
}
.edMuted{
  margin-top:8px;
  color: rgba(15,23,42,.75);
  font-weight:900;
}
.edComments{ margin-top:10px; display:flex; flex-direction:column; gap:10px; }
.edC{
  border:1px solid rgba(0,0,0,.10);
  background: rgba(255,255,255,.92);
  border-radius:14px;
  padding:10px;
}
.edCHead{ display:flex; justify-content:space-between; align-items:center; gap:10px; }
.edCUser{ display:flex; align-items:center; gap:10px; }
.edCav{ width:26px; height:26px; border-radius:999px; object-fit:cover; background: rgba(0,0,0,.06); }
.edCname{ font-weight:900; color:#0b1222; }
.edCdate{ font-size:12px; color: rgba(15,23,42,.65); }
.edCbody{ margin-top:8px; color: rgba(15,23,42,.92); font-weight:700; }

.edErr{ margin-top:10px; color: #b91c1c; font-weight:900; }

.edTa{
  width:100%;
  margin-top:10px;
  min-height: 90px;
  resize:vertical;
  border-radius:14px;
  border:1px solid rgba(0,0,0,.12);
  padding:10px 12px;
  outline:none;
  color:#0b1222;
  background: rgba(255,255,255,.96);
}
.edBtn{
  margin-top:10px;
  width:100%;
  border-radius:14px;
  border:1px solid rgba(0,0,0,.12);
  padding:11px 12px;
  font-weight:900;
  cursor:pointer;
  background: rgba(236,72,153,.20);
  color:#0b1222;
}
.edBtn:disabled{ opacity:.55; cursor:not-allowed; }

.umHead{ display:flex; align-items:center; gap:12px; padding-right:46px; }
.umAv{ width:54px; height:54px; border-radius:16px; object-fit:cover; background: rgba(0,0,0,.06); }
.umSub{ color: rgba(15,23,42,.70); font-weight:900; }
.umList{ margin-top:12px; display:flex; flex-direction:column; gap:10px; }
.umCard{
  border:1px solid rgba(0,0,0,.10);
  background: rgba(255,255,255,.92);
  border-radius:16px;
  padding:10px;
}
.umTop{ display:flex; gap:8px; align-items:center; justify-content:space-between; flex-wrap:wrap; }
.umDate{ margin-top:8px; font-size:12px; color: rgba(15,23,42,.65); }

.lbInner{ width:min(980px, 100%); padding:12px; }
.lbImg{ width:100%; border-radius:14px; border:1px solid rgba(0,0,0,.10); }
.lbCap{ margin-top:8px; font-weight:900; color: rgba(15,23,42,.75); }

@media(max-width: 1400px){
  .grid4{ grid-template-columns: 1fr 1fr; }
}
@media(max-width: 1100px){
  .grid4{ grid-template-columns: 1fr; }
  .tall{ min-height: auto; }
  .list,.recent{ max-height: 320px; }
  .logoWrap{ width:84px;height:84px;padding:2px;}
  .logo{ width:64px; height:64px; }
  .word{ font-size: 22px; }
  .userPill, .logoutBtn{ width: 200px; }
}
/* ===== FORCE WHITE BUTTONS ===== */

button:not(.userLink):not(.edUser),
.btn,
.miniBtn,
.miniBtnDark,
.edBtn,
.rmActions button {
  background: linear-gradient(180deg, rgba(255,255,255,.95), rgba(255,255,255,.78)) !important;
  color:#1e1b4b !important;
  border:1px solid rgba(255,255,255,.35) !important;
  box-shadow:
    0 10px 26px rgba(0,0,0,.18),
    inset 0 1px 0 rgba(255,255,255,.65) !important;
}

/* hover */
button:hover,
.btn:hover,
.miniBtn:hover,
.miniBtnDark:hover,
.edBtn:hover,
.rmActions button:hover {
  background: linear-gradient(180deg, rgba(255,255,255,1), rgba(243,232,255,.9)) !important;
}

/* ghost hariç */
.ghost {
  background: rgba(0,0,0,.22) !important;
  color: rgba(255,255,255,.92) !important;
}

/* Avatar placeholder (harfler) */
.ph.txt{
  opacity: 1;
  display:flex;
  align-items:center;
  justify-content:center;
  font-weight:900;
  font-size:12px;
  letter-spacing:.5px;
  color:#fff;
}

/* .ph genel opacity'si avatarları soldurmasın */
.avSm.ph,
.edAv.ph,
.edCav.ph,
.umAv.ph{
  opacity: 1;
}

/* (İsteğe bağlı) hepsinde text kesin ortada kalsın */
.avSm.ph.txt,
.edAv.ph.txt,
.edCav.ph.txt,
.umAv.ph.txt{
  display:flex;
  align-items:center;
  justify-content:center;
  color:#fff;
  font-weight:900;
}

/* ===== /FORCE WHITE BUTTONS ===== */
`