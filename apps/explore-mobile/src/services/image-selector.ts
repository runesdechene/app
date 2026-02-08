import { Nullable } from '@/shared/types'
import { MediaUploader } from '@services'
import * as ImagePicker from 'expo-image-picker'
import { customAlphabet } from 'nanoid/non-secure'

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10)

export type PickedMedia = {
  id: string
  url: string
}

export type OnUploadedResult = {
  id: string
  url: string
}

export type OnUploadedAsMediaResult = {
  id: string
  media: {
    id: string
    url: string
  }
}

export class ImageSelector {
  constructor(private readonly mediaUploader: MediaUploader) {}

  async pickMany({
    onSelected,
    onUploaded,
    onFailed,
  }: {
    onSelected: (medias: PickedMedia[]) => Promise<any>
    onUploaded: (result: OnUploadedResult) => Promise<any>
    onFailed: (id: string) => Promise<any>
  }) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.9,
    })

    if (result.canceled) {
      return
    }

    const medias: PickedMedia[] = result.assets.map(asset => ({
      id: nanoid(),
      url: asset.uri,
    }))

    await onSelected(medias)

    await Promise.all(
      medias.map(async asset => {
        try {
          const { url } = await this.mediaUploader.storeAsUrl({
            uri: asset.url,
          })

          await onUploaded({ id: asset.id, url })
        } catch (e) {
          await onFailed(asset.id)
        }
      }),
    )
  }

  async pickOne({
    onSelected,
    onUploaded,
    onFailed,
  }: {
    onSelected: (images: PickedMedia) => Promise<any>
    onUploaded: (result: OnUploadedResult) => Promise<any>
    onFailed: (id: string) => Promise<any>
  }) {
    const image = await this.selectOne()
    if (!image) {
      return null
    }

    await onSelected(image)

    try {
      const { url } = await this.mediaUploader.storeAsUrl({
        uri: image.url,
      })

      await onUploaded({ id: image.id, url })
    } catch (e) {
      await onFailed(image.id)
    }
  }

  async pickOneAndStoreAsMedia({
    onSelected,
    onUploaded,
    onFailed,
  }: {
    onSelected: (medias: PickedMedia) => Promise<any>
    onUploaded: (result: OnUploadedAsMediaResult) => Promise<any>
    onFailed: () => Promise<any>
  }) {
    const image = await this.selectOne()
    if (!image) {
      return null
    }

    await onSelected(image)

    try {
      const media = await this.mediaUploader.storeAsMedia({
        uri: image.url,
      })

      await onUploaded({ id: image.id, media })
    } catch (e) {
      await onFailed()
    }
  }

  async pickManyAndStoreAsMedia({
    onSelected,
    onUploaded,
    onFailed,
  }: {
    onSelected: (medias: PickedMedia[]) => Promise<any>
    onUploaded: (result: OnUploadedAsMediaResult) => Promise<any>
    onFailed: (id: string) => Promise<any>
  }) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.9,
    })

    if (result.canceled) {
      return
    }

    const medias: PickedMedia[] = result.assets.map(asset => ({
      id: nanoid(),
      url: asset.uri,
    }))

    await onSelected(medias)

    await Promise.all(
      medias.map(async asset => {
        try {
          const media = await this.mediaUploader.storeAsMedia({
            uri: asset.url,
          })

          await onUploaded({ id: asset.id, media })
        } catch (e) {
          await onFailed(asset.id)
        }
      }),
    )
  }

  private async selectOne(): Promise<Nullable<PickedMedia>> {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.9,
    })

    if (result.canceled || result.assets.length === 0) {
      return null
    }

    return result.assets.map(asset => ({
      id: nanoid(),
      url: asset.uri,
    }))[0]
  }
}
