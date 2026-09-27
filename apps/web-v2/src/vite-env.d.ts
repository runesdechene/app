/**
 * QUOI     — déclare les variables d'environnement que la V2 lit (fichier .env racine).
 * POURQUOI — sans cette déclaration, TypeScript ignore leurs noms ; une faute de frappe
 *            passerait en silence.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
