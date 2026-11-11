/**
 * QUOI     — /soumettre-contenu : un client partage un avis, avec ses photos en tenue Runes de Chêne
 *            (quatre étapes : contenus, tailles, histoire, toi) ou seul (deux : ton avis, toi). Le
 *            premier écran fait choisir ; le lien d'une mission (`?quete=<slug>`) ouvre les photos.
 * POURQUOI — le design de la page en ligne (ancien StudioSubmit), gardé par Uriel le 15/10 : sur PC,
 *            une carte à deux panneaux posée sur la photo du réglage Studio ; au téléphone, le
 *            formulaire seul, plein écran. Le chemin et l'étape sont dans l'adresse
 *            (`?chemin=avis&etape=2`) : le retour du navigateur revient d'un écran, et une étape tapée
 *            à la main n'ouvre jamais plus loin que ce qui est rempli.
 */
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { PagePublique } from '../PagePublique'
import { lireConfigStudio, lireMissions } from './api'
import { ChoixDuChemin } from './ChoixDuChemin'
import { EtapeAvis } from './EtapeAvis'
import { EtapeContenus } from './EtapeContenus'
import { EtapeHistoire } from './EtapeHistoire'
import { EtapeTailles } from './EtapeTailles'
import { EtapeToi } from './EtapeToi'
import { Frise } from './Frise'
import {
  cheminDe,
  ETAPES,
  ETAPES_AVIS,
  etapeAffichee,
  etapeAvisAffichee,
  HISTOIRE_VIDE,
  TOI_VIDE,
  VETEMENTS,
  type Chemin,
  type Contenu,
} from './lib/formulaire'
import { Succes } from './Succes'
import { useEnvoi } from './useEnvoi'
import styles from './PageSoumettre.module.css'

function liberer(apercus: Set<string>) {
  for (const apercu of apercus) URL.revokeObjectURL(apercu)
  apercus.clear()
}

export function PageSoumettre() {
  const [params, setParams] = useSearchParams()
  const missions = useQuery({ queryKey: ['soumettre', 'missions'], queryFn: lireMissions })
  const config = useQuery({ queryKey: ['soumettre', 'config'], queryFn: lireConfigStudio })
  const [contenus, setContenus] = useState<Contenu[]>([])
  // Les adresses d'aperçu encore ouvertes : libérées au retrait, à l'envoi réussi et en quittant.
  const [apercus] = useState(() => new Set<string>())
  // Le lien de l'e-mail de demande d'avis pré-remplit le vêtement et l'adresse ; rien de plus.
  const [histoire, setHistoire] = useState(() => {
    const type = params.get('type') ?? ''
    return VETEMENTS.some((v) => v.cle === type) ? { ...HISTOIRE_VIDE, vetement: type } : HISTOIRE_VIDE
  })
  const [toi, setToi] = useState(() => ({ ...TOI_VIDE, email: params.get('email') ?? '' }))
  const { envoyer, progression, erreur, reussite } = useEnvoi()

  useEffect(
    () => () => {
      liberer(apercus)
    },
    [apercus],
  )

  const chemin = cheminDe(params)
  const etape = etapeAffichee(params.get('etape'), contenus)
  const etapeAvis = etapeAvisAffichee(params.get('etape'), histoire)
  const quete = params.get('quete') ?? ''
  const mission = missions.data?.some((m) => m.slug === quete) ? quete : ''

  function allerA(n: number) {
    setParams((p) => {
      const suite = new URLSearchParams(p)
      suite.set('etape', String(n))
      return suite
    })
  }

  function choisirChemin(c: Chemin) {
    setParams((p) => {
      const suite = new URLSearchParams(p)
      suite.set('chemin', c)
      suite.delete('etape')
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
    for (const c of nouveaux) apercus.add(c.apercu)
    setContenus((cs) => [...cs, ...nouveaux])
  }

  function retirer(rang: number) {
    const contenu = contenus[rang]
    if (contenu) {
      URL.revokeObjectURL(contenu.apercu)
      apercus.delete(contenu.apercu)
    }
    setContenus((cs) => cs.filter((_, i) => i !== rang))
  }

  function choisirTaille(rang: number, taille: string) {
    setContenus((cs) => cs.map((c, i) => (i === rang ? { ...c, taille } : c)))
  }

  const fond = config.data?.fond
  const colonne = config.data?.colonne

  // La colonne et la frise suivent le chemin : le choix, l'avis seul, ou l'avis avec photos.
  const colonneDuChemin = {
    choix: { titre: <>Partager <br />ton aventure</>, etapes: ['Ton choix'], etape: 1 },
    avis: { titre: <>Ton avis</>, etapes: ETAPES_AVIS, etape: etapeAvis },
    photos: { titre: <>Envoyer <br />mes contenus</>, etapes: ETAPES, etape },
  }[chemin ?? 'choix']

  let corps
  if (reussite) {
    corps = <Succes reussite={reussite} couronnes={config.data?.couronnes ?? 0} chemin={chemin ?? 'photos'} />
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
            <h1 className={styles.titre}>{colonneDuChemin.titre}</h1>
            <Frise etapes={colonneDuChemin.etapes} etape={colonneDuChemin.etape} sens="vertical" />
            <p className={styles.citation}>
              « On te guide pas à pas. Quelques minutes, et tes clichés rejoignent le Mouvement. »
            </p>
          </div>
        </aside>

        <section className={styles.panneau}>
          <Frise etapes={colonneDuChemin.etapes} etape={colonneDuChemin.etape} sens="horizontal" />
          {chemin === null && <ChoixDuChemin choisir={choisirChemin} />}
          {chemin === 'avis' && etapeAvis === 1 && (
            <EtapeAvis
              histoire={histoire}
              changer={(modif) => {
                setHistoire((h) => ({ ...h, ...modif }))
              }}
              suivant={() => {
                allerA(2)
              }}
            />
          )}
          {chemin === 'photos' && etape === 1 && (
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
          {chemin === 'photos' && etape === 2 && (
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
          {chemin === 'photos' && etape === 3 && (
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
          {((chemin === 'photos' && etape === 4) || (chemin === 'avis' && etapeAvis === 2)) && (
            <EtapeToi
              chemin={chemin}
              toi={toi}
              changer={(modif) => {
                setToi((t) => ({ ...t, ...modif }))
              }}
              erreur={erreur}
              precedent={() => {
                allerA(chemin === 'avis' ? 1 : 3)
              }}
              envoyer={() => {
                void envoyer(contenus, histoire, toi, mission, chemin).then((reussi) => {
                  if (reussi) liberer(apercus)
                })
              }}
            />
          )}
        </section>
      </div>
    )
  }

  return (
    <PagePublique titre="Envoyer mes contenus — Runes de Chêne" disposition="carte" photo={fond ? <img className={styles.fond} src={fond} alt="" /> : undefined}>
      {corps}
    </PagePublique>
  )
}
