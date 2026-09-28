/**
 * QUOI     — le Registre et Supabase (migration 371) : lire, écrire, et écouter les nouveaux
 *            messages en direct.
 * POURQUOI — lire et écrire passent par des fonctions de la base (le nom posé par elle) ;
 *            l'écoute est celle du temps réel de Supabase, qui respecte les règles d'accès de la
 *            table : on n'y voit que les canaux qu'on a le droit de lire.
 */
import { supabase } from '@/shared/supabase/client'
import { lireRegistre, type Canal } from './lireRegistre'

export async function fetchRegistre() {
  const { data, error } = await supabase.rpc('registre', { p_canaux: ['general', 'bugs'] })
  if (error) throw error
  return lireRegistre(data)
}

export async function ecrire(canal: Canal, texte: string) {
  const { error } = await supabase.rpc('ecrire_au_registre', { p_canal: canal, p_texte: texte })
  if (error) throw error
}

// Prévient à chaque nouveau message ; rend de quoi arrêter d'écouter.
export function ecouterRegistre(nouveau: () => void): () => void {
  const canal = supabase
    .channel('registre')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, nouveau)
    .subscribe()
  return () => {
    void supabase.removeChannel(canal)
  }
}
