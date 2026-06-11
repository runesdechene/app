import { useEffect, useMemo, useState } from 'react'
import JSZip from 'jszip'
import { supabase } from '../lib/supabase'
import { pushImageToProduct, deleteProductImage, type ShopifyProductHit } from '../lib/shopifyProducts'
import {
  type PhotoStatus, type SubmitterRole, type SubmissionImage, type PhotoTag, type PhotoSubmission,
} from './photos/types'
import { PhotosToolbar } from './photos/PhotosToolbar'
import { SubmissionList } from './photos/SubmissionList'
import { SubmissionDetail } from './photos/SubmissionDetail'
import { TagManager } from './photos/TagManager'
import { Lightbox } from './photos/Lightbox'
import './photos/Photos.css'

/** Texte alternatif Shopify : "Pierre mesure 1m83 et porte du M" (parties omises si absentes). */
function buildImageAlt(name: string | null, heightCm: number | null, size: string | null): string {
  const n = (name ?? '').trim()
  const heightStr = typeof heightCm === 'number' && heightCm > 0
    ? `${Math.floor(heightCm / 100)}m${String(Math.round(heightCm % 100)).padStart(2, '0')}`
    : ''
  const sz = size && size !== 'none' ? size.trim() : ''
  if (n && heightStr && sz) return `${n} mesure ${heightStr} et porte du ${sz}`
  if (n && heightStr) return `${n} mesure ${heightStr}`
  if (n && sz) return `${n} porte du ${sz}`
  if (n) return n
  return 'Communauté Runes de Chêne'
}

export function Photos() {
  const [submissions, setSubmissions] = useState<PhotoSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [allTags, setAllTags] = useState<PhotoTag[]>([])
  const [filter, setFilter] = useState<PhotoStatus | 'all'>('pending')
  const [roleFilter, setRoleFilter] = useState<'all' | SubmitterRole>('all')
  const [tagFilter, setTagFilter] = useState<'all' | string>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showTagManager, setShowTagManager] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [downloadSince, setDownloadSince] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState('')
  const [crownInput, setCrownInput] = useState<Record<string, number>>({})
  const [lightbox, setLightbox] = useState<{ images: SubmissionImage[]; index: number } | null>(null)
  const [missionTitles, setMissionTitles] = useState<Record<string, string>>({})

  // Fetch tags
  useEffect(() => {
    async function fetchTags() {
      const { data } = await supabase.rpc('get_photo_tags')
      if (data) setAllTags(data)
    }
    fetchTags()
  }, [])

  // Map slug→titre des missions, pour afficher le rattachement quest_ref en clair.
  useEffect(() => {
    supabase.from('missions').select('slug, title').then(({ data }) => {
      const map: Record<string, string> = {}
      for (const m of (data as Array<{ slug: string; title: string }> | null) ?? []) map[m.slug] = m.title
      setMissionTitles(map)
    })
  }, [])

  // Fetch submissions
  useEffect(() => {
    async function fetchSubmissions() {
      setLoading(true)
      try {
        const { data: subs } = await supabase.rpc('get_photo_submissions', {
          p_status: filter === 'all' ? null : filter
        })

        if (subs && subs.length > 0) {
          const subIds = subs.map((s: PhotoSubmission) => s.id)

          const [{ data: images }, { data: tagLinks }] = await Promise.all([
            supabase.rpc('get_submission_images_batch', { p_submission_ids: subIds }),
            supabase.rpc('get_submission_tags_batch', { p_submission_ids: subIds })
          ])

          const enriched = subs.map((s: PhotoSubmission) => ({
            ...s,
            hub_submission_images: (images || []).filter((img: SubmissionImage & { submission_id: string }) => img.submission_id === s.id),
            tags: (tagLinks || [])
              .filter((t: { submission_id: string }) => t.submission_id === s.id)
              .map((t: { tag_id: string; tag_name: string }) => ({ id: t.tag_id, name: t.tag_name }))
          }))
          setSubmissions(enriched)
        } else {
          setSubmissions([])
        }
      } finally {
        setLoading(false)
      }
    }

    fetchSubmissions()
  }, [filter])

  const crownsFor = (id: string) => crownInput[id] ?? 10

  const filteredSubmissions = useMemo(() => submissions.filter(s => {
    if (filter !== 'all' && s.status !== filter) return false
    if (roleFilter !== 'all' && s.submitter_role !== roleFilter) return false
    if (tagFilter !== 'all' && !s.tags.some(t => t.id === tagFilter)) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!s.submitter_name.toLowerCase().includes(q) && !s.submitter_email.toLowerCase().includes(q)) return false
    }
    return true
  }), [submissions, filter, roleFilter, tagFilter, search])

  useEffect(() => {
    if (filteredSubmissions.length === 0) { if (selectedId !== null) setSelectedId(null); return }
    if (!selectedId || !filteredSubmissions.some(s => s.id === selectedId)) setSelectedId(filteredSubmissions[0].id)
  }, [filteredSubmissions, selectedId])

  const selected = filteredSubmissions.find(s => s.id === selectedId) ?? null
  const pendingCount = useMemo(() => submissions.filter(s => s.status === 'pending').length, [submissions])

  const downloadableSubmissions = downloadSince
    ? filteredSubmissions.filter(s => new Date(s.created_at) >= new Date(downloadSince))
    : []
  const downloadableImageCount = downloadableSubmissions.reduce((sum, s) => sum + (s.hub_submission_images?.length || 0), 0)

  const moderate = async (subId: string, status: PhotoStatus, crowns?: number) => {
    const { error } = await supabase.rpc('moderate_submission', {
      p_submission_id: subId,
      p_status: status,
      p_crowns: crowns ?? null
    })

    if (!error) {
      if (filter !== 'all') {
        setSubmissions(prev => prev.filter(s => s.id !== subId))
      } else {
        setSubmissions(prev => prev.map(s =>
          s.id === subId ? { ...s, status } : s
        ))
      }
    }
  }

  const deleteSubmission = async (subId: string) => {
    if (!window.confirm('Supprimer definitivement cette soumission ?')) return

    const { error } = await supabase.rpc('delete_photo_submission', {
      p_submission_id: subId
    })

    if (!error) {
      setSubmissions(prev => prev.filter(s => s.id !== subId))
    }
  }

  // Tag management
  const createTag = async () => {
    const name = newTagName.trim()
    if (!name) return
    const { data } = await supabase.rpc('create_photo_tag', { p_name: name })
    if (data) {
      setAllTags(prev => [...prev, { id: data, name: name.toLowerCase() }].sort((a, b) => a.name.localeCompare(b.name)))
      setNewTagName('')
    }
  }

  const deleteTag = async (tagId: string) => {
    if (!window.confirm('Supprimer ce tag ? Il sera retire de toutes les photos.')) return
    const { error } = await supabase.rpc('delete_photo_tag', { p_tag_id: tagId })
    if (!error) {
      setAllTags(prev => prev.filter(t => t.id !== tagId))
      setSubmissions(prev => prev.map(s => ({
        ...s,
        tags: s.tags.filter(t => t.id !== tagId)
      })))
    }
  }

  const addTagToSubmission = async (subId: string, tagId: string) => {
    const { error } = await supabase.rpc('add_tag_to_submission', {
      p_submission_id: subId,
      p_tag_id: tagId
    })
    if (!error) {
      const tag = allTags.find(t => t.id === tagId)
      if (tag) {
        setSubmissions(prev => prev.map(s =>
          s.id === subId ? { ...s, tags: [...s.tags, tag] } : s
        ))
      }
    }
  }

  const removeTagFromSubmission = async (subId: string, tagId: string) => {
    const { error } = await supabase.rpc('remove_tag_from_submission', {
      p_submission_id: subId,
      p_tag_id: tagId
    })
    if (!error) {
      setSubmissions(prev => prev.map(s =>
        s.id === subId ? { ...s, tags: s.tags.filter(t => t.id !== tagId) } : s
      ))
    }
  }

  // Download helpers
  const sanitizeFilename = (str: string) =>
    str.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim()

  const buildDownloadName = (sub: PhotoSubmission, index: number, url: string) => {
    const ext = url.split('.').pop()?.split('?')[0] || 'webp'
    const parts = [sanitizeFilename(sub.submitter_name)]
    if (sub.submitter_instagram) parts.push(sanitizeFilename(sub.submitter_instagram))
    parts.push(String(index + 1))
    return parts.join(' - ') + '.' + ext
  }

  const handleDownloadZip = async () => {
    if (downloadableSubmissions.length === 0) return
    setIsDownloading(true)
    setDownloadProgress('Preparation...')

    try {
      const zip = new JSZip()
      let fileIndex = 0
      const totalFiles = downloadableImageCount

      for (const sub of downloadableSubmissions) {
        const images = (sub.hub_submission_images || []).sort((a, b) => a.sort_order - b.sort_order)

        for (let i = 0; i < images.length; i++) {
          fileIndex++
          setDownloadProgress(`Telechargement ${fileIndex}/${totalFiles}...`)

          const img = images[i]
          const filename = buildDownloadName(sub, i, img.image_url)

          try {
            const response = await fetch(img.image_url)
            if (!response.ok) continue
            const blob = await response.blob()
            zip.file(filename, blob)
          } catch (err) {
            console.warn('[Photos] zip fetch skipped file', filename, err)
          }
        }
      }

      setDownloadProgress('Creation de l\'archive...')
      const content = await zip.generateAsync({ type: 'blob' })

      // Déclencher le téléchargement
      const url = URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = url
      const dateStr = downloadSince.replace(/-/g, '')
      a.download = `photos-communaute-depuis-${dateStr}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setDownloadProgress('')
    } catch (err) {
      console.error('[Photos] downloadArchive failed', err)
      setDownloadProgress('Erreur lors du telechargement')
    } finally {
      setIsDownloading(false)
    }
  }

  const downloadSingleSubmission = async (sub: PhotoSubmission) => {
    const images = (sub.hub_submission_images || []).sort((a, b) => a.sort_order - b.sort_order)
    if (images.length === 0) return

    if (images.length === 1) {
      // Téléchargement direct
      try {
        const response = await fetch(images[0].image_url)
        if (!response.ok) return
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = buildDownloadName(sub, 0, images[0].image_url)
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } catch (err) { console.error('[Photos] single download failed', err); alert('Erreur lors du téléchargement') }
    } else {
      // Mini ZIP pour plusieurs images
      const zip = new JSZip()
      for (let i = 0; i < images.length; i++) {
        try {
          const response = await fetch(images[i].image_url)
          if (!response.ok) continue
          const blob = await response.blob()
          zip.file(buildDownloadName(sub, i, images[i].image_url), blob)
        } catch (err) { console.error('[Photos] submission zip fetch failed', err); alert('Erreur lors du téléchargement') }
      }
      const content = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = url
      a.download = `${sanitizeFilename(sub.submitter_name)}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  const downloadSingleImage = async (sub: PhotoSubmission, url: string, index: number) => {
    try {
      const response = await fetch(url)
      if (!response.ok) return
      const blob = await response.blob()
      const filename = buildDownloadName(sub, index, url)
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch (err) { console.error('[Photos] downloadSingleImage failed', err); alert('Erreur lors du téléchargement') }
  }

  const openLightbox = (images: SubmissionImage[], index: number) => {
    setLightbox({ images: [...images].sort((a, b) => a.sort_order - b.sort_order), index })
  }

  const closeLightbox = () => setLightbox(null)

  const saveMessage = async (subId: string, msg: string | null) => {
    const { error } = await supabase.rpc('update_submission_message', { p_submission_id: subId, p_message: msg })
    if (!error) setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, message: msg } : s))
  }

  const linkImage = async (subId: string, imageId: string, hit: ShopifyProductHit) => {
    await supabase.rpc('set_submission_image_shopify_product', { p_image_id: imageId, p_product_id: hit.productId, p_handle: hit.handle, p_title: hit.title })
    setSubmissions(prev => prev.map(s => s.id !== subId ? s : ({ ...s, hub_submission_images: s.hub_submission_images.map(i => i.id === imageId ? { ...i, shopify_product_id: hit.productId, shopify_product_handle: hit.handle, shopify_product_title: hit.title } : i) }) ))
  }

  const setPhotoProduit = async (subId: string, imageId: string, on: boolean) => {
    const sub = submissions.find(s => s.id === subId)
    const img = sub?.hub_submission_images.find(i => i.id === imageId)
    if (!sub || !img || !img.shopify_product_id) return
    if (on) {
      const alt = buildImageAlt(sub.submitter_name, sub.model_height_cm, img.size)
      const mediaId = await pushImageToProduct(img.shopify_product_id, img.image_url, alt)
      await supabase.rpc('set_submission_image_media', { p_image_id: imageId, p_media_id: mediaId })
      setSubmissions(prev => prev.map(s => s.id !== subId ? s : ({ ...s, hub_submission_images: s.hub_submission_images.map(i => i.id === imageId ? { ...i, shopify_media_id: mediaId } : i) }) ))
    } else {
      if (img.shopify_media_id) await deleteProductImage(img.shopify_product_id, img.shopify_media_id)
      await supabase.rpc('set_submission_image_media', { p_image_id: imageId, p_media_id: '' })
      setSubmissions(prev => prev.map(s => s.id !== subId ? s : ({ ...s, hub_submission_images: s.hub_submission_images.map(i => i.id === imageId ? { ...i, shopify_media_id: null } : i) }) ))
    }
  }

  const setImageCommunity = async (subId: string, imageId: string, on: boolean) => {
    await supabase.rpc('set_submission_image_community', { p_image_id: imageId, p_show: on })
    setSubmissions(prev => prev.map(s => s.id !== subId ? s : ({ ...s, hub_submission_images: s.hub_submission_images.map(i => i.id === imageId ? { ...i, show_in_community: on } : i) }) ))
  }

  const setImageWall = async (subId: string, imageId: string, on: boolean) => {
    await supabase.rpc('set_submission_image_wall', { p_image_id: imageId, p_show: on })
    setSubmissions(prev => prev.map(s => s.id !== subId ? s : ({ ...s, hub_submission_images: s.hub_submission_images.map(i => i.id === imageId ? { ...i, show_on_wall: on } : i) }) ))
  }

  const deleteImage = async (subId: string, imageId: string) => {
    if (!window.confirm('Supprimer définitivement cette photo ? Action irréversible.')) return
    const sub = submissions.find(s => s.id === subId)
    const img = sub?.hub_submission_images.find(i => i.id === imageId)
    if (!img) return
    if (img.shopify_product_id && img.shopify_media_id) {
      await deleteProductImage(img.shopify_product_id, img.shopify_media_id).catch(() => {})
    }
    if (img.storage_path) {
      await supabase.storage.from('community-photos').remove([img.storage_path]).catch(() => {})
    }
    await supabase.rpc('delete_submission_image', { p_image_id: imageId })
    setSubmissions(prev => prev.map(s => s.id !== subId ? s : ({ ...s, hub_submission_images: s.hub_submission_images.filter(i => i.id !== imageId) }) ))
  }

  const unlinkImage = async (subId: string, imageId: string) => {
    const sub = submissions.find(s => s.id === subId)
    const img = sub?.hub_submission_images.find(i => i.id === imageId)
    if (!sub || !img || !img.shopify_product_id) return
    if (img.shopify_media_id) await deleteProductImage(img.shopify_product_id, img.shopify_media_id)
    await supabase.rpc('clear_submission_image_shopify_product', { p_image_id: imageId })
    setSubmissions(prev => prev.map(s => s.id !== subId ? s : ({ ...s, hub_submission_images: s.hub_submission_images.map(i => i.id === imageId ? { ...i, shopify_product_id: null, shopify_product_handle: null, shopify_product_title: null, shopify_media_id: null, show_in_community: false } : i) }) ))
  }


  if (loading) return <div className="mod"><div className="mod-loading">Chargement…</div></div>

  return (
    <div className="mod">
      <PhotosToolbar
        filter={filter} onFilter={(f) => { setFilter(f); setSelectedId(null) }}
        roleFilter={roleFilter} onRoleFilter={(r) => { setRoleFilter(r); setSelectedId(null) }}
        tagFilter={tagFilter} onTagFilter={(t) => { setTagFilter(t); setSelectedId(null) }}
        tags={allTags}
        search={search} onSearch={setSearch}
        pendingCount={pendingCount}
        onToggleTagManager={() => setShowTagManager(v => !v)}
        downloadSince={downloadSince} onDownloadSince={setDownloadSince}
        downloadCount={{ subs: downloadableSubmissions.length, files: downloadableImageCount }}
        isDownloading={isDownloading} downloadProgress={downloadProgress} onDownloadZip={handleDownloadZip}
      />
      {showTagManager && (
        <TagManager tags={allTags} newTagName={newTagName} onNewTagName={setNewTagName}
          onCreate={createTag} onDelete={deleteTag} onClose={() => setShowTagManager(false)} />
      )}
      {filteredSubmissions.length === 0 ? (
        <div className="mod-empty">Aucune soumission</div>
      ) : (
        <div className="mod-split">
          <SubmissionList submissions={filteredSubmissions} selectedId={selectedId} onSelect={setSelectedId} missionTitles={missionTitles} />
          {selected ? (
            <SubmissionDetail
              key={selected.id}
              submission={selected}
              allTags={allTags}
              missionTitles={missionTitles}
              crowns={crownsFor(selected.id)}
              onCrowns={(n) => setCrownInput(prev => ({ ...prev, [selected.id]: n }))}
              onModerate={(status, crowns) => moderate(selected.id, status, crowns)}
              onDelete={() => deleteSubmission(selected.id)}
              onSaveMessage={(msg) => saveMessage(selected.id, msg)}
              onAddTag={(tagId) => addTagToSubmission(selected.id, tagId)}
              onRemoveTag={(tagId) => removeTagFromSubmission(selected.id, tagId)}
              onSetImageWall={(imageId, on) => setImageWall(selected.id, imageId, on)}
              onDeleteImage={(imageId) => deleteImage(selected.id, imageId)}
              onLinkImage={(imageId, hit) => linkImage(selected.id, imageId, hit)}
              onUnlinkImage={(imageId) => unlinkImage(selected.id, imageId)}
              onSetPhotoProduit={(imageId, on) => setPhotoProduit(selected.id, imageId, on)}
              onSetCommunity={(imageId, on) => setImageCommunity(selected.id, imageId, on)}
              onOpenLightbox={(index) => openLightbox(selected.hub_submission_images, index)}
              onDownloadSubmission={() => downloadSingleSubmission(selected)}
              onDownloadImage={(index) => { const imgs = [...selected.hub_submission_images].sort((a, b) => a.sort_order - b.sort_order); downloadSingleImage(selected, imgs[index].image_url, index) }}
            />
          ) : <div className="mod-detail mod-detail--empty">Sélectionne une soumission</div>}
        </div>
      )}
      {lightbox && (
        <Lightbox images={lightbox.images} index={lightbox.index}
          onClose={closeLightbox}
          onIndex={(i) => setLightbox(lb => lb ? { ...lb, index: i } : lb)} />
      )}
    </div>
  )
}
