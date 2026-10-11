/**
 * QUOI     — la vitrine rendue en HTML au build, pour les moteurs de recherche
 *            (spec 2026-10-11-vitrine-html-google) : les vrais chiffres et les natures, lus une
 *            fois, des lieux tirés au sort, puis la vitrine telle que l'appli la dessine.
 * POURQUOI — sans elle, /bienvenue n'est qu'une <div> vide pour Google. Construit par
 *            `vite build --ssr` (mêmes classes, mêmes images que l'appli) et appelé par
 *            scripts/prerendre-vitrine.mjs.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { prerender } from 'react-dom/static'
import { MemoryRouter } from 'react-router'
import { fetchChiffres, fetchLieuxAuHasard, fetchNatures } from '@/features/vitrine/api/vitrine'
import { Vitrine } from '@/features/vitrine/components/Vitrine'

export async function rendreVitrine() {
  const client = new QueryClient()
  client.setQueryData(['vitrine', 'chiffres'], await fetchChiffres())
  client.setQueryData(['vitrine', 'natures'], await fetchNatures())
  client.setQueryData(['vitrine', 'lieux'], await fetchLieuxAuHasard())
  client.setQueryData(['vitrine', 'connecte'], false)

  const { prelude } = await prerender(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/bienvenue']}>
        <Vitrine />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  const html = await new Response(prelude).text()
  // Hors d'un document entier, React laisse le titre et la description de la vitrine dans le
  // corps ; index.html les porte déjà dans l'en-tête.
  return html.replace(/<title>.*?<\/title>/, '').replace(/<meta name="description"[^>]*>/, '')
}
