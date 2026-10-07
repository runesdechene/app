/**
 * QUOI     — le menu du profil (maquette 476:434, Uriel 07/10) : qui je suis (portrait, nom, niveau,
 *            premier titre porté), puis Mon profil · Les énigmes · Tous les titres · Préférences, et
 *            « Se déconnecter » à part.
 * POURQUOI — le portrait de la barre ouvre ce menu, téléphone comme PC : la coupe, l'engrenage et la
 *            sortie y sont entrés ; la cloche reste dans la barre.
 * ATTENTION — chaque ligne ferme d'abord la feuille. Se déconnecter ne navigue nulle part : la garde
 *            d'accès voit la session tomber et renvoie vers la V1.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { seDeconnecter } from '@/features/compte/api/session'
import { useExplorateur } from '@/features/compte/hooks/useExplorateur'
import { useMonIdentifiant } from '@/features/compte/hooks/useMonIdentifiant'
import { useMesEnigmes } from '@/features/enigmes/hooks/useMesEnigmes'
import { useMesTitres } from '@/features/titres/hooks/useMesTitres'
import iconeEnigmes from '@/assets/ui/menu-enigmes.svg'
import iconePreferences from '@/assets/ui/menu-preferences.svg'
import iconeProfil from '@/assets/ui/menu-profil.svg'
import iconeSortie from '@/assets/ui/menu-sortie.svg'
import iconeTitres from '@/assets/ui/menu-titres.svg'
import { Avatar } from '@/shared/ui/Avatar'
import { Feuille } from '@/shared/ui/Feuille'
import { useOuvrir } from '../navigation/useOuvrir'
import styles from './MenuDuProfil.module.css'

export function MenuDuProfil({ onFermer }: { onFermer: () => void }) {
  const { profil } = useExplorateur(useMonIdentifiant())
  const { mesEnigmes } = useMesEnigmes()
  const { titres } = useMesTitres()
  const navigate = useNavigate()
  const ouvrir = useOuvrir()
  const [echec, setEchec] = useState(false)

  const aller = (action: () => void) => () => {
    onFermer()
    action()
  }

  return (
    <Feuille titre="Mon menu" onFermer={onFermer}>
      <div className={styles.menu}>
        {profil && (
          <div className={styles.qui}>
            <Avatar url={profil.avatarUrl} nom={profil.nom} taille="moyen" />
            <div className={styles.nom}>
              <span className={styles.prenom}>{profil.nom}</span>
              <span className={styles.niveau}>
                {[`Niveau ${String(profil.niveau)}`, profil.titres[0]?.nom].filter(Boolean).join(' · ')}
              </span>
            </div>
          </div>
        )}
        <ul className={styles.lignes}>
          <Ligne icone={iconeProfil} libelle="Mon profil" onToucher={aller(() => void navigate('/compte'))} />
          <Ligne
            icone={iconeEnigmes}
            libelle="Les énigmes"
            detail={mesEnigmes ? `${String(mesEnigmes.resolues)} résolue${mesEnigmes.resolues > 1 ? 's' : ''}` : null}
            onToucher={aller(() => {
              ouvrir('enigmes')
            })}
          />
          <Ligne
            icone={iconeTitres}
            libelle="Tous les titres"
            detail={titres ? `${String(titres.obtenus)} obtenu${titres.obtenus > 1 ? 's' : ''}` : null}
            onToucher={aller(() => {
              ouvrir('titres')
            })}
          />
          <Ligne
            icone={iconePreferences}
            libelle="Préférences"
            onToucher={aller(() => {
              ouvrir('preferences')
            })}
          />
        </ul>
        <button
          type="button"
          className={styles.sortie}
          onClick={() => {
            setEchec(false)
            seDeconnecter().catch(() => {
              setEchec(true)
            })
          }}
        >
          <img src={iconeSortie} alt="" />
          Se déconnecter
        </button>
        {echec && (
          <p role="alert" className={styles.alerte}>
            La déconnexion a échoué. Vérifie ta connexion, puis réessaie.
          </p>
        )}
      </div>
    </Feuille>
  )
}

function Ligne({
  icone,
  libelle,
  detail = null,
  onToucher,
}: {
  icone: string
  libelle: string
  detail?: string | null
  onToucher: () => void
}) {
  return (
    <li>
      <button type="button" className={styles.ligne} onClick={onToucher}>
        <img src={icone} alt="" />
        <span className={styles.libelle}>{libelle}</span>
        {detail && <span className={styles.detail}>{detail}</span>}
        <span className={styles.chevron} aria-hidden="true">
          ›
        </span>
      </button>
    </li>
  )
}
