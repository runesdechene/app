import { supabase } from '@/shared/supabase/client'
import { customAlphabet } from 'nanoid/non-secure'

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 21)

export class SupabaseMediaUploader {
  constructor(private readonly getUserId: () => string | null) {}

  async storeAsUrl({ uri }: { uri: string }): Promise<{ url: string }> {
    const userId = this.getUserId()
    if (!userId) throw new Error('Not authenticated')

    const fileExt = uri.split('.').pop() ?? 'jpg'
    const fileName = `${userId}/${nanoid()}.${fileExt}`

    const response = await fetch(uri)
    const blob = await response.blob()

    const { error } = await supabase.storage
      .from('place-images')
      .upload(fileName, blob, {
        contentType: `image/${fileExt}`,
        upsert: false,
      })

    if (error) throw error

    const {
      data: { publicUrl },
    } = supabase.storage.from('place-images').getPublicUrl(fileName)

    return { url: publicUrl }
  }

  async storeAsMedia({
    uri,
  }: {
    uri: string
  }): Promise<{ id: string; url: string }> {
    const userId = this.getUserId()
    if (!userId) throw new Error('Not authenticated')

    const { url } = await this.storeAsUrl({ uri })
    const mediaId = nanoid()

    // Create an image_media record
    const { error } = await supabase.from('image_media').insert({
      id: mediaId,
      user_id: userId,
      variants: [
        {
          name: 'original',
          url,
          height: 0,
          width: 0,
          size: 0,
        },
      ],
    })

    if (error) throw error

    return { id: mediaId, url }
  }
}
