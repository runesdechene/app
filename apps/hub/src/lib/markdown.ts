import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ breaks: true, gfm: true })

/** Rendu Markdown → HTML sanitisé (preview admin du composer). */
export function renderMarkdown(md: string): string {
  const raw = marked.parse(md ?? '', { async: false }) as string
  return typeof DOMPurify.sanitize === 'function' ? DOMPurify.sanitize(raw) : raw
}
