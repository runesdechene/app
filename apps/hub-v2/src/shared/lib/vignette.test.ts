import { expect, test } from 'vitest'
import { vignetteDe } from './vignette'

test('une photo a sa vignette à côté, en WebP', () => {
  expect(vignetteDe('submissions/a/b.webp')).toBe('submissions/a/b_thumb.webp')
  expect(vignetteDe('https://x/community-photos/submissions/a/b.JPEG')).toBe('https://x/community-photos/submissions/a/b_thumb.webp')
})

test('une vidéo, ou une vignette, n’en a pas', () => {
  expect(vignetteDe('submissions/a/b.mp4')).toBeNull()
  expect(vignetteDe('submissions/a/b_thumb.webp')).toBeNull()
})
