/**
 * QUOI     — dernière étape du build : la vitrine rendue (dist-ssr, `vite build --ssr`) entre
 *            dans la #root d'une copie de dist/index.html, écrite en dist/bienvenue.html.
 *            Netlify la sert à /bienvenue ; l'appli se monte ensuite par-dessus, à l'identique.
 * POURQUOI — spec 2026-10-11-vitrine-html-google : que Google lise le texte de la vitrine.
 */
import { readFile, rm, writeFile } from 'node:fs/promises'

const DIST = new URL('../dist/', import.meta.url)
const SSR = new URL('../dist-ssr/', import.meta.url)

const { rendreVitrine } = await import(new URL('vitrine.js', SSR).href)
const vitrine = await rendreVitrine()
const page = await readFile(new URL('index.html', DIST), 'utf-8')
if (!page.includes('<div id="root"></div>')) throw new Error('#root absent de dist/index.html')

await writeFile(
  new URL('bienvenue.html', DIST),
  page.replace('<div id="root"></div>', `<div id="root">${vitrine}</div>`),
)
await rm(SSR, { recursive: true })
console.log(`dist/bienvenue.html : ${String(vitrine.length)} signes de vitrine`)
