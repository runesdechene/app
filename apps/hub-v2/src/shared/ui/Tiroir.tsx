/**
 * QUOI     — la fiche d'un élément, ouverte par-dessus sa liste : un panneau à droite sur PC, une
 *            pleine page sur téléphone (maquette 595:1140).
 * POURQUOI — la fiche a son adresse (/…/:id) ; fermer, c'est revenir à l'adresse de la liste — le
 *            bouton, le voile et la touche Échap font la même chose.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import styles from './Tiroir.module.css'

export function Tiroir({ titre, retour, children }: { titre: string; retour: string; children: ReactNode }) {
  const naviguer = useNavigate()
  const fermer = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    fermer.current?.focus()
  }, [])
  useEffect(() => {
    function touche(e: KeyboardEvent) {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      // Un formulaire à moitié rempli ne se perd pas d'un coup d'Échap.
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')) return
      void naviguer(retour)
    }
    window.addEventListener('keydown', touche)
    return () => {
      window.removeEventListener('keydown', touche)
    }
  }, [naviguer, retour])

  return (
    <div className={styles.cadre}>
      <Link to={retour} className={styles.voile} aria-label="Fermer la fiche" tabIndex={-1} />
      <section className={styles.tiroir} role="dialog" aria-modal="true" aria-label={titre}>
        <Link ref={fermer} to={retour} className={styles.fermer}>✕ Fermer</Link>
        {children}
      </section>
    </div>
  )
}
