/**
 * QUOI     — les liens d'invitation des Compagnies (`?company=<clé>`, créés par la V1 et déjà
 *            partagés) ouvrent la fiche de la Compagnie.
 * POURQUOI — la bascule (spec 2026-10-07) : la V1 disparaît, ses liens restent. La base traduit
 *            la clé (public_slug, ou l'identifiant des plus anciens liens) : compagnie_par_lien,
 *            migration 453.
 * ATTENTION — rendu derrière la garde d'accès : il faut un compte pour voir une Compagnie. Une clé
 *            inconnue ne fait rien, l'Explorateur reste où il est.
 */
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { supabase } from '@/shared/supabase/client'
import { cleDInvitation } from './cleDInvitation'

export function Invitation() {
  const { search } = useLocation()
  const navigate = useNavigate()
  const cle = cleDInvitation(search)

  useEffect(() => {
    if (!cle) return
    void supabase.rpc('compagnie_par_lien', { p_cle: cle }).then(({ data }) => {
      if (data) void navigate(`/compagnies/compagnie/${data}`, { replace: true })
    })
  }, [cle, navigate])

  return null
}
