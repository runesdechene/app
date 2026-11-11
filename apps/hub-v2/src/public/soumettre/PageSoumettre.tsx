/**
 * QUOI     — /soumettre-contenu : un client partage ce qu'il vit avec Runes de Chêne. Étape 1, il
 *            choisit : « Un avis » (son avis, puis des photos s'il veut, puis lui) ou « Des photos »
 *            (ses photos et leurs tailles, puis un avis s'il veut, puis lui). Le lien d'une mission
 *            (`?quete=<slug>`) ouvre directement les photos.
 * POURQUOI — le design de la page en ligne (ancien StudioSubmit), gardé par Uriel le 15/10 : sur PC,
 *            une carte à deux panneaux posée sur la photo du réglage Studio ; au téléphone, le
 *            formulaire seul, plein écran. Le chemin et l'étape sont dans l'adresse
 *            (`?chemin=avis&etape=3`) : le retour du navigateur revient d'un écran, et un écran tapé à
 *            la main n'ouvre jamais plus loin que ce qui est rempli.
 */
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { PagePublique } from '../PagePublique'
import { lireConfigStudio, lireMissions } from './api'
import { ChoixDuChemin } from './ChoixDuChemin'
import { EtapeAvis } from './EtapeAvis'
import { EtapeContenus } from './EtapeContenus'
import { EtapeTailles } from './EtapeTailles'
import { EtapeToi } from './EtapeToi'
import { Frise } from './Frise'
import {
  cheminDe,
  ecranAffiche,
  ETAPES,
  etapeDeLaFrise,
  HISTOIRE_VIDE,
  numeroDeLEcran,
  TOI_VIDE,
  VETEMENTS,
  voisin,
  type Chemin,
  type Contenu,
  type Ecran,
  type Histoire,
} from './lib/formulaire'
import { Succes } from './Succes'
import { useEnvoi } from './useEnvoi'
import styles from './PageSoumettre.module.css'

const TITRES: Record<Chemin | 'choix', string> = { choix: 'Partager ton aventure', avis: 'Ton avis', photos: 'Envoyer mes contenus' }

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
  const ecran = chemin && ecranAffiche(chemin, params.get('etape'), histoire, contenus)
  const avecPhotos = contenus.length > 0
  const quete = params.get('quete') ?? ''
  const mission = missions.data?.some((m) => m.slug === quete) ? quete : ''

  function allerA(c: Chemin, e: Ecran) {
    setParams((p) => {
      const suite = new URLSearchParams(p)
      suite.set('etape', String(numeroDeLEcran(c, e)))
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

  function revenirAuChoix() {
    setParams((p) => {
      const suite = new URLSearchParams(p)
      suite.delete('chemin')
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

  function changerHistoire(modif: Partial<Histoire>) {
    setHistoire((h) => ({ ...h, ...modif }))
  }

  /** Le panneau de l'écran en cours : chaque écran sait seulement aller au précédent et au suivant. */
  function panneau(c: Chemin, e: Ecran) {
    const surTitre = `Étape ${String(etapeDeLaFrise(c, e))} sur 4`
    const precedent = () => {
      const avant = voisin(c, e, -1, contenus)
      if (avant === e) revenirAuChoix()
      else allerA(c, avant)
    }
    const suivant = () => {
      allerA(c, voisin(c, e, 1, contenus))
    }
    switch (e) {
      case 'avis':
        return <EtapeAvis surTitre={surTitre} facultatif={c === 'photos'} histoire={histoire} changer={changerHistoire} precedent={precedent} suivant={suivant} />
      case 'photos':
        return (
          <EtapeContenus
            surTitre={surTitre}
            facultatif={c === 'avis'}
            missions={missions.data ?? []}
            mission={mission}
            choisirMission={choisirMission}
            contenus={contenus}
            ajouter={ajouter}
            retirer={retirer}
            precedent={precedent}
            suivant={suivant}
          />
        )
      case 'tailles':
        return <EtapeTailles surTitre={surTitre} contenus={contenus} choisirTaille={choisirTaille} precedent={precedent} suivant={suivant} />
      case 'toi':
        return (
          <EtapeToi
            avecPhotos={avecPhotos}
            toi={toi}
            changer={(modif) => {
              setToi((t) => ({ ...t, ...modif }))
            }}
            histoire={histoire}
            changerHistoire={changerHistoire}
            erreur={erreur}
            precedent={precedent}
            envoyer={() => {
              void envoyer(contenus, histoire, toi, mission).then((reussi) => {
                if (reussi) liberer(apercus)
              })
            }}
          />
        )
    }
  }

  const fond = config.data?.fond
  const colonne = config.data?.colonne
  const etapes = ETAPES[chemin ?? 'avis']
  const etape = chemin && ecran ? etapeDeLaFrise(chemin, ecran) : 1

  let corps
  if (reussite) {
    corps = <Succes reussite={reussite} couronnes={config.data?.couronnes ?? 0} avisSeul={!avecPhotos} />
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
            <h1 className={styles.titre}>{TITRES[chemin ?? 'choix']}</h1>
            <Frise etapes={etapes} etape={etape} sens="vertical" />
            <p className={styles.citation}>« On te guide pas à pas. Quelques minutes, et ce que tu partages rejoint le Mouvement. »</p>
          </div>
        </aside>

        <section className={styles.panneau}>
          <Frise etapes={etapes} etape={etape} sens="horizontal" />
          {chemin && ecran ? panneau(chemin, ecran) : <ChoixDuChemin choisir={choisirChemin} />}
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
