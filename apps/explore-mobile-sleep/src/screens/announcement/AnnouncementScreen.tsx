import { isDev } from '@/shared/api/environment'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { Announcement, Feature } from '@ui'

import { useState } from 'react'

export default function AnnouncementScreen() {
  const { storage, appVersion } = useDependencies()
  const [show, setShow] = useState(false)
  const FEATURES: Feature[] = []

  const shouldShowNew = async () => {
    const persistedVersion = await storage.getItem('@app_version')
    setShow(persistedVersion !== appVersion)
  }
  shouldShowNew()

  const setVersion = () => {
    storage.setItem('@app_version', appVersion)
    setShow(false)
  }

  const filteredVersion = isDev()
    ? FEATURES
    : FEATURES.filter(x => x.version === appVersion)

  if (filteredVersion.length === 0) {
    return null
  }

  return (
    <Announcement
      visible={show}
      handleDoneButtonOnPressed={setVersion}
      features={filteredVersion}
    />
  )
}
