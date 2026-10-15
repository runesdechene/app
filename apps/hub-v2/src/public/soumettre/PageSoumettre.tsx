/**
 * QUOI     — /soumettre-contenu : un joueur envoie ses photos et vidéos en tenue Runes de Chêne, en
 *            quatre étapes (contenus, tailles, histoire, toi). On y arrive par un QR imprimé ou par
 *            le lien d'une mission (`?quete=<slug>`).
 * POURQUOI — le design de la page en ligne (ancien StudioSubmit), gardé par Uriel le 15/10 : sur PC,
 *            une carte à deux panneaux posée sur la photo du réglage Studio ; au téléphone, le
 *            formulaire seul, plein écran. L'étape est dans l'adresse (`?etape=2`) : le retour du
 *            navigateur revient d'une étape, et une étape tapée à la main n'ouvre jamais plus loin
 *            que ce qui est rempli.
 */
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { PagePublique } from '../PagePublique'
import { lireConfigStudio, lireMissions } from './api'
import { EtapeContenus } from './EtapeContenus'
import { EtapeHistoire } from './EtapeHistoire'
import { EtapeTailles } from './EtapeTailles'
import { EtapeToi } from './EtapeToi'
import { Frise } from './Frise'
import { etapeAffichee, HISTOIRE_VIDE, TOI_VIDE, type Contenu } from './lib/formulaire'
import { Succes } from './Succes'
import { useEnvoi } from './useEnvoi'
import styles from './PageSoumettre.module.css'

export function PageSoumettre() {
  const [params, setParams] = useSearchParams()
  const missions = useQuery({ queryKey: ['soumettre', 'missions'], queryFn: lireMissions })
  const config = useQuery({ queryKey: ['soumettre', 'config'], queryFn: lireConfigStudio })
  const [contenus, setContenus] = useState<Contenu[]>([])
  const [histoire, setHistoire] = useState(HISTOIRE_VIDE)
  const [toi, setToi] = useState(TOI_VIDE)
  const { envoyer, progression, erreur, reussite } = useEnvoi()

  const etape = etapeAffichee(params.get('etape'), contenus)
  const quete = params.get('quete') ?? ''
  const mission = missions.data?.some((m) => m.slug === quete) ? quete : ''

  function allerA(n: number) {
    setParams((p) => {
      const suite = new URLSearchParams(p)
      suite.set('etape', String(n))
      return suite
    })
  }

  function choisirMission(slug: string) {
    setParams(
      (p) => {
        const suite = new URLSearchParams(p)
        if (slug) suite.set('quete', slug)
        else suite.delete('quete')
        return suite
      },
      { replace: true },
    )
  }

  function ajouter(fichiers: File[]) {
    const nouveaux = fichiers.map((fichier) => ({ fichier, apercu: URL.createObjectURL(fichier), taille: null }))
    setContenus((cs) => [...cs, ...nouveaux])
  }

  function retirer(rang: number) {
    const contenu = contenus[rang]
    if (contenu) URL.revokeObjectURL(contenu.apercu)
    setContenus((cs) => cs.filter((_, i) => i !== rang))
  }

  function choisirTaille(rang: number, taille: string) {
    setContenus((cs) => cs.map((c, i) => (i === rang ? { ...c, taille } : c)))
  }

  const fond = config.data?.fond
  const colonne = config.data?.colonne

  let corps
  if (reussite) {
    corps = <Succes reussite={reussite} couronnes={config.data?.couronnes ?? 0} />
  } else if (progression) {
    corps = (
      <div className={styles.attente}>
        <span className={styles.roue} />
        <p role="status">{progression}</p>
      </div>
    )
  } else {
    corps = (
      <div className={styles.console}>
        <aside className={styles.colonne}>
          {colonne && <img className={styles.imageColonne} src={colonne} alt="" />}
          <div className={styles.colonneDedans}>
            <p className={styles.marque}>Runes de Chêne</p>
            <h1 className={styles.titre}>
              Envoyer <br />
              mes contenus
            </h1>
            <Frise etape={etape} sens="vertical" />
            <p className={styles.citation}>
              « On te guide pas à pas. Quelques minutes, et tes clichés rejoignent le Mouvement. »
            </p>
          </div>
        </aside>

        <section className={styles.panneau}>
          <Frise etape={etape} sens="horizontal" />
          {etape === 1 && (
            <EtapeContenus
              missions={missions.data ?? []}
              mission={mission}
              choisirMission={choisirMission}
              contenus={contenus}
              ajouter={ajouter}
              retirer={retirer}
              suivant={() => {
                allerA(2)
              }}
            />
          )}
          {etape === 2 && (
            <EtapeTailles
              contenus={contenus}
              choisirTaille={choisirTaille}
              precedent={() => {
                allerA(1)
              }}
              suivant={() => {
                allerA(3)
              }}
            />
          )}
          {etape === 3 && (
            <EtapeHistoire
              histoire={histoire}
              changer={(modif) => {
                setHistoire((h) => ({ ...h, ...modif }))
              }}
              precedent={() => {
                allerA(2)
              }}
              suivant={() => {
                allerA(4)
              }}
            />
          )}
          {etape === 4 && (
            <EtapeToi
              toi={toi}
              changer={(modif) => {
                setToi((t) => ({ ...t, ...modif }))
              }}
              erreur={erreur}
              precedent={() => {
                allerA(3)
              }}
              envoyer={() => {
                void envoyer(contenus, histoire, toi, mission)
              }}
            />
          )}
        </section>
      </div>
    )
  }

  return (
    <PagePublique disposition="carte" photo={fond ? <img className={styles.fond} src={fond} alt="" /> : undefined}>
      {corps}
    </PagePublique>
  )
}
