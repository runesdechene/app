/**
 * QUOI     — les champs d'une fiche de Compagnie, communs à « Fonder » et « Gérer » (maquettes
 *            390:258 et 396:326) : l'avatar, le nom, la devise et son compteur, la mission, la
 *            couleur (une palette, ou une couleur libre), publique ou privée.
 * POURQUOI — les deux écrans ne divergent jamais. La devise présente la Compagnie dans les listes,
 *            en une phrase (Uriel, 05/10).
 */
import { useState } from 'react'
import { Segments } from '@/shared/ui/Segments'
import type { ChampsFiche } from '../api/lireCompagnies'
import { envoyerAvatar } from '../api/compagnies'
import { PALETTE } from '../lib/palette'
import { AvatarCompagnie } from './AvatarCompagnie'
import styles from './ChampsCompagnie.module.css'

const ACCES = [
  { id: 'publique', libelle: 'Publique' },
  { id: 'privee', libelle: 'Privée' },
] as const

export function ChampsCompagnie({
  valeur,
  changer,
}: {
  valeur: ChampsFiche
  changer: (partiel: Partial<ChampsFiche>) => void
}) {
  const [envoi, setEnvoi] = useState<'repos' | 'envoi' | 'echec'>('repos')

  async function choisirAvatar(fichier: File | undefined) {
    if (!fichier) return
    setEnvoi('envoi')
    try {
      changer({ avatar: await envoyerAvatar(fichier) })
      setEnvoi('repos')
    } catch {
      setEnvoi('echec')
    }
  }

  return (
    <div className={styles.champs}>
      <div className={styles.avatar}>
        <AvatarCompagnie
          nom={valeur.nom || '?'}
          avatar={valeur.avatar}
          couleur={valeur.couleur}
          taille={64}
        />
        <label className={styles.lienAvatar}>
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={envoi === 'envoi'}
            onChange={(e) => {
              void choisirAvatar(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          {envoi === 'envoi' ? 'Envoi…' : valeur.avatar ? 'Changer l’avatar' : 'Choisir un avatar'}
        </label>
        {envoi === 'echec' && <span className={styles.aide}>L’image n’a pas pu partir.</span>}
      </div>

      <label className={styles.champ}>
        <span className={styles.etiquette}>Son nom</span>
        <input
          className={styles.saisie}
          maxLength={40}
          value={valeur.nom}
          onChange={(e) => {
            changer({ nom: e.target.value })
          }}
        />
      </label>

      <label className={styles.champ}>
        <span className={styles.etiquette}>Sa devise</span>
        <input
          className={styles.devise}
          maxLength={80}
          placeholder="Ex. : « Les sommets du Vercors, en bande »"
          value={valeur.devise}
          onChange={(e) => {
            changer({ devise: e.target.value })
          }}
        />
      </label>
      <span className={styles.compte} aria-hidden="true">
        {valeur.devise.length} / 80
      </span>

      <label className={styles.champ}>
        <span className={styles.etiquette}>Sa mission</span>
        <textarea
          className={styles.mission}
          maxLength={500}
          rows={3}
          placeholder="Ce que vous faites ensemble, où, comment on vous rejoint…"
          value={valeur.mission}
          onChange={(e) => {
            changer({ mission: e.target.value })
          }}
        />
      </label>

      <div className={styles.champ}>
        <span className={styles.etiquette}>Sa couleur</span>
        <div className={styles.palette}>
          {PALETTE.map((c, i) => (
            <button
              key={c}
              type="button"
              className={styles.pastille}
              style={{ '--couleur': c }}
              aria-label={`Couleur ${String(i + 1)}`}
              aria-pressed={valeur.couleur === c}
              onClick={() => {
                changer({ couleur: c })
              }}
            />
          ))}
          <input
            type="color"
            className={styles.libre}
            aria-label="Une autre couleur"
            value={valeur.couleur}
            onChange={(e) => {
              changer({ couleur: e.target.value })
            }}
          />
        </div>
      </div>

      <div className={styles.champ}>
        <span className={styles.etiquette}>Qui peut entrer</span>
        <Segments
          libelle="Qui peut entrer"
          options={ACCES}
          valeur={valeur.privee ? 'privee' : 'publique'}
          onChange={(v) => {
            changer({ privee: v === 'privee' })
          }}
        />
        <span className={styles.aide}>
          Privée : on demande à rejoindre, un officier accepte. Le canal reste fermé aux autres.
        </span>
      </div>
    </div>
  )
}
